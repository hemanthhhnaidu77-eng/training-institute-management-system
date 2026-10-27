'use strict';
/**
 * Pure booking rules (no I/O) so they can be unit-tested in isolation.
 */
const { dayName, addDays, toMinutes } = require('../utils/dates');

const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];

/**
 * Computes slot availability for one date.
 * @param {object} p
 * @param {string} p.date        YYYY-MM-DD
 * @param {object|null} p.trainer trainer record or null for "any counsellor"
 * @param {object[]} p.appointments all appointment records
 * @param {object} p.settings    appointment settings (slots, workingDays, slotMinutes, counselorsPerSlot, bookingWindowDays)
 * @param {{date:string,time:string}} p.now current institute-local date/time
 * @param {string} [p.excludeId] appointment id to ignore (rescheduling)
 * @returns {{ date, dayOpen, reason, slots: {time, available, reason}[] }}
 */
function computeAvailability({ date, trainer, appointments, settings, now, excludeId }) {
  const result = { date, dayOpen: true, reason: null, slots: [] };
  const close = (reason) => ({ ...result, dayOpen: false, reason, slots: settings.slots.map((time) => ({ time, available: false, reason })) });

  if (date < now.date) return close('Date is in the past');
  if (date > addDays(now.date, settings.bookingWindowDays)) return close(`Bookings open up to ${settings.bookingWindowDays} days in advance`);
  const day = dayName(date);
  if (!settings.workingDays.includes(day)) return close('The institute is closed on this day');
  if (trainer && !(trainer.availabilityDays || []).includes(day)) return close(`${trainer.name} is not available on ${day}`);

  const active = appointments.filter((a) => a.date === date && ACTIVE_STATUSES.includes(a.status) && a.id !== excludeId);

  for (const time of settings.slots) {
    const start = toMinutes(time);
    let reason = null;
    if (date === now.date && start <= toMinutes(now.time)) reason = 'Time has passed';
    else if (trainer && (start < toMinutes(trainer.availableFrom || '00:00') || start + settings.slotMinutes > toMinutes(trainer.availableTo || '23:59'))) {
      reason = 'Outside trainer hours';
    } else if (trainer) {
      const clash = active.some((a) => a.trainerId === trainer.id && overlaps(a.time, time, settings.slotMinutes));
      if (clash) reason = 'Already booked';
    } else {
      const taken = active.filter((a) => !a.trainerId && a.time === time).length;
      if (taken >= settings.counselorsPerSlot) reason = 'Fully booked';
    }
    result.slots.push({ time, available: !reason, reason });
  }
  return result;
}

function overlaps(timeA, timeB, minutes) {
  const a = toMinutes(timeA);
  const b = toMinutes(timeB);
  return a < b + minutes && b < a + minutes;
}

/** True when the same person already holds an active booking that overlaps this slot. */
function hasDuplicate({ appointments, email, date, time, minutes, excludeId }) {
  return appointments.some(
    (a) => a.id !== excludeId && a.email === email && a.date === date && ACTIVE_STATUSES.includes(a.status) && overlaps(a.time, time, minutes)
  );
}

module.exports = { ACTIVE_STATUSES, computeAvailability, hasDuplicate, overlaps };
