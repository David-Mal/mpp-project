// ─────────────────────────────────────────────────────────────
// AUTH SEED — roles, permissions, and default accounts
//
// Three roles with distinct permission scopes:
//
//   admin   — full access (all 8 permissions)
//   manager — product + review + generator management, can read
//             users but cannot delete them
//   user    — read-only on products, can write reviews
// ─────────────────────────────────────────────────────────────

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

// ── Permission sets per role ───────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin: ALL_PERMISSIONS,                          // unrestricted

  manager: [                                       // catalogue operations
    'products:read',
    'products:write',
    'reviews:read',
    'reviews:write',
    'stats:read',
    'generator:manage',
    'users:read',                                  // can see who exists
    // NOT users:manage — cannot create/delete accounts
  ],

  user: [                                          // read + personal reviews
    'products:read',
    'reviews:read',
    'reviews:write',
    'stats:read',
  ],
};

export default async function authSeed() {
  // ── 1. Ensure all roles exist ─────────────────────────────────
  const roleMap = {};
  for (const name of Object.keys(ROLE_PERMISSIONS)) {
    const [role] = await Role.findOrCreate({ where: { name } });
    roleMap[name] = role;
  }

  // ── 2. Ensure all permissions exist ──────────────────────────
  const permMap = {};
  for (const name of ALL_PERMISSIONS) {
    const [perm] = await Permission.findOrCreate({ where: { name } });
    permMap[name] = perm;
  }

  // ── 3. Wire role → permission mappings ───────────────────────
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleMap[roleName];
    for (const permName of perms) {
      await RolePermission.findOrCreate({
        where: { roleId: role.id, permissionId: permMap[permName].id },
      });
    }
  }

  // ── 4. Seed one default account per role ─────────────────────
  const [adminPw, managerPw, userPw] = await Promise.all([
    bcrypt.hash('admin123',   10),
    bcrypt.hash('manager123', 10),
    bcrypt.hash('user123',    10),
  ]);

  await User.findOrCreate({
    where:    { email: 'admin@estethis.com' },
    defaults: { passwordHash: adminPw,   phone: '+40700000001', roleId: roleMap.admin.id },
  });
  await User.findOrCreate({
    where:    { email: 'manager@estethis.com' },
    defaults: { passwordHash: managerPw, phone: '+40700000002', roleId: roleMap.manager.id },
  });
  await User.findOrCreate({
    where:    { email: 'user@estethis.com' },
    defaults: { passwordHash: userPw,    phone: '+40700000003', roleId: roleMap.user.id },
  });
}
