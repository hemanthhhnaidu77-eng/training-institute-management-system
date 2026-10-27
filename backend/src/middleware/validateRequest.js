'use strict';
const { validate } = require('../utils/validate');

/** Validates req.body against a schema and replaces it with the sanitised result. */
function body(schema, options = {}) {
  return (req, res, next) => {
    try {
      req.body = validate(schema, req.body ?? {}, options);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Validates :id style route params. */
function idParam(name = 'id') {
  return (req, res, next) => {
    const value = req.params[name];
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'Invalid identifier' } });
    }
    next();
  };
}

module.exports = { body, idParam };
