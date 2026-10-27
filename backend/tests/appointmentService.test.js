'use strict';
require('./helpers/env');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { store, repos } = require('../src/storage');
const appointmentService = require('../src/services/appointmentService');
const settingsService = require('../src/services/settingsService');
const { nowInZone, addDays, dayName } = require('../src/utils/dates');

let trainer;
let date;

before(async () => {
  await store.init({ logger: { warn() {} } });
  await settingsService.update({ appointment: { slots: ['10:00', '11:00', '12:00'], workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], slotMinutes: 45, counselorsPerSlot: 1, bookingWindowDays: 60 } });
  date = addDays(nowInZone().date, 3);
  trainer = await repos.trainers.create({ name: 'Test Trainer', availabilityDays: [dayName(date)], availableFrom: '09:00', availableTo: '18:00', isActive: true });
});

const booking = (over = {}) => ({ fullName: 'Guest User', email: `guest${Math.random()}@x.io`, mobile: '9876543210', trainerId: trainer.id, date, time: '10:00', mode: 'Online', ...over });

test('creates an appointment with a unique appointment number and pending status', async () => {
  const a = await appointmentService.create(booking({ time: '12:00' }), null);
  assert.match(a.appointmentNo, /^APT-\d{8}-[A-Z0-9]{6}$/);
  assert.equal(a.status, 'pending');
  assert.equal(a.trainerName, 'Test Trainer');
  const saved = await repos.appointments.findById(a.id);
  assert.equal(saved.appointmentNo, a.appointmentNo, 'persisted to JSON');
});

test('10 simultaneous requests for one trainer slot -> exactly one succeeds', async () => {
  const results = await Promise.allSettled(Array.from({ length: 10 }, () => appointmentService.create(booking({ time: '10:00' }), null)));
  const ok = results.filter((r) => r.status === 'fulfilled');
  const conflicts = results.filter((r) => r.status === 'rejected' && r.reason.code === 'SLOT_UNAVAILABLE');
  assert.equal(ok.length, 1);
  assert.equal(conflicts.length, 9);
  assert.ok(conflicts[0].reason.details.alternatives.includes('11:00'), 'suggests free slots');
});

test('booking in the past is refused', async () => {
  await assert.rejects(appointmentService.create(booking({ date: addDays(nowInZone().date, -1), trainerId: undefined }), null), (e) => e.code === 'SLOT_UNAVAILABLE');
});

test('availability reflects existing bookings', async () => {
  const r = await appointmentService.availability({ date, trainerId: trainer.id });
  assert.equal(r.slots.find((s) => s.time === '10:00').available, false);
  assert.equal(r.slots.find((s) => s.time === '11:00').available, true);
});

test('student ownership: other students cannot cancel or view', async () => {
  const owner = { id: 'usr_owner', role: 'student', fullName: 'Owner' };
  const intruder = { id: 'usr_other', role: 'student', fullName: 'Other' };
  const a = await appointmentService.create(booking({ time: '11:00' }), owner);
  await assert.rejects(appointmentService.getForUser(a.id, intruder), (e) => e.status === 404);
  await assert.rejects(appointmentService.cancelByOwner(a.id, intruder, {}), (e) => e.status === 404);
  const cancelled = await appointmentService.cancelByOwner(a.id, owner, { reason: 'Plans changed' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.immediate, true);
});

test('admin confirm then student cancel creates a request; admin reschedule checks conflicts', async () => {
  const owner = { id: 'usr_2', role: 'student', fullName: 'Student Two' };
  const adminUser = { id: 'usr_admin', role: 'admin', fullName: 'Admin' };
  const a = await appointmentService.create(booking({ time: '11:00' }), owner);
  const confirmed = await appointmentService.applyAction(a.id, { action: 'confirm' }, adminUser);
  assert.equal(confirmed.status, 'confirmed');
  const req = await appointmentService.cancelByOwner(a.id, owner, { reason: 'Exam' });
  assert.equal(req.immediate, false);
  assert.equal(req.requestedAction.type, 'cancel');
  await assert.rejects(appointmentService.applyAction(a.id, { action: 'reschedule', date, time: '10:00' }, adminUser), (e) => e.code === 'SLOT_UNAVAILABLE');
  await assert.rejects(appointmentService.applyAction(a.id, { action: 'confirm' }, adminUser), (e) => e.code === 'INVALID_TRANSITION');
  const done = await appointmentService.applyAction(a.id, { action: 'cancel' }, adminUser);
  assert.equal(done.status, 'cancelled');
  assert.equal(done.requestedAction, null);
});
