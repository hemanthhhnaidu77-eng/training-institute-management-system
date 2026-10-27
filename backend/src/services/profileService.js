'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { publicUser } = require('../utils/sanitize');

async function get(user) {
  const record = await repos.users.findById(user.id);
  if (!record) throw ApiError.notFound('User not found');
  return publicUser(record);
}

async function update(user, data) {
  if (data.preferredCourseId && !(await repos.courses.findById(data.preferredCourseId))) {
    throw ApiError.badRequest('Preferred course not found', [{ field: 'preferredCourseId', message: 'Select a valid course' }], 'VALIDATION_ERROR');
  }
  const patch = {};
  for (const key of ['fullName', 'mobile', 'preferredCourseId']) if (data[key] !== undefined) patch[key] = data[key];
  return publicUser(await repos.users.update(user.id, patch));
}

module.exports = { get, update };
