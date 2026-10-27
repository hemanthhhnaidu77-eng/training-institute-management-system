'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { referenceCode } = require('../utils/ids');
const { nowInZone } = require('../utils/dates');
const { isValidDate } = require('../utils/validate');
const { cleanQueryString, matchesSearch, pageParams, paginate } = require('../utils/query');
const settingsService = require('./settingsService');
const notifications = require('./notificationService');
const activity = require('./activityService');
const { ACTIVE_STATUSES, computeAvailability, hasDuplicate } = require('./appointmentRules');

async function bookingContext(trainerId) {
  const settings = await settingsService.get();
  let trainer = null;
  if (trainerId) {
    trainer = await repos.trainers.findById(trainerId);
    if (!trainer || trainer.isActive === false) {
      throw ApiError.badRequest('Selected trainer is not available', [{ field: 'trainerId', message: 'Choose another trainer' }], 'VALIDATION_ERROR');
    }
  }
  return { settings: settings.appointment, timezone: settings.timezone, trainer, now: nowInZone(settings.timezone) };
}

async function availability(query) {
  const date = cleanQueryString(query.date, 10);
  const trainerId = cleanQueryString(query.trainerId, 64) || null;
  if (!isValidDate(date)) throw ApiError.badRequest('A valid date (YYYY-MM-DD) is required', [{ field: 'date', message: 'Invalid date' }], 'VALIDATION_ERROR');
  const ctx = await bookingContext(trainerId);
  const result = computeAvailability({ date, trainer: ctx.trainer, appointments: await repos.appointments.all(), settings: ctx.settings, now: ctx.now });
  return { ...result, trainerId, slotMinutes: ctx.settings.slotMinutes, timezone: ctx.timezone };
}

async function enrich(rows) {
  const [courses, services, trainers] = await Promise.all([repos.courses.all(), repos.services.all(), repos.trainers.all()]);
  return rows.map((a) => ({
    ...a,
    courseTitle: (courses.find((c) => c.id === a.courseId) || {}).title || null,
    serviceTitle: (services.find((s) => s.id === a.serviceId) || {}).title || null,
    trainerName: (trainers.find((t) => t.id === a.trainerId) || {}).name || null,
  }));
}

function unavailableError(check, time) {
  const slot = check.slots.find((s) => s.time === time);
  const alternatives = check.slots.filter((s) => s.available).map((s) => s.time);
  const reason = check.dayOpen ? (slot ? slot.reason : 'Invalid time slot') : check.reason;
  return ApiError.conflict(
    `The ${time} slot on ${check.date} is unavailable (${reason}).${alternatives.length ? ` Available: ${alternatives.join(', ')}.` : ' Please choose another date.'}`,
    'SLOT_UNAVAILABLE',
    { reason, alternatives }
  );
}

/** Checks the slot against the freshest data; must be called inside the appointments critical section. */
function assertBookable(rows, ctx, { date, time, email, excludeId }) {
  const check = computeAvailability({ date, trainer: ctx.trainer, appointments: rows, settings: ctx.settings, now: ctx.now, excludeId });
  const slot = check.slots.find((s) => s.time === time);
  if (!slot || !slot.available) throw unavailableError(check, time);
  if (email && hasDuplicate({ appointments: rows, email, date, time, minutes: ctx.settings.slotMinutes, excludeId })) {
    throw ApiError.conflict('You already have an appointment at this time. Choose a different slot.', 'DUPLICATE_BOOKING');
  }
}

async function create(input, user) {
  const errors = [];
  if (input.courseId && !(await repos.courses.findById(input.courseId))) errors.push({ field: 'courseId', message: 'Select a valid course' });
  if (input.serviceId && !(await repos.services.findById(input.serviceId))) errors.push({ field: 'serviceId', message: 'Select a valid service' });
  if (errors.length) throw ApiError.badRequest('Please correct the highlighted fields', errors, 'VALIDATION_ERROR');
  const ctx = await bookingContext(input.trainerId);
  const now = new Date().toISOString();

  // Check + insert happen inside one serialised section so two requests can never take the same slot.
  const record = await repos.appointments.mutate((rows) => {
    assertBookable(rows, ctx, { date: input.date, time: input.time, email: input.email });
    let appointmentNo;
    do appointmentNo = referenceCode('APT', new Date(), 6);
    while (rows.some((r) => r.appointmentNo === appointmentNo));
    const appointment = repos.appointments.build({
      appointmentNo,
      userId: user && user.role === 'student' ? user.id : null,
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      courseId: input.courseId || null,
      serviceId: input.serviceId || null,
      trainerId: input.trainerId || null,
      date: input.date,
      time: input.time,
      durationMinutes: ctx.settings.slotMinutes,
      mode: input.mode,
      message: input.message || null,
      status: 'pending',
      requestedAction: null,
      adminNote: null,
      statusHistory: [{ status: 'pending', at: now, by: user ? user.fullName : input.fullName, note: 'Booking received' }],
    });
    rows.push(appointment);
    return structuredClone(appointment);
  });

  if (record.userId) {
    await notifications.notify(record.userId, { title: 'Appointment requested', message: `Booking ${record.appointmentNo} for ${record.date} at ${record.time} is pending confirmation.`, type: 'info', link: '/student/appointments' });
  }
  if (ctx.trainer && ctx.trainer.userId) {
    await notifications.notify(ctx.trainer.userId, { title: 'New appointment request', message: `${record.fullName} booked ${record.date} at ${record.time}.`, type: 'info', link: '/trainer/appointments' });
  }
  await notifications.notifyAdmins({ title: 'New appointment', message: `${record.fullName} booked ${record.date} ${record.time} (${record.appointmentNo}).`, type: 'info', link: '/admin/appointments' });
  await activity.log(user || null, 'booked', 'appointment', record.id, `Appointment ${record.appointmentNo} booked by ${record.fullName}`);
  return (await enrich([record]))[0];
}

