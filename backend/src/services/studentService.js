'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { publicUser } = require('../utils/sanitize');
const { cleanQueryString, matchesSearch, pageParams, paginate } = require('../utils/query');
const enrollmentService = require('./enrollmentService');
const appointmentService = require('./appointmentService');
const activity = require('./activityService');

async function list(query = {}) {
  const [users, enrollments] = await Promise.all([repos.users.find((u) => u.role === 'student'), repos.enrollments.all()]);
  let rows = users.map((u) => ({
    ...publicUser(u),
    enrollmentCount: enrollments.filter((e) => e.studentId === u.id && ['approved', 'completed', 'pending'].includes(e.status)).length,
  }));
  const status = cleanQueryString(query.status);
  if (status === 'active') rows = rows.filter((u) => u.isActive);
  if (status === 'inactive') rows = rows.filter((u) => !u.isActive);
  rows = rows.filter((u) => matchesSearch(u, cleanQueryString(query.q), ['fullName', 'email', 'mobile']));
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(rows, pageParams(query));
}

async function get(id) {
  const user = await repos.users.findById(id);
  if (!user || user.role !== 'student') throw ApiError.notFound('Student not found');
  const [enrollments, appointments] = await Promise.all([
    enrollmentService.enrich(await repos.enrollments.find((e) => e.studentId === id)),
    appointmentService.enrich(await repos.appointments.find((a) => a.userId === id)),
  ]);
  return { ...publicUser(user), enrollments, appointments };
}

async function update(id, data, actor) {
  const updated = await repos.users.mutate((rows) => {
    const user = rows.find((u) => u.id === id && u.role === 'student');
    if (!user) throw ApiError.notFound('Student not found');
    if (data.fullName !== undefined) user.fullName = data.fullName;
    if (data.mobile !== undefined) user.mobile = data.mobile;
    if (data.isActive !== undefined && data.isActive !== user.isActive) {
      user.isActive = data.isActive;
      if (!data.isActive) user.tokenVersion = (user.tokenVersion || 0) + 1; // force logout
    }
    user.updatedAt = new Date().toISOString();
    return structuredClone(user);
  });
  await activity.log(actor, 'updated', 'student', id, `Student ${updated.fullName} updated${data.isActive === false ? ' (deactivated)' : data.isActive === true ? ' (activated)' : ''}`);
  return publicUser(updated);
}

module.exports = { list, get, update };
