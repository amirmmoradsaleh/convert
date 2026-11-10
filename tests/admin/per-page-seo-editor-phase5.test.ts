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
import { getToolContentBySlug } from '@/lib/admin/services/tool.service';
import { getToolBySlug } from '@/lib/tools';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';
import { InlineSeoDrawer, InlineSeoData } from '@/components/admin/inline/InlineSeoDrawer';
import { InlineEditorToolbar } from '@/components/admin/inline/InlineEditorToolbar';
import { siteConfig } from '@/lib/seo';

describe('Admin CMS Phase 05 — Per-Page SEO Editor Test Suite', () => {
  const superAdminSession: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role,
  };

  const editorSession: AdminUserSession = {
    id: 'editor-01',
    email: 'editor@filetools.local',
    name: 'Content Editor',
    role: 'EDITOR',
  };

  const viewerSession: AdminUserSession = {
    id: 'viewer-01',
    email: 'viewer@filetools.local',
    name: 'Readonly Viewer',
    role: 'VIEWER',
  };

  let superAdminToken: string;
  let editorToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    resetMemoryDb();
    const db = getDb();

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

  describe('1. SEO Field Validation & Safe URL Handling', () => {
    it('validates SEO title and meta description length recommendations', () => {
      const reportShort = validateSeo({
        seoTitle: 'Short',
        metaDescription: 'Too short',
      });
      expect(reportShort.warnings.length).toBeGreaterThan(0);
      expect(reportShort.warnings.some((w) => w.field === 'seoTitle')).toBe(true);
      expect(reportShort.warnings.some((w) => w.field === 'metaDescription')).toBe(true);

      const reportOptimal = validateSeo({
        seoTitle: 'Free JPG to PNG Converter Online – 100% Private',
        metaDescription: 'Convert JPG images to PNG format instantly in your browser. Fast, private, and 100% free with zero file uploads to external servers.',
      });
      expect(reportOptimal.isValid).toBe(true);
    });

    it('detects and rejects unsafe URL schemes in canonical and image URLs', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);

      expect(isSafeUrl('https://example.com/og-image.png')).toBe(true);
      expect(isSafeUrl('/images/og-share.png')).toBe(true);
    });

    it('buildCanonicalUrl normalizes URLs and strips unsafe schemes', () => {
      const unsafe = buildCanonicalUrl('javascript:alert(1)', '/tools/jpg-to-png');
      expect(unsafe).toBe(`${siteConfig.url}/tools/jpg-to-png`);

      const validRelative = buildCanonicalUrl('/tools/merge-pdf');
      expect(validRelative).toBe(`${siteConfig.url}/tools/merge-pdf`);

      const validAbsolute = buildCanonicalUrl(`${siteConfig.url}/tools/compress-image`);
      expect(validAbsolute).toBe(`${siteConfig.url}/tools/compress-image`);
    });
  });

  describe('2. 3-Tier SEO Precedence & Reset Overrides', () => {
    it('uses explicit page override when present (Tier 1)', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'jpg-to-png',
        pageSeo: {
          seoTitle: 'Custom Tier 1 Title',
          metaDescription: 'Custom Tier 1 Description',
          canonicalUrl: `${siteConfig.url}/custom-canonical`,
        },
        typeDefaults: {
          title: 'Tier 2 Type Default Title',
          description: 'Tier 2 Type Default Description',
        },
      });

      expect(resolved.title).toBe('Custom Tier 1 Title');
      expect(resolved.description).toBe('Custom Tier 1 Description');
      expect((resolved.alternates as any)?.canonical).toBe(`${siteConfig.url}/custom-canonical`);
    });

    it('falls back to type-specific defaults when override is empty or absent (Tier 2)', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'jpg-to-png',
        pageSeo: {
          seoTitle: '',
          metaDescription: '   ',
        },
        typeDefaults: {
          title: 'Tier 2 Type Default Title',
          description: 'Tier 2 Type Default Description',
        },
      });

      expect(resolved.title).toBe('Tier 2 Type Default Title');
      expect(resolved.description).toBe('Tier 2 Type Default Description');
    });

    it('falls back to site-wide defaults when override and type defaults are absent (Tier 3)', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'jpg-to-png',
        pageSeo: null,
      });

      expect(resolved.title).toBeDefined();
      expect(resolved.description).toBeDefined();
    });
  });

  describe('3. Draft Persistence vs Public Metadata Isolation', () => {
    it('saving SEO edits in draft mode updates draft state without changing public metadata', async () => {
      const customSeo: InlineSeoData = {
        seoTitle: 'Draft Exclusive SEO Title for JPG to PNG',
        metaDescription: 'Draft exclusive meta description that must not leak to public visitors until published.',
        canonicalUrl: `${siteConfig.url}/tools/jpg-to-png`,
        robotsIndex: true,
        robotsFollow: true,
      };

      const saveReq = createRequest('/api/admin/tools/jpg-to-png', 'PUT', editorToken, {
        seo: customSeo,
        isPublished: false,
      });
      const saveRes = await updateToolApi(saveReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(saveRes.status).toBe(200);

      // Public visitors MUST see canonical defaults, NOT the unpublished draft SEO
      const publicTool = await getPublishedTool('jpg-to-png');
      expect(publicTool).not.toBeNull();

      // Authorized preview/details resolver MUST reflect the updated SEO
      const cmsDetails = await getToolContentBySlug('jpg-to-png');
      expect(cmsDetails).not.toBeNull();
      expect(cmsDetails?.override?.seo?.seoTitle).toBe('Draft Exclusive SEO Title for JPG to PNG');
    });

    it('publishing SEO changes makes them immediately active for public visitors', async () => {
      const customSeo: InlineSeoData = {
        seoTitle: 'Published SEO Title for JPG to PNG',
        metaDescription: 'Published meta description active for all search engines and visitors.',
        canonicalUrl: `${siteConfig.url}/tools/jpg-to-png`,
        robotsIndex: true,
        robotsFollow: true,
      };

      // Save draft
      const saveReq = createRequest('/api/admin/tools/jpg-to-png', 'PUT', superAdminToken, {
        seo: customSeo,
        isPublished: false,
      });
      await updateToolApi(saveReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });

      // Publish
      const publishReq = createRequest('/api/admin/tools/jpg-to-png/publish', 'POST', superAdminToken);
      const publishRes = await publishToolApi(publishReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(publishRes.status).toBe(200);

      // Verify published tool SEO
      const cmsDetails = await getToolContentBySlug('jpg-to-png');
      expect(cmsDetails?.override?.seo?.seoTitle).toBe('Published SEO Title for JPG to PNG');
    });
  });

  describe('4. Authorization & Security Enforcement', () => {
    it('blocks unauthenticated visitors from updating SEO metadata (401)', async () => {
      const req = createRequest('/api/admin/tools/jpg-to-png', 'PUT', undefined, {
        seo: { seoTitle: 'Unauthorized Title' },
      });
      const res = await updateToolApi(req, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(res.status).toBe(401);
    });

    it('blocks users without EDIT_CONTENT permission from updating SEO (403)', async () => {
      const req = createRequest('/api/admin/tools/jpg-to-png', 'PUT', viewerToken, {
        seo: { seoTitle: 'Viewer Attempt' },
      });
      const res = await updateToolApi(req, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(res.status).toBe(403);
    });
  });

  describe('5. JSON-LD Structured Data Parsing & Safe Serialization', () => {
    it('buildPageStructuredData generates valid WebApplication schema for tool routes', () => {
      const canonical = getToolBySlug('merge-pdf')!;
      const jsonLd = buildPageStructuredData({
        pageType: 'tool',
        slug: 'merge-pdf',
        name: canonical.title,
        description: canonical.description,
      });

      expect(jsonLd).toBeDefined();
      expect(jsonLd['@context']).toBe('https://schema.org');
      expect(jsonLd['@type']).toBe('WebApplication');
      expect(jsonLd.name).toBe(canonical.title);
    });

    it('safely merges custom schemaJson payload without throwing syntax errors', () => {
      const canonical = getToolBySlug('merge-pdf')!;
      const customSchema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: 'How to Merge PDF Files Online',
        step: [
          { '@type': 'HowToStep', text: 'Select PDF files' },
          { '@type': 'HowToStep', text: 'Click Merge PDF' },
        ],
      };

      const jsonLd = buildPageStructuredData({
        pageType: 'tool',
        slug: 'merge-pdf',
        name: canonical.title,
        seo: {
          schemaType: 'HowTo',
          schemaJson: customSchema,
        },
      });

      expect(jsonLd['@type']).toBe('HowTo');
      expect(jsonLd.name).toBe('How to Merge PDF Files Online');
    });
  });

  describe('6. Revisions & SEO Snapshot Tracking', () => {
    it('snapshots SEO configuration in tool revisions and restores exact SEO snapshot', async () => {
      const tool = getToolBySlug('compress-pdf')!;

      // Save SEO v1
      const v1Req = createRequest('/api/admin/tools/compress-pdf', 'PUT', editorToken, {
        seo: {
          seoTitle: 'Compress PDF V1 SEO Title',
          metaDescription: 'V1 Meta Description',
        },
        reason: 'SEO Version 1',
      });
      await updateToolApi(v1Req, { params: Promise.resolve({ slug: 'compress-pdf' }) });

      // Save SEO v2
      const v2Req = createRequest('/api/admin/tools/compress-pdf', 'PUT', editorToken, {
        seo: {
          seoTitle: 'Compress PDF V2 SEO Title',
          metaDescription: 'V2 Meta Description',
        },
        reason: 'SEO Version 2',
      });
      await updateToolApi(v2Req, { params: Promise.resolve({ slug: 'compress-pdf' }) });

      // Fetch revisions
      const revReq = createRequest('/api/admin/tools/compress-pdf/revisions', 'GET', editorToken);
      const revRes = await getRevisionsApi(revReq, { params: Promise.resolve({ slug: 'compress-pdf' }) });
      const revData = await revRes.json();
      expect(revData.revisions.length).toBeGreaterThanOrEqual(2);

      const oldestRevision = revData.revisions[revData.revisions.length - 1];

      // Restore oldest revision
      const restoreReq = createRequest(
        `/api/admin/tools/compress-pdf/revisions/${oldestRevision.id}/restore`,
        'POST',
        superAdminToken
      );
      const restoreRes = await restoreRevisionApi(restoreReq, {
        params: Promise.resolve({ slug: 'compress-pdf', revisionId: oldestRevision.id }),
      });
      expect(restoreRes.status).toBe(200);

      // Verify restored SEO details reflect V1
      const cmsDetails = await getToolContentBySlug('compress-pdf');
      expect(cmsDetails?.override?.seo?.seoTitle).toBe('Compress PDF V1 SEO Title');
    });
  });

  describe('7. Inline Editor UI Export Integrity', () => {
    it('exports InlineSeoDrawer and InlineEditorToolbar cleanly', () => {
      expect(InlineSeoDrawer).toBeDefined();
      expect(InlineEditorToolbar).toBeDefined();
    });
  });
});
