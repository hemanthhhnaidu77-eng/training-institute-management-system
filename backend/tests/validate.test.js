'use strict';
require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validate } = require('../src/utils/validate');
const S = require('../src/validation/schemas');

const validRegistration = { fullName: 'Asha Verma', email: 'Asha@Example.com ', mobile: '98765 43210', password: 'Secret123', acceptTerms: true };

test('valid registration is normalised', () => {
  const out = validate(S.register, validRegistration);
  assert.equal(out.email, 'asha@example.com');
  assert.equal(out.mobile, '9876543210');
});

test('invalid email, mobile and weak password are reported per field', () => {
  try {
    validate(S.register, { ...validRegistration, email: 'not-an-email', mobile: '12345', password: 'password' });
    assert.fail('should throw');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.code, 'VALIDATION_ERROR');
    const fields = err.details.map((d) => d.field).sort();
    assert.deepEqual(fields, ['email', 'mobile', 'password']);
  }
});

test('required fields are enforced and unknown fields are stripped (mass assignment)', () => {
  assert.throws(() => validate(S.register, { email: 'a@b.co' }), (e) => e.details.some((d) => d.field === 'fullName'));
  const out = validate(S.register, { ...validRegistration, role: 'admin', isActive: false });
  assert.equal(out.role, undefined);
  assert.equal(out.isActive, undefined);
});

test('HTML tags and control characters are stripped from text', () => {
  const out = validate(S.inquiry, { name: '<b>Ravi</b>', email: 'r@x.io', category: 'Other', subject: 'Hi\u0007 there', message: '<script>alert(1)</script>Please call me back' });
  assert.equal(out.name, 'Ravi');
  assert.equal(out.subject, 'Hi there');
  assert.ok(!out.message.includes('<script>'));
});

test('non-object bodies are rejected', () => {
  assert.throws(() => validate(S.login, null), /JSON object/);
  assert.throws(() => validate(S.login, ['a']), /JSON object/);
});

test('partial validation only checks provided fields', () => {
  const out = validate(S.course, { fee: '42000' }, { partial: true });
  assert.deepEqual(out, { fee: 42000 });
  assert.throws(() => validate(S.course, { level: 'Expert' }, { partial: true }), /highlighted/);
});

test('dates and times are strictly validated', () => {
  const base = { fullName: 'A B', email: 'a@b.co', mobile: '9876543210', mode: 'Online' };
  assert.throws(() => validate(S.appointment, { ...base, date: '2026-02-30', time: '10:00' }));
  assert.throws(() => validate(S.appointment, { ...base, date: '2026-12-01', time: '25:00' }));
  assert.ok(validate(S.appointment, { ...base, date: '2026-12-01', time: '10:00' }));
});
