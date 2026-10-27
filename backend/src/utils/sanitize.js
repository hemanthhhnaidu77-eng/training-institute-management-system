'use strict';
/** Strips secrets from a user record before it leaves the server. */
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, tokenVersion, ...safe } = user;
  return safe;
}

/** Public-facing trainer projection (no contact details or account links). */
function publicTrainer(trainer) {
  if (!trainer) return null;
  const { userId, email, phone, ...safe } = trainer;
  return safe;
}

module.exports = { publicUser, publicTrainer };
