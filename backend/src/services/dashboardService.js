'use strict';
const { repos } = require('../storage');
const { nowInZone, dayName, addDays } = require('../utils/dates');
const { publicUser } = require('../utils/sanitize');
const enrollmentService = require('./enrollmentService');
const appointmentService = require('./appointmentService');
const activity = require('./activityService');
const { batchView } = require('./batchService');

const ACTIVE_APPT = appointmentService.ACTIVE_STATUSES;

/** Expands batch weekly schedules into concrete class sessions for the next N days. */
function upcomingClasses(batches, fromDate, days = 14) {
  const sessions = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(fromDate, i);
    const day = dayName(date);
    for (const b of batches) {
      if (!['upcoming', 'ongoing'].includes(b.status)) continue;
      if (date < b.startDate || date > b.endDate) continue;
      if (!(b.days || []).includes(day)) continue;
      sessions.push({ date, day, startTime: b.startTime, endTime: b.endTime, batchId: b.id, batchName: b.name, courseTitle: b.courseTitle, trainerName: b.trainerName, mode: b.mode, location: b.location || null });
    }
  }
  return sessions.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

async function batchContext() {
  const [batches, courses, trainers, enrollments] = await Promise.all([repos.batches.all(), repos.courses.all(), repos.trainers.all(), repos.enrollments.all()]);
  return { batches, ctx: { courses, trainers, enrollments } };
}

async function student(user) {
  const today = nowInZone().date;
  const [enrollments, appointments, notifications, inquiries, { batches, ctx }] = await Promise.all([
    enrollmentService.listMine(user),
    appointmentService.listMine(user),
    repos.notifications.find((n) => n.userId === user.id),
    repos.inquiries.find((i) => i.userId === user.id || i.email === user.email),
    batchContext(),
  ]);
  const myBatchIds = enrollments.filter((e) => e.status === 'approved' && e.batchId).map((e) => e.batchId);
  const myBatches = batches.filter((b) => myBatchIds.includes(b.id)).map((b) => batchView(b, ctx));
  const upcomingAppointments = appointments.filter((a) => ACTIVE_APPT.includes(a.status) && a.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const classes = upcomingClasses(myBatches, today, 14);
  return {
    stats: {
      enrolledCourses: enrollments.filter((e) => e.status === 'approved').length,
      pendingEnrollments: enrollments.filter((e) => e.status === 'pending').length,
      completedCourses: enrollments.filter((e) => e.status === 'completed').length,
      upcomingAppointments: upcomingAppointments.length,
      upcomingClasses: classes.length,
      pendingInquiries: inquiries.filter((i) => ['new', 'in_progress'].includes(i.status)).length,
      unreadNotifications: notifications.filter((n) => !n.isRead).length,
    },
    nextAppointments: upcomingAppointments.slice(0, 5),
    nextClasses: classes.slice(0, 6),
    enrollments: enrollments.slice(0, 5),
    notifications: notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
  };
}

async function schedule(user) {
  const today = nowInZone().date;
  const enrollments = await repos.enrollments.find((e) => e.studentId === user.id && e.status === 'approved' && e.batchId);
  const { batches, ctx } = await batchContext();
  const mine = batches.filter((b) => enrollments.some((e) => e.batchId === b.id)).map((b) => batchView(b, ctx));
  return { batches: mine, sessions: upcomingClasses(mine, today, 28) };
}

async function admin() {
  const today = nowInZone().date;
  const [users, trainers, courses, appointments, inquiries, enrollments, reviews, { batches, ctx }] = await Promise.all([
    repos.users.all(), repos.trainers.all(), repos.courses.all(), appointmentService.enrich(await repos.appointments.all()),
    repos.inquiries.all(), repos.enrollments.all(), repos.reviews.all(), batchContext(),
  ]);
  const students = users.filter((u) => u.role === 'student');
  const count = (rows, status) => rows.filter((r) => r.status === status).length;
  const months = [];
  const base = new Date(`${today}T00:00:00Z`);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    months.push({ month: key, registrations: students.filter((s) => s.createdAt.startsWith(key)).length, enrollments: enrollments.filter((e) => e.createdAt.startsWith(key)).length, appointments: appointments.filter((a) => a.createdAt.startsWith(key)).length });
  }
  const upcomingSessions = upcomingClasses(batches.map((b) => batchView(b, ctx)), today, 7).slice(0, 8);
  return {
    stats: {
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.isActive).length,
      totalTrainers: trainers.filter((t) => t.isActive !== false).length,
      activeCourses: courses.filter((c) => c.status === 'active').length,
      totalAppointments: appointments.length,
      pendingAppointments: count(appointments, 'pending'),
      confirmedAppointments: count(appointments, 'confirmed') + count(appointments, 'rescheduled'),
      appointmentRequests: appointments.filter((a) => a.requestedAction).length,
      totalInquiries: inquiries.length,
      openInquiries: inquiries.filter((i) => ['new', 'in_progress'].includes(i.status)).length,
      pendingEnrollments: count(enrollments, 'pending'),
      pendingReviews: count(reviews, 'pending'),
      activeBatches: batches.filter((b) => ['upcoming', 'ongoing'].includes(b.status)).length,
    },
    trend: months,
    recentRegistrations: students.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6).map(publicUser),
    upcomingAppointments: appointments.filter((a) => ACTIVE_APPT.includes(a.status) && a.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 6),
    upcomingSessions,
    recentActivity: await activity.recent(12),
  };
}

async function trainer(user) {
  const today = nowInZone().date;
  if (!user.trainerId) return { stats: {}, profileMissing: true };
  const [profile, courses, appointments, { batches, ctx }, sessions, notifications] = await Promise.all([
    repos.trainers.findById(user.trainerId),
    repos.courses.find((c) => c.status !== 'archived'),
    appointmentService.listForTrainer(user),
    batchContext(),
    repos.sessionRecords.find((s) => s.trainerId === user.trainerId),
    repos.notifications.find((n) => n.userId === user.id && !n.isRead),
  ]);
  const myCourses = courses.filter((c) => c.trainerId === user.trainerId || ((profile && profile.courseIds) || []).includes(c.id));
  const myBatches = batches.filter((b) => b.trainerId === user.trainerId).map((b) => batchView(b, ctx));
  const studentIds = new Set(ctx.enrollments.filter((e) => myBatches.some((b) => b.id === e.batchId) && ['approved', 'completed'].includes(e.status)).map((e) => e.studentId));
  const upcomingAppts = appointments.filter((a) => ACTIVE_APPT.includes(a.status) && a.date >= today);
  return {
    stats: {
      assignedCourses: myCourses.length,
      activeBatches: myBatches.filter((b) => ['upcoming', 'ongoing'].includes(b.status)).length,
      students: studentIds.size,
      upcomingAppointments: upcomingAppts.length,
      pendingAppointments: appointments.filter((a) => a.status === 'pending').length,
      sessionsRecorded: sessions.length,
      unreadNotifications: notifications.length,
    },
    nextAppointments: upcomingAppts.slice(0, 5),
    nextClasses: upcomingClasses(myBatches, today, 7).slice(0, 6),
  };
}

module.exports = { student, schedule, admin, trainer, upcomingClasses };