function canView(appointment, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'student') return appointment.userId === user.id;
  if (user.role === 'trainer') return Boolean(user.trainerId) && appointment.trainerId === user.trainerId;
  return false;
}

async function getForUser(id, user) {
  const appointment = await repos.appointments.findById(id);
  if (!appointment || !canView(appointment, user)) throw ApiError.notFound('Appointment not found');
  return (await enrich([appointment]))[0];
}

async function listMine(user, query = {}) {
  let rows = await repos.appointments.find((a) => a.userId === user.id);
  const status = cleanQueryString(query.status);
  if (status) rows = rows.filter((a) => a.status === status);
  rows.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  return enrich(rows);
}

function pushHistory(row, status, by, note) {
  const at = new Date().toISOString();
  row.statusHistory = [...(row.statusHistory || []), { status, at, by, note: note || null }];
  row.status = status;
  row.updatedAt = at;
}

/** Owner cancels: pending bookings are cancelled immediately, confirmed ones create a request. */
async function cancelByOwner(id, user, { reason }) {
  const result = await repos.appointments.mutate((rows) => {
    const row = rows.find((a) => a.id === id && a.userId === user.id);
    if (!row) throw ApiError.notFound('Appointment not found');
    if (!ACTIVE_STATUSES.includes(row.status)) throw ApiError.conflict(`A ${row.status} appointment cannot be cancelled`, 'INVALID_STATUS');
    if (row.status === 'pending') {
      pushHistory(row, 'cancelled', user.fullName, reason || 'Cancelled by student');
      row.requestedAction = null;
      return { row: structuredClone(row), immediate: true };
    }
    row.requestedAction = { type: 'cancel', reason: reason || null, requestedAt: new Date().toISOString() };
    row.updatedAt = new Date().toISOString();
    return { row: structuredClone(row), immediate: false };
  });
  await notifications.notifyAdmins({
    title: result.immediate ? 'Appointment cancelled' : 'Cancellation requested',
    message: `${result.row.fullName}: ${result.row.appointmentNo} (${result.row.date} ${result.row.time}).`,
    type: 'warning',
    link: '/admin/appointments',
  });
  return { ...(await enrich([result.row]))[0], immediate: result.immediate };
}

/** Owner reschedules: pending bookings move immediately (after conflict check); confirmed ones create a request. */
async function rescheduleByOwner(id, user, { date, time, reason }) {
  const existing = await repos.appointments.findById(id);
  if (!existing || existing.userId !== user.id) throw ApiError.notFound('Appointment not found');
  const ctx = await bookingContext(existing.trainerId);
  const result = await repos.appointments.mutate((rows) => {
    const row = rows.find((a) => a.id === id);
    if (!ACTIVE_STATUSES.includes(row.status)) throw ApiError.conflict(`A ${row.status} appointment cannot be rescheduled`, 'INVALID_STATUS');
    if (row.date === date && row.time === time) throw ApiError.badRequest('Choose a different date or time', undefined, 'NO_CHANGE');
    assertBookable(rows, ctx, { date, time, email: row.email, excludeId: id });
    if (row.status === 'pending') {
      row.date = date;
      row.time = time;
      row.requestedAction = null;
      pushHistory(row, 'pending', user.fullName, `Moved to ${date} ${time}${reason ? `: ${reason}` : ''}`);
      return { row: structuredClone(row), immediate: true };
    }
    row.requestedAction = { type: 'reschedule', date, time, reason: reason || null, requestedAt: new Date().toISOString() };
    row.updatedAt = new Date().toISOString();
    return { row: structuredClone(row), immediate: false };
  });
  await notifications.notifyAdmins({
    title: result.immediate ? 'Appointment moved' : 'Reschedule requested',
    message: `${result.row.fullName}: ${result.row.appointmentNo} -> ${date} ${time}.`,
    type: 'info',
    link: '/admin/appointments',
  });
  return { ...(await enrich([result.row]))[0], immediate: result.immediate };
}

