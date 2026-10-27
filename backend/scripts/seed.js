'use strict';
/**
 * Seeds demonstration content and development accounts.
 *
 *   npm run seed            -> seeds only EMPTY collections (safe to re-run)
 *   npm run seed -- --force -> backs up, then replaces demo content collections
 *
 * Admin/trainer passwords come from SEED_ADMIN_PASSWORD / SEED_TRAINER_PASSWORD.
 * If not set, strong random passwords are generated and printed ONCE.
 */
const crypto = require('crypto');
const { config } = require('../src/config');
const { store, repos } = require('../src/storage');
const { newId, slugify } = require('../src/utils/ids');
const { addDays, nowInZone } = require('../src/utils/dates');
const { validate } = require('../src/utils/validate');
const S = require('../src/validation/schemas');
const authService = require('../src/services/authService');
const data = require('./seed-data');

const force = process.argv.includes('--force');
const stamp = () => new Date().toISOString();
const rec = (prefix, fields) => ({ id: newId(prefix), ...fields, createdAt: stamp(), updatedAt: stamp() });

function randomPassword() {
  return `${crypto.randomBytes(9).toString('base64url')}A1`;
}

async function seedCollection(name, build) {
  const existing = await store.read(name);
  if (existing.length && !force) {
    console.log(`  - ${name}: kept ${existing.length} existing record(s)`);
    return existing;
  }
  const rows = build();
  await store.replace(name, rows);
  console.log(`  + ${name}: seeded ${rows.length} record(s)`);
  return rows;
}

