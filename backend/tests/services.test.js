'use strict';
require('./helpers/env');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { store, repos } = require('../src/storage');
const courseService = require('../src/services/courseService');
const trainerService = require('../src/services/trainerService');
const batchService = require('../src/services/batchService');
const enrollmentService = require('../src/services/enrollmentService');
const inquiryService = require('../src/services/inquiryService');
const reviewService = require('../src/services/reviewService');
const dashboardService = require('../src/services/dashboardService');
const { validate } = require('../src/utils/validate');
const S = require('../src/validation/schemas');

const admin = { id: 'usr_admin', role: 'admin', fullName: 'Admin' };
const studentA = { id: 'usr_a', role: 'student', fullName: 'Student A', email: 'a@x.io' };
const studentB = { id: 'usr_b', role: 'student', fullName: 'Student B', email: 'b@x.io' };
let trainer;
let course;

before(async () => {
  await store.init({ logger: { warn() {} } });
  await repos.users.mutate((rows) => rows.push(
    { ...studentA, isActive: true, createdAt: new Date().toISOString() },
    { ...studentB, isActive: true, createdAt: new Date().toISOString() }
  ));
});

test('trainer CRUD with validation and soft delete', async () => {
  const input = validate(S.trainer, { name: 'T One', designation: 'Mentor', specialization: 'JS', experienceYears: 5, bio: 'Bio text', email: 't1@x.io' });
  trainer = await trainerService.create(input, admin);
  assert.equal(trainer.availabilityDays.length, 5, 'defaults applied');
  const updated = await trainerService.update(trainer.id, { experienceYears: 6 }, admin);
  assert.equal(updated.experienceYears, 6);
  const publicView = await trainerService.get(trainer.id);
  assert.equal(publicView.email, undefined, 'public view hides contact details');
});

test('course CRUD: slug generation, fee rules, archive and hard delete protection', async () => {
  const input = validate(S.course, { title: 'Angular Basics', category: 'Web', shortDescription: 'Short', description: 'Long description', duration: '6 weeks', level: 'Beginner', fee: 20000, discountedFee: 18000, mode: 'Online', trainerId: trainer.id, syllabus: 'Intro\nComponents\n\nRouting' });
  assert.deepEqual(input.syllabus, ['Intro', 'Components', 'Routing'], 'multi-line text becomes a list');
  course = await courseService.create(input, admin);
  assert.equal(course.slug, 'angular-basics');
  const dup = await courseService.create(input, admin);
  assert.equal(dup.slug, 'angular-basics-2', 'slugs are unique');
  await assert.rejects(courseService.update(course.id, { discountedFee: 999999 }, admin), (e) => e.code === 'VALIDATION_ERROR');
  const detail = await courseService.get('angular-basics');
  assert.equal(detail.trainer.name, 'T One');
  assert.equal(detail.effectiveFee, 18000);
  const archived = await courseService.remove(dup.id, {}, admin);
  assert.equal(archived.status, 'archived');
  await assert.rejects(courseService.get(dup.id), (e) => e.status === 404, 'archived courses are hidden from the public');
  const list = await courseService.list({ q: 'angular' });
  assert.equal(list.items.length, 1);
});

test('enrollment request, duplicate prevention, approval with seat limits, completion certificate', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const batch = await batchService.create(validate(S.batch, { name: 'B1', courseId: course.id, trainerId: trainer.id, startDate: today, endDate: '2099-01-01', startTime: '10:00', endTime: '12:00', days: ['Mon', 'Wed'], mode: 'Online', capacity: 1 }), admin);
  assert.equal(batch.availableSeats, 1);
  const eA = await enrollmentService.request(studentA, { courseId: course.id, batchId: batch.id });
  assert.equal(eA.status, 'pending');
  await assert.rejects(enrollmentService.request(studentA, { courseId: course.id }), (e) => e.code === 'DUPLICATE_ENROLLMENT');
  const eB = await enrollmentService.request(studentB, { courseId: course.id });
  const approvedA = await enrollmentService.adminUpdateStatus(eA.id, { status: 'approved' }, admin);
  assert.equal(approvedA.status, 'approved');
  assert.equal((await batchService.get(batch.id)).availableSeats, 0);
  await assert.rejects(enrollmentService.adminUpdateStatus(eB.id, { status: 'approved', batchId: batch.id }, admin), (e) => e.code === 'BATCH_FULL');
  await assert.rejects(enrollmentService.adminUpdateStatus(eA.id, { status: 'rejected' }, admin), (e) => e.code === 'INVALID_TRANSITION');
  const done = await enrollmentService.adminUpdateStatus(eA.id, { status: 'completed' }, admin);
  assert.match(done.certificateNo, /^CERT-/);
  const notes = await repos.notifications.find((n) => n.userId === studentA.id);
  assert.ok(notes.some((n) => n.title === 'Enrollment approved'), 'student notified');
  await assert.rejects(enrollmentService.cancelMine(studentB, eA.id), (e) => e.status === 404, 'students cannot touch others\' enrollments');
});

test('reviews require enrollment and go through moderation', async () => {
  await assert.rejects(reviewService.create(studentB, { courseId: course.id, rating: 5, comment: 'Great course overall' }), (e) => e.code === 'NOT_ENROLLED');
  const review = await reviewService.create(studentA, { courseId: course.id, rating: 5, comment: 'Great course overall' });
  assert.equal(review.status, 'pending');
  assert.equal((await reviewService.listPublic({ courseId: course.id })).length, 0, 'pending reviews are hidden');
  await reviewService.moderate(review.id, { status: 'approved', publishAsTestimonial: true }, admin);
  const pub = await reviewService.listPublic({ courseId: course.id });
  assert.equal(pub[0].studentName, 'Student A.');
  assert.equal((await repos.testimonials.all()).length, 1);
});

test('inquiry submission, status change and notes', async () => {
  const created = await inquiryService.create(validate(S.inquiry, { name: 'Visitor', email: 'v@x.io', category: 'Other', subject: 'Hello', message: 'I would like more details please.' }), null);
  assert.match(created.ticketNo, /^INQ-/);
  await inquiryService.addNote(created.id, { note: 'Called back' }, admin);
  const resolved = await inquiryService.updateStatus(created.id, { status: 'resolved' }, admin);
  assert.equal(resolved.status, 'resolved');
  assert.equal(resolved.notes.length, 1);
  const list = await inquiryService.adminList({ q: 'visitor' });
  assert.equal(list.meta.total, 1);
});

test('admin dashboard statistics are computed from stored records', async () => {
  const d = await dashboardService.admin();
  assert.equal(d.stats.totalStudents, 2);
  assert.equal(d.stats.totalTrainers, 1);
  assert.equal(d.stats.activeCourses, 1);
  assert.equal(d.stats.totalInquiries, 1);
  assert.equal(d.trend.length, 6);
});
