'use strict';
/**
 * HTTP integration tests (Express + bcrypt + JWT). Requires `npm install` (uses supertest).
 */
require('./helpers/env');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { store, repos } = require('../src/storage');
const { createApp } = require('../src/app');
const authService = require('../src/services/authService');
const settingsService = require('../src/services/settingsService');
const { nowInZone, addDays, dayName } = require('../src/utils/dates');

const app = createApp();
const api = () => request(app);
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let adminToken;
let trainerToken;
let studentToken;
let studentId;
let trainerRecord;
let courseId;

before(async () => {
  await store.init({ logger: { warn() {} } });
  trainerRecord = await repos.trainers.create({ name: 'API Trainer', designation: 'Mentor', specialization: 'JS', experienceYears: 4, bio: 'Bio', availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], availableFrom: '09:00', availableTo: '19:00', isActive: true, courseIds: [] });
  await authService.createStaffUser({ role: 'admin', fullName: 'Admin', email: 'admin@test.io', mobile: '9000000001', password: 'AdminPass1' });
  await authService.createStaffUser({ role: 'trainer', fullName: 'API Trainer', email: 'trainer@test.io', mobile: '9000000002', password: 'TrainerPass1', trainerId: trainerRecord.id });
  await settingsService.update({ appointment: { workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], slots: ['10:00', '11:00', '12:00'] } });
  adminToken = (await api().post('/api/auth/login').send({ email: 'admin@test.io', password: 'AdminPass1' })).body.data.token;
  trainerToken = (await api().post('/api/auth/login').send({ email: 'trainer@test.io', password: 'TrainerPass1' })).body.data.token;
});

test('GET /api/health reports ok', async () => {
  const res = await api().get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.data.storage, 'ok');
});

test('registration creates a student, hashes the password and never returns it', async () => {
  const res = await api().post('/api/auth/register').send({ fullName: 'Asha Verma', email: 'asha@test.io', mobile: '9876543210', password: 'Secret123', acceptTerms: true, role: 'admin' });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.user.role, 'student', 'role cannot be chosen by the client');
  assert.equal(res.body.data.user.passwordHash, undefined);
  assert.ok(res.body.data.token);
  studentToken = res.body.data.token;
  studentId = res.body.data.user.id;
  const stored = await repos.users.findById(studentId);
  assert.match(stored.passwordHash, /^\$2[aby]\$/, 'bcrypt hash stored');
  assert.notEqual(stored.passwordHash, 'Secret123');
});

test('duplicate registration and missing terms are rejected', async () => {
  const dup = await api().post('/api/auth/register').send({ fullName: 'Asha', email: 'ASHA@test.io', mobile: '9876543210', password: 'Secret123', acceptTerms: true });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'EMAIL_TAKEN');
  const terms = await api().post('/api/auth/register').send({ fullName: 'Bob', email: 'bob@test.io', mobile: '9876543211', password: 'Secret123', acceptTerms: false });
  assert.equal(terms.status, 400);
});

test('invalid credentials return 401 with a generic message', async () => {
  const wrong = await api().post('/api/auth/login').send({ email: 'asha@test.io', password: 'WrongPass1' });
  const unknown = await api().post('/api/auth/login').send({ email: 'nobody@test.io', password: 'WrongPass1' });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.body.error.message, unknown.body.error.message, 'no account enumeration');
});

test('JWT verification: missing, tampered and expired tokens are refused', async () => {
  assert.equal((await api().get('/api/auth/me')).status, 401);
  assert.equal((await api().get('/api/auth/me').set(auth(`${studentToken}x`))).status, 401);
  const expired = jwt.sign({ sub: studentId, role: 'student', tv: 0 }, process.env.JWT_SECRET, { expiresIn: -10, issuer: 'training-institute-api', audience: 'training-institute-web', jwtid: 'x' });
  const res = await api().get('/api/auth/me').set(auth(expired));
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
  const forged = jwt.sign({ sub: studentId, role: 'admin', tv: 0 }, 'some-other-secret-that-is-long-enough!!', { issuer: 'training-institute-api', audience: 'training-institute-web', jwtid: 'y' });
  assert.equal((await api().get('/api/dashboard/admin').set(auth(forged))).status, 401);
  const me = await api().get('/api/auth/me').set(auth(studentToken));
  assert.equal(me.body.data.email, 'asha@test.io');
});