async function main() {
  await store.init();
  if (force) console.log(`Backup created at ${await store.backup('pre-seed')}`);
  const today = nowInZone().date;
  console.log('Seeding demonstration content...');

  const trainers = await seedCollection('trainers', () =>
    data.trainers.map(({ key, ...t }) => rec('trn', { ...validate(S.trainer, t), photoUrl: null, userId: null, courseIds: [], seedKey: key }))
  );
  const trainerId = (key) => (trainers.find((t) => t.seedKey === key) || {}).id || null;

  const courses = await seedCollection('courses', () =>
    data.courses.map(({ key, trainer, ...c }) => rec('crs', { ...validate(S.course, c), slug: slugify(c.title), imageUrl: null, trainerId: trainerId(trainer), seedKey: key }))
  );
  const courseId = (key) => (courses.find((c) => c.seedKey === key) || {}).id || null;

  // Link trainers to the courses they teach.
  if (force || !(await store.read('trainers')).some((t) => t.courseIds && t.courseIds.length)) {
    await store.mutate('trainers', (rows) => {
      for (const t of rows) t.courseIds = courses.filter((c) => c.trainerId === t.id).map((c) => c.id);
    });
  }

  await seedCollection('services', () =>
    data.services.map(([title, icon, description, benefits, deliveryMode, ctaLabel, ctaType], i) =>
      rec('svc', { title, icon, description, benefits, deliveryMode, ctaLabel, ctaType, order: (i + 1) * 10, isEnabled: true })
    )
  );

  await seedCollection('faqs', () => data.faqs.map(([category, question, answer], i) => rec('faq', { category, question, answer, order: (i + 1) * 10, isPublished: true })));

  await seedCollection('testimonials', () => data.testimonials.map((t) => rec('tst', { ...t, isPublished: true, isSample: true })));

  await seedCollection('batches', () => {
    const plan = [
      ['fullstack', 'ananya', 'FSD Weekday Morning', 7, 168, '10:00', '12:00', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 'Hybrid', 30],
      ['fullstack', 'ananya', 'FSD Weekend', 12, 180, '09:30', '13:00', ['Sat', 'Sun'], 'Online', 40],
      ['java', 'rahul', 'Java Evening', 5, 84, '18:00', '20:00', ['Mon', 'Wed', 'Fri'], 'Offline', 25],
      ['python', 'priya', 'Python Fast-Track', 3, 45, '14:00', '16:00', ['Tue', 'Wed', 'Thu'], 'Online', 35],
      ['datascience', 'priya', 'Data Science Hybrid', 14, 154, '11:00', '13:00', ['Tue', 'Thu', 'Sat'], 'Hybrid', 30],
      ['aiml', 'priya', 'AI/ML Advanced Online', 21, 189, '19:00', '21:00', ['Mon', 'Wed'], 'Online', 40],
      ['cloud', 'vikram', 'Cloud Weekend Labs', 9, 93, '10:00', '13:00', ['Sat'], 'Online', 30],
      ['cyber', 'sneha', 'Cybersecurity Lab Batch', 10, 122, '15:00', '17:00', ['Mon', 'Wed', 'Thu'], 'Offline', 20],
      ['testing', 'arjun', 'QA Automation Online', 6, 76, '17:00', '19:00', ['Tue', 'Fri'], 'Online', 35],
      ['marketing', 'meera', 'Digital Marketing Hybrid', 8, 92, '11:00', '13:00', ['Mon', 'Thu'], 'Hybrid', 30],
    ];
    return plan.map(([course, trainer, name, startIn, length, startTime, endTime, days, mode, capacity]) =>
      rec('bat', {
        name, courseId: courseId(course), trainerId: trainerId(trainer), startDate: addDays(today, startIn), endDate: addDays(today, startIn + length),
        startTime, endTime, days, mode, location: mode === 'Online' ? 'Live online classroom' : 'Main campus, Lab 2', capacity, status: 'upcoming', notes: null,
      })
    );
  });

  await seedCollection('events', () => [
    rec('evt', { title: 'Build Your First REST API (Workshop)', type: 'Workshop', date: addDays(today, 10), startTime: '10:00', endTime: '13:00', mode: 'Offline', location: 'Main campus', description: 'Hands-on workshop: design and build a small Express API with validation and authentication.', isPublished: true }),
    rec('evt', { title: 'Careers in Data & AI (Webinar)', type: 'Webinar', date: addDays(today, 16), startTime: '18:00', endTime: '19:00', mode: 'Online', location: 'Online', description: 'An open session on roles, skills and learning paths in data science and AI.', isPublished: true }),
    rec('evt', { title: 'Cloud Fundamentals Bootcamp', type: 'Workshop', date: addDays(today, 24), startTime: '10:00', endTime: '16:00', mode: 'Hybrid', location: 'Main campus + online', description: 'One-day bootcamp covering core cloud services with guided labs.', isPublished: true }),
  ]);

  // ---- Accounts ------------------------------------------------------------
  const users = await store.read('users');
  const printed = [];
  if (!users.some((u) => u.role === 'admin')) {
    const password = process.env.SEED_ADMIN_PASSWORD || randomPassword();
    const email = (process.env.SEED_ADMIN_EMAIL || 'admin@institute.local').toLowerCase();
    validate(S.staffUser, { role: 'admin', fullName: 'Institute Administrator', email, mobile: '9000000001', password });
    await authService.createStaffUser({ role: 'admin', fullName: 'Institute Administrator', email, mobile: '9000000001', password });
    printed.push({ role: 'admin', email, password: process.env.SEED_ADMIN_PASSWORD ? '(from SEED_ADMIN_PASSWORD)' : password });
  } else {
    console.log('  - admin account already exists (not modified)');
  }
  const freshTrainers = await store.read('trainers');
  for (const key of ['ananya', 'priya']) {
    const t = freshTrainers.find((x) => x.seedKey === key);
    if (!t || t.userId) continue;
    const password = process.env.SEED_TRAINER_PASSWORD || randomPassword();
    await authService.createStaffUser({ role: 'trainer', fullName: t.name, email: t.email, mobile: key === 'ananya' ? '9000000002' : '9000000003', password, trainerId: t.id });
    printed.push({ role: 'trainer', email: t.email, password: process.env.SEED_TRAINER_PASSWORD ? '(from SEED_TRAINER_PASSWORD)' : password });
  }

  console.log('\nSeed complete.');
  if (printed.length) {
    console.log('\nDevelopment accounts (shown ONCE; store them safely and change them after first login):');
    for (const p of printed) console.log(`  ${p.role.padEnd(8)} ${p.email.padEnd(34)} ${p.password}`);
    console.log('\nStudent accounts: register through the website (/register).');
  }
  if (config.isProd) console.warn('\nWARNING: you seeded demo content in production mode.');
}

main().catch((err) => {
  console.error('Seed failed:', err.details ? JSON.stringify(err.details) : err.message);
  process.exit(1);
});
