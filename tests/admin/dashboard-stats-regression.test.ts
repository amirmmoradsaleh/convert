import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDashboardStats } from '@/lib/admin/services/dashboard.service';
import {
  getAuthenticatedAdmin,
  requireAdminAuth,
  verifyAdminSession,
} from '@/lib/admin/guard';
import { createSessionToken, verifySessionToken } from '@/lib/admin/session';
import {
  getDb,
  memoryDb,
  resetMemoryDb,
  isConnectionError,
  isSchemaError,
} from '@/lib/db';
import { NextRequest } from 'next/server';

describe('Admin CMS — VPS Session & Dashboard Statistics Regression Tests', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Dashboard Statistics Resilience & Observability', () => {
    it('returns complete dashboard statistics with resilient metrics', async () => {
      const stats = await getDashboardStats();

      expect(stats).toBeDefined();
      expect(typeof stats.totalAdminUsers).toBe('number');
      expect(typeof stats.publishedPages).toBe('number');
      expect(typeof stats.draftPages).toBe('number');
      expect(typeof stats.totalPages).toBe('number');
      expect(typeof stats.totalTools).toBe('number');
      expect(typeof stats.customizedTools).toBe('number');
      expect(Array.isArray(stats.recentAuditLogs)).toBe(true);
      expect(['connected', 'fallback_memory']).toContain(stats.databaseStatus);
    });

    it('returns available total tools matching canonical count (25)', async () => {
      const stats = await getDashboardStats();
      expect(stats.totalTools).toBe(25);
    });
  });

  describe('2. Distinguishing Genuine Connection Failures vs Schema Drift', () => {
    it('correctly identifies genuine database connection failures', () => {
      // Network & socket errors
      expect(isConnectionError({ message: "Can't reach database server at localhost:5432" })).toBe(true);
      expect(isConnectionError({ message: 'connect ECONNREFUSED 127.0.0.1:5432' })).toBe(true);
      expect(isConnectionError({ message: 'connection timed out' })).toBe(true);

      // Prisma connectivity error codes
      expect(isConnectionError({ name: 'PrismaClientKnownRequestError', code: 'P1001' })).toBe(true);
      expect(isConnectionError({ name: 'PrismaClientKnownRequestError', code: 'P1002' })).toBe(true);
      expect(isConnectionError({ name: 'PrismaClientInitializationError', message: 'Unable to connect' })).toBe(true);

      // Schema drift codes must NOT be classified as connection errors
      expect(isConnectionError({ name: 'PrismaClientKnownRequestError', code: 'P2021' })).toBe(false);
      expect(isConnectionError({ name: 'PrismaClientKnownRequestError', code: 'P2022' })).toBe(false);
      expect(isConnectionError({ message: 'relation "tool_contents" does not exist' })).toBe(false);
    });

    it('correctly identifies schema drift errors (missing tables or columns)', () => {
      expect(isSchemaError({ name: 'PrismaClientKnownRequestError', code: 'P2021' })).toBe(true);
      expect(isSchemaError({ name: 'PrismaClientKnownRequestError', code: 'P2022' })).toBe(true);
      expect(isSchemaError({ message: 'The table public.tool_contents does not exist in the current database.' })).toBe(true);
      expect(isSchemaError({ message: 'relation "audit_logs" does not exist' })).toBe(true);

      // Connection errors must NOT be classified as schema errors
      expect(isSchemaError({ message: "Can't reach database server" })).toBe(false);
      expect(isSchemaError({ code: 'P1001' })).toBe(false);
    });
  });

  describe('3. Admin Authentication & Guard Behavior', () => {
    it('authenticates valid session token from cookie correctly', async () => {
      const sessionUser = {
        id: 'admin-super-01',
        email: 'admin@filetools.local',
        name: 'System Administrator',
        role: 'SUPER_ADMIN' as const,
      };

      const token = await createSessionToken(sessionUser);
      const req = new NextRequest('http://localhost:3000/api/admin/dashboard', {
        headers: {
          cookie: `admin_session=${token}`,
        },
      });

      const user = await getAuthenticatedAdmin(req);
      expect(user).not.toBeNull();
      expect(user?.email).toBe('admin@filetools.local');
      expect(user?.role).toBe('SUPER_ADMIN');
    });

    it('authenticates valid session token from Authorization header (Bearer)', async () => {
      const sessionUser = {
        id: 'admin-super-01',
        email: 'admin@filetools.local',
        name: 'System Administrator',
        role: 'SUPER_ADMIN' as const,
      };

      const token = await createSessionToken(sessionUser);
      const req = new NextRequest('http://localhost:3000/api/admin/dashboard', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const user = await getAuthenticatedAdmin(req);
      expect(user).not.toBeNull();
      expect(user?.email).toBe('admin@filetools.local');
    });

    it('returns 401 when no token is present', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/dashboard');
      const result = await requireAdminAuth(req, 'VIEW_CMS');

      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(401);
    });

    it('returns 403 when user does not have required permission', async () => {
      const db = getDb();
      const viewerUser = await db.adminUser.create({
        data: {
          email: 'viewer@filetools.local',
          passwordHash: 'dummy-hash',
          name: 'Viewer User',
          role: 'VIEWER',
          isActive: true,
        },
      });

      const token = await createSessionToken({
        id: viewerUser.id,
        email: viewerUser.email,
        name: viewerUser.name,
        role: viewerUser.role as any,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: {
          cookie: `admin_session=${token}`,
        },
      });

      // VIEWER does not have MANAGE_USERS permission
      const result = await requireAdminAuth(req, 'MANAGE_USERS');
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(403);
    });

    it('strictly blocks deactivated users even with a valid signed token', async () => {
      const db = getDb();
      const deactivatedUser = await db.adminUser.create({
        data: {
          email: 'deactivated-admin@filetools.local',
          passwordHash: 'dummy-hash',
          name: 'Deactivated Admin',
          role: 'ADMIN',
          isActive: false,
        },
      });

      const token = await createSessionToken({
        id: deactivatedUser.id,
        email: deactivatedUser.email,
        name: deactivatedUser.name,
        role: deactivatedUser.role as any,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/dashboard', {
        headers: {
          cookie: `admin_session=${token}`,
        },
      });

      const verification = await verifyAdminSession(req);
      expect(verification.success).toBe(false);
      if (!verification.success) {
        expect(verification.failureType).toBe('user_disabled');
        expect(verification.httpStatus).toBe(401);
      }

      const result = await requireAdminAuth(req, 'VIEW_CMS');
      expect(result.errorResponse?.status).toBe(401);
    });

    it('strictly rejects deleted users whose ID and email no longer exist in the database', async () => {
      // User holds a validly signed token, but does NOT exist in the database (e.g. was deleted)
      const token = await createSessionToken({
        id: 'deleted-cuid-999',
        email: 'deleted-user@filetools.local',
        name: 'Deleted User',
        role: 'ADMIN' as const,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/dashboard', {
        headers: {
          cookie: `admin_session=${token}`,
        },
      });

      const verification = await verifyAdminSession(req);
      expect(verification.success).toBe(false);
      if (!verification.success) {
        expect(verification.failureType).toBe('user_not_found');
        expect(verification.httpStatus).toBe(401);
      }

      const user = await getAuthenticatedAdmin(req);
      expect(user).toBeNull();

      const result = await requireAdminAuth(req, 'VIEW_CMS');
      expect(result.errorResponse?.status).toBe(401);
    });

    it('allows session when user ID differed between seeds but existing active account matches email', async () => {
      const db = getDb();
      const activeAdmin = await db.adminUser.create({
        data: {
          email: 'reseeded-admin@filetools.local',
          passwordHash: 'dummy-hash',
          name: 'Reseeded Admin',
          role: 'ADMIN',
          isActive: true,
        },
      });

      // Token has old ID but matching email
      const token = await createSessionToken({
        id: 'old-seed-cuid-000',
        email: 'reseeded-admin@filetools.local',
        name: 'Reseeded Admin',
        role: 'ADMIN' as const,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/dashboard', {
        headers: {
          cookie: `admin_session=${token}`,
        },
      });

      const user = await getAuthenticatedAdmin(req);
      expect(user).not.toBeNull();
      expect(user?.email).toBe('reseeded-admin@filetools.local');
      expect(user?.id).toBe(activeAdmin.id);
    });

    it('returns 503 infrastructure error when database query throws connection error', async () => {
      const token = await createSessionToken({
        id: 'admin-super-01',
        email: 'admin@filetools.local',
        name: 'Admin',
        role: 'SUPER_ADMIN' as const,
      });

      const req = new NextRequest('http://localhost:3000/api/admin/dashboard', {
        headers: {
          cookie: `admin_session=${token}`,
        },
      });

      const originalFindUnique = memoryDb.adminUser.findUnique;
      // Simulate infrastructure error during session lookup
      memoryDb.adminUser.findUnique = vi.fn().mockRejectedValue(new Error('Database connection failed: ECONNREFUSED'));

      try {
        const verification = await verifyAdminSession(req);
        expect(verification.success).toBe(false);
        if (!verification.success) {
          expect(verification.failureType).toBe('infrastructure_error');
          expect(verification.httpStatus).toBe(503);
        }

        const result = await requireAdminAuth(req, 'VIEW_CMS');
        expect(result.errorResponse?.status).toBe(503);
      } finally {
        memoryDb.adminUser.findUnique = originalFindUnique;
      }
    });
  });

  describe('4. Session Token Verification', () => {
    it('correctly signs and verifies claims', async () => {
      const payload = {
        id: 'adm-123',
        email: 'ops@filetools.local',
        name: 'Operations Admin',
        role: 'ADMIN' as const,
      };

      const token = await createSessionToken(payload);
      const verified = await verifySessionToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('adm-123');
      expect(verified?.email).toBe('ops@filetools.local');
      expect(verified?.role).toBe('ADMIN');
    });

    it('rejects tampered or forged JWT tokens', async () => {
      const token = await createSessionToken({
        id: 'adm-123',
        email: 'ops@filetools.local',
        name: 'Operations Admin',
        role: 'ADMIN' as const,
      });

      const parts = token.split('.');
      // Tamper payload
      const tampered = `${parts[0]}.eyJhZG1pbiI6dHJ1ZX0.${parts[2]}`;
      const verified = await verifySessionToken(tampered);

      expect(verified).toBeNull();
    });
  });
});
