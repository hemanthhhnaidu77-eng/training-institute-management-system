'use strict';
const ApiError = require('../utils/ApiError');
const authService = require('../services/authService');

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
}

/** Requires a valid, unexpired, non-revoked JWT belonging to an active user. */
async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Please log in to continue', 'NO_TOKEN');
    const { user, payload } = await authService.verifyToken(token);
    req.user = user;
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
}

/** Attaches req.user when a valid token is present; otherwise continues anonymously. */
async function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const { user, payload } = await authService.verifyToken(token);
    req.user = user;
    req.auth = payload;
  } catch {
    /* invalid tokens are ignored on public endpoints */
  }
  next();
}

/** Role gate. Always use after authenticate. */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

module.exports = { authenticate, optionalAuth, authorize };
