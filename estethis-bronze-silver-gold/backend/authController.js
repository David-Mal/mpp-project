import bcrypt from 'bcryptjs';
import { User, Role, Permission } from './models/index.js';
import { createSession, deleteSession } from './session.js';
import { logUserAction } from './actionLogger.js';

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
  const token   = createSession(payload);
  // Explicit log — req.user not yet set (no session token at register time)
  logUserAction(user.id, payload.role, `Registered new account: ${email}`).catch(() => {});
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
  const token   = createSession(payload);
  // Explicit log — req.user not yet set (no session token at login time)
  logUserAction(user.id, payload.role, `Logged in as ${email}`).catch(() => {});
  res.json({ token, user: payload });
}

export function logout(req, res) {
  const token = req.headers['x-session-token'];
  if (token) deleteSession(token);
  res.status(204).end();
}

export function me(req, res) {
  res.json(req.user);
}

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
