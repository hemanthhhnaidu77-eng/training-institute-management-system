'use strict';
const ApiError = require('../utils/ApiError');
const { config } = require('../config');

function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again later.';
  let details;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body contains malformed JSON';
  } else if (err && err.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (err && err.name === 'StoreError') {
    status = 503;
    code = 'STORAGE_ERROR';
    message = config.isProd ? 'Data storage is temporarily unavailable' : err.message;
  }

  if (status >= 500) {
    // Log the error server-side without request bodies (they may contain passwords).
    console.error(`[error] ${req.method} ${req.originalUrl.split('?')[0]} ->`, err && err.stack ? err.stack : err);
  }

  const body = { success: false, error: { code, message } };
  if (details) body.error.details = details;
  if (!config.isProd && status >= 500 && err && err.message && !(err instanceof ApiError)) body.error.debug = err.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
