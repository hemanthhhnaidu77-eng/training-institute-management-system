'use strict';
const { config } = require('../config');
const { JsonStore } = require('./jsonStore');
const Repository = require('./repository');

const store = new JsonStore(config.dataDir);

const repos = {
  users: new Repository(store, 'users', 'usr'),
  courses: new Repository(store, 'courses', 'crs'),
  trainers: new Repository(store, 'trainers', 'trn'),
  services: new Repository(store, 'services', 'svc'),
  batches: new Repository(store, 'batches', 'bat'),
  enrollments: new Repository(store, 'enrollments', 'enr'),
  appointments: new Repository(store, 'appointments', 'apt'),
  inquiries: new Repository(store, 'inquiries', 'inq'),
  testimonials: new Repository(store, 'testimonials', 'tst'),
  faqs: new Repository(store, 'faqs', 'faq'),
  notifications: new Repository(store, 'notifications', 'ntf'),
  reviews: new Repository(store, 'reviews', 'rev'),
  events: new Repository(store, 'events', 'evt'),
  newsletter: new Repository(store, 'newsletter', 'nws'),
  activity: new Repository(store, 'activity', 'act'),
  sessionRecords: new Repository(store, 'session_records', 'ses'),
  revokedTokens: new Repository(store, 'revoked_tokens', 'rvk'),
  passwordResets: new Repository(store, 'password_resets', 'pwr'),
  outbox: new Repository(store, 'outbox', 'mail'),
};

module.exports = { store, repos };
