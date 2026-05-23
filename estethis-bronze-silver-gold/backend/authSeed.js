import bcrypt from 'bcryptjs';
import { Role, Permission, RolePermission, User } from './models/index.js';

const ALL_PERMISSIONS = [
  'products:read',
  'products:write',
  'reviews:read',
  'reviews:write',
  'stats:read',
  'generator:manage',
  'users:read',
  'users:manage',
];

// Permissions granted to the regular 'user' role
const USER_PERMISSIONS = ['products:read', 'reviews:read', 'reviews:write', 'stats:read'];

export default async function authSeed() {
  // ── Roles ────────────────────────────────────────────────────
  const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' } });
  const [userRole]  = await Role.findOrCreate({ where: { name: 'user'  } });

  // ── Permissions ──────────────────────────────────────────────
  const permMap = {};
  for (const name of ALL_PERMISSIONS) {
    const [perm] = await Permission.findOrCreate({ where: { name } });
    permMap[name] = perm;
  }

  // ── Role → Permission wiring ─────────────────────────────────
  for (const perm of Object.values(permMap)) {
    await RolePermission.findOrCreate({
      where: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  for (const name of USER_PERMISSIONS) {
    await RolePermission.findOrCreate({
      where: { roleId: userRole.id, permissionId: permMap[name].id },
    });
  }

  // ── Default accounts ─────────────────────────────────────────
  const [adminPw, userPw] = await Promise.all([
    bcrypt.hash('admin123', 10),
    bcrypt.hash('user123',  10),
  ]);
  await User.findOrCreate({
    where:    { email: 'admin@estethis.com' },
    defaults: { passwordHash: adminPw, roleId: adminRole.id },
  });
  await User.findOrCreate({
    where:    { email: 'user@estethis.com' },
    defaults: { passwordHash: userPw, roleId: userRole.id },
  });
}
