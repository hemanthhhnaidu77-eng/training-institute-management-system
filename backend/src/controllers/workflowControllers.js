'use strict';
/** Controllers for workflows: appointments, enrollments, inquiries, reviews, notifications. */
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const appointmentService = require('../services/appointmentService');
const enrollmentService = require('../services/enrollmentService');
const inquiryService = require('../services/inquiryService');
const reviewService = require('../services/reviewService');
const notificationService = require('../services/notificationService');
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');

const appointments = {
  availability: asyncHandler(async (req, res) => ok(res, await appointmentService.availability(req.query))),
  create: asyncHandler(async (req, res) => created(res, await appointmentService.create(req.body, req.user))),
  mine: asyncHandler(async (req, res) => ok(res, await appointmentService.listMine(req.user, req.query))),
  get: asyncHandler(async (req, res) => ok(res, await appointmentService.getForUser(req.params.id, req.user))),
  cancel: asyncHandler(async (req, res) => ok(res, await appointmentService.cancelByOwner(req.params.id, req.user, req.body))),
  reschedule: asyncHandler(async (req, res) => ok(res, await appointmentService.rescheduleByOwner(req.params.id, req.user, req.body))),
  adminList: asyncHandler(async (req, res) => {
    const { items, meta } = await appointmentService.adminList(req.query);
    ok(res, items, meta);
  }),
  adminStatus: asyncHandler(async (req, res) => ok(res, await appointmentService.applyAction(req.params.id, req.body, req.user))),
  trainerList: asyncHandler(async (req, res) => ok(res, await appointmentService.listForTrainer(req.user, req.query))),
  trainerStatus: asyncHandler(async (req, res) => {
    if (!req.user.trainerId) throw ApiError.forbidden('No trainer profile is linked to this account');
    ok(res, await appointmentService.applyAction(req.params.id, req.body, req.user, { trainerScope: req.user.trainerId }));
  }),
};

const enrollments = {
  create: asyncHandler(async (req, res) => created(res, await enrollmentService.request(req.user, req.body))),
  mine: asyncHandler(async (req, res) => ok(res, await enrollmentService.listMine(req.user))),
  cancelMine: asyncHandler(async (req, res) => ok(res, await enrollmentService.cancelMine(req.user, req.params.id))),
  adminList: asyncHandler(async (req, res) => {
    const { items, meta } = await enrollmentService.adminList(req.query);
    ok(res, items, meta);
  }),
  adminStatus: asyncHandler(async (req, res) => ok(res, await enrollmentService.adminUpdateStatus(req.params.id, req.body, req.user))),
};

const inquiries = {
  create: asyncHandler(async (req, res) => created(res, await inquiryService.create(req.body, req.user))),
  mine: asyncHandler(async (req, res) => ok(res, await inquiryService.listMine(req.user))),
  adminList: asyncHandler(async (req, res) => {
    const { items, meta } = await inquiryService.adminList(req.query);
    ok(res, items, meta);
  }),
  adminGet: asyncHandler(async (req, res) => ok(res, await inquiryService.get(req.params.id))),
  adminStatus: asyncHandler(async (req, res) => ok(res, await inquiryService.updateStatus(req.params.id, req.body, req.user))),
  adminNote: asyncHandler(async (req, res) => ok(res, await inquiryService.addNote(req.params.id, req.body, req.user))),
};

const reviews = {
  listPublic: asyncHandler(async (req, res) => ok(res, await reviewService.listPublic(req.query))),
  create: asyncHandler(async (req, res) => created(res, await reviewService.create(req.user, req.body))),
  mine: asyncHandler(async (req, res) => ok(res, await reviewService.listMine(req.user))),
  adminList: asyncHandler(async (req, res) => ok(res, await reviewService.adminList(req.query))),
  moderate: asyncHandler(async (req, res) => ok(res, await reviewService.moderate(req.params.id, req.body, req.user))),
  remove: asyncHandler(async (req, res) => ok(res, await reviewService.remove(req.params.id, req.user))),
};

const notifications = {
  mine: asyncHandler(async (req, res) => {
    const { items, unread } = await notificationService.listMine(req.user, { unreadOnly: req.query.unread === 'true' });
    ok(res, items, { unread });
  }),
  read: asyncHandler(async (req, res) => ok(res, await notificationService.markRead(req.user, req.params.id))),
  readAll: asyncHandler(async (req, res) => ok(res, await notificationService.markAllRead(req.user))),
};

const newsletter = {
  subscribe: asyncHandler(async (req, res) => {
    const result = await repos.newsletter.mutate((rows) => {
      const existing = rows.find((r) => r.email === req.body.email);
      if (existing) return { alreadySubscribed: true };
      rows.push(repos.newsletter.build({ email: req.body.email, name: req.body.name || null, status: 'subscribed' }));
      return { alreadySubscribed: false };
    });
    created(res, { message: result.alreadySubscribed ? 'You are already subscribed. Thank you!' : 'Thanks for subscribing!' });
  }),
  adminList: asyncHandler(async (req, res) => ok(res, (await repos.newsletter.all()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))),
};

module.exports = { appointments, enrollments, inquiries, reviews, notifications, newsletter };
