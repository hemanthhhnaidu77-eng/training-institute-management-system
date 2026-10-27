'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { cleanQueryString, matchesSearch } = require('../utils/query');
const { toMinutes } = require('../utils/dates');
const activity = require('./activityService');

const SEAT_STATUSES = ['approved', 'completed'];

function seatsTaken(batchId, enrollments) {
  return enrollments.filter((e) => e.batchId === batchId && SEAT_STATUSES.includes(e.status)).length;
}

function batchView(batch, { courses, trainers, enrollments }) {
  const course = courses.find((c) => c.id === batch.courseId);
  const trainer = trainers.find((t) => t.id === batch.trainerId);
  const taken = seatsTaken(batch.id, enrollments);
  return {
    ...batch,
    courseTitle: course ? course.title : 'Unknown course',
    courseSlug: course ? course.slug : null,
    courseDuration: course ? course.duration : null,
    trainerName: trainer ? trainer.name : 'To be announced',
    seatsTaken: taken,
    availableSeats: Math.max(batch.capacity - taken, 0),
    isFull: taken >= batch.capacity,
  };
}

async function context() {
  const [courses, trainers, enrollments] = await Promise.all([repos.courses.all(), repos.trainers.all(), repos.enrollments.all()]);
  return { courses, trainers, enrollments };
}

async function list(query = {}, { isAdmin = false } = {}) {
  const ctx = await context();
  let rows = await repos.batches.all();
  const courseId = cleanQueryString(query.courseId);
  const trainerId = cleanQueryString(query.trainerId);
  const status = cleanQueryString(query.status);
  const mode = cleanQueryString(query.mode);
  if (!isAdmin) rows = rows.filter((b) => b.status !== 'cancelled');
  if (courseId) rows = rows.filter((b) => b.courseId === courseId);
  if (trainerId) rows = rows.filter((b) => b.trainerId === trainerId);
  if (status) rows = rows.filter((b) => b.status === status);
  if (mode) rows = rows.filter((b) => b.mode === mode);
  let items = rows.map((b) => batchView(b, ctx));
  items = items.filter((b) => matchesSearch(b, cleanQueryString(query.q), ['name', 'courseTitle', 'trainerName']));
  items.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return items;
}

async function get(id) {
  const batch = await repos.batches.findById(id);
  if (!batch) throw ApiError.notFound('Batch not found');
  return batchView(batch, await context());
}

async function validateRefs(data, existing = {}) {
  const merged = { ...existing, ...data };
  const errors = [];
  if (merged.courseId && !(await repos.courses.findById(merged.courseId))) errors.push({ field: 'courseId', message: 'Select a valid course' });
  if (merged.trainerId && !(await repos.trainers.findById(merged.trainerId))) errors.push({ field: 'trainerId', message: 'Select a valid trainer' });
  if (merged.startDate && merged.endDate && merged.endDate < merged.startDate) errors.push({ field: 'endDate', message: 'End date must be on or after the start date' });
  if (merged.startTime && merged.endTime && toMinutes(merged.endTime) <= toMinutes(merged.startTime)) errors.push({ field: 'endTime', message: 'End time must be after start time' });
  if (errors.length) throw ApiError.badRequest('Please correct the highlighted fields', errors, 'VALIDATION_ERROR');
}

async function create(data, actor) {
  await validateRefs(data);
  const record = await repos.batches.create({ trainerId: null, location: null, notes: null, ...data });
  await activity.log(actor, 'created', 'batch', record.id, `Batch "${record.name}" created`);
  return get(record.id);
}

async function update(id, data, actor) {
  const existing = await repos.batches.findById(id);
  if (!existing) throw ApiError.notFound('Batch not found');
  await validateRefs(data, existing);
  if (data.capacity !== undefined) {
    const taken = seatsTaken(id, await repos.enrollments.all());
    if (data.capacity < taken) {
      throw ApiError.badRequest(`Capacity cannot be lower than the ${taken} seats already allocated`, [{ field: 'capacity', message: `Minimum ${taken}` }], 'VALIDATION_ERROR');
    }
  }
  await repos.batches.update(id, data);
  await activity.log(actor, 'updated', 'batch', id, `Batch "${existing.name}" updated`);
  return get(id);
}

async function remove(id, actor) {
  const existing = await repos.batches.findById(id);
  if (!existing) throw ApiError.notFound('Batch not found');
  const linked = await repos.enrollments.find((e) => e.batchId === id && e.status !== 'rejected' && e.status !== 'cancelled');
  if (linked.length) throw ApiError.conflict('Students are assigned to this batch. Set its status to "cancelled" instead.', 'BATCH_IN_USE');
  await repos.batches.remove(id);
  await activity.log(actor, 'deleted', 'batch', id, `Batch "${existing.name}" deleted`);
  return { deleted: true };
}

module.exports = { list, get, create, update, remove, batchView, seatsTaken, SEAT_STATUSES };
