'use strict';
require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeAvailability, hasDuplicate } = require('../src/services/appointmentRules');

const settings = { slots: ['10:00', '11:00', '12:00', '14:00'], workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], slotMinutes: 45, counselorsPerSlot: 2, bookingWindowDays: 60 };
const now = { date: '2026-11-02', time: '10:30' }; // Monday
const trainer = { id: 'trn_1', name: 'Trainer One', availabilityDays: ['Mon', 'Wed'], availableFrom: '10:00', availableTo: '13:00' };
const appt = (over) => ({ id: Math.random().toString(36), date: '2026-11-04', time: '10:00', status: 'pending', trainerId: 'trn_1', email: 'x@y.z', ...over });

test('past dates are closed', () => {
  const r = computeAvailability({ date: '2026-11-01', trainer: null, appointments: [], settings, now });
  assert.equal(r.dayOpen, false);
  assert.ok(r.slots.every((s) => !s.available));
});

test('slots earlier today are unavailable, later ones open', () => {
  const r = computeAvailability({ date: '2026-11-02', trainer: null, appointments: [], settings, now });
  assert.equal(r.slots.find((s) => s.time === '10:00').available, false);
  assert.equal(r.slots.find((s) => s.time === '11:00').available, true);
});

test('closed weekdays and dates beyond the booking window are rejected', () => {
  assert.equal(computeAvailability({ date: '2026-11-08', trainer: null, appointments: [], settings, now }).dayOpen, false); // Sunday
  assert.equal(computeAvailability({ date: '2027-03-01', trainer: null, appointments: [], settings, now }).dayOpen, false);
});

test('trainer working days and hours are respected', () => {
  assert.equal(computeAvailability({ date: '2026-11-03', trainer, appointments: [], settings, now }).dayOpen, false); // Tuesday
  const wed = computeAvailability({ date: '2026-11-04', trainer, appointments: [], settings, now });
  assert.equal(wed.slots.find((s) => s.time === '12:00').available, true);
  assert.equal(wed.slots.find((s) => s.time === '14:00').reason, 'Outside trainer hours');
});

test('a trainer cannot be double booked; cancelled bookings free the slot', () => {
  const booked = computeAvailability({ date: '2026-11-04', trainer, appointments: [appt()], settings, now });
  assert.equal(booked.slots.find((s) => s.time === '10:00').reason, 'Already booked');
  const freed = computeAvailability({ date: '2026-11-04', trainer, appointments: [appt({ status: 'cancelled' })], settings, now });
  assert.equal(freed.slots.find((s) => s.time === '10:00').available, true);
});

test('rescheduling ignores the appointment being moved', () => {
  const a = appt();
  const r = computeAvailability({ date: '2026-11-04', trainer, appointments: [a], settings, now, excludeId: a.id });
  assert.equal(r.slots.find((s) => s.time === '10:00').available, true);
});

test('general counselling slots honour counselorsPerSlot capacity', () => {
  const rows = [appt({ trainerId: null }), appt({ trainerId: null, email: 'b@c.d' })];
  const r = computeAvailability({ date: '2026-11-04', trainer: null, appointments: rows, settings, now });
  assert.equal(r.slots.find((s) => s.time === '10:00').reason, 'Fully booked');
  assert.equal(r.slots.find((s) => s.time === '11:00').available, true);
});

test('duplicate / overlapping booking by the same person is detected', () => {
  const rows = [appt({ email: 'me@x.io', time: '10:00' })];
  assert.equal(hasDuplicate({ appointments: rows, email: 'me@x.io', date: '2026-11-04', time: '10:30', minutes: 45 }), true);
  assert.equal(hasDuplicate({ appointments: rows, email: 'me@x.io', date: '2026-11-04', time: '11:00', minutes: 45 }), false);
  assert.equal(hasDuplicate({ appointments: rows, email: 'other@x.io', date: '2026-11-04', time: '10:00', minutes: 45 }), false);
});
