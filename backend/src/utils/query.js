'use strict';

function toInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Reads ?page=&limit= safely (limit capped at 100). */
function pageParams(query = {}, defaultLimit = 20) {
  return {
    page: toInt(query.page, 1, 1, 100000),
    limit: toInt(query.limit, defaultLimit, 1, 100),
  };
}

function paginate(items, { page, limit }) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), meta: { page, limit, total, totalPages } };
}

/** Case-insensitive search across the listed (possibly nested "a.b") fields. */
function matchesSearch(record, q, fields) {
  if (!q) return true;
  const needle = String(q).toLowerCase().trim();
  if (!needle) return true;
  return fields.some((field) => {
    const value = field.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), record);
    if (Array.isArray(value)) return value.some((v) => String(v).toLowerCase().includes(needle));
    return value != null && String(value).toLowerCase().includes(needle);
  });
}

function cleanQueryString(value, max = 100) {
  if (value === undefined || value === null) return '';
  return String(Array.isArray(value) ? value[0] : value).trim().slice(0, max);
}

function sortBy(items, key, dir = 'asc') {
  const factor = dir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
    return String(va).localeCompare(String(vb), 'en', { numeric: true }) * factor;
  });
}

module.exports = { pageParams, paginate, matchesSearch, cleanQueryString, sortBy, toInt };
