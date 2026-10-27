'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { repos } = require('../storage');
const ApiError = require('../utils/ApiError');
const { newId, sha256 } = require('../utils/ids');
const { publicUser } = require('../utils/sanitize');
const revocation = require('./tokenRevocation');
const notifications = require('./notificationService');
const activity = require('./activityService');
const mail = require('./mailService');

// Used to keep login timing similar whether or not the email exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-not-a-real-password', 4);

function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptRounds);
}

function issueToken(user, remember = false) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: user.id, role: user.role, tv: user.tokenVersion || 0, rem: Boolean(remember) },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: remember ? config.jwt.rememberExpiresIn : config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      jwtid: jti,
    }
  );
  const { exp } = jwt.decode(token);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

async function verifyToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Your session has expired. Please log in again.', 'TOKEN_EXPIRED');
    throw ApiError.unauthorized('Invalid authentication token', 'INVALID_TOKEN');
  }
  if (await revocation.isRevoked(payload.jti)) throw ApiError.unauthorized('This session has been logged out', 'TOKEN_REVOKED');
  const user = await repos.users.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not available', 'ACCOUNT_UNAVAILABLE');
  if ((user.tokenVersion || 0) !== payload.tv) throw ApiError.unauthorized('This session is no longer valid. Please log in again.', 'TOKEN_REVOKED');
  return { user: publicUser(user), payload };
}

async function register(input) {
  if (input.acceptTerms !== true) {
    throw ApiError.badRequest('You must accept the terms and conditions', [{ field: 'acceptTerms', message: 'Please accept the terms and conditions' }], 'VALIDATION_ERROR');
  }
  if (input.preferredCourseId) {
    const course = await repos.courses.findById(input.preferredCourseId);
    if (!course) throw ApiError.badRequest('Preferred course not found', [{ field: 'preferredCourseId', message: 'Select a valid course' }], 'VALIDATION_ERROR');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await repos.users.mutate((rows) => {
    if (rows.some((u) => u.email === input.email)) {
      throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    }
    const now = new Date().toISOString();
    const record = {
      id: newId('usr'),
      role: 'student',
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      passwordHash,
      preferredCourseId: input.preferredCourseId || null,
      trainerId: null,
      isActive: true,
      tokenVersion: 0,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };
    rows.push(record);
    return structuredClone(record);
  });
  await notifications.notify(user.id, {
    title: 'Welcome aboard!',
    message: 'Your student account is ready. Explore courses and book a free consultation.',
    type: 'success',
    link: '/courses',
  });
  await activity.log(user, 'registered', 'user', user.id, `${user.fullName} created a student account`);
  return { user: publicUser(user), ...issueToken(user, false) };
}

async function login({ email, password, remember }) {
  const user = await repos.users.findOne((u) => u.email === email);
  const valid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !valid) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact the institute.', 'ACCOUNT_DISABLED');
  const updated = await repos.users.update(user.id, { lastLoginAt: new Date().toISOString() });
  return { user: publicUser(updated), ...issueToken(updated, remember) };
}

async function logout(payload) {
  await revocation.revoke(payload.jti, payload.exp);
}

/** Rotates a still-valid token: the old one is revoked and a fresh one issued. */
async function refresh(user, payload) {
  const full = await repos.users.findById(user.id);
  await revocation.revoke(payload.jti, payload.exp);
  return { user: publicUser(full), ...issueToken(full, payload.rem) };
}

async function forgotPassword(email) {
  const user = await repos.users.findOne((u) => u.email === email && u.isActive);
  if (!user) return; // identical response either way (no account enumeration)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + config.resetTokenMinutes * 60 * 1000).toISOString();
  await repos.passwordResets.mutate((rows) => {
    const now = new Date().toISOString();
    // Invalidate previous outstanding tokens for this user and prune old entries.
    const kept = rows.filter((r) => r.userId !== user.id && r.expiresAt > now && !r.usedAt);
    kept.push(repos.passwordResets.build({ userId: user.id, tokenHash: sha256(token), expiresAt, usedAt: null }));
    rows.splice(0, rows.length, ...kept);
  });
  const link = `${config.frontendUrl}/reset-password?token=${token}`;
  await mail.deliver({
    to: user.email,
    subject: 'Reset your password',
    text: `Hi ${user.fullName},\n\nUse this link within ${config.resetTokenMinutes} minutes to choose a new password:\n${link}\n\nIf you did not request this, ignore this message.`,
  });
  await activity.log(user, 'password_reset_requested', 'user', user.id, 'Password reset requested');
}

