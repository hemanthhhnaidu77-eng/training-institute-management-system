'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { nowInZone } = require('../utils/dates');
const { batchView } = require('./batchService');
const { upcomingClasses } = require('./dashboardService');
const activity = require('./activityService');

function requireTrainer(user) {
  if (!user.trainerId) throw ApiError.forbidden('No trainer profile is linked to this account', 'NO_TRAINER_PROFILE');
  return user.trainerId;
}

async function context() {
  const [courses, trainers, enrollments, batches, users] = await Promise.all([repos.courses.all(), repos.trainers.all(), repos.enrollments.all(), repos.batches.all(), repos.users.all()]);
  return { courses, trainers, enrollments, batches, users };
}

async function courses(user) {
  const trainerId = requireTrainer(user);
  const [ctx, profile] = await Promise.all([context(), repos.trainers.findById(trainerId)]);
  return ctx.courses
    .filter((c) => c.status !== 'archived' && (c.trainerId === trainerId || ((profile && profile.courseIds) || []).includes(c.id)))
    .map((c) => ({
      id: c.id, title: c.title, slug: c.slug, category: c.category, level: c.level, mode: c.mode, duration: c.duration, status: c.status, syllabus: c.syllabus,
      isPrimaryTrainer: c.trainerId === trainerId,
      batchCount: ctx.batches.filter((b) => b.courseId === c.id && b.trainerId === trainerId).length,
    }));
}

async function batches(user) {
  const trainerId = requireTrainer(user);
  const ctx = await context();
  return ctx.batches.filter((b) => b.trainerId === trainerId).map((b) => batchView(b, ctx)).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Only students enrolled in this trainer's batches, with minimal contact data. */
async function students(user) {
  const trainerId = requireTrainer(user);
  const ctx = await context();
  const myBatches = ctx.batches.filter((b) => b.trainerId === trainerId);
  const rows = [];
  for (const e of ctx.enrollments) {
    const batch = myBatches.find((b) => b.id === e.batchId);
    if (!batch || !['approved', 'completed'].includes(e.status)) continue;
    const student = ctx.users.find((u) => u.id === e.studentId);
    if (!student) continue;
    const course = ctx.courses.find((c) => c.id === e.courseId);
    rows.push({ enrollmentId: e.id, studentId: student.id, fullName: student.fullName, email: student.email, batchId: batch.id, batchName: batch.name, courseTitle: course ? course.title : '', status: e.status });
  }
  return rows.sort((a, b) => a.batchName.localeCompare(b.batchName) || a.fullName.localeCompare(b.fullName));
}

async function schedule(user) {
  const list = await batches(user);
  return { batches: list, sessions: upcomingClasses(list, nowInZone().date, 28) };
}

async function listSessions(user) {
  const trainerId = requireTrainer(user);
  const [rows, all] = await Promise.all([repos.sessionRecords.find((s) => s.trainerId === trainerId), repos.batches.all()]);
  return rows.map((r) => ({ ...r, batchName: (all.find((b) => b.id === r.batchId) || {}).name || null })).sort((a, b) => b.date.localeCompare(a.date));
}

async function recordSession(user, data) {
  const trainerId = requireTrainer(user);
  const batch = await repos.batches.findById(data.batchId);
  if (!batch || batch.trainerId !== trainerId) throw ApiError.forbidden('You can only record sessions for your own batches', 'NOT_YOUR_BATCH');
  if (data.date > nowInZone().date) throw ApiError.badRequest('Session date cannot be in the future', [{ field: 'date', message: 'Choose today or a past date' }], 'VALIDATION_ERROR');
  const record = await repos.sessionRecords.create({ ...data, trainerId, notes: data.notes || null, attendeesCount: data.attendeesCount ?? null });
  await activity.log(user, 'session_recorded', 'session', record.id, `Session "${record.topic}" recorded for ${batch.name}`);
  return { ...record, batchName: batch.name };
}

module.exports = { courses, batches, students, schedule, listSessions, recordSession };