async function adminList(query = {}) {
  let rows = await enrich(await repos.appointments.all());
  const f = (k) => cleanQueryString(query[k]);
  if (f('status')) rows = rows.filter((a) => a.status === f('status'));
  if (f('trainerId')) rows = rows.filter((a) => a.trainerId === f('trainerId'));
  if (f('courseId')) rows = rows.filter((a) => a.courseId === f('courseId'));
  if (f('date')) rows = rows.filter((a) => a.date === f('date'));
  if (f('from')) rows = rows.filter((a) => a.date >= f('from'));
  if (f('to')) rows = rows.filter((a) => a.date <= f('to'));
  if (query.hasRequest === 'true') rows = rows.filter((a) => a.requestedAction);
  rows = rows.filter((a) => matchesSearch(a, f('q'), ['appointmentNo', 'fullName', 'email', 'mobile', 'courseTitle', 'trainerName']));
  const dir = f('sort') === 'oldest' ? 1 : -1;
  rows.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) * dir);
  return paginate(rows, pageParams(query));
}

const ACTION_RULES = {
  confirm: { from: ['pending'], to: 'confirmed' },
  reject: { from: ['pending'], to: 'cancelled' },
  cancel: { from: ACTIVE_STATUSES, to: 'cancelled' },
  complete: { from: ['confirmed', 'rescheduled'], to: 'completed' },
  reschedule: { from: ACTIVE_STATUSES, to: 'rescheduled' },
  dismiss_request: { from: ACTIVE_STATUSES, to: null },
};

async function applyAction(id, { action, date, time, note }, actor, { trainerScope = null } = {}) {
  const existing = await repos.appointments.findById(id);
  if (!existing || (trainerScope && existing.trainerId !== trainerScope)) throw ApiError.notFound('Appointment not found');
  const rule = ACTION_RULES[action];
  let ctx = null;
  if (action === 'reschedule') {
    const target = { date: date || (existing.requestedAction && existing.requestedAction.date), time: time || (existing.requestedAction && existing.requestedAction.time) };
    if (!target.date || !target.time) throw ApiError.badRequest('New date and time are required to reschedule', [{ field: 'date', message: 'Required' }], 'VALIDATION_ERROR');
    date = target.date;
    time = target.time;
    ctx = await bookingContext(existing.trainerId);
  }
  const updated = await repos.appointments.mutate((rows) => {
    const row = rows.find((a) => a.id === id);
    if (!rule.from.includes(row.status)) throw ApiError.conflict(`Cannot ${action.replace('_', ' ')} an appointment that is ${row.status}`, 'INVALID_TRANSITION');
    if (action === 'dismiss_request') {
      if (!row.requestedAction) throw ApiError.conflict('There is no pending request on this appointment', 'NO_REQUEST');
      row.requestedAction = null;
      row.statusHistory = [...(row.statusHistory || []), { status: row.status, at: new Date().toISOString(), by: actor.fullName, note: note || 'Request declined' }];
      row.updatedAt = new Date().toISOString();
      return structuredClone(row);
    }
    if (action === 'reschedule') {
      assertBookable(rows, ctx, { date, time, email: row.email, excludeId: id });
      row.date = date;
      row.time = time;
    }
    const defaultNotes = { reject: 'Rejected by institute', cancel: row.requestedAction && row.requestedAction.type === 'cancel' ? 'Cancellation request approved' : 'Cancelled by institute', reschedule: `Moved to ${date} ${time}` };
    pushHistory(row, rule.to, actor.fullName, note || defaultNotes[action]);
    if (note) row.adminNote = note;
    row.requestedAction = null;
    return structuredClone(row);
  });
  const userMessages = {
    confirm: `Your appointment ${updated.appointmentNo} on ${updated.date} at ${updated.time} is confirmed.`,
    reject: `Your appointment ${updated.appointmentNo} could not be accommodated.${note ? ` ${note}` : ''}`,
    cancel: `Your appointment ${updated.appointmentNo} has been cancelled.`,
    complete: `Thanks for attending appointment ${updated.appointmentNo}.`,
    reschedule: `Your appointment ${updated.appointmentNo} was moved to ${updated.date} at ${updated.time}.`,
    dismiss_request: `Your request for appointment ${updated.appointmentNo} was declined.${note ? ` ${note}` : ''}`,
  };
  if (updated.userId) {
    await notifications.notify(updated.userId, { title: 'Appointment update', message: userMessages[action], type: ['reject', 'cancel', 'dismiss_request'].includes(action) ? 'warning' : 'success', link: '/student/appointments' });
  }
  await activity.log(actor, `appointment_${action}`, 'appointment', id, `Appointment ${updated.appointmentNo}: ${action.replace('_', ' ')}`);
  return (await enrich([updated]))[0];
}

async function listForTrainer(user, query = {}) {
  if (!user.trainerId) return [];
  let rows = await repos.appointments.find((a) => a.trainerId === user.trainerId);
  const status = cleanQueryString(query.status);
  if (status) rows = rows.filter((a) => a.status === status);
  rows.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return enrich(rows);
}

module.exports = { availability, create, getForUser, listMine, cancelByOwner, rescheduleByOwner, adminList, applyAction, listForTrainer, enrich, ACTIVE_STATUSES };