async function resetPassword({ token, password }) {
  const tokenHash = sha256(token);
  const now = new Date().toISOString();
  const reset = await repos.passwordResets.mutate((rows) => {
    const row = rows.find((r) => r.tokenHash === tokenHash);
    if (!row || row.usedAt || row.expiresAt <= now) return null;
    row.usedAt = now;
    return structuredClone(row);
  });
  if (!reset) throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.', undefined, 'INVALID_RESET_TOKEN');
  const passwordHash = await hashPassword(password);
  const user = await repos.users.mutate((rows) => {
    const u = rows.find((r) => r.id === reset.userId);
    if (!u) return null;
    u.passwordHash = passwordHash;
    u.tokenVersion = (u.tokenVersion || 0) + 1; // signs out every existing session
    u.updatedAt = now;
    return structuredClone(u);
  });
  if (!user) throw ApiError.badRequest('Account no longer exists', undefined, 'INVALID_RESET_TOKEN');
  await notifications.notify(user.id, { title: 'Password changed', message: 'Your password was reset successfully.', type: 'warning' });
  await activity.log(user, 'password_reset', 'user', user.id, 'Password reset completed');
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await repos.users.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw ApiError.badRequest('Current password is incorrect', [{ field: 'currentPassword', message: 'Current password is incorrect' }], 'VALIDATION_ERROR');
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw ApiError.badRequest('New password must be different', [{ field: 'newPassword', message: 'Choose a password you have not used here' }], 'VALIDATION_ERROR');
  }
  const passwordHash = await hashPassword(newPassword);
  const updated = await repos.users.update(user.id, { passwordHash, tokenVersion: (user.tokenVersion || 0) + 1 });
  await notifications.notify(user.id, { title: 'Password changed', message: 'Your password was changed. Other sessions were signed out.', type: 'warning' });
  return { user: publicUser(updated), ...issueToken(updated, false) };
}

/** Admin/CLI provisioning of admin and trainer accounts (never via public registration). */
async function createStaffUser(input, actor = null) {
  if (input.role === 'trainer') {
    if (!input.trainerId) throw ApiError.badRequest('Select the trainer profile this account belongs to', [{ field: 'trainerId', message: 'Required for trainer accounts' }], 'VALIDATION_ERROR');
    const trainer = await repos.trainers.findById(input.trainerId);
    if (!trainer) throw ApiError.badRequest('Trainer profile not found', [{ field: 'trainerId', message: 'Trainer not found' }], 'VALIDATION_ERROR');
    if (trainer.userId) throw ApiError.conflict('This trainer already has a login account', 'TRAINER_HAS_ACCOUNT');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await repos.users.mutate((rows) => {
    if (rows.some((u) => u.email === input.email)) throw ApiError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
    const now = new Date().toISOString();
    const record = {
      id: newId('usr'),
      role: input.role,
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      passwordHash,
      preferredCourseId: null,
      trainerId: input.role === 'trainer' ? input.trainerId : null,
      isActive: true,
      tokenVersion: 0,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    rows.push(record);
    return structuredClone(record);
  });
  if (user.role === 'trainer') await repos.trainers.update(user.trainerId, { userId: user.id });
  await activity.log(actor, 'staff_account_created', 'user', user.id, `${user.role} account created for ${user.fullName}`);
  return publicUser(user);
}

async function listStaff() {
  const users = await repos.users.find((u) => u.role !== 'student');
  return users.map(publicUser).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

module.exports = {
  hashPassword, issueToken, verifyToken, register, login, logout, refresh, forgotPassword,
  resetPassword, changePassword, createStaffUser, listStaff,
};
