'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { referenceCode } = require('../utils/ids');
const { cleanQueryString, matchesSearch, pageParams, paginate } = require('../utils/query');
const { SEAT_STATUSES, seatsTaken } = require('./batchService');
const notifications = require('./notificationService');
const activity = require('./activityService');

const OPEN_STATUSES = ['pending', 'approved'];
const TRANSITIONS = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['completed', 'cancelled', 'pending'],
  rejected: ['pending'],
  cancelled: ['pending'],
  completed: [],
};

async function enrich(rows) {
  const [users, courses, batches, trainers] = await Promise.all([
    repos.users.all(), repos.courses.all(), repos.batches.all(), repos.trainers.all(),
  ]);
  return rows.map((e) => {
    const student = users.find((u) => u.id === e.studentId);
    const course = courses.find((c) => c.id === e.courseId);
    const batch = batches.find((b) => b.id === e.batchId);
    const trainer = trainers.find((t) => t.id === (batch ? batch.trainerId : course ? course.trainerId : null));
    return {
      ...e,
      studentName: student ? student.fullName : 'Unknown',
      studentEmail: student ? student.email : null,
      courseTitle: course ? course.title : 'Unknown course',
      courseSlug: course ? course.slug : null,
      courseDuration: course ? course.duration : null,
      batch: batch
        ? { id: batch.id, name: batch.name, startDate: batch.startDate, endDate: batch.endDate, startTime: batch.startTime, endTime: batch.endTime, days: batch.days, mode: batch.mode, location: batch.location, status: batch.status }
        : null,
      trainerName: trainer ? trainer.name : null,
    };
  });
}

async function request(user, { courseId, batchId, note }) {
  const course = await repos.courses.findById(courseId);
  if (!course || course.status !== 'active') throw ApiError.notFound('Course not found');
  if (!course.enrollmentOpen) throw ApiError.conflict('Enrollment for this course is currently closed', 'ENROLLMENT_CLOSED');
  let batch = null;
  if (batchId) {
    batch = await repos.batches.findById(batchId);
    if (!batch || batch.courseId !== courseId) throw ApiError.badRequest('Selected batch does not belong to this course', [{ field: 'batchId', message: 'Choose a batch for this course' }], 'VALIDATION_ERROR');
    if (!['upcoming', 'ongoing'].includes(batch.status)) throw ApiError.conflict('This batch is not accepting enrollments', 'BATCH_CLOSED');
  }
  const record = await repos.enrollments.mutate((rows) => {
    if (rows.some((e) => e.studentId === user.id && e.courseId === courseId && OPEN_STATUSES.includes(e.status))) {
      throw ApiError.conflict('You already have an active enrollment or request for this course', 'DUPLICATE_ENROLLMENT');
    }
    if (batch && seatsTaken(batch.id, rows) >= batch.capacity) {
      throw ApiError.conflict('This batch is full. Choose another batch or request without a batch.', 'BATCH_FULL');
    }
    const enrollment = repos.enrollments.build({
      studentId: user.id, courseId, batchId: batchId || null, note: note || null, status: 'pending',
      adminNote: null, certificateNo: null, completedAt: null,
      history: [{ status: 'pending', at: new Date().toISOString(), by: user.fullName }],
    });
    rows.push(enrollment);
    return structuredClone(enrollment);
  });
  await notifications.notify(user.id, { title: 'Enrollment request received', message: `We received your request for ${course.title}. You will be notified once it is reviewed.`, type: 'info', link: '/student/courses' });
  await notifications.notifyAdmins({ title: 'New enrollment request', message: `${user.fullName} requested ${course.title}.`, type: 'info', link: '/admin/enrollments' });
  await activity.log(user, 'requested', 'enrollment', record.id, `${user.fullName} requested enrollment in ${course.title}`);
  return (await enrich([record]))[0];
}

async function listMine(user) {
  const rows = await repos.enrollments.find((e) => e.studentId === user.id);
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return enrich(rows);
}

