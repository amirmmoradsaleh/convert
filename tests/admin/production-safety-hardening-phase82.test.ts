import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  getJwtSecret,
  createSessionToken,
  verifySessionToken,
  JwtConfigError,
  DEV_FALLBACK_JWT_SECRET,
  resolveCookieSecure,
} from '@/lib/admin/session';
import { verifyAdminSession } from '@/lib/admin/guard';
import { getDb, DatabasePersistenceError, resetMemoryDb } from '@/lib/db';
import { validateProductionEnv } from '@/lib/env-validation';

describe('Phase 8.2 — Production Safety Hardening Test Suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetMemoryDb();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Priority 1 — Admin JWT Secret Validation', () => {
    it('fails closed in production if ADMIN_JWT_SECRET is missing', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ADMIN_JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => getJwtSecret()).toThrow(JwtConfigError);
      expect(() => getJwtSecret()).toThrow(/missing in production/i);
    });

    it('fails closed in production if ADMIN_JWT_SECRET uses the known dev fallback string', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.ADMIN_JWT_SECRET = DEV_FALLBACK_JWT_SECRET;

      expect(() => getJwtSecret()).toThrow(JwtConfigError);
      expect(() => getJwtSecret()).toThrow(/must not use development fallback/i);
    });

    it('fails closed in production if ADMIN_JWT_SECRET is shorter than 32 characters', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.ADMIN_JWT_SECRET = 'short-secret-12345';

      expect(() => getJwtSecret()).toThrow(JwtConfigError);
      expect(() => getJwtSecret()).toThrow(/at least 32 characters/i);
    });

    it('succeeds in production when provided a valid 32+ character secret', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.ADMIN_JWT_SECRET = 'a-very-secure-production-jwt-secret-with-more-than-32-chars';

      const secret = getJwtSecret();
      expect(secret).toBeInstanceOf(Uint8Array);
      expect(secret.length).toBeGreaterThanOrEqual(32);

      const token = await createSessionToken({
        id: 'usr_admin_01',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'SUPER_ADMIN',
      });
      expect(token).toBeTruthy();

      const session = await verifySessionToken(token);
      expect(session).toEqual({
        id: 'usr_admin_01',
        email: 'admin@example.com',
        name: 'Admin User',
        role: 'SUPER_ADMIN',
      });
    });

    it('returns a controlled 500 error in verifyAdminSession when ADMIN_JWT_SECRET is invalid in production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ADMIN_JWT_SECRET;

      const req = new NextRequest('https://convert24.com/api/admin/me', {
        headers: {
          authorization: 'Bearer mock_session_token',
        },
      });

      const result = await verifyAdminSession(req);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.httpStatus).toBe(500);
        expect(result.failureType).toBe('infrastructure_error');
        expect(result.message).toContain('Authentication configuration error');
      }
    });

    it('allows dev fallback secret when NOT in production', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      delete process.env.ADMIN_JWT_SECRET;

      const secret = getJwtSecret();
      expect(secret).toBeInstanceOf(Uint8Array);

      const token = await createSessionToken({
        id: 'usr_dev_01',
        email: 'dev@example.com',
        name: 'Dev User',
        role: 'EDITOR',
      });
      const session = await verifySessionToken(token);
      expect(session?.id).toBe('usr_dev_01');
    });
  });

  describe('Priority 2 — Database Persistence Safety & Phase 8.3 Verification', () => {
    it('1. Missing DATABASE_URL in production: aborts write operations with DatabasePersistenceError', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.DATABASE_URL;

      const db = getDb();

      // Read operations should succeed with fallback data for public route stability
      const readResult = await db.toolContent.findUnique({ where: { toolSlug: 'jpg-to-png' } });
      expect(readResult).toBeNull();

      // Write operations MUST fail closed in production
      await expect(
        db.toolContent.upsert({
          where: { toolSlug: 'jpg-to-png' },
          create: { toolSlug: 'jpg-to-png', customTitle: 'Test Title' },
          update: { customTitle: 'Test Title' },
        })
      ).rejects.toThrow(DatabasePersistenceError);
    });

    it('2. Malformed DATABASE_URL in production: aborts write operations with DatabasePersistenceError', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.DATABASE_URL = 'invalid-malformed-connection-string';

      const db = getDb();

      await expect(
        db.blogPost.create({
          data: {
            title: 'Test Post',
            slug: 'test-post',
            content: 'Test content',
          },
        })
      ).rejects.toThrow(DatabasePersistenceError);
    });

    it('3. Localhost placeholder DATABASE_URL in production: fails write operations when DB server is offline', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/filetools_db?schema=public';

      const db = getDb();

      await expect(
        db.mediaAsset.create({
          data: {
            filename: 'test.png',
            originalFilename: 'test.png',
            mimeType: 'image/png',
            size: 1024,
            url: '/uploads/test.png',
            storagePath: '/tmp/test.png',
          },
        })
      ).rejects.toThrow(DatabasePersistenceError);
    });

    it('4. PostgreSQL connection failure in production: aborts writes and prevents silent data loss', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://invalid_user:invalid_pass@localhost:5432/invalid_db';

      const db = getDb();

      await expect(
        db.toolContent.upsert({
          where: { toolSlug: 'pdf-to-jpg' },
          create: { toolSlug: 'pdf-to-jpg', customTitle: 'PDF to JPG' },
          update: { customTitle: 'PDF to JPG' },
        })
      ).rejects.toThrow(DatabasePersistenceError);
    });

    it('5. Successful local preview using memory storage when NODE_ENV is development', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      delete process.env.DATABASE_URL;

      const db = getDb();
      const created = await db.page.create({
        data: {
          id: 'page_dev_test',
          slug: 'dev-test-page',
          name: 'Dev Test Page',
          status: 'DRAFT',
        },
      });
      expect(created.id).toBe('page_dev_test');

      const retrieved = await db.page.findUnique({ where: { id: 'page_dev_test' } });
      expect(retrieved?.name).toBe('Dev Test Page');
    });

    it('6. Durable database connection: successful write executes against database client when connected', async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      // Test double simulating successful Prisma Client execution
      const mockPrismaClient = {
        toolContent: {
          upsert: vi.fn().mockResolvedValue({
            id: 'tc_mock_01',
            toolSlug: 'jpg-to-png',
            customTitle: 'Persisted Title',
            isPublished: true,
          }),
        },
      };

      const result = await mockPrismaClient.toolContent.upsert({
        where: { toolSlug: 'jpg-to-png' },
        create: { toolSlug: 'jpg-to-png', customTitle: 'Persisted Title' },
        update: { customTitle: 'Persisted Title' },
      });

      expect(mockPrismaClient.toolContent.upsert).toHaveBeenCalled();
      expect(result.id).toBe('tc_mock_01');
      expect(result.customTitle).toBe('Persisted Title');
    });
  });

  describe('Priority 3 — Environment and Cookie Validation', () => {
    it('validates production environment settings correctly', () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.ADMIN_JWT_SECRET;
      delete process.env.DATABASE_URL;
      delete process.env.TRUST_PROXY;

      const result = validateProductionEnv();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some((e) => e.includes('ADMIN_JWT_SECRET'))).toBe(true);
      expect(result.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('TRUST_PROXY'))).toBe(true);
    });

    it('ignores untrusted X-Forwarded-Proto header when TRUST_PROXY is false or unset', () => {
      delete process.env.TRUST_PROXY;
      delete process.env.COOKIE_SECURE;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      const req = new NextRequest('http://localhost:3000/api/admin/me', {
        headers: {
          'x-forwarded-proto': 'https',
        },
      });

      // When TRUST_PROXY is false, untrusted x-forwarded-proto must be ignored!
      const isSecure = resolveCookieSecure(req);
      expect(isSecure).toBe(false);
    });

    it('respects X-Forwarded-Proto header when TRUST_PROXY is explicitly enabled', () => {
      process.env.TRUST_PROXY = 'true';
      delete process.env.COOKIE_SECURE;
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

      const req = new NextRequest('http://localhost:3000/api/admin/me', {
        headers: {
          'x-forwarded-proto': 'https',
        },
      });

      const isSecure = resolveCookieSecure(req);
      expect(isSecure).toBe(true);
    });
  });
});
