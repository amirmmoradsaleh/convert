import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
}));

import { GET as getSettingsApi, PUT as updateSettingsApi } from '@/app/api/admin/settings/route';
import {
  getGlobalSettings,
  getPublicSiteSettings,
  updateGlobalSettings,
  DEFAULT_SETTINGS,
  DEFAULT_HEADER_NAV,
  DEFAULT_FOOTER_GROUPS,
} from '@/lib/admin/services/settings.service';
import { validateSettingsPayload } from '@/lib/admin/validation';
import { createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin/session';
import { AdminUserSession } from '@/lib/admin/types';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';

describe('Convert24 — Phase 12.1-A: Header & Footer CMS Editing Test Suite', () => {
  const superAdminSession: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role,
  };

  const editorSession: AdminUserSession = {
    id: 'editor-12a',
    email: 'editor@convert24.local',
    name: 'Content Editor 12A',
    role: 'EDITOR',
  };

  const viewerSession: AdminUserSession = {
    id: 'viewer-12a',
    email: 'viewer@convert24.local',
    name: 'Viewer 12A',
    role: 'VIEWER',
  };

  let superAdminToken: string;
  let editorToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetMemoryDb();
    const db = getDb();

    // Seed users in memoryDb
    await db.adminUser.create({
      data: {
        id: editorSession.id,
        email: editorSession.email,
        passwordHash: 'dummy-hash',
        name: editorSession.name,
        role: editorSession.role,
        isActive: true,
      },
    });

    await db.adminUser.create({
      data: {
        id: viewerSession.id,
        email: viewerSession.email,
        passwordHash: 'dummy-hash',
        name: viewerSession.name,
        role: viewerSession.role,
        isActive: true,
      },
    });

    superAdminToken = await createSessionToken(superAdminSession);
    editorToken = await createSessionToken(editorSession);
    viewerToken = await createSessionToken(viewerSession);
  });

  const createRequest = (
    url: string,
    method = 'GET',
    token?: string,
    body?: any
  ): NextRequest => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.cookie = `${ADMIN_COOKIE_NAME}=${token}`;
    }
    if (body) {
      headers['content-type'] = 'application/json';
    }

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  describe('1. Input Validation & URL Safety (validateSettingsPayload)', () => {
    it('accepts safe relative paths and standard HTTPS URLs', () => {
      const result = validateSettingsPayload({
        siteName: 'Convert24 Pro',
        headerTagline: 'Fast File Utilities',
        headerCtaLabel: 'Start Converting',
        headerCtaLink: '/tools/jpg-to-png',
        headerNav: [
          { id: '1', label: 'Blog', href: '/blog', order: 1, visible: true },
          { id: '2', label: 'Docs', href: 'https://docs.convert24.local', order: 2, visible: true },
        ],
        footerDescription: 'Safe client-side tools.',
        copyrightText: '© {year} Convert24 Pro',
        trustText: 'No cloud uploads.',
        footerGroups: [
          {
            title: 'Converters',
            links: [{ label: 'JPG to PNG', href: '/tools/jpg-to-png' }],
          },
        ],
        socialLinks: {
          twitter: 'https://x.com/convert24',
          github: 'https://github.com/convert24',
        },
      });

      expect(result.isValid).toBe(true);
      expect(result.report.errors.length).toBe(0);
      expect(result.sanitized.headerCtaLink).toBe('/tools/jpg-to-png');
      expect(result.sanitized.headerNav?.[0].href).toBe('/blog');
    });

    it('rejects unsafe javascript: URLs in navigation links', () => {
      const result = validateSettingsPayload({
        headerNav: [
          { id: 'xss-1', label: 'Evil Link', href: 'javascript:alert("pwned")', order: 1, visible: true },
        ],
      });

      expect(result.isValid).toBe(false);
      expect(result.report.errors.some((e) => e.field.includes('headerNav') && /unsafe/i.test(e.message))).toBe(true);
    });

    it('rejects unsafe data: and vbscript: URLs in footer links and social profiles', () => {
      const resultFooter = validateSettingsPayload({
        footerGroups: [
          {
            title: 'Dangerous',
            links: [{ label: 'Data Link', href: 'data:text/html,<script>alert(1)</script>' }],
          },
        ],
      });
      expect(resultFooter.isValid).toBe(false);

      const resultSocial = validateSettingsPayload({
        socialLinks: {
          twitter: 'vbscript:msgbox("xss")',
        },
      });
      expect(resultSocial.isValid).toBe(false);
    });

    it('rejects unsafe CTA links and logo URLs', () => {
      const resultCta = validateSettingsPayload({
        headerCtaLink: 'javascript:void(0)',
      });
      expect(resultCta.isValid).toBe(false);

      const resultLogo = validateSettingsPayload({
        siteLogo: 'javascript:alert(1)',
      });
      expect(resultLogo.isValid).toBe(false);
    });

    it('strips dangerous HTML tags from text inputs', () => {
      const result = validateSettingsPayload({
        siteName: '<script>alert("xss")</script>Convert24',
        headerTagline: '<b>Fast</b> & <img src=x onerror=alert(1)> Secure',
        footerDescription: '<a href="evil">Text</a> Description',
        copyrightText: '<script>evil()</script>© {year} Convert24',
        trustText: '<span>Safe</span> & 100% Free',
      });

      expect(result.isValid).toBe(true);
      expect(result.sanitized.siteName).toBe('alert("xss")Convert24');
      expect(result.sanitized.siteName).not.toContain('<script>');
      expect(result.sanitized.headerTagline).not.toContain('<img');
      expect(result.sanitized.headerTagline).not.toContain('onerror');
      expect(result.sanitized.footerDescription).toBe('Text Description');
      expect(result.sanitized.copyrightText).toBe('evil()© {year} Convert24');
      expect(result.sanitized.trustText).toBe('Safe & 100% Free');
    });
  });

  describe('2. Server RBAC & Authorization (app/api/admin/settings/route.ts)', () => {
    it('returns 401 Unauthorized for unauthenticated requests', async () => {
      const req = createRequest('/api/admin/settings', 'PUT', undefined, {
        siteName: 'Hacked Site',
      });
      const res = await updateSettingsApi(req);
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden for VIEWER role without MANAGE_SETTINGS or EDIT_CONTENT', async () => {
      const req = createRequest('/api/admin/settings', 'PUT', viewerToken, {
        siteName: 'Viewer Change',
      });
      const res = await updateSettingsApi(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/Forbidden/i);
    });

    it('allows SUPER_ADMIN (MANAGE_SETTINGS) to update shared settings', async () => {
      const req = createRequest('/api/admin/settings', 'PUT', superAdminToken, {
        siteName: 'Convert24 Suite',
        headerTagline: 'Online Tools Reimagined',
      });
      const res = await updateSettingsApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.settings.siteName).toBe('Convert24 Suite');
      expect(data.settings.headerTagline).toBe('Online Tools Reimagined');
    });

    it('denies EDITOR role without MANAGE_SETTINGS from updating settings (403 Forbidden)', async () => {
      const req = createRequest('/api/admin/settings', 'PUT', editorToken, {
        footerDescription: 'Updated by Content Editor.',
      });
      const res = await updateSettingsApi(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/MANAGE_SETTINGS/i);
    });
  });

  describe('3. Persistence, Revalidation & Partial Updates (settings.service.ts)', () => {
    it('persists complete header and footer configuration and triggers layout revalidation', async () => {
      const updateData = {
        siteName: 'Convert24 Cloud-Free',
        siteLogo: '/images/custom-logo.svg',
        headerTagline: '100% Browser Utilities',
        headerCtaLabel: 'Get Started',
        headerCtaLink: '/#explore-hubs',
        headerCtaVisible: true,
        headerNav: [
          { id: 'nav-tools', label: 'All Tools', href: '/image-tools', order: 1, visible: true },
          { id: 'nav-blog', label: 'Guides', href: '/blog', order: 2, visible: true },
        ],
        footerDescription: 'Privacy-first client-side file converter.',
        copyrightText: '© {year} Convert24 Cloud-Free Inc.',
        trustText: 'Encrypted • Fast • Zero Tracking',
        footerGroups: [
          {
            title: 'Top Converters',
            links: [
              { label: 'JPG to PNG', href: '/tools/jpg-to-png' },
              { label: 'Merge PDF', href: '/tools/merge-pdf' },
            ],
          },
        ],
        socialLinks: {
          twitter: 'https://twitter.com/convert24',
          github: 'https://github.com/convert24',
        },
      };

      const result = await updateGlobalSettings(updateData, superAdminSession);

      expect(result.siteName).toBe('Convert24 Cloud-Free');
      expect(result.siteLogo).toBe('/images/custom-logo.svg');
      expect(result.headerNav?.length).toBe(2);
      expect(result.footerGroups?.length).toBe(1);
      expect(result.socialLinks?.twitter).toBe('https://twitter.com/convert24');

      // Verify layout cache revalidation was triggered
      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');

      // Verify public query reflects the persisted data
      const publicSettings = await getPublicSiteSettings();
      expect(publicSettings.siteName).toBe('Convert24 Cloud-Free');
      expect(publicSettings.headerTagline).toBe('100% Browser Utilities');
      expect(publicSettings.headerNav?.[0].label).toBe('All Tools');
      expect(publicSettings.footerDescription).toBe('Privacy-first client-side file converter.');
      expect(publicSettings.footerGroups?.[0].title).toBe('Top Converters');
      expect(publicSettings.socialLinks?.github).toBe('https://github.com/convert24');
    });

    it('partial update safely preserves existing unrelated settings', async () => {
      // Step 1: Initial baseline
      await updateGlobalSettings(
        {
          siteName: 'Base Name',
          headerTagline: 'Base Tagline',
          footerDescription: 'Base Footer Description',
          copyrightText: '© {year} Base Copyright',
          headerNav: [
            { id: 'nav-1', label: 'Base Nav', href: '/base', order: 1, visible: true },
          ],
        },
        superAdminSession
      );

      // Step 2: Partial update of ONLY headerNav
      await updateGlobalSettings(
        {
          headerNav: [
            { id: 'nav-2', label: 'Updated Nav Only', href: '/updated', order: 1, visible: true },
          ],
        },
        editorSession
      );

      const afterNavUpdate = await getPublicSiteSettings();
      expect(afterNavUpdate.headerNav?.[0].label).toBe('Updated Nav Only');
      // Verify unrelated settings are preserved!
      expect(afterNavUpdate.siteName).toBe('Base Name');
      expect(afterNavUpdate.headerTagline).toBe('Base Tagline');
      expect(afterNavUpdate.footerDescription).toBe('Base Footer Description');
      expect(afterNavUpdate.copyrightText).toBe('© {year} Base Copyright');

      // Step 3: Partial update of ONLY footer trust text
      await updateGlobalSettings(
        {
          trustText: 'Updated Trust Statement',
        },
        superAdminSession
      );

      const afterTrustUpdate = await getPublicSiteSettings();
      expect(afterTrustUpdate.trustText).toBe('Updated Trust Statement');
      // Navigation and brand remain untouched
      expect(afterTrustUpdate.headerNav?.[0].label).toBe('Updated Nav Only');
      expect(afterTrustUpdate.siteName).toBe('Base Name');
    });
  });

  describe('4. Backward Compatibility & Defaults Fallback', () => {
    it('returns default settings when database table is fresh or uninitialized', async () => {
      // Clear mocked global settings database table to test uninitialized fallback
      const db = getDb();
      (db.globalSettings.findUnique as any) = vi.fn().mockResolvedValue(null);

      const publicSettings = await getPublicSiteSettings();

      expect(publicSettings.siteName).toBe('Convert24');
      expect(publicSettings.headerTagline).toBe('Fast, Free & Private Online File Tools');
      expect(publicSettings.headerCtaVisible).toBe(true);
      expect(publicSettings.headerCtaLabel).toBe('Explore All');
      expect(publicSettings.headerCtaLink).toBe('/#explore-hubs');

      // Default header nav items
      expect(publicSettings.headerNav).toBeDefined();
      expect(publicSettings.headerNav?.length).toBe(3);
      expect(publicSettings.headerNav?.map((n) => n.label)).toEqual(['Blog', 'Pricing', 'Help']);

      // Default footer link groups
      expect(publicSettings.footerGroups).toBeDefined();
      expect(publicSettings.footerGroups?.length).toBe(3);
      expect(publicSettings.footerGroups?.map((g) => g.title)).toEqual([
        'Tools & Converters',
        'Formats & Guides',
        'About & Legal',
      ]);

      // Default copyright
      expect(publicSettings.copyrightText).toContain('Convert24');
      expect(publicSettings.trustText).toContain('Client-side processing');
    });
  });
});
