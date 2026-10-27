'use strict';
/** Must be required FIRST in every test file: isolates data in a temp dir. */
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tim-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = dir;
process.env.JWT_SECRET = 'test-secret-that-is-definitely-longer-than-32-chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.DEV_MAIL_OUTBOX = 'true';

module.exports = { dataDir: dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