test('role-based authorization is enforced server-side', async () => {
  assert.equal((await api().get('/api/dashboard/admin').set(auth(studentToken))).status, 403);
  assert.equal((await api().get('/api/students').set(auth(trainerToken))).status, 403);
  assert.equal((await api().post('/api/courses').set(auth(studentToken)).send({})).status, 403);
  assert.equal((await api().get('/api/dashboard/admin').set(auth(adminToken))).status, 200);
  assert.equal((await api().get('/api/dashboard/trainer').set(auth(trainerToken))).status, 200);
  assert.equal((await api().get('/api/dashboard/student').set(auth(studentToken))).status, 200);
});

test('course CRUD via API (admin only) with validation', async () => {
  const bad = await api().post('/api/courses').set(auth(adminToken)).send({ title: 'X' });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.details.length > 1);
  const created = await api().post('/api/courses').set(auth(adminToken)).send({ title: 'Node.js and Express.js', category: 'Web Development', shortDescription: 'APIs', description: 'Build APIs', duration: '8 weeks', level: 'Intermediate', fee: 26000, mode: 'Hybrid', trainerId: trainerRecord.id, syllabus: ['Express', 'JWT'] });
  assert.equal(created.status, 201);
  courseId = created.body.data.id;
  const updated = await api().put(`/api/courses/${courseId}`).set(auth(adminToken)).send({ fee: 25000 });
  assert.equal(updated.body.data.fee, 25000);
  const pub = await api().get('/api/courses?q=express');
  assert.equal(pub.body.data.length, 1);
  const bySlug = await api().get('/api/courses/nodejs-and-expressjs');
  assert.equal(bySlug.status, 200);
  assert.equal(bySlug.body.data.trainer.email, undefined);
});

test('trainer CRUD via API', async () => {
  const created = await api().post('/api/trainers').set(auth(adminToken)).send({ name: 'New Trainer', designation: 'Coach', specialization: 'Testing', experienceYears: 3, bio: 'Bio' });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal((await api().put(`/api/trainers/${id}`).set(auth(adminToken)).send({ experienceYears: 4 })).body.data.experienceYears, 4);
  assert.equal((await api().delete(`/api/trainers/${id}?hard=true`).set(auth(adminToken))).body.data.deleted, true);
  assert.equal((await api().get(`/api/trainers/${id}`)).status, 404);
});

test('appointments: create, conflict prevention, ownership, trainer scope', async () => {
  const date = addDays(nowInZone().date, 2);
  const body = { fullName: 'Asha Verma', email: 'asha@test.io', mobile: '9876543210', trainerId: trainerRecord.id, date, time: '10:00', mode: 'Online', courseId };
  const first = await api().post('/api/appointments').set(auth(studentToken)).send(body);
  assert.equal(first.status, 201);
  assert.match(first.body.data.appointmentNo, /^APT-/);
  const clash = await api().post('/api/appointments').send({ ...body, email: 'guest@test.io' });
  assert.equal(clash.status, 409);
  assert.equal(clash.body.error.code, 'SLOT_UNAVAILABLE');
  const past = await api().post('/api/appointments').send({ ...body, date: addDays(nowInZone().date, -1), time: '11:00' });
  assert.equal(past.status, 409);
  const avail = await api().get(`/api/appointments/availability?date=${date}&trainerId=${trainerRecord.id}`);
  assert.equal(avail.body.data.slots.find((s) => s.time === '10:00').available, false);
  const mine = await api().get('/api/appointments/my').set(auth(studentToken));
  assert.equal(mine.body.data.length, 1);
  const other = await api().post('/api/auth/register').send({ fullName: 'Other Student', email: 'other@test.io', mobile: '9876500000', password: 'Secret123', acceptTerms: true });
  const otherToken = other.body.data.token;
  assert.equal((await api().get(`/api/appointments/${first.body.data.id}`).set(auth(otherToken))).status, 404);
  assert.equal((await api().patch(`/api/appointments/${first.body.data.id}/cancel`).set(auth(otherToken)).send({})).status, 404);
  const trainerView = await api().get('/api/trainer/appointments').set(auth(trainerToken));
  assert.equal(trainerView.body.data.length, 1);
  const confirm = await api().patch(`/api/trainer/appointments/${first.body.data.id}/status`).set(auth(trainerToken)).send({ action: 'confirm' });
  assert.equal(confirm.body.data.status, 'confirmed');
  const adminList = await api().get('/api/admin/appointments?status=confirmed').set(auth(adminToken));
  assert.equal(adminList.body.meta.total, 1);
});

