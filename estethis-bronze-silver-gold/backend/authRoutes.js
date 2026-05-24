// ─────────────────────────────────────────────────────────────
// AUTH ROUTES
//
// Method 1 — Password
//   POST /register
//   POST /login
//
// Method 2 — OTP (one-time password)
//   POST /request-otp          ← send identifier (email or phone)
//   POST /login-otp            ← send identifier + code
//
// Method 3 — Magic link (passwordless)
//   POST /request-magic-link   ← send email
//   GET  /verify-magic-link    ← ?token=<uuid>
//
// Password recovery
//   POST /forgot-password      ← send email
//   POST /reset-password       ← send token + newPassword
//
// Session
//   POST /logout
//   GET  /me
//
// Admin
//   GET    /users
//   DELETE /users/:id
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import { loadUser, requireAuth, requireAdmin } from './authMiddleware.js';
import {
  register, login,
  requestOtp, loginWithOtp,
  requestMagicLink, verifyMagicLink,
  forgotPassword, resetPassword,
  logout, me, listUsers, deleteUser,
} from './authController.js';

const router = Router();

// ── Method 1: Password ────────────────────────────────────────
router.post('/register', register);
router.post('/login',    login);

// ── Method 2: OTP ─────────────────────────────────────────────
router.post('/request-otp', requestOtp);
router.post('/login-otp',   loginWithOtp);

// ── Method 3: Magic link ──────────────────────────────────────
router.post('/request-magic-link', requestMagicLink);
router.get ('/verify-magic-link',  verifyMagicLink);

// ── Password recovery ─────────────────────────────────────────
router.post('/forgot-password', forgotPassword);
router.post('/reset-password',  resetPassword);

// ── Session ───────────────────────────────────────────────────
router.post('/logout', loadUser, logout);
router.get ('/me',     loadUser, requireAuth, me);

// ── Admin ─────────────────────────────────────────────────────
router.get   ('/users',      loadUser, requireAdmin, listUsers);
router.delete('/users/:id',  loadUser, requireAdmin, deleteUser);

export default router;
