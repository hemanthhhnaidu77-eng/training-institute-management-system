'use strict';
/**
 * Access-token revocation list (logout / refresh rotation).
 * Revoked token ids (jti) are cached in memory and persisted to revoked_tokens.json
 * so they survive restarts. Expired entries are pruned automatically.
 * Password changes / deactivation additionally bump user.tokenVersion, which
 * invalidates every token issued before the change.
 */
const { repos } = require('../storage');

let cache = null;

async function load() {
  if (cache) return cache;
  const rows = await repos.revokedTokens.all();
  const now = Math.floor(Date.now() / 1000);
  cache = new Map(rows.filter((r) => r.exp > now).map((r) => [r.jti, r.exp]));
  return cache;
}

async function revoke(jti, exp) {
  if (!jti) return;
  const map = await load();
  map.set(jti, exp);
  const now = Math.floor(Date.now() / 1000);
  await repos.revokedTokens.mutate((rows) => {
    const kept = rows.filter((r) => r.exp > now && r.jti !== jti);
    kept.push({ jti, exp, revokedAt: new Date().toISOString() });
    rows.splice(0, rows.length, ...kept);
  });
}

async function isRevoked(jti) {
  const map = await load();
  const exp = map.get(jti);
  if (exp === undefined) return false;
  if (exp <= Math.floor(Date.now() / 1000)) {
    map.delete(jti);
    return false;
  }
  return true;
}

function _resetCache() {
  cache = null;
}

module.exports = { revoke, isRevoked, _resetCache };
