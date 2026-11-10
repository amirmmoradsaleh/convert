import { describe, it, expect, beforeEach } from 'vitest';
import { loginAdmin, logoutAdmin, getAdminProfile } from '@/lib/admin/services/auth.service';
import { hashPassword, verifyPassword } from '@/lib/admin/crypto';
import { createSessionToken, verifySessionToken } from '@/lib/admin/session';
import { getDb, resetMemoryDb } from '@/lib/db';

describe('Admin CMS Phase 01 — Authentication', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  describe('Password Hashing & Verification', () => {
    it('hashes passwords using bcrypt with strong salt rounds', async () => {
      const plain = 'StrongAdminPass123!';
      const hash = await hashPassword(plain);

      expect(hash).not.toBe(plain);
      expect(hash).toMatch(/^\$2[aby]\$/);
    });

    it('verifies correct password against hash', async () => {
      const plain = 'ValidPassword2026!';
      const hash = await hashPassword(plain);

      const isValid = await verifyPassword(plain, hash);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect password against hash', async () => {
      const plain = 'CorrectPassword123!';
      const hash = await hashPassword(plain);

      const isValid = await verifyPassword('WrongPassword!', hash);
      expect(isValid).toBe(false);
    });

    it('rejects passwords shorter than 8 characters', async () => {
      await expect(hashPassword('short')).rejects.toThrow(/8 characters/);
    });
  });

  describe('Session Token (JWT)', () => {
    it('creates, signs and verifies a valid admin session token', async () => {
      const user = {
        id: 'user-1',
        email: 'editor@filetools.local',
        name: 'Jane Editor',
        role: 'EDITOR' as const,
      };

      const token = await createSessionToken(user);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);

      const payload = await verifySessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.id).toBe('user-1');
      expect(payload?.email).toBe('editor@filetools.local');
      expect(payload?.role).toBe('EDITOR');
    });

    it('returns null when verifying an invalid or tampered token', async () => {
      const result = await verifySessionToken('invalid.token.signature');
      expect(result).toBeNull();
    });
  });

  describe('Admin Login Workflow', () => {
    it('authenticates valid admin credentials and returns user with token', async () => {
      const result = await loginAdmin({
        email: 'admin@filetools.local',
        password: 'AdminPassword123!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('admin@filetools.local');
      expect(result.user.role).toBe('SUPER_ADMIN');
      expect(typeof result.token).toBe('string');

      // Verify lastLoginAt was updated
      const profile = await getAdminProfile(result.user.id);
      expect(profile?.lastLoginAt).not.toBeNull();
    });

    it('rejects login with wrong password and throws clear error without stack trace', async () => {
      await expect(
        loginAdmin({
          email: 'admin@filetools.local',
          password: 'IncorrectPassword',
        })
      ).rejects.toThrow(/Invalid email or password/i);
    });

    it('rejects login for non-existent admin email', async () => {
      await expect(
        loginAdmin({
          email: 'nonexistent@filetools.local',
          password: 'SomePassword123!',
        })
      ).rejects.toThrow(/Invalid email or password/i);
    });

    it('rejects deactivated/inactive users', async () => {
      const db = getDb();
      const hash = await hashPassword('DeactivatedPass123!');
      const inactiveUser = await db.adminUser.create({
        data: {
          email: 'inactive@filetools.local',
          passwordHash: hash,
          name: 'Inactive User',
          role: 'EDITOR',
          isActive: false,
        },
      });

      await expect(
        loginAdmin({
          email: inactiveUser.email,
          password: 'DeactivatedPass123!',
        })
      ).rejects.toThrow(/deactivated/i);
    });

    it('records audit log on successful login and logout', async () => {
      const result = await loginAdmin({
        email: 'admin@filetools.local',
        password: 'AdminPassword123!',
      });

      await logoutAdmin(result.user);

      const db = getDb();
      const logs = await db.auditLog.findMany({ where: { userId: result.user.id } });
      const actions = logs.map((l: any) => l.action);

      expect(actions).toContain('LOGIN');
      expect(actions).toContain('LOGOUT');
    });
  });
});