async function cancelMine(user, id) {
  const updated = await repos.enrollments.mutate((rows) => {
    const row = rows.find((e) => e.id === id && e.studentId === user.id);
    if (!row) throw ApiError.notFound('Enrollment not found');
    if (row.status !== 'pending') throw ApiError.conflict('Only pending requests can be withdrawn. Contact the institute for approved enrollments.', 'INVALID_STATUS');
    row.status = 'cancelled';
    row.history = [...(row.history || []), { status: 'cancelled', at: new Date().toISOString(), by: user.fullName }];
    row.updatedAt = new Date().toISOString();
    return structuredClone(row);
  });
  return (await enrich([updated]))[0];
}

async function adminList(query = {}) {
  let rows = await enrich(await repos.enrollments.all());
  const status = cleanQueryString(query.status);
  const courseId = cleanQueryString(query.courseId);
  if (status) rows = rows.filter((e) => e.status === status);
  if (courseId) rows = rows.filter((e) => e.courseId === courseId);
  rows = rows.filter((e) => matchesSearch(e, cleanQueryString(query.q), ['studentName', 'studentEmail', 'courseTitle']));
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(rows, pageParams(query));
}

async function adminUpdateStatus(id, { status, batchId, adminNote }, actor) {
  let batch = null;
  const existing = await repos.enrollments.findById(id);
  if (!existing) throw ApiError.notFound('Enrollment not found');
  const targetBatchId = batchId !== undefined ? batchId : existing.batchId;
  if (targetBatchId) {
    batch = await repos.batches.findById(targetBatchId);
    if (!batch || batch.courseId !== existing.courseId) throw ApiError.badRequest('Batch must belong to the enrolled course', [{ field: 'batchId', message: 'Invalid batch' }], 'VALIDATION_ERROR');
  }
  const course = await repos.courses.findById(existing.courseId);
  const updated = await repos.enrollments.mutate((rows) => {
    const row = rows.find((e) => e.id === id);
    const allowed = TRANSITIONS[row.status] || [];
    const batchChanged = targetBatchId !== row.batchId;
    if (status !== row.status && !allowed.includes(status)) {
      throw ApiError.conflict(`Cannot change an enrollment from ${row.status} to ${status}`, 'INVALID_TRANSITION');
    }
    if (status === 'completed' && !targetBatchId) {
      throw ApiError.badRequest('Assign a batch before marking the enrollment completed', [{ field: 'batchId', message: 'Batch required' }], 'VALIDATION_ERROR');
    }
    if (SEAT_STATUSES.includes(status) && batch && (batchChanged || !SEAT_STATUSES.includes(row.status))) {
      const taken = seatsTaken(batch.id, rows.filter((e) => e.id !== id));
      if (taken >= batch.capacity) throw ApiError.conflict(`Batch "${batch.name}" is full (${batch.capacity} seats)`, 'BATCH_FULL');
    }
    const now = new Date().toISOString();
    row.status = status;
    row.batchId = targetBatchId || null;
    if (adminNote !== undefined) row.adminNote = adminNote;
    if (status === 'completed' && !row.certificateNo) {
      row.certificateNo = referenceCode('CERT');
      row.completedAt = now;
    }
    row.history = [...(row.history || []), { status, at: now, by: actor.fullName, note: adminNote || null }];
    row.updatedAt = now;
    return structuredClone(row);
  });
  const messages = {
    approved: `Your enrollment in ${course ? course.title : 'the course'} has been approved${batch ? ` (batch: ${batch.name}, starts ${batch.startDate})` : ''}.`,
    rejected: `Your enrollment request for ${course ? course.title : 'the course'} was not approved.${adminNote ? ` Note: ${adminNote}` : ''}`,
    completed: `Congratulations! You completed ${course ? course.title : 'the course'}. Your completion record is now available.`,
    cancelled: `Your enrollment in ${course ? course.title : 'the course'} was cancelled.`,
    pending: `Your enrollment for ${course ? course.title : 'the course'} is back under review.`,
  };
  await notifications.notify(updated.studentId, { title: `Enrollment ${status}`, message: messages[status], type: status === 'rejected' || status === 'cancelled' ? 'warning' : 'success', link: '/student/courses' });
  await activity.log(actor, `enrollment_${status}`, 'enrollment', id, `Enrollment for ${course ? course.title : id} set to ${status}`);
  return (await enrich([updated]))[0];
}

module.exports = { request, listMine, cancelMine, adminList, adminUpdateStatus, enrich };
