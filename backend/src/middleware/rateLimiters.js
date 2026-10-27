'use strict';
const rateLimit = require('express-rate-limit');
const { config } = require('../config');

function limiter({ windowMs, limit, message }) {
  if (config.rateLimitDisabled) return (req, res, next) => next();
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message } }),
  });
}

module.exports = {
  authLimiter: limiter({ windowMs: 15 * 60 * 1000, limit: 20, message: 'Too many attempts. Please wait 15 minutes and try again.' }),
  passwordResetLimiter: limiter({ windowMs: 60 * 60 * 1000, limit: 5, message: 'Too many password reset requests. Try again in an hour.' }),
  publicFormLimiter: limiter({ windowMs: 15 * 60 * 1000, limit: 15, message: 'Too many submissions. Please try again later.' }),
  apiLimiter: limiter({ windowMs: 60 * 1000, limit: 300, message: 'Too many requests. Slow down a little.' }),
};
