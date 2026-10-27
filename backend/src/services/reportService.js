'use strict';
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { inRange } = require('../utils/dates');
const { isValidDate } = require('../utils/validate');
const enrollmentService = require('./enrollmentService');
const appointmentService = require('./appointmentService');

const REPORTS = {
  registrations: {
    title: 'Student registrations',
    columns: [
      { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'mobile', label: 'Mobile' },
      { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Registered at' },
    ],
    async rows() {
      return (await repos.users.find((u) => u.role === 'student')).map((u) => ({ fullName: u.fullName, email: u.email, mobile: u.mobile, status: u.isActive ? 'Active' : 'Inactive', createdAt: u.createdAt }));
    },
  },
  enrollments: {
    title: 'Course enrollments',
    columns: [
      { key: 'studentName', label: 'Student' }, { key: 'studentEmail', label: 'Email' }, { key: 'courseTitle', label: 'Course' },
      { key: 'batchName', label: 'Batch' }, { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Requested at' },
    ],
    async rows() {
      return (await enrollmentService.enrich(await repos.enrollments.all())).map((e) => ({ ...e, batchName: e.batch ? e.batch.name : '' }));
    },
  },
  appointments: {
    title: 'Appointments',
    columns: [
      { key: 'appointmentNo', label: 'Appointment ID' }, { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' },
      { key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'mode', label: 'Mode' },
      { key: 'courseTitle', label: 'Course' }, { key: 'trainerName', label: 'Trainer' }, { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Booked at' },
    ],
    async rows() {
      return appointmentService.enrich(await repos.appointments.all());
    },
  },
  inquiries: {
    title: 'Inquiries',
    columns: [
      { key: 'ticketNo', label: 'Ticket' }, { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' },
      { key: 'category', label: 'Category' }, { key: 'subject', label: 'Subject' }, { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Received at' },
    ],
    async rows() {
      return repos.inquiries.all();
    },
  },
};

async function generate(type, { from, to } = {}) {
  const report = REPORTS[type];
  if (!report) throw ApiError.notFound('Unknown report type');
  if ((from && !isValidDate(from)) || (to && !isValidDate(to))) throw ApiError.badRequest('from/to must be dates in YYYY-MM-DD format');
  if (from && to && from > to) throw ApiError.badRequest('"from" must be before "to"');
  const rows = (await report.rows())
    .filter((r) => inRange(r.createdAt, from, to))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const byStatus = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {});
  return { type, title: report.title, from: from || null, to: to || null, columns: report.columns, rows: rows.map((r) => Object.fromEntries(report.columns.map((c) => [c.key, r[c.key] ?? '']))), summary: { total: rows.length, byStatus } };
}

module.exports = { generate, REPORT_TYPES: Object.keys(REPORTS) };
