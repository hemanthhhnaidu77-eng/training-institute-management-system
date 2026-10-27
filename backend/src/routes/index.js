'use strict';
const express = require('express');
const S = require('../validation/schemas');
const { body, idParam } = require('../middleware/validateRequest');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { authLimiter, passwordResetLimiter, publicFormLimiter } = require('../middleware/rateLimiters');
const auth = require('../controllers/authController');
const { courses, trainers, batches, content } = require('../controllers/resourceControllers');
const W = require('../controllers/workflowControllers');
const A = require('../controllers/accountControllers');
const catalogs = require('../services/catalogs');
const { store } = require('../storage');
const openapi = require('../../docs/openapi.json');

const router = express.Router();
const admin = [authenticate, authorize('admin')];
const student = [authenticate, authorize('student')];
const trainerOnly = [authenticate, authorize('trainer')];
const id = idParam('id');

// ---- Health & docs --------------------------------------------------------
router.get('/health', async (req, res) => {
  let storage = 'ok';
  try {
    await store.read('settings');
  } catch {
    storage = 'error';
  }
  res.status(storage === 'ok' ? 200 : 503).json({ success: storage === 'ok', data: { status: storage === 'ok' ? 'ok' : 'degraded', storage, uptimeSeconds: Math.round(process.uptime()), timestamp: new Date().toISOString() } });
});
router.get('/docs', (req, res) => res.json(openapi));

// ---- Auth -----------------------------------------------------------------
router.post('/auth/register', authLimiter, body(S.register), auth.register);
router.post('/auth/login', authLimiter, body(S.login), auth.login);
router.post('/auth/logout', authenticate, auth.logout);
router.get('/auth/me', authenticate, auth.me);
router.post('/auth/refresh', authenticate, auth.refresh);
router.post('/auth/forgot-password', passwordResetLimiter, body(S.forgotPassword), auth.forgotPassword);
router.post('/auth/reset-password', authLimiter, body(S.resetPassword), auth.resetPassword);
router.post('/auth/change-password', authenticate, authLimiter, body(S.changePassword), auth.changePassword);

// ---- Profile & notifications ---------------------------------------------
router.get('/profile', authenticate, A.profile.get);
router.patch('/profile', authenticate, body(S.profile, { partial: true }), A.profile.update);
router.get('/notifications/my', authenticate, W.notifications.mine);
router.patch('/notifications/read-all', authenticate, W.notifications.readAll);
router.patch('/notifications/:id/read', authenticate, id, W.notifications.read);

// ---- Courses --------------------------------------------------------------
router.get('/courses', optionalAuth, courses.list);
router.get('/courses/:id', optionalAuth, id, courses.get);
router.post('/courses', ...admin, body(S.course), courses.create);
router.put('/courses/:id', ...admin, id, body(S.course, { partial: true }), courses.update);
router.delete('/courses/:id', ...admin, id, courses.remove);

// ---- Trainers -------------------------------------------------------------
router.get('/trainers/me', ...trainerOnly, trainers.me);
router.patch('/trainers/me', ...trainerOnly, body(S.trainerSelf, { partial: true }), trainers.updateMe);
router.get('/trainers', optionalAuth, trainers.list);
router.get('/trainers/:id', optionalAuth, id, trainers.get);
router.post('/trainers', ...admin, body(S.trainer), trainers.create);
router.put('/trainers/:id', ...admin, id, body(S.trainer, { partial: true }), trainers.update);
router.delete('/trainers/:id', ...admin, id, trainers.remove);

// ---- Services, testimonials, FAQs, events --------------------------------
const services = content(catalogs.services);
router.get('/services', optionalAuth, services.list);
router.patch('/services/reorder', ...admin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await catalogs.services.reorder(req.body && req.body.ids, req.user) });
  } catch (err) {
    next(err);
  }
});
router.get('/services/:id', optionalAuth, id, services.get);
router.post('/services', ...admin, body(S.service), services.create);
router.put('/services/:id', ...admin, id, body(S.service, { partial: true }), services.update);
router.delete('/services/:id', ...admin, id, services.remove);

for (const [path, svc, schema] of [
  ['testimonials', catalogs.testimonials, S.testimonial],
  ['faqs', catalogs.faqs, S.faq],
  ['events', catalogs.events, S.event],
]) {
  const c = content(svc);
  router.get(`/${path}`, optionalAuth, c.list);
  router.get(`/${path}/:id`, optionalAuth, id, c.get);
  router.post(`/${path}`, ...admin, body(schema), c.create);
  router.put(`/${path}/:id`, ...admin, id, body(schema, { partial: true }), c.update);
  router.delete(`/${path}/:id`, ...admin, id, c.remove);
}

