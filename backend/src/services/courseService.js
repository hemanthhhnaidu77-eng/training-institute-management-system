'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../utils/ids');
const { matchesSearch, paginate, cleanQueryString } = require('../utils/query');
const { publicTrainer } = require('../utils/sanitize');
const activity = require('./activityService');
const { batchView } = require('./batchService');

function effectiveFee(course) {
  return course.discountedFee != null && course.discountedFee < course.fee ? course.discountedFee : course.fee;
}

function summarize(course, ctx) {
  const trainer = ctx.trainers.find((t) => t.id === course.trainerId);
  const reviews = ctx.reviews.filter((r) => r.courseId === course.id && r.status === 'approved');
  const upcoming = ctx.batches.filter((b) => b.courseId === course.id && ['upcoming', 'ongoing'].includes(b.status));
  const enrolledCount = ctx.enrollments.filter((e) => e.courseId === course.id && ['approved', 'completed'].includes(e.status)).length;
  return {
    ...course,
    effectiveFee: effectiveFee(course),
    trainerName: trainer ? trainer.name : null,
    batchCount: upcoming.length,
    enrolledCount,
    rating: reviews.length ? Number((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)) : null,
    reviewCount: reviews.length,
  };
}

async function context() {
  const [trainers, reviews, batches, enrollments] = await Promise.all([
    repos.trainers.all(), repos.reviews.all(), repos.batches.all(), repos.enrollments.all(),
  ]);
  return { trainers, reviews, batches, enrollments };
}

async function list(query = {}, { isAdmin = false } = {}) {
  const ctx = await context();
  let rows = await repos.courses.all();
  const status = cleanQueryString(query.status);
  if (!isAdmin) rows = rows.filter((c) => c.status === 'active');
  else if (status) rows = rows.filter((c) => c.status === status);
  const q = cleanQueryString(query.q);
  const category = cleanQueryString(query.category);
  const level = cleanQueryString(query.level);
  const mode = cleanQueryString(query.mode);
  rows = rows.filter((c) => matchesSearch(c, q, ['title', 'category', 'shortDescription', 'syllabus']));
  if (category) rows = rows.filter((c) => c.category === category);
  if (level) rows = rows.filter((c) => c.level === level);
  if (mode) rows = rows.filter((c) => c.mode === mode || (mode !== 'Hybrid' && c.mode === 'Hybrid'));
  if (query.featured === 'true') rows = rows.filter((c) => c.featured);
  let items = rows.map((c) => summarize(c, ctx));
  const sorters = {
    title: (a, b) => a.title.localeCompare(b.title),
    fee_asc: (a, b) => a.effectiveFee - b.effectiveFee,
    fee_desc: (a, b) => b.effectiveFee - a.effectiveFee,
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    popular: (a, b) => b.enrolledCount - a.enrolledCount || Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title),
  };
  items.sort(sorters[cleanQueryString(query.sort)] || sorters.popular);
  const categories = [...new Set((await repos.courses.all()).filter((c) => isAdmin || c.status === 'active').map((c) => c.category))].sort();
  if (query.page || query.limit) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);
    const result = paginate(items, { page, limit });
    return { items: result.items, meta: { ...result.meta, categories } };
  }
  return { items, meta: { total: items.length, categories } };
}

async function get(idOrSlug, { isAdmin = false } = {}) {
  const course = await repos.courses.findOne((c) => c.id === idOrSlug || c.slug === idOrSlug);
  if (!course || (!isAdmin && course.status !== 'active')) throw ApiError.notFound('Course not found');
  const ctx = await context();
  const trainer = ctx.trainers.find((t) => t.id === course.trainerId);
  const courses = await repos.courses.all();
  const batches = ctx.batches
    .filter((b) => b.courseId === course.id && ['upcoming', 'ongoing'].includes(b.status))
    .map((b) => batchView(b, { courses, trainers: ctx.trainers, enrollments: ctx.enrollments }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { ...summarize(course, ctx), trainer: publicTrainer(trainer), batches };
}

async function assertRefs(data) {
  if (data.trainerId) {
    const trainer = await repos.trainers.findById(data.trainerId);
    if (!trainer) throw ApiError.badRequest('Trainer not found', [{ field: 'trainerId', message: 'Select a valid trainer' }], 'VALIDATION_ERROR');
  }
}

function assertFees(fee, discountedFee) {
  if (discountedFee != null && fee != null && discountedFee > fee) {
    throw ApiError.badRequest('Discounted fee cannot exceed the regular fee', [{ field: 'discountedFee', message: 'Must be less than or equal to the fee' }], 'VALIDATION_ERROR');
  }
}

async function create(data, actor) {
  await assertRefs(data);
  assertFees(data.fee, data.discountedFee);
  const record = await repos.courses.mutate((rows) => {
    let slug = data.slug || slugify(data.title);
    const base = slug;
    let n = 2;
    while (rows.some((c) => c.slug === slug)) slug = `${base}-${n++}`;
    const course = repos.courses.build({ discountedFee: null, imageUrl: null, trainerId: null, ...data, slug });
    rows.push(course);
    return structuredClone(course);
  });
  await activity.log(actor, 'created', 'course', record.id, `Course "${record.title}" created`);
  return record;
}

async function update(id, data, actor) {
  const existing = await repos.courses.findById(id);
  if (!existing) throw ApiError.notFound('Course not found');
  if (!data.slug) delete data.slug; // an empty slug keeps the current one
  await assertRefs(data);
  assertFees(data.fee ?? existing.fee, data.discountedFee !== undefined ? data.discountedFee : existing.discountedFee);
  const record = await repos.courses.mutate((rows) => {
    if (data.slug && rows.some((c) => c.slug === data.slug && c.id !== id)) {
      throw ApiError.conflict('Another course already uses this slug', 'SLUG_TAKEN');
    }
    const index = rows.findIndex((c) => c.id === id);
    rows[index] = { ...rows[index], ...data, id, createdAt: rows[index].createdAt, updatedAt: new Date().toISOString() };
    return structuredClone(rows[index]);
  });
  await activity.log(actor, 'updated', 'course', id, `Course "${record.title}" updated`);
  return record;
}

/** Archives by default; hard delete only when nothing references the course. */
async function remove(id, { hard = false } = {}, actor) {
  const course = await repos.courses.findById(id);
  if (!course) throw ApiError.notFound('Course not found');
  if (hard) {
    const [enrollments, batches] = await Promise.all([
      repos.enrollments.find((e) => e.courseId === id),
      repos.batches.find((b) => b.courseId === id),
    ]);
    if (enrollments.length || batches.length) {
      throw ApiError.conflict('This course has batches or enrollments. Archive it instead of deleting.', 'COURSE_IN_USE');
    }
    await repos.courses.remove(id);
    await activity.log(actor, 'deleted', 'course', id, `Course "${course.title}" deleted`);
    return { deleted: true };
  }
  const archived = await repos.courses.update(id, { status: 'archived', enrollmentOpen: false });
  await activity.log(actor, 'archived', 'course', id, `Course "${course.title}" archived`);
  return archived;
}

module.exports = { list, get, create, update, remove, effectiveFee };
