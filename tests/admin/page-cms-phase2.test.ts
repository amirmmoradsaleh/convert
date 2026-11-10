import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraftPage,
  updateDraftPage,
  publishPage,
  unpublishPage,
  getPageById,
  getPageRevisions,
  restorePageRevision,
  previewDraftPage,
} from '@/lib/admin/services/page.service';
import {
  isSafeUrl,
  sanitizeRichTextHtml,
  validateJsonLd,
  validateSeo,
  validateAndSanitizeBlock,
  validatePagePayload,
} from '@/lib/admin/validation';
import { getPublishedPage, buildCmsMetadata } from '@/lib/cms/page-resolver';
import { resetMemoryDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';
import type { Metadata } from 'next';

describe('Admin CMS Phase 02 — Pages CMS, SEO, Revisions & Public Resolver', () => {
  const author: AdminUserSession = {
    id: 'admin-cm-01',
    email: 'editor@filetools.local',
    name: 'Lead Editor',
    role: 'CONTENT_MANAGER',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Content Validation & Sanitization', () => {
    it('validates safe and unsafe URLs correctly', () => {
      expect(isSafeUrl('/about')).toBe(true);
      expect(isSafeUrl('https://example.com/terms')).toBe(true);
      expect(isSafeUrl('mailto:support@example.com')).toBe(true);
      expect(isSafeUrl('#faq-heading')).toBe(true);

      // Unsafe URLs must be rejected
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:void(0)')).toBe(false);
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox("hi")')).toBe(false);
    });

    it('sanitizes rich text HTML removing scripts, iframes, and inline event handlers', () => {
      const maliciousHtml = `
        <p>Welcome to our site!</p>
        <script>alert("pwned")</script>
        <iframe src="https://attacker.example"></iframe>
        <a href="javascript:stealCookies()" onclick="steal()">Click here</a>
        <img src="/safe.png" onload="alert('xss')" />
      `;

      const clean = sanitizeRichTextHtml(maliciousHtml);
      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('onload=');
      expect(clean).not.toContain('onclick=');
      expect(clean).not.toContain('javascript:');
      expect(clean).toContain('<p>Welcome to our site!</p>');
    });

    it('validates JSON-LD structured data and rejects syntax errors or script injection', () => {
      const validJson = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: 'About Us',
      });
      expect(validateJsonLd(validJson).isValid).toBe(true);

      // Invalid syntax
      expect(validateJsonLd('{ not valid json }').isValid).toBe(false);

      // Injected script in JSON-LD string
      expect(validateJsonLd('<script>alert(1)</script>').isValid).toBe(false);
    });

    it('validates SEO title and meta description length recommendations', () => {
      const report = validateSeo({
        seoTitle: 'Short', // < 10 chars
        metaDescription: 'Too short description', // < 50 chars
        canonicalUrl: '/valid-url',
        robotsIndex: true,
        robotsFollow: true,
      });

      expect(report.isValid).toBe(true); // Warnings do not block
      expect(report.warnings.length).toBeGreaterThanOrEqual(2);
      expect(report.warnings.some((w) => w.field === 'seoTitle')).toBe(true);
      expect(report.warnings.some((w) => w.field === 'metaDescription')).toBe(true);
    });

    it('rejects blocks with unsafe CTA links', () => {
      const unsafeBlock = {
        type: 'cta',
        label: 'Click me',
        href: 'javascript:alert("hack")',
      };
      const result = validateAndSanitizeBlock(unsafeBlock);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/unsafe/i);
    });

    it('validates complete page payload', () => {
      const payload = {
        name: 'Guides Hub',
        slug: 'guides-hub',
        blocks: [
          { type: 'heading', level: 1, text: 'Guides & Tutorials' },
          { type: 'paragraph', text: 'Step by step instructions for file tools.' },
          { type: 'cta', label: 'Start Now', href: '/tools/jpg-to-png' },
        ],
        seo: {
          seoTitle: 'File Processing Guides – 100% Free Tools',
          metaDescription: 'Learn how to easily convert and manage your image and PDF documents.',
          canonicalUrl: '/guides-hub',
        },
      };

      const result = validatePagePayload(payload as any);
      expect(result.isValid).toBe(true);
      expect(result.sanitizedBlocks.length).toBe(3);
    });
  });

  describe('2. Draft / Publish Lifecycle & Public Fallback', () => {
    it('draft content is never exposed to public visitors (Draft Isolation)', async () => {
      const page = await createDraftPage(
        {
          slug: 'upcoming-feature-preview',
          name: 'Upcoming Feature',
          status: 'DRAFT',
          blocks: [{ type: 'paragraph', text: 'Confidential roadmap info.' } as any],
        },
        author
      );

      // Public resolver
      const publicPage = await getPublishedPage('upcoming-feature-preview');
      expect(publicPage).toBeNull();

      // Admin preview
      const preview = await previewDraftPage(page.id, author);
      expect(preview).not.toBeNull();
      expect(preview?.id).toBe(page.id);
    });

    it('publishing makes content available to public resolver and sets isPublished flag', async () => {
      const page = await createDraftPage(
        {
          slug: 'help-center-v2',
          name: 'Help Center',
          status: 'DRAFT',
          blocks: [{ type: 'heading', level: 1, text: 'Help Center' } as any],
        },
        author
      );

      expect(await getPublishedPage('help-center-v2')).toBeNull();

      await publishPage(page.id, author);

      const published = await getPublishedPage('help-center-v2');
      expect(published).not.toBeNull();
      expect(published?.status).toBe('PUBLISHED');
      expect(published?.blocks.length).toBe(1);
    });

    it('unpublishing immediately withdraws content from public view', async () => {
      const page = await createDraftPage(
        {
          slug: 'temporary-notice',
          name: 'Notice',
          status: 'DRAFT',
        },
        author
      );

      await publishPage(page.id, author);
      expect(await getPublishedPage('temporary-notice')).not.toBeNull();

      await unpublishPage(page.id, author);
      expect(await getPublishedPage('temporary-notice')).toBeNull();
    });

    it('buildCmsMetadata generates accurate Open Graph, Twitter, and canonical metadata', () => {
      const defaultMeta: Metadata = {
        title: 'Default Title',
        description: 'Default Description',
      };

      const cmsPage: any = {
        name: 'Custom Page',
        slug: 'custom',
        status: 'PUBLISHED',
        seo: {
          seoTitle: 'Custom CMS SEO Title',
          metaDescription: 'Custom CMS Meta Description for search engines.',
          canonicalUrl: '/custom',
          robotsIndex: true,
          robotsFollow: true,
          ogTitle: 'Social OG Title',
          ogDescription: 'Social OG Description',
          ogImage: '/og.png',
          twitterTitle: 'Twitter Title',
          twitterDescription: 'Twitter Description',
          twitterImage: '/twitter.png',
        },
      };

      const metadata = buildCmsMetadata(cmsPage, defaultMeta);
      expect(metadata.title).toBe('Custom CMS SEO Title');
      expect(metadata.description).toBe('Custom CMS Meta Description for search engines.');
      expect((metadata.alternates as any)?.canonical).toBe('/custom');
      expect(metadata.robots).toEqual({ index: true, follow: true });
      expect((metadata.openGraph as any)?.title).toBe('Social OG Title');
      expect((metadata.twitter as any)?.title).toBe('Twitter Title');
    });

    it('buildCmsMetadata safely falls back to defaults when CMS SEO is empty', () => {
      const defaultMeta: Metadata = {
        title: 'Original Title',
        description: 'Original Description',
      };

      const emptyCmsPage: any = {
        name: 'Empty SEO Page',
        slug: 'empty',
        status: 'PUBLISHED',
        seo: null,
      };

      const metadata = buildCmsMetadata(emptyCmsPage, defaultMeta);
      expect(metadata.title).toBe('Original Title');
      expect(metadata.description).toBe('Original Description');
    });
  });

  describe('3. Immutable Revision History & Restoration', () => {
    it('creates revisions on page creation and updates', async () => {
      const page = await createDraftPage(
        {
          slug: 'changelog',
          name: 'Changelog',
          status: 'DRAFT',
          blocks: [{ type: 'heading', level: 1, text: 'v1.0.0' } as any],
        },
        author
      );

      await updateDraftPage(
        page.id,
        {
          blocks: [
            { type: 'heading', level: 1, text: 'v1.0.0' } as any,
            { type: 'paragraph', text: 'Initial release' } as any,
          ],
          reason: 'Added release notes paragraph',
        },
        author
      );

      const revs = await getPageRevisions(page.id);
      expect(revs.length).toBe(2);
      expect(revs[0].reason).toBe('Added release notes paragraph');
      expect(revs[1].reason).toBe('Initial creation');
    });

    it('restoring a previous revision creates a new revision without mutating historical records', async () => {
      const page = await createDraftPage(
        {
          slug: 'restore-test',
          name: 'Restore Test Page',
          status: 'DRAFT',
          blocks: [{ id: 'b1', type: 'paragraph', text: 'Original content v1' } as any],
          seo: { seoTitle: 'SEO Title v1' },
        },
        author
      );

      const initialRevisions = await getPageRevisions(page.id);
      const v1RevisionId = initialRevisions[0].id;

      // Update to v2
      await updateDraftPage(
        page.id,
        {
          blocks: [{ id: 'b2', type: 'paragraph', text: 'Modified content v2' } as any],
          seo: { seoTitle: 'SEO Title v2' },
          reason: 'Updated to v2',
        },
        author
      );

      const updatedPage = await getPageById(page.id);
      expect((updatedPage?.content?.blocks as any[])[0].text).toBe('Modified content v2');

      // Now restore v1
      const restoredPage = await restorePageRevision(page.id, v1RevisionId, author);
      expect((restoredPage?.content?.blocks as any[])[0].text).toBe('Original content v1');
      expect(restoredPage?.seo?.seoTitle).toBe('SEO Title v1');

      // Verify revision history expanded with a new restoration entry
      const finalRevisions = await getPageRevisions(page.id);
      expect(finalRevisions.length).toBe(3);
      expect(finalRevisions[0].reason).toBe(`Restored from revision ${v1RevisionId}`);
      expect(finalRevisions[2].id).toBe(v1RevisionId); // Historical v1 is preserved intact!
    });
  });
});