// ---- Batches --------------------------------------------------------------
router.get('/batches', optionalAuth, batches.list);
router.get('/batches/:id', id, batches.get);
router.post('/batches', ...admin, body(S.batch), batches.create);
router.put('/batches/:id', ...admin, id, body(S.batch, { partial: true }), batches.update);
router.delete('/batches/:id', ...admin, id, batches.remove);

// ---- Appointments ---------------------------------------------------------
router.get('/appointments/availability', W.appointments.availability);
router.post('/appointments', publicFormLimiter, optionalAuth, body(S.appointment), W.appointments.create);
router.get('/appointments/my', ...student, W.appointments.mine);
router.get('/appointments/:id', authenticate, id, W.appointments.get);
router.patch('/appointments/:id/cancel', ...student, id, body(S.appointmentCancel), W.appointments.cancel);
router.patch('/appointments/:id/reschedule', ...student, id, body(S.appointmentReschedule), W.appointments.reschedule);

// ---- Enrollments, reviews, student inquiries -----------------------------
router.post('/enrollments', ...student, body(S.enrollmentRequest), W.enrollments.create);
router.get('/enrollments/my', ...student, W.enrollments.mine);
router.patch('/enrollments/:id/cancel', ...student, id, W.enrollments.cancelMine);
router.get('/reviews', W.reviews.listPublic);
router.get('/reviews/my', ...student, W.reviews.mine);
router.post('/reviews', ...student, body(S.review), W.reviews.create);
router.get('/inquiries/my', authenticate, W.inquiries.mine);

// ---- Public forms ---------------------------------------------------------
router.post('/inquiries', publicFormLimiter, optionalAuth, body(S.inquiry), W.inquiries.create);
router.post('/newsletter', publicFormLimiter, body(S.newsletter), W.newsletter.subscribe);

// ---- Settings -------------------------------------------------------------
router.get('/settings', A.settings.getPublic);
router.put('/settings', ...admin, body(S.settings, { partial: true }), A.settings.update);

// ---- Students (admin) -----------------------------------------------------
router.get('/students', ...admin, A.students.list);
router.get('/students/:id', ...admin, id, A.students.get);
router.patch('/students/:id', ...admin, id, body(S.studentAdminUpdate, { partial: true }), A.students.update);

// ---- Dashboards -----------------------------------------------------------
router.get('/dashboard/student', ...student, A.dashboard.student);
router.get('/dashboard/student/schedule', ...student, A.dashboard.studentSchedule);
router.get('/dashboard/admin', ...admin, A.dashboard.admin);
router.get('/dashboard/trainer', ...trainerOnly, A.dashboard.trainer);

// ---- Trainer portal -------------------------------------------------------
router.get('/trainer/courses', ...trainerOnly, A.trainer.courses);
router.get('/trainer/batches', ...trainerOnly, A.trainer.batches);
router.get('/trainer/students', ...trainerOnly, A.trainer.students);
router.get('/trainer/schedule', ...trainerOnly, A.trainer.schedule);
router.get('/trainer/appointments', ...trainerOnly, W.appointments.trainerList);
router.patch('/trainer/appointments/:id/status', ...trainerOnly, id, body(S.appointmentTrainerAction), W.appointments.trainerStatus);
router.get('/trainer/sessions', ...trainerOnly, A.trainer.sessions);
router.post('/trainer/sessions', ...trainerOnly, body(S.sessionRecord), A.trainer.recordSession);

// ---- Admin workflows ------------------------------------------------------
router.get('/admin/appointments', ...admin, W.appointments.adminList);
router.patch('/admin/appointments/:id/status', ...admin, id, body(S.appointmentAdminAction), W.appointments.adminStatus);
router.get('/admin/enrollments', ...admin, W.enrollments.adminList);
router.patch('/admin/enrollments/:id/status', ...admin, id, body(S.enrollmentStatus), W.enrollments.adminStatus);
router.get('/admin/inquiries', ...admin, W.inquiries.adminList);
router.get('/admin/inquiries/:id', ...admin, id, W.inquiries.adminGet);
router.patch('/admin/inquiries/:id/status', ...admin, id, body(S.inquiryStatus), W.inquiries.adminStatus);
router.post('/admin/inquiries/:id/notes', ...admin, id, body(S.inquiryNote), W.inquiries.adminNote);
router.get('/admin/reviews', ...admin, W.reviews.adminList);
router.patch('/admin/reviews/:id/status', ...admin, id, body(S.reviewModeration), W.reviews.moderate);
router.delete('/admin/reviews/:id', ...admin, id, W.reviews.remove);
router.get('/admin/newsletter', ...admin, W.newsletter.adminList);
router.get('/admin/users', ...admin, A.staff.list);
router.post('/admin/users', ...admin, body(S.staffUser), A.staff.create);
router.get('/admin/reports/:type', ...admin, A.reports.get);
router.get('/admin/activity', ...admin, A.activity.recent);

module.exports = router;
