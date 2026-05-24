// ─────────────────────────────────────────────────────────────
// AUTH CONTROLLER
//
// Supports three authentication methods:
//   1. Password   — POST /login    (email + password)
//   2. OTP        — POST /request-otp  →  POST /login-otp
//   3. Magic link — POST /request-magic-link  →  GET /verify-magic-link
//
// Password recovery:
//   POST /forgot-password  →  POST /reset-password
//
// Admin / user-management:
//   GET    /me
//   POST   /logout
//   GET    /users
//   DELETE /users/:id
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import { User, Role, Permission } from './models/index.js';
import { createSession, deleteSession } from './session.js';
import { logUserAction } from './actionLogger.js';
import {
  createOtp, verifyOtp,
  createMagicToken, verifyMagicToken,
  createResetToken, peekResetToken, consumeResetToken,
} from './tokenStore.js';

// ── Shared helpers ────────────────────────────────────────────

async function buildPayload(user) {
  const role = await Role.findByPk(user.roleId, {
    include: [{ model: Permission, attributes: ['name'] }],
  });
  return {
    id:          user.id,
    email:       user.email,
    phone:       user.phone ?? null,
    role:        role.name,
    permissions: role.Permissions.map(p => p.name),
  };
}

function logAction(userId, role, msg) {
  logUserAction(userId, role, msg).catch(() => {});
}

// ── 1. Password authentication ────────────────────────────────

export async function register(req, res) {
  const { email, phone, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = await User.findOne({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const userRole = await Role.findOne({ where: { name: 'user' } });
  if (!userRole) return res.status(500).json({ error: 'Roles not seeded — restart server' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, phone: phone || null, passwordHash, roleId: userRole.id });

  const payload = await buildPayload(user);
  const token   = createSession(payload, 'password');
  logAction(user.id, payload.role, `Registered new account: ${email}`);
  res.status(201).json({ token, user: payload });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = await buildPayload(user);
  const token   = createSession(payload, 'password');
  logAction(user.id, payload.role, `Logged in via password: ${email}`);
  res.json({ token, user: payload });
}

// ── 2. OTP authentication ─────────────────────────────────────

/**
 * Request a 6-digit OTP for an existing account.
 * Identifier can be email OR phone number.
 * In production this would trigger an SMS / email.
 * For the lab demo the code is returned in the response body.
 */
export async function requestOtp(req, res) {
  const { identifier } = req.body ?? {};
  if (!identifier)
    return res.status(400).json({ error: 'identifier (email or phone) required' });

  // Find the user by email OR phone
  const user = await User.findOne({
    where: identifier.includes('@')
      ? { email: identifier }
      : { phone: identifier },
  });
  if (!user) return res.status(404).json({ error: 'No account found for that identifier' });

  const code = createOtp(identifier);

  // In production: await smsService.send(user.phone, `Your code: ${code}`)
  console.log(`[OTP] ${identifier} → ${code}  (demo: returned in response)`);

  res.json({
    message: 'OTP generated. In production this would be sent via SMS/email.',
    // For demo purposes only — remove in production:
    _demo_otp: code,
    expiresInSeconds: 600,
  });
}

/**
 * Complete OTP login by providing the identifier + 6-digit code.
 */
export async function loginWithOtp(req, res) {
  const { identifier, code } = req.body ?? {};
  if (!identifier || !code)
    return res.status(400).json({ error: 'identifier and code required' });

  const valid = verifyOtp(identifier, String(code));
  if (!valid) return res.status(401).json({ error: 'Invalid or expired OTP' });

  const user = await User.findOne({
    where: identifier.includes('@')
      ? { email: identifier }
      : { phone: identifier },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const payload = await buildPayload(user);
  const token   = createSession(payload, 'otp');
  logAction(user.id, payload.role, `Logged in via OTP: ${identifier}`);
  res.json({ token, user: payload });
}

// ── 3. Magic-link authentication ──────────────────────────────

/**
 * Request a magic-link for the given email.
 * In production this would send an email with a clickable link.
 * For the lab demo the token is returned in the response body.
 */
export async function requestMagicLink(req, res) {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(404).json({ error: 'No account found for that email' });

  const magicToken = createMagicToken(email);
  const link       = `/api/auth/verify-magic-link?token=${magicToken}`;

  // In production: await emailService.send(email, `Click here: https://app.estethis.com${link}`)
  console.log(`[Magic Link] ${email} → ${link}  (demo: returned in response)`);

  res.json({
    message: 'Magic link generated. In production this would be sent via email.',
    // For demo purposes only — remove in production:
    _demo_link:  link,
    _demo_token: magicToken,
    expiresInSeconds: 900,
  });
}

/**
 * Verify a magic-link token and start a session.
 * Accepts token via query string: GET /verify-magic-link?token=<uuid>
 */
export async function verifyMagicLink(req, res) {
  const { token } = req.query ?? {};
  if (!token) return res.status(400).json({ error: 'token query parameter required' });

  const email = verifyMagicToken(token);
  if (!email) return res.status(401).json({ error: 'Invalid or expired magic link' });

  const user = await User.findOne({ where: { email } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const payload = await buildPayload(user);
  const session  = createSession(payload, 'magic-link');
  logAction(user.id, payload.role, `Logged in via magic link: ${email}`);
  res.json({ token: session, user: payload });
}

// ── Password recovery ─────────────────────────────────────────

/**
 * Generate a password-reset token for the given email.
 * In production this would be emailed; for the demo it is returned.
 */
export async function forgotPassword(req, res) {
  const { email } = req.body ?? {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const user = await User.findOne({ where: { email } });
  // Always return 200 to avoid leaking which emails are registered
  if (!user) {
    return res.json({
      message: 'If that email exists, a reset token has been sent.',
    });
  }

  const resetToken = createResetToken(user.id);
  console.log(`[Reset] ${email} → token: ${resetToken}  (demo: returned in response)`);

  res.json({
    message: 'Password reset token generated. In production this would be emailed.',
    // For demo purposes only — remove in production:
    _demo_token:     resetToken,
    expiresInSeconds: 1800,
  });
}

/**
 * Reset the password using a valid reset token.
 */
export async function resetPassword(req, res) {
  const { token, newPassword } = req.body ?? {};
  if (!token || !newPassword)
    return res.status(400).json({ error: 'token and newPassword required' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const userId = peekResetToken(token);
  if (!userId) return res.status(401).json({ error: 'Invalid or expired reset token' });

  const user = await User.findByPk(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  consumeResetToken(token); // single-use

  logAction(user.id, 'system', `Password reset for: ${user.email}`);
  res.json({ message: 'Password updated successfully. Please log in with your new password.' });
}

// ── Session endpoints ─────────────────────────────────────────

export function logout(req, res) {
  const token = req.headers['x-session-token'];
  if (token) deleteSession(token);
  res.status(204).end();
}

export function me(req, res) {
  res.json(req.user);
}

// ── Admin: user management ────────────────────────────────────

export async function listUsers(_req, res) {
  const users = await User.findAll({
    include: [{ model: Role, attributes: ['name'] }],
    attributes: ['id', 'email', 'phone', 'createdAt'],
    order: [['id', 'ASC']],
  });
  res.json(users.map(u => ({
    id:        u.id,
    email:     u.email,
    phone:     u.phone ?? null,
    role:      u.Role.name,
    createdAt: u.createdAt,
  })));
}

export async function deleteUser(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await user.destroy();
  res.status(204).end();
}
