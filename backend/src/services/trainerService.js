'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { cleanQueryString, matchesSearch } = require('../utils/query');
const { publicTrainer } = require('../utils/sanitize');
const activity = require('./activityService');

function withCourses(trainer, courses) {
  const taught = courses.filter((c) => c.status === 'active' && (c.trainerId === trainer.id || (trainer.courseIds || []).includes(c.id)));
  return { ...trainer, courses: taught.map((c) => ({ id: c.id, title: c.title, slug: c.slug })) };
}

async function list(query = {}, { isAdmin = false } = {}) {
  const courses = await repos.courses.all();
  let rows = await repos.trainers.all();
  if (!isAdmin || query.includeInactive !== 'true') rows = rows.filter((t) => t.isActive !== false);
  rows = rows.filter((t) => matchesSearch(t, cleanQueryString(query.q), ['name', 'specialization', 'designation']));
  rows.sort((a, b) => b.experienceYears - a.experienceYears || a.name.localeCompare(b.name));
  return rows.map((t) => withCourses(isAdmin ? t : publicTrainer(t), courses));
}

async function get(id, { isAdmin = false } = {}) {
  const trainer = await repos.trainers.findById(id);
  if (!trainer || (!isAdmin && trainer.isActive === false)) throw ApiError.notFound('Trainer not found');
  return withCourses(isAdmin ? trainer : publicTrainer(trainer), await repos.courses.all());
}

async function assertCourses(courseIds) {
  if (!courseIds || !courseIds.length) return;
  const courses = await repos.courses.all();
  const missing = courseIds.filter((id) => !courses.some((c) => c.id === id));
  if (missing.length) throw ApiError.badRequest('Some courses were not found', [{ field: 'courseIds', message: 'Select valid courses' }], 'VALIDATION_ERROR');
}

async function create(data, actor) {
  await assertCourses(data.courseIds);
  const record = await repos.trainers.create({ photoUrl: null, userId: null, courseIds: [], certifications: [], ...data });
  await activity.log(actor, 'created', 'trainer', record.id, `Trainer "${record.name}" added`);
  return get(record.id, { isAdmin: true });
}

async function update(id, data, actor) {
  const existing = await repos.trainers.findById(id);
  if (!existing) throw ApiError.notFound('Trainer not found');
  await assertCourses(data.courseIds);
  await repos.trainers.update(id, data);
  await activity.log(actor, 'updated', 'trainer', id, `Trainer "${existing.name}" updated`);
  return get(id, { isAdmin: true });
}

/** Deactivates by default; hard delete only if the trainer is not referenced anywhere. */
async function remove(id, { hard = false } = {}, actor) {
  const existing = await repos.trainers.findById(id);
  if (!existing) throw ApiError.notFound('Trainer not found');
  if (hard) {
    const [courses, batches, appointments] = await Promise.all([
      repos.courses.find((c) => c.trainerId === id),
      repos.batches.find((b) => b.trainerId === id),
      repos.appointments.find((a) => a.trainerId === id),
    ]);
    if (courses.length || batches.length || appointments.length || existing.userId) {
      throw ApiError.conflict('This trainer is linked to courses, batches, appointments or a login account. Deactivate instead.', 'TRAINER_IN_USE');
    }
    await repos.trainers.remove(id);
    await activity.log(actor, 'deleted', 'trainer', id, `Trainer "${existing.name}" deleted`);
    return { deleted: true };
  }
  await repos.trainers.update(id, { isActive: false });
  if (existing.userId) {
    // Disable the linked login and invalidate its sessions.
    await repos.users.mutate((rows) => {
      const u = rows.find((r) => r.id === existing.userId);
      if (u) {
        u.isActive = false;
        u.tokenVersion = (u.tokenVersion || 0) + 1;
        u.updatedAt = new Date().toISOString();
      }
    });
  }
  await activity.log(actor, 'deactivated', 'trainer', id, `Trainer "${existing.name}" deactivated`);
  return get(id, { isAdmin: true });
}

async function getForUser(user) {
  if (!user.trainerId) throw ApiError.notFound('No trainer profile is linked to this account');
  return get(user.trainerId, { isAdmin: true });
}

async function updateSelf(user, data) {
  if (!user.trainerId) throw ApiError.notFound('No trainer profile is linked to this account');
  await repos.trainers.update(user.trainerId, data);
  return getForUser(user);
}

module.exports = { list, get, create, update, remove, getForUser, updateSelf };
