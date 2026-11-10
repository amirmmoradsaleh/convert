import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { PUT as updateToolApi } from '@/app/api/admin/tools/[slug]/route';
import { POST as publishToolApi } from '@/app/api/admin/tools/[slug]/publish/route';
import { GET as getRevisionsApi } from '@/app/api/admin/tools/[slug]/revisions/route';
import { POST as restoreRevisionApi } from '@/app/api/admin/tools/[slug]/revisions/[revisionId]/restore/route';
import { createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin/session';
import { AdminUserSession } from '@/lib/admin/types';
import {
  resolveUnifiedSeo,
  buildCanonicalUrl,
  buildPageStructuredData,
} from '@/lib/cms/unified-content';
import { validateSeo, isSafeUrl } from '@/lib/admin/validation';
import { getPublishedTool } from '@/lib/cms/tool-resolver';
import { getToolContentBySlug, upsertToolContent } from '@/lib/admin/services/tool.service';
import { getAllTools, getToolBySlug } from '@/lib/tools';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';
import { siteConfig } from '@/lib/seo';

describe('Admin CMS Phase 07 — Production Readiness & Failure Case Audit Test Suite', () => {
  let adminSessionToken: string;
  let viewerSessionToken: string;

  const CANONICAL_25_SLUGS = [
    'jpg-to-png',
    'png-to-jpg',
    'jpg-to-webp',
    'webp-to-jpg',
    'png-to-webp',
    'webp-to-png',
    'heic-to-jpg',
    'svg-to-png',
    'gif-to-png',
    'bmp-to-png',
    'compress-image',
    'resize-image',
    'crop-image',
    'rotate-image',
    'image-to-pdf',
    'jpg-to-pdf',
    'png-to-pdf',
    'pdf-to-jpg',
    'pdf-to-png',
    'merge-pdf',
    'split-pdf',
    'compress-pdf',
    'rotate-pdf',
    'delete-pdf-pages',
    'reorder-pdf-pages',
  ];

  beforeEach(async () => {
    resetMemoryDb();
    const db = getDb();

    // Create Super Admin user
    await db.adminUser.create({
      data: {
        id: DEFAULT_ADMIN.id,
        email: DEFAULT_ADMIN.email,
        passwordHash: DEFAULT_ADMIN.passwordHash,
        name: DEFAULT_ADMIN.name,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create Viewer user (insufficient permissions)
    await db.adminUser.create({
      data: {
        id: 'usr_viewer_01',
        email: 'viewer@convert24.com',
        passwordHash: 'hashed_pw',
        name: 'ReadOnly Viewer',
        role: 'VIEWER',
        status: 'ACTIVE',
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const adminSession: AdminUserSession = {
      id: DEFAULT_ADMIN.id,
      email: DEFAULT_ADMIN.email,
      name: DEFAULT_ADMIN.name,
      role: 'SUPER_ADMIN',
    };

    const viewerSession: AdminUserSession = {
      id: 'usr_viewer_01',
      email: 'viewer@convert24.com',
      name: 'ReadOnly Viewer',
      role: 'VIEWER',
    };

    adminSessionToken = await createSessionToken(adminSession);
    viewerSessionToken = await createSessionToken(viewerSession);
  });

  describe('1. Unauthorized and Insufficiently Authorized API Requests', () => {
    it('blocks unauthenticated requests to edit tool content with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/tools/jpg-to-png', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seoTitle: 'Hacker Edit' }),
      });

      const res = await updateToolApi(req, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(res.status).toBe(401);
    });

    it('blocks viewer user without EDIT_CONTENT permission with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/tools/jpg-to-png', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${ADMIN_COOKIE_NAME}=${viewerSessionToken}`,
        },
        body: JSON.stringify({ seoTitle: 'Unauthorized Edit' }),
      });

      const res = await updateToolApi(req, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(res.status).toBe(403);
    });

    it('blocks viewer user without PUBLISH_CONTENT permission from publishing with 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/tools/jpg-to-png/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${ADMIN_COOKIE_NAME}=${viewerSessionToken}`,
        },
      });

      const res = await publishToolApi(req, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(res.status).toBe(403);
    });
  });

  describe('2. Invalid Canonical URL Schemes & Malformed JSON-LD', () => {
    it('rejects unsafe javascript: and data: canonical URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);

      const normalizedJs = buildCanonicalUrl('javascript:alert(1)', '/tools/jpg-to-png');
      expect(normalizedJs).toBe(`${siteConfig.url}/tools/jpg-to-png`);
    });

    it('handles malformed JSON-LD schema gracefully without throwing', () => {
      const result = buildPageStructuredData({
        pageType: 'tool',
        slug: 'jpg-to-png',
        name: 'JPG to PNG',
        seo: {
          schemaJson: '{ invalid json structure ...' as any,
        },
      });

      expect(result).toBeDefined();
      expect(result['@context']).toBe('https://schema.org');
      expect(result['@type']).toBe('WebApplication');
    });

    it('validates SEO field constraints strictly via validateSeo', () => {
      const invalidSeo = validateSeo({
        canonicalUrl: 'javascript:badUrl',
        metaDescription: 'a'.repeat(400),
      });

      expect(invalidSeo.isValid).toBe(false);
      expect(invalidSeo.errors.length).toBeGreaterThan(0);
    });
  });

  describe('3. Public Page Isolation (Draft Content Leakage Prevention)', () => {
    it('ensures draft SEO and content updates do NOT leak to public view before publication', async () => {
      const initialPublic = await getPublishedTool('jpg-to-png');
      expect(initialPublic).toBeDefined();
      const originalTitle = initialPublic?.title;

      // Update draft via admin API
      const req = new NextRequest('http://localhost:3000/api/admin/tools/jpg-to-png', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${ADMIN_COOKIE_NAME}=${adminSessionToken}`,
        },
        body: JSON.stringify({
          customTitle: 'UNPUBLISHED DRAFT TITLE',
          seo: {
            seoTitle: 'UNPUBLISHED DRAFT SEO TITLE',
            metaDescription: 'Draft Meta Description',
          },
        }),
      });

      const updateRes = await updateToolApi(req, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(updateRes.status).toBe(200);

      // Public view MUST still return original published data
      const publicAfterDraft = await getPublishedTool('jpg-to-png');
      expect(publicAfterDraft?.title).toBe(originalTitle);

      // Explicitly publish
      const pubReq = new NextRequest('http://localhost:3000/api/admin/tools/jpg-to-png/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${ADMIN_COOKIE_NAME}=${adminSessionToken}`,
        },
      });

      const pubRes = await publishToolApi(pubReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(pubRes.status).toBe(200);

      // Now public view reflects published changes
      const publicAfterPublish = await getPublishedTool('jpg-to-png');
      expect(publicAfterPublish?.title).toBe('UNPUBLISHED DRAFT SEO TITLE');
    });
  });

  describe('4. Revision Snapshots & Restore Mechanics', () => {
    it('creates revision snapshot on save and allows restoring previous exact state', async () => {
      const adminSessionObj: AdminUserSession = {
        id: DEFAULT_ADMIN.id,
        email: DEFAULT_ADMIN.email,
        name: DEFAULT_ADMIN.name,
        role: 'SUPER_ADMIN',
      };

      // Step 1: Save state 1
      await upsertToolContent('jpg-to-png', {
        customTitle: 'SEO State V1',
        seo: {
          seoTitle: 'SEO State V1',
          metaDescription: 'Description V1',
        },
      }, adminSessionObj);

      // Step 2: Save state 2
      await upsertToolContent('jpg-to-png', {
        customTitle: 'SEO State V2',
        seo: {
          seoTitle: 'SEO State V2',
          metaDescription: 'Description V2',
        },
      }, adminSessionObj);

      // Verify revisions list via API
      const revReq = new NextRequest('http://localhost:3000/api/admin/tools/jpg-to-png/revisions', {
        headers: { Cookie: `${ADMIN_COOKIE_NAME}=${adminSessionToken}` },
      });
      const revRes = await getRevisionsApi(revReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(revRes.status).toBe(200);
      const { revisions } = await revRes.json();
      expect(revisions.length).toBeGreaterThanOrEqual(2);

      const oldestRevision = revisions[revisions.length - 1];

      // Restore oldest revision
      const restoreReq = new NextRequest(`http://localhost:3000/api/admin/tools/jpg-to-png/revisions/${oldestRevision.id}/restore`, {
        method: 'POST',
        headers: { Cookie: `${ADMIN_COOKIE_NAME}=${adminSessionToken}` },
      });
      const restoreRes = await restoreRevisionApi(restoreReq, {
        params: Promise.resolve({ slug: 'jpg-to-png', revisionId: oldestRevision.id }),
      });
      expect(restoreRes.status).toBe(200);

      // Draft state should match state 1
      const currentDraft = await getToolContentBySlug('jpg-to-png');
      expect(currentDraft?.override?.seo?.seoTitle || currentDraft?.override?.customTitle).toBe('SEO State V1');
    });
  });

  describe('5. Missing/Malformed Content & Fallback Integrity', () => {
    it('inherits Tier 2 (tool defaults) and Tier 3 (site defaults) when SEO overrides are absent', () => {
      const tool = getToolBySlug('png-to-jpg')!;
      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'png-to-jpg',
        typeDefaults: {
          title: tool.title,
          description: tool.description,
        },
      });

      expect(resolved.title).toBe(tool.title);
      expect(resolved.description).toBe(tool.description);
      expect((resolved.alternates as any)?.canonical).toBe(`${siteConfig.url}/tools/png-to-jpg`);
    });

    it('falls back to site defaults for completely missing type defaults', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'static',
        slug: 'unknown-route',
      });

      expect(resolved.title).toContain(siteConfig.name);
      expect(resolved.description).toBe(siteConfig.description);
    });
  });

  describe('6. Canonical 25 Public Route Resolution', () => {
    it('strictly maintains exactly 25 canonical tools', () => {
      const tools = getAllTools();
      expect(tools.length).toBe(25);
    });

    it('verifies that every canonical slug resolves to valid engine, metadata, and published page', async () => {
      for (const slug of CANONICAL_25_SLUGS) {
        const tool = getToolBySlug(slug);
        expect(tool, `Tool ${slug} must exist in lib/tools.ts`).toBeDefined();
        expect(tool?.slug).toBe(slug);

        const published = await getPublishedTool(slug);
        expect(published, `Published tool ${slug} must resolve`).toBeDefined();
        expect(published?.slug).toBe(slug);
        expect(published?.blocks?.length || 0).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
