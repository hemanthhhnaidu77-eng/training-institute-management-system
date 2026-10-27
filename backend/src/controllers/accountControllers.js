'use strict';
/** Profile, students, staff accounts, dashboards, trainer portal, reports, settings, activity. */
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const ApiError = require('../utils/ApiError');
const { toCsv } = require('../utils/csv');
const profileService = require('../services/profileService');
const studentService = require('../services/studentService');
const authService = require('../services/authService');
const dashboardService = require('../services/dashboardService');
const trainerPortal = require('../services/trainerPortalService');
const reportService = require('../services/reportService');
const settingsService = require('../services/settingsService');
const activityService = require('../services/activityService');
const { cleanQueryString } = require('../utils/query');

const profile = {
  get: asyncHandler(async (req, res) => ok(res, await profileService.get(req.user))),
  update: asyncHandler(async (req, res) => ok(res, await profileService.update(req.user, req.body))),
};

const students = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await studentService.list(req.query);
    ok(res, items, meta);
  }),
  get: asyncHandler(async (req, res) => ok(res, await studentService.get(req.params.id))),
  update: asyncHandler(async (req, res) => ok(res, await studentService.update(req.params.id, req.body, req.user))),
};

const staff = {
  list: asyncHandler(async (req, res) => ok(res, await authService.listStaff())),
  create: asyncHandler(async (req, res) => created(res, await authService.createStaffUser(req.body, req.user))),
};

const dashboard = {
  student: asyncHandler(async (req, res) => ok(res, await dashboardService.student(req.user))),
  studentSchedule: asyncHandler(async (req, res) => ok(res, await dashboardService.schedule(req.user))),
  admin: asyncHandler(async (req, res) => ok(res, await dashboardService.admin())),
  trainer: asyncHandler(async (req, res) => ok(res, await dashboardService.trainer(req.user))),
};

const trainer = {
  courses: asyncHandler(async (req, res) => ok(res, await trainerPortal.courses(req.user))),
  batches: asyncHandler(async (req, res) => ok(res, await trainerPortal.batches(req.user))),
  students: asyncHandler(async (req, res) => ok(res, await trainerPortal.students(req.user))),
  schedule: asyncHandler(async (req, res) => ok(res, await trainerPortal.schedule(req.user))),
  sessions: asyncHandler(async (req, res) => ok(res, await trainerPortal.listSessions(req.user))),
  recordSession: asyncHandler(async (req, res) => created(res, await trainerPortal.recordSession(req.user, req.body))),
};

const reports = {
  get: asyncHandler(async (req, res) => {
    const report = await reportService.generate(req.params.type, { from: cleanQueryString(req.query.from, 10) || undefined, to: cleanQueryString(req.query.to, 10) || undefined });
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${report.type}-report.csv"`);
      return res.send(`\uFEFF${toCsv(report.columns, report.rows)}`);
    }
    ok(res, report);
  }),
};

const settings = {
  getPublic: asyncHandler(async (req, res) => ok(res, await settingsService.get())),
  update: asyncHandler(async (req, res) => {
    if (!Object.keys(req.body).length) throw ApiError.badRequest('Nothing to update');
    ok(res, await settingsService.update(req.body));
  }),
};

const activity = {
  recent: asyncHandler(async (req, res) => ok(res, await activityService.recent(Math.min(parseInt(req.query.limit, 10) || 50, 200)))),
};

module.exports = { profile, students, staff, dashboard, trainer, reports, settings, activity };
