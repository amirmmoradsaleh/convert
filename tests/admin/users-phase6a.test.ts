import { describe, it, expect, beforeEach } from 'vitest';
import {
  listAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  generatePasswordResetToken,
  completePasswordReset,
} from '@/lib/admin/services/user.service';
import { loginAdmin } from '@/lib/admin/services/auth.service';
import { verifyPassword, hashToken } from '@/lib/admin/crypto';
import { resetMemoryDb, getDb } from '@/lib/db';
import { hasPermission } from '@/lib/admin/permissions';
import { AdminUserSession } from '@/lib/admin/types';

describe('Admin CMS Phase 06A — User Management & Security Hardening Test Suite', () => {
  const superAdminSession: AdminUserSession = {
    id: 'admin-super-01',
    email: 'admin@filetools.local',
    name: 'System Administrator',
    role: 'SUPER_ADMIN',
  };

  const standardAdminSession: AdminUserSession = {
    id: 'admin-std-01',
    email: 'standard@filetools.local',
    name: 'Standard Admin',
    role: 'ADMIN',
  };

  const viewerSession: AdminUserSession = {
    id: 'viewer-01',
    email: 'viewer@filetools.local',
    name: 'Read Only Viewer',
    role: 'VIEWER',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. User CRUD & Filtering', () => {
    it('lists default initial super admin user', async () => {
      const result = await listAdminUsers();
      expect(result.total).toBe(1);
      expect(result.users[0].email).toBe('admin@filetools.local');
      expect(result.users[0].role).toBe('SUPER_ADMIN');
      expect(result.users[0].isActive).toBe(true);
      // Password hash must never be in user item
      expect((result.users[0] as any).passwordHash).toBeUndefined();
    });

    it('creates a new admin user with a provided password', async () => {
      const { user } = await createAdminUser(
        {
          name: 'Sarah Connor',
          email: 'sarah@filetools.local',
          role: 'EDITOR',
          password: 'SecurePassword123!',
          isActive: true,
        },
        superAdminSession
      );

      expect(user.id).toBeDefined();
      expect(user.email).toBe('sarah@filetools.local');
      expect(user.name).toBe('Sarah Connor');
      expect(user.role).toBe('EDITOR');
      expect(user.isActive).toBe(true);

      const db = getDb();
      const rawUser = await db.adminUser.findUnique({ where: { id: user.id } });
      expect(rawUser?.passwordHash).toBeDefined();
      const isMatch = await verifyPassword('SecurePassword123!', rawUser!.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('creates a user with an auto-generated temporary password when password is omitted', async () => {
      const { user, temporaryPassword } = await createAdminUser(
        {
          name: 'John Connor',
          email: 'john@filetools.local',
          role: 'CONTENT_MANAGER',
        },
        superAdminSession
      );

      expect(temporaryPassword).toBeDefined();
      expect(temporaryPassword!.length).toBeGreaterThanOrEqual(12);

      const db = getDb();
      const rawUser = await db.adminUser.findUnique({ where: { id: user.id } });
      const isMatch = await verifyPassword(temporaryPassword!, rawUser!.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('filters users by search query, role, and active status', async () => {
      await createAdminUser(
        { name: 'Alice Smith', email: 'alice@alpha.com', role: 'ADMIN', isActive: true },
        superAdminSession
      );
      await createAdminUser(
        { name: 'Bob Jones', email: 'bob@beta.com', role: 'EDITOR', isActive: false },
        superAdminSession
      );

      const searchAlice = await listAdminUsers({ search: 'alice' });
      expect(searchAlice.users.length).toBe(1);
      expect(searchAlice.users[0].name).toBe('Alice Smith');

      const filterEditors = await listAdminUsers({ role: 'EDITOR' });
      expect(filterEditors.users.length).toBe(1);
      expect(filterEditors.users[0].name).toBe('Bob Jones');

      const filterInactive = await listAdminUsers({ isActive: false });
      expect(filterInactive.users.length).toBe(1);
      expect(filterInactive.users[0].name).toBe('Bob Jones');
    });

    it('updates user profile, name, and email', async () => {
      const { user } = await createAdminUser(
        { name: 'Kyle Reese', email: 'kyle@filetools.local', role: 'EDITOR' },
        superAdminSession
      );

      const updated = await updateAdminUser(
        user.id,
        { name: 'Kyle Reese Jr.', email: 'kyle.jr@filetools.local' },
        superAdminSession
      );

      expect(updated.name).toBe('Kyle Reese Jr.');
      expect(updated.email).toBe('kyle.jr@filetools.local');
    });

    it('deactivates and reactivates a user', async () => {
      const { user } = await createAdminUser(
        { name: 'Marcus Wright', email: 'marcus@filetools.local', role: 'VIEWER', isActive: true },
        superAdminSession
      );

      const deactivated = await updateAdminUser(user.id, { isActive: false }, superAdminSession);
      expect(deactivated.isActive).toBe(false);

      const reactivated = await updateAdminUser(user.id, { isActive: true }, superAdminSession);
      expect(reactivated.isActive).toBe(true);
    });
  });

  describe('2. RBAC & Security Rules', () => {
    it('verifies that only SUPER_ADMIN has MANAGE_USERS permission', () => {
      expect(hasPermission('VIEWER', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('EDITOR', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('ADMIN', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('SUPER_ADMIN', 'MANAGE_USERS')).toBe(true);
    });

    it('prevents non-SUPER_ADMIN from creating a SUPER_ADMIN user', async () => {
      await expect(
        createAdminUser(
          { name: 'Hacker Admin', email: 'hacker@filetools.local', role: 'SUPER_ADMIN' },
          standardAdminSession
        )
      ).rejects.toThrow(/Only Super Administrators/);
    });

    it('prevents non-SUPER_ADMIN from promoting a user to SUPER_ADMIN', async () => {
      const { user } = await createAdminUser(
        { name: 'Regular Editor', email: 'reg@filetools.local', role: 'EDITOR' },
        superAdminSession
      );

      await expect(
        updateAdminUser(user.id, { role: 'SUPER_ADMIN' }, standardAdminSession)
      ).rejects.toThrow(/Only Super Administrators/);
    });

    it('prevents deactivating or demoting the final active SUPER_ADMIN', async () => {
      // admin-super-01 is currently the only active super admin
      await expect(
        updateAdminUser('admin-super-01', { isActive: false }, superAdminSession)
      ).rejects.toThrow(/Cannot deactivate the final active Super Administrator/);

      await expect(
        updateAdminUser('admin-super-01', { role: 'ADMIN' }, superAdminSession)
      ).rejects.toThrow(/Cannot demote the final active Super Administrator/);

      await expect(
        deleteAdminUser('admin-super-01', { ...superAdminSession, id: 'another-user' })
      ).rejects.toThrow(/Cannot delete the final active Super Administrator/);
    });

    it('prevents deleting one’s own account while currently logged in', async () => {
      await expect(
        deleteAdminUser(superAdminSession.id, superAdminSession)
      ).rejects.toThrow(/cannot delete your own account/);
    });
  });

  describe('3. Login Rate Limiting & Account Lockout', () => {
    it('tracks failed login attempts and temporarily locks the account after 5 failed attempts', async () => {
      const email = 'admin@filetools.local';

      // 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        await expect(loginAdmin({ email, password: 'WrongPassword!' })).rejects.toThrow(
          'Invalid email or password.'
        );
      }

      const db = getDb();
      let user = await db.adminUser.findUnique({ where: { email } });
      expect(user?.failedLoginAttempts).toBe(4);
      expect(user?.lockedUntil).toBeNull();

      // 5th failed attempt triggers lockout
      await expect(loginAdmin({ email, password: 'WrongPassword!' })).rejects.toThrow(
        /temporarily locked/
      );

      user = await db.adminUser.findUnique({ where: { email } });
      expect(user?.failedLoginAttempts).toBe(5);
      expect(user?.lockedUntil).not.toBeNull();
      expect(new Date(user!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());

      // Attempting with correct password while locked must also be rejected
      await expect(loginAdmin({ email, password: 'AdminPassword123!' })).rejects.toThrow(
        /temporarily locked/
      );
    });

    it('resets failed login attempts counter upon successful login', async () => {
      const email = 'admin@filetools.local';

      // 2 failed attempts
      await expect(loginAdmin({ email, password: 'WrongPassword!' })).rejects.toThrow();
      await expect(loginAdmin({ email, password: 'WrongPassword!' })).rejects.toThrow();

      const db = getDb();
      let user = await db.adminUser.findUnique({ where: { email } });
      expect(user?.failedLoginAttempts).toBe(2);

      // Successful login
      const result = await loginAdmin({ email, password: 'AdminPassword123!' });
      expect(result.token).toBeDefined();

      user = await db.adminUser.findUnique({ where: { email } });
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lockedUntil).toBeNull();
      expect(user?.lastLoginAt).not.toBeNull();
    });

    it('rejects deactivated accounts immediately', async () => {
      const { user } = await createAdminUser(
        { name: 'Inactive User', email: 'inactive@filetools.local', role: 'EDITOR', password: 'Password123!', isActive: false },
        superAdminSession
      );

      await expect(
        loginAdmin({ email: 'inactive@filetools.local', password: 'Password123!' })
      ).rejects.toThrow(/deactivated/);
    });
  });

  describe('4. Secure Password Reset Workflow', () => {
    it('generates a single-use token and stores only its SHA-256 hash in the database', async () => {
      const { user } = await createAdminUser(
        { name: 'Token User', email: 'token@filetools.local', role: 'EDITOR' },
        superAdminSession
      );

      const result = await generatePasswordResetToken(user.id, superAdminSession);
      expect(result.resetToken).toBeDefined();
      expect(result.resetToken.length).toBe(64);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const db = getDb();
      const rawUser = await db.adminUser.findUnique({ where: { id: user.id } });
      // DB stores SHA-256 hash, not raw token
      expect(rawUser?.passwordResetTokenHash).toBe(hashToken(result.resetToken));
      expect(rawUser?.passwordResetTokenHash).not.toBe(result.resetToken);
    });

    it('resets password successfully using a valid reset token', async () => {
      const { user } = await createAdminUser(
        { name: 'Reset User', email: 'reset@filetools.local', role: 'EDITOR', password: 'OldPassword123!' },
        superAdminSession
      );

      const { resetToken } = await generatePasswordResetToken(user.id, superAdminSession);

      const resetResult = await completePasswordReset(resetToken, 'BrandNewPassword123!');
      expect(resetResult.success).toBe(true);

      // User can now log in with the new password
      const loginRes = await loginAdmin({ email: 'reset@filetools.local', password: 'BrandNewPassword123!' });
      expect(loginRes.token).toBeDefined();

      // Old password no longer works
      await expect(
        loginAdmin({ email: 'reset@filetools.local', password: 'OldPassword123!' })
      ).rejects.toThrow('Invalid email or password.');
    });

    it('invalidates the reset token immediately upon use (single-use)', async () => {
      const { user } = await createAdminUser(
        { name: 'Single Use User', email: 'single@filetools.local', role: 'EDITOR', password: 'OldPassword123!' },
        superAdminSession
      );

      const { resetToken } = await generatePasswordResetToken(user.id, superAdminSession);

      // First reset succeeds
      await completePasswordReset(resetToken, 'FirstNewPassword123!');

      // Second reset attempt with same token is rejected
      await expect(
        completePasswordReset(resetToken, 'SecondNewPassword123!')
      ).rejects.toThrow(/Invalid or expired/);
    });

    it('rejects expired reset tokens', async () => {
      const { user } = await createAdminUser(
        { name: 'Expired User', email: 'expired@filetools.local', role: 'EDITOR' },
        superAdminSession
      );

      const { resetToken } = await generatePasswordResetToken(user.id, superAdminSession);

      // Manually set expiry in the past
      const db = getDb();
      await db.adminUser.update({
        where: { id: user.id },
        data: {
          passwordResetExpiresAt: new Date(Date.now() - 10000),
        },
      });

      await expect(
        completePasswordReset(resetToken, 'ValidPassword123!')
      ).rejects.toThrow(/expired/);
    });
  });

  describe('5. Audit Logging for User Mutations', () => {
    it('records audit log entries for all administrative actions without logging secrets', async () => {
      const db = getDb();

      // 1. Create user
      const { user } = await createAdminUser(
        { name: 'Audited User', email: 'audited@filetools.local', role: 'EDITOR', password: 'InitialPassword123!' },
        superAdminSession
      );

      // 2. Update user
      await updateAdminUser(user.id, { role: 'CONTENT_MANAGER' }, superAdminSession);

      // 3. Request password reset
      await generatePasswordResetToken(user.id, superAdminSession);

      const auditLogs = await db.auditLog.findMany({
        where: { entityType: 'ADMIN_USER' },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(3);

      const actions = auditLogs.map((l: any) => l.action);
      expect(actions).toContain('USER_CREATED');
      expect(actions).toContain('USER_ROLE_CHANGED');
      expect(actions).toContain('PASSWORD_RESET_REQUESTED');

      // Verify that no log contains plain passwords or hashes
      for (const log of auditLogs) {
        const metaStr = JSON.stringify(log.metadata || {});
        expect(metaStr).not.toContain('InitialPassword123!');
        expect(metaStr).not.toContain('$2b$12$');
      }
    });
  });
});
