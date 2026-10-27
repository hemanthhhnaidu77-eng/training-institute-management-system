'use strict';
/** Consistent success envelope: { success: true, data, meta? } */
function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}
function created(res, data, meta) {
  return ok(res, data, meta, 201);
}
module.exports = { ok, created };
