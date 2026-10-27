'use strict';
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const authService = require('../services/authService');

module.exports = {
  register: asyncHandler(async (req, res) => created(res, await authService.register(req.body))),
  login: asyncHandler(async (req, res) => ok(res, await authService.login(req.body))),
  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.auth);
    ok(res, { loggedOut: true });
  }),
  me: asyncHandler(async (req, res) => ok(res, req.user)),
  refresh: asyncHandler(async (req, res) => ok(res, await authService.refresh(req.user, req.auth))),
  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body.email);
    ok(res, { message: 'If an account exists for this email, password reset instructions have been issued.' });
  }),
  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body);
    ok(res, { message: 'Password updated. You can now log in with your new password.' });
  }),
  changePassword: asyncHandler(async (req, res) => ok(res, await authService.changePassword(req.user.id, req.body))),
};
