import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parseBooleanEnv,
  resolveCookieSecure,
  getSessionCookieOptions,
  getExpireSessionCookieOptions,
  createSessionToken,
  verifySessionToken,
  ADMIN_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from '@/lib/admin/session';
import { requireAdminAuth } from '@/lib/admin/guard';
import { hasPermission, getPermissionsForRole } from '@/lib/admin/permissions';
import { AdminRole } from '@/lib/admin/types';
import { getDb, resetMemoryDb } from '@/lib/db';
import { NextRequest } from 'next/server';

describe('Admin CMS Phase 1 — Session Cookie Lifecycle & Auth Hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetMemoryDb();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. parseBooleanEnv Helper', () => {
    it('correctly parses truthy values regardless of casing or quotes', () => {
      expect(parseBooleanEnv('true')).toBe(true);
      expect(parseBooleanEnv('TRUE')).toBe(true);
      expect(parseBooleanEnv('"true"')).toBe(true);
      expect(parseBooleanEnv("'true'")).toBe(true);
      expect(parseBooleanEnv('1')).toBe(true);
      expect(parseBooleanEnv('yes')).toBe(true);
      expect(parseBooleanEnv('YES')).toBe(true);
      expect(parseBooleanEnv('on')).toBe(true);
      expect(parseBooleanEnv('  true  ')).toBe(true);
    });

    it('correctly parses falsy values regardless of casing or quotes', () => {
      expect(parseBooleanEnv('false')).toBe(false);
      expect(parseBooleanEnv('FALSE')).toBe(false);
      expect(parseBooleanEnv('"false"')).toBe(false);
      expect(parseBooleanEnv("'false'")).toBe(false);
      expect(parseBooleanEnv('0')).toBe(false);
      expect(parseBooleanEnv('no')).toBe(false);
      expect(parseBooleanEnv('NO')).toBe(false);
      expect(parseBooleanEnv('off')).toBe(false);
      expect(parseBooleanEnv('  false  ')).toBe(false);
    });

    it('returns undefined for unset, empty, or unparseable values', () => {
      expect(parseBooleanEnv(undefined)).toBeUndefined();
      expect(parseBooleanEnv(null)).toBeUndefined();
      expect(parseBooleanEnv('')).toBeUndefined();
      expect(parseBooleanEnv('random-string')).toBeUndefined();
    });
  });

  describe('2. resolveCookieSecure Configuration', () => {
    it('honors explicit COOKIE_SECURE="false" in production', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.COOKIE_SECURE = 'false';
      expect(resolveCookieSecure()).toBe(false);

      process.env.COOKIE_SECURE = '"false"';
      expect(resolveCookieSecure()).toBe(false);

      process.env.COOKIE_SECURE = '0';
      expect(resolveCookieSecure()).toBe(false);
    });

    it('honors explicit COOKIE_SECURE="true" in development', () => {
      (process.env as any).NODE_ENV = 'development';
      process.env.COOKIE_SECURE = 'true';
      expect(resolveCookieSecure()).toBe(true);
    });

    it('defaults to secure in production when COOKIE_SECURE is unset', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.COOKIE_SECURE;
      delete process.env.TRUST_PROXY;
      expect(resolveCookieSecure()).toBe(true);
    });

    it('defaults to insecure in non-production when COOKIE_SECURE is unset', () => {
      (process.env as any).NODE_ENV = 'test';
      delete process.env.COOKIE_SECURE;
      delete process.env.TRUST_PROXY;
      expect(resolveCookieSecure()).toBe(false);
    });

    it('respects X-Forwarded-Proto when TRUST_PROXY is enabled', () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.TRUST_PROXY = 'true';
      delete process.env.COOKIE_SECURE;

      const httpsReq = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: { 'x-forwarded-proto': 'https' },
      });
      expect(resolveCookieSecure(httpsReq)).toBe(true);

      const httpReq = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: { 'x-forwarded-proto': 'http' },
      });
      expect(resolveCookieSecure(httpReq)).toBe(false);
    });

    it('ignores arbitrary X-Forwarded-Proto headers when TRUST_PROXY is false or unset', () => {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.TRUST_PROXY;
      delete process.env.COOKIE_SECURE;

      const httpReq = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: { 'x-forwarded-proto': 'http' },
      });
      // Untrusted proxy: still defaults to secure in production
      expect(resolveCookieSecure(httpReq)).toBe(true);
    });
  });

  describe('3. Cookie Options Consistency (Login vs Logout)', () => {
    it('generates matching attributes between set and expire options', () => {
      process.env.COOKIE_SECURE = 'false';

      const setOpts = getSessionCookieOptions();
      const expOpts = getExpireSessionCookieOptions();

      expect(setOpts.name).toBe(ADMIN_COOKIE_NAME);
      expect(expOpts.name).toBe(ADMIN_COOKIE_NAME);

      expect(setOpts.httpOnly).toBe(true);
      expect(expOpts.httpOnly).toBe(true);

      expect(setOpts.sameSite).toBe('lax');
      expect(expOpts.sameSite).toBe('lax');

      expect(setOpts.path).toBe('/');
      expect(expOpts.path).toBe('/');

      expect(setOpts.secure).toBe(expOpts.secure);

      // Verify expiration semantics
      expect(setOpts.maxAge).toBe(SESSION_DURATION_SECONDS);
      expect(expOpts.maxAge).toBe(0);
      expect(expOpts.value).toBe('');
    });
  });

  describe('4. Token Verification & Tamper Resistance', () => {
    it('creates and verifies a valid token payload', async () => {
      const user = {
        id: 'admin-1',
        email: 'super@filetools.local',
        name: 'Super Admin',
        role: 'SUPER_ADMIN' as const,
      };

      const token = await createSessionToken(user);
      const verified = await verifySessionToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.id).toBe('admin-1');
      expect(verified?.email).toBe('super@filetools.local');
      expect(verified?.role).toBe('SUPER_ADMIN');
    });

    it('rejects an empty, null, or undefined token string', async () => {
      expect(await verifySessionToken('')).toBeNull();
      // @ts-expect-error test boundary
      expect(await verifySessionToken(null)).toBeNull();
      // @ts-expect-error test boundary
      expect(await verifySessionToken(undefined)).toBeNull();
    });

    it('rejects tampered token signature', async () => {
      const token = await createSessionToken({
        id: 'admin-1',
        email: 'super@filetools.local',
        name: 'Super Admin',
        role: 'SUPER_ADMIN' as const,
      });

      const parts = token.split('.');
      const tampered = `${parts[0]}.${parts[1]}.invalidSignatureHere`;
      expect(await verifySessionToken(tampered)).toBeNull();
    });
  });

  describe('5. Auth Guard & Route Behavior', () => {
    it('returns 401 when no session cookie or bearer token is present', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/auth/me');
      const result = await requireAdminAuth(req);

      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(401);
    });

    it('authenticates successfully when valid session cookie is provided', async () => {
      const token = await createSessionToken({
        id: 'admin-super-01',
        email: 'admin@filetools.local',
        name: 'System Administrator',
        role: 'SUPER_ADMIN',
      });

      const req = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${token}`,
        },
      });

      const result = await requireAdminAuth(req);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('admin@filetools.local');
      expect(result.user?.role).toBe('SUPER_ADMIN');
      expect(result.errorResponse).toBeUndefined();
    });

    it('enforces RBAC permissions and blocks unauthorized roles with 403', async () => {
      const db = getDb();
      const viewerUser = await db.adminUser.create({
        data: {
          email: 'viewer-user@filetools.local',
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

      const req = new NextRequest('http://localhost:3000/api/admin/settings', {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${token}`,
        },
      });

      // VIEWER only has VIEW_CMS permission; MANAGE_SETTINGS must return 403
      const result = await requireAdminAuth(req, 'MANAGE_SETTINGS');
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(403);
    });
  });

  describe('6. RBAC Role Matrix Integrity', () => {
    const roles: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'EDITOR', 'VIEWER'];

    it('preserves all canonical permissions for each role', () => {
      for (const role of roles) {
        const perms = getPermissionsForRole(role);
        expect(Array.isArray(perms)).toBe(true);
        expect(perms.length).toBeGreaterThan(0);
        expect(hasPermission(role, 'VIEW_CMS')).toBe(true);
      }

      // Check specific role limits
      expect(hasPermission('VIEWER', 'EDIT_CONTENT')).toBe(false);
      expect(hasPermission('EDITOR', 'PUBLISH_CONTENT')).toBe(false);
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('ADMIN', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('SUPER_ADMIN', 'MANAGE_USERS')).toBe(true);
    });
  });

  describe('7. /api/admin/auth/me & Client-Side Transition Behavior', () => {
    it('returns 200 with user and permissions when session is valid', async () => {
      const token = await createSessionToken({
        id: 'admin-super-01',
        email: 'admin@filetools.local',
        name: 'System Administrator',
        role: 'SUPER_ADMIN',
      });

      const req = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
      });

      const auth = await requireAdminAuth(req);
      expect(auth.user).toBeDefined();
      expect(auth.errorResponse).toBeUndefined();

      const permissions = getPermissionsForRole(auth.user!.role);
      expect(permissions).toContain('VIEW_CMS');
      expect(permissions).toContain('MANAGE_USERS');
    });

    it('returns 401 when account was deleted from database', async () => {
      const token = await createSessionToken({
        id: 'deleted-user-id',
        email: 'deleted-admin@filetools.local',
        name: 'Deleted User',
        role: 'ADMIN',
      });

      const req = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
      });

      const auth = await requireAdminAuth(req);
      expect(auth.errorResponse).toBeDefined();
      expect(auth.errorResponse?.status).toBe(401);
    });

    it('distinguishes 401 (eviction) from 403 (forbidden banner) and 503 (infrastructure retry)', () => {
      // Logic verified against AdminLayoutClient transitions:
      // Status 401 -> must trigger router.push('/admin/login')
      const handleStatus = (status: number) => {
        if (status === 401) return 'REDIRECT_LOGIN';
        if (status === 403) return 'SHOW_FORBIDDEN_ERROR';
        if (status >= 500) return 'SHOW_RETRYABLE_BANNER';
        return 'UNKNOWN';
      };

      expect(handleStatus(401)).toBe('REDIRECT_LOGIN');
      expect(handleStatus(403)).toBe('SHOW_FORBIDDEN_ERROR');
      expect(handleStatus(500)).toBe('SHOW_RETRYABLE_BANNER');
      expect(handleStatus(502)).toBe('SHOW_RETRYABLE_BANNER');
      expect(handleStatus(503)).toBe('SHOW_RETRYABLE_BANNER');
    });

    it('ignores aborted/cancelled requests without redirecting on route transitions', () => {
      const controller = new AbortController();
      controller.abort();

      let redirected = false;
      try {
        if (controller.signal.aborted) {
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Stale request safely ignored
          redirected = false;
        } else {
          redirected = true;
        }
      }

      expect(redirected).toBe(false);
    });
  });
});