test('enrollment request and admin approval', async () => {
  const req = await api().post('/api/enrollments').set(auth(studentToken)).send({ courseId });
  assert.equal(req.status, 201);
  const approved = await api().patch(`/api/admin/enrollments/${req.body.data.id}/status`).set(auth(adminToken)).send({ status: 'approved' });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.status, 'approved');
  const mine = await api().get('/api/enrollments/my').set(auth(studentToken));
  assert.equal(mine.body.data[0].status, 'approved');
});

test('public inquiry submission is stored and visible to admins only', async () => {
  const res = await api().post('/api/inquiries').send({ name: 'Visitor', email: 'v@test.io', category: 'Admissions', subject: 'Batch timings', message: 'What are the weekend timings?' });
  assert.equal(res.status, 201);
  assert.match(res.body.data.ticketNo, /^INQ-/);
  assert.equal((await api().get('/api/admin/inquiries').set(auth(studentToken))).status, 403);
  assert.equal((await api().get('/api/admin/inquiries').set(auth(adminToken))).body.meta.total, 1);
});

test('malformed and invalid requests get clean 4xx responses', async () => {
  const malformed = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error.code, 'MALFORMED_JSON');
  assert.equal((await api().get('/api/courses/..%2F..%2Fusers')).status, 400);
  assert.equal((await api().get('/api/nope')).status, 404);
  const huge = await api().post('/api/inquiries').send({ name: 'x', message: 'a'.repeat(200 * 1024) });
  assert.equal(huge.status, 413);
});

test('logout revokes the token; password change signs out old sessions', async () => {
  const login = await api().post('/api/auth/login').send({ email: 'asha@test.io', password: 'Secret123' });
  const t = login.body.data.token;
  assert.equal((await api().post('/api/auth/logout').set(auth(t))).status, 200);
  assert.equal((await api().get('/api/auth/me').set(auth(t))).body.error.code, 'TOKEN_REVOKED');
  const changed = await api().post('/api/auth/change-password').set(auth(studentToken)).send({ currentPassword: 'Secret123', newPassword: 'NewSecret456' });
  assert.equal(changed.status, 200);
  assert.equal((await api().get('/api/auth/me').set(auth(studentToken))).status, 401, 'old token invalid');
  assert.equal((await api().get('/api/auth/me').set(auth(changed.body.data.token))).status, 200, 'new token works');
});

test('password reset flow uses a one-time hashed token', async () => {
  const res = await api().post('/api/auth/forgot-password').send({ email: 'asha@test.io' });
  assert.equal(res.status, 200);
  const unknown = await api().post('/api/auth/forgot-password').send({ email: 'ghost@test.io' });
  assert.equal(unknown.body.data.message, res.body.data.message);
  const [mail] = (await repos.outbox.all()).slice(-1);
  const token = mail.text.match(/token=([a-f0-9]+)/)[1];
  const stored = await repos.passwordResets.all();
  assert.ok(stored.every((r) => r.tokenHash !== token), 'only the hash is stored');
  assert.equal((await api().post('/api/auth/reset-password').send({ token, password: 'Reset789x' })).status, 200);
  assert.equal((await api().post('/api/auth/reset-password').send({ token, password: 'Reset789y' })).status, 400, 'token is single-use');
  assert.equal((await api().post('/api/auth/login').send({ email: 'asha@test.io', password: 'Reset789x' })).status, 200);
});

test('students cannot read other students via admin endpoints; admin can deactivate', async () => {
  assert.equal((await api().get(`/api/students/${studentId}`).set(auth(studentToken))).status, 401);
  const res = await api().patch(`/api/students/${studentId}`).set(auth(adminToken)).send({ isActive: false });
  assert.equal(res.body.data.isActive, false);
  assert.equal((await api().post('/api/auth/login').send({ email: 'asha@test.io', password: 'Reset789x' })).status, 403);
});
