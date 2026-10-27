'use strict';
/** Controllers for catalogue resources: courses, trainers, batches and simple content. */
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const courseService = require('../services/courseService');
const trainerService = require('../services/trainerService');
const batchService = require('../services/batchService');

const isAdmin = (req) => Boolean(req.user && req.user.role === 'admin');

const courses = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await courseService.list(req.query, { isAdmin: isAdmin(req) && req.query.all === 'true' });
    ok(res, items, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await courseService.get(req.params.id, { isAdmin: isAdmin(req) }))),
  create: asyncHandler(async (req, res) => created(res, await courseService.create(req.body, req.user))),
  update: asyncHandler(async (req, res) => ok(res, await courseService.update(req.params.id, req.body, req.user))),
  remove: asyncHandler(async (req, res) => ok(res, await courseService.remove(req.params.id, { hard: req.query.hard === 'true' }, req.user))),
};

const trainers = {
  list: asyncHandler(async (req, res) => ok(res, await trainerService.list(req.query, { isAdmin: isAdmin(req) }))),
  get: asyncHandler(async (req, res) => ok(res, await trainerService.get(req.params.id, { isAdmin: isAdmin(req) }))),
  create: asyncHandler(async (req, res) => created(res, await trainerService.create(req.body, req.user))),
  update: asyncHandler(async (req, res) => ok(res, await trainerService.update(req.params.id, req.body, req.user))),
  remove: asyncHandler(async (req, res) => ok(res, await trainerService.remove(req.params.id, { hard: req.query.hard === 'true' }, req.user))),
  me: asyncHandler(async (req, res) => ok(res, await trainerService.getForUser(req.user))),
  updateMe: asyncHandler(async (req, res) => ok(res, await trainerService.updateSelf(req.user, req.body))),
};

const batches = {
  list: asyncHandler(async (req, res) => ok(res, await batchService.list(req.query, { isAdmin: isAdmin(req) && req.query.all === 'true' }))),
  get: asyncHandler(async (req, res) => ok(res, await batchService.get(req.params.id))),
  create: asyncHandler(async (req, res) => created(res, await batchService.create(req.body, req.user))),
  update: asyncHandler(async (req, res) => ok(res, await batchService.update(req.params.id, req.body, req.user))),
  remove: asyncHandler(async (req, res) => ok(res, await batchService.remove(req.params.id, req.user))),
};

/** Builds controller handlers for a content service (services, testimonials, FAQs, events). */
function content(service) {
  return {
    list: asyncHandler(async (req, res) => ok(res, await service.list(req.query, { isAdmin: isAdmin(req) }))),
    get: asyncHandler(async (req, res) => ok(res, await service.get(req.params.id, { isAdmin: isAdmin(req) }))),
    create: asyncHandler(async (req, res) => created(res, await service.create(req.body, req.user))),
    update: asyncHandler(async (req, res) => ok(res, await service.update(req.params.id, req.body, req.user))),
    remove: asyncHandler(async (req, res) => ok(res, await service.remove(req.params.id, req.user))),
  };
}

module.exports = { courses, trainers, batches, content };
