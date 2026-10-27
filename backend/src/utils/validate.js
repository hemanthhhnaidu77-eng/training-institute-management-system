'use strict';
const ApiError = require('./ApiError');

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/;
const MOBILE_RE = /^(\+91)?[6-9]\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const URL_RE = /^(https?:\/\/[^\s<>"']+|\/[^\s<>"']*|assets\/[^\s<>"']+)$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Removes control characters and HTML tags from plain-text input. */
function cleanString(value, { multiline = false } = {}) {
  let s = String(value);
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (!multiline) s = s.replace(/[\r\n\t]+/g, ' ');
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  return s.trim();
}

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function label(field, rule) {
  return rule.label || field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

function emptyValue(rule) {
  if (rule.type === 'array') return [];
  if (rule.type === 'boolean') return false;
  return null;
}

function checkValue(field, rule, value, errors, partial) {
  const name = label(field, rule);
  const fail = (message) => {
    errors.push({ field, message });
    return undefined;
  };

  switch (rule.type) {
    case 'string':
    case 'text': {
      if (typeof value !== 'string' && typeof value !== 'number') return fail(`${name} must be text`);
      const s = cleanString(value, { multiline: rule.type === 'text' });
      const max = rule.maxLength || (rule.type === 'text' ? 5000 : 500);
      if (rule.minLength && s.length < rule.minLength) return fail(`${name} must be at least ${rule.minLength} characters`);
      if (s.length > max) return fail(`${name} must be at most ${max} characters`);
      if (rule.pattern && !rule.pattern.test(s)) return fail(rule.patternMessage || `${name} has an invalid format`);
      if (rule.required && !s) return fail(`${name} is required`);
      return s;
    }
    case 'email': {
      if (typeof value !== 'string') return fail(`${name} must be a valid email address`);
      const s = value.trim().toLowerCase();
      if (s.length > 254 || !EMAIL_RE.test(s)) return fail(`${name} must be a valid email address`);
      return s;
    }
    case 'mobile': {
      if (typeof value !== 'string' && typeof value !== 'number') return fail(`${name} must be a valid mobile number`);
      const s = String(value).replace(/[\s-]/g, '');
      if (!MOBILE_RE.test(s)) return fail(`${name} must be a valid 10-digit Indian mobile number`);
      return s.length === 13 ? s : s.slice(-10);
    }
    case 'password': {
      if (typeof value !== 'string') return fail(`${name} is required`);
      if (value.length < 8) return fail(`${name} must be at least 8 characters`);
      if (value.length > 128) return fail(`${name} must be at most 128 characters`);
      if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return fail(`${name} must contain at least one letter and one number`);
      return value;
    }
    case 'number': {
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
      if (!Number.isFinite(n)) return fail(`${name} must be a number`);
      if (rule.integer && !Number.isInteger(n)) return fail(`${name} must be a whole number`);
      if (rule.min !== undefined && n < rule.min) return fail(`${name} must be at least ${rule.min}`);
      if (rule.max !== undefined && n > rule.max) return fail(`${name} must be at most ${rule.max}`);
      return n;
    }
    case 'boolean': {
      if (value === true || value === 'true') return true;
      if (value === false || value === 'false') return false;
      return fail(`${name} must be true or false`);
    }
    case 'enum': {
      const s = typeof value === 'string' ? value.trim() : value;
      if (!rule.values.includes(s)) return fail(`${name} must be one of: ${rule.values.join(', ')}`);
      return s;
    }
    case 'date': {
      if (!isValidDate(value)) return fail(`${name} must be a valid date (YYYY-MM-DD)`);
      return value;
    }
    case 'time': {
      if (typeof value !== 'string' || !TIME_RE.test(value)) return fail(`${name} must be a valid time (HH:MM)`);
      return value;
    }
    case 'id': {
      if (typeof value !== 'string' || !ID_RE.test(value)) return fail(`${name} is not a valid identifier`);
      return value;
    }
    case 'url': {
      if (typeof value !== 'string') return fail(`${name} must be a URL`);
      const s = value.trim();
      if (s.length > 500 || !URL_RE.test(s)) return fail(`${name} must be an http(s) URL or a relative asset path`);
      return s;
    }
    case 'color': {
      if (typeof value !== 'string' || !COLOR_RE.test(value)) return fail(`${name} must be a hex color like #0B2545`);
      return value;
    }
    case 'array': {
      let arr = value;
      if (typeof arr === 'string') arr = arr.split(rule.separator || /\r?\n/);
      if (!Array.isArray(arr)) return fail(`${name} must be a list`);
      const max = rule.maxItems || 50;
      if (arr.length > max) return fail(`${name} can contain at most ${max} items`);
      const itemRule = rule.items || { type: 'string', maxLength: 300 };
      const out = [];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (item === null || item === undefined || (typeof item === 'string' && item.trim() === '')) continue;
        const sub = [];
        const v = checkValue(`${field}[${i}]`, { ...itemRule, label: `${name} item ${i + 1}` }, item, sub, partial);
        if (sub.length) {
          errors.push(...sub);
          return undefined;
        }
        out.push(v);
      }
      const final = rule.unique ? [...new Set(out)] : out;
      if (rule.minItems && final.length < rule.minItems) return fail(`${name} needs at least ${rule.minItems} item(s)`);
      return final;
    }
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return fail(`${name} must be an object`);
      try {
        return validate(rule.schema, value, { partial });
      } catch (err) {
        if (err instanceof ApiError && Array.isArray(err.details)) {
          errors.push(...err.details.map((d) => ({ field: `${field}.${d.field}`, message: d.message })));
          return undefined;
        }
        throw err;
      }
    }
    default:
      throw new Error(`Unknown validation type "${rule.type}" for ${field}`);
  }
}

/**
 * Validates and sanitises input against a schema. Unknown fields are dropped
 * (mass-assignment protection). With { partial: true } only provided fields are checked.
 */
function validate(schema, input, { partial = false } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw ApiError.badRequest('Request body must be a JSON object', undefined, 'INVALID_BODY');
  }
  const out = {};
  const errors = [];
  for (const [field, rule] of Object.entries(schema)) {
    const value = input[field];
    const missing = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    if (missing) {
      if (rule.required && (!partial || value !== undefined)) {
        errors.push({ field, message: `${label(field, rule)} is required` });
        continue;
      }
      if (value !== undefined) out[field] = emptyValue(rule);
      else if (!partial && rule.default !== undefined) out[field] = structuredClone(rule.default);
      continue;
    }
    const result = checkValue(field, rule, value, errors, partial);
    if (result !== undefined) out[field] = result;
  }
  if (errors.length) throw new ApiError(400, 'Please correct the highlighted fields', 'VALIDATION_ERROR', errors);
  return out;
}

module.exports = { validate, cleanString, isValidDate, EMAIL_RE, MOBILE_RE, TIME_RE };
