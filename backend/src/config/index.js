'use strict';
const path = require('path');
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') throw err;
  // dotenv not installed (e.g. running isolated unit tests): rely on real environment variables.
}

const env = process.env.NODE_ENV || 'development';

function list(value, fallback) {
  return String(value || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: parseInt(process.env.PORT || '3000', 10),
  corsOrigins: list(process.env.CORS_ORIGINS, 'http://localhost:4200'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  dataDir: path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data')),
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
    rememberExpiresIn: process.env.JWT_REMEMBER_EXPIRES_IN || '7d',
    issuer: 'training-institute-api',
    audience: 'training-institute-web',
  },
  bcryptRounds: Math.min(Math.max(parseInt(process.env.BCRYPT_ROUNDS || '12', 10), 4), 15),
  resetTokenMinutes: 30,
  devMailOutbox: process.env.DEV_MAIL_OUTBOX ? process.env.DEV_MAIL_OUTBOX === 'true' : env !== 'production',
  rateLimitDisabled: process.env.RATE_LIMIT_DISABLED === 'true' && env !== 'production',
  trustProxy: process.env.TRUST_PROXY === 'true',
  bodyLimit: '100kb',
};

function assertConfig() {
  const secret = config.jwt.secret;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or shorter than 32 characters. Copy backend/.env.example to backend/.env and set a long random JWT_SECRET.'
    );
  }
  if (config.isProd && config.corsOrigins.some((o) => o === '*')) {
    throw new Error('CORS_ORIGINS must list explicit origins in production.');
  }
}

module.exports = { config, assertConfig };
