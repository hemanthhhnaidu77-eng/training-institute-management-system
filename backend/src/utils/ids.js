'use strict';
const crypto = require('crypto');

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Human-friendly reference such as APT-20261027-7KX2QD */
function referenceCode(prefix, date = new Date(), length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let suffix = '';
  for (let i = 0; i < length; i++) suffix += alphabet[bytes[i] % alphabet.length];
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${stamp}-${suffix}`;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .slice(0, 100);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

module.exports = { newId, referenceCode, slugify, sha256 };
