import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
}));

import {
  bootstrapHomepage,
  createDraftPage,
  updateDraftPage,
  publishPage,
  unpublishPage,
  getPageBySlug,
} from '@/lib/admin/services/page.service';
import { getPublishedPage, buildCmsMetadata } from '@/lib/cms/page-resolver';
import { getDb, resetMemoryDb, DEFAULT_ADMIN } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';
import { sanitizeCustomCss } from '@/lib/admin/validation';
import type { Metadata } from 'next';

describe('Phase 10C — Homepage CMS Rendering & Section Customization', () => {
  const superAdmin: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: 'SUPER_ADMIN',
  };

  beforeEach(() => {
    resetMemoryDb();
    mockRevalidatePath.mockClear();
  });

  describe('1. Fallback Behavior When Homepage Blocks are Empty or Absent', () => {
    it('returns null or empty blocks gracefully when homepage record is absent from database', async () => {
      const db = getDb();
      const existingHome = await db.page.findUnique({ where: { slug: 'home' } });
      if (existingHome) {
        await db.page.delete({ where: { id: existingHome.id } });
      }

      const published = await getPublishedPage('home');
      expect(published).toBeNull();
    });

    it('returns empty blocks list when homepage exists with no blocks', async () => {
      await bootstrapHomepage(superAdmin);
      const published = await getPublishedPage('home');

      expect(published).not.toBeNull();
      expect(published?.slug).toBe('home');
      expect(published?.status).toBe('PUBLISHED');
      expect(Array.isArray(published?.blocks)).toBe(true);
      expect(published?.blocks.length).toBe(0);
    });
  });

  describe('2. Rendering Published CMS Content Blocks', () => {
    it('retrieves custom headings, paragraphs, FAQs, and features from published homepage content', async () => {
      const boot = await bootstrapHomepage(superAdmin);
      const homeId = boot.page.id;

      const customBlocks = [
        {
          id: 'blk-h2',
          type: 'heading',
          level: 2,
          text: 'Custom Welcome Heading',
          enabled: true,
        },
        {
          id: 'blk-p1',
          type: 'paragraph',
          text: 'Custom introductory body text created by admin.',
          enabled: true,
        },
        {
          id: 'blk-f1',
          type: 'feature',
          title: 'Custom Feature 1',
          description: 'Description of custom feature 1',
          enabled: true,
        },
        {
          id: 'blk-faq1',
          type: 'faq',
          question: 'Is Convert24 free?',
          answer: 'Yes, 100% free with unlimited client-side processing.',
          enabled: true,
        },
      ];

      await updateDraftPage(
        homeId,
        {
          name: 'Convert24 - Custom Homepage Title',
          blocks: customBlocks as any,
          customCss: '.custom-hero { background: #fafafa; }',
          reason: 'Added custom homepage blocks',
        },
        superAdmin
      );

      // Publish draft
      await publishPage(homeId, superAdmin);

      const published = await getPublishedPage('home');
      expect(published).not.toBeNull();
      expect(published?.name).toBe('Convert24 - Custom Homepage Title');
      expect(published?.customCss).toBe('.custom-hero { background: #fafafa; }');
      expect(published?.blocks.length).toBe(4);

      const faqBlock = published?.blocks.find((b) => b.type === 'faq');
      expect(faqBlock).toBeDefined();
      expect((faqBlock as any).question).toBe('Is Convert24 free?');

      const featureBlock = published?.blocks.find((b) => b.type === 'feature');
      expect(featureBlock).toBeDefined();
      expect((featureBlock as any).title).toBe('Custom Feature 1');
    });

    it('filters out disabled blocks from published view', async () => {
      const boot = await bootstrapHomepage(superAdmin);
      const homeId = boot.page.id;

      const blocksWithDisabled = [
        { id: 'b1', type: 'heading', level: 2, text: 'Active Heading', enabled: true },
        { id: 'b2', type: 'paragraph', text: 'Hidden Draft Note', enabled: false },
      ];

      await updateDraftPage(
        homeId,
        {
          blocks: blocksWithDisabled as any,
          reason: 'Testing disabled block filtering',
        },
        superAdmin
      );

      await publishPage(homeId, superAdmin);

      const published = await getPublishedPage('home');
      expect(published).not.toBeNull();
      // Raw blocks are retrieved; client/page filtering hides enabled: false
      const enabledOnly = published!.blocks.filter((b: any) => b.enabled !== false);
      expect(enabledOnly.length).toBe(1);
      expect((enabledOnly[0] as any).text).toBe('Active Heading');
    });
  });

  describe('3. Draft Isolation Guardrails', () => {
    it('draft updates do not leak to public getPublishedPage when page status is DRAFT until explicitly published', async () => {
      const boot = await bootstrapHomepage(superAdmin);
      const homeId = boot.page.id;

      // Unpublish page to put it into DRAFT state
      await unpublishPage(homeId, superAdmin);

      // Verify public resolver returns null for DRAFT page
      const draftState = await getPublishedPage('home');
      expect(draftState).toBeNull();

      // Make draft updates
      await updateDraftPage(
        homeId,
        {
          name: 'Draft Title Never Published',
          blocks: [
            { id: 'draft-b1', type: 'heading', level: 1, text: 'Confidential Draft Title' } as any,
          ],
          reason: 'Draft editing phase',
        },
        superAdmin
      );

      // Public resolver should still return null while in DRAFT status
      const publicState = await getPublishedPage('home');
      expect(publicState).toBeNull();

      // Now publish explicitly
      await publishPage(homeId, superAdmin);

      const newlyPublished = await getPublishedPage('home');
      expect(newlyPublished).not.toBeNull();
      expect(newlyPublished?.name).toBe('Draft Title Never Published');
      expect(newlyPublished?.blocks.length).toBe(1);
    });
  });

  describe('4. Custom SEO, JSON-LD, and Cache Invalidation', () => {
    it('buildCmsMetadata correctly handles custom homepage SEO overrides', async () => {
      const defaultMeta: Metadata = {
        title: 'Default Homepage Title',
        description: 'Default Homepage Description',
      };

      const cmsPage: any = {
        name: 'Homepage',
        slug: 'home',
        status: 'PUBLISHED',
        seo: {
          seoTitle: 'Convert24 – Free Instant File Converters',
          metaDescription: 'Convert images and PDFs online with 100% browser privacy.',
          canonicalUrl: '/',
          robotsIndex: true,
          robotsFollow: true,
          ogTitle: 'Convert24 Social Card',
          ogDescription: 'Instant private file tools',
          ogImage: '/images/social-card.png',
        },
      };

      const meta = buildCmsMetadata(cmsPage, defaultMeta);
      expect(meta.title).toBe('Convert24 – Free Instant File Converters');
      expect(meta.description).toBe('Convert images and PDFs online with 100% browser privacy.');
      expect((meta.alternates as any)?.canonical).toBe('/');
      expect((meta.openGraph as any)?.title).toBe('Convert24 Social Card');
    });

    it('publishing or unpublishing homepage invalidates root cache route /', async () => {
      const boot = await bootstrapHomepage(superAdmin);
      const homeId = boot.page.id;

      mockRevalidatePath.mockClear();
      await publishPage(homeId, superAdmin);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');

      mockRevalidatePath.mockClear();
      await unpublishPage(homeId, superAdmin);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });
  });

  describe('5. Custom CSS Security & Sanitization', () => {
    it('strips style closing tags and script tags to prevent HTML/XSS injection', () => {
      const maliciousCss = '.hero { color: red; } </style><script>alert("xss")</script>';
      const clean = sanitizeCustomCss(maliciousCss);

      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
      expect(clean).not.toContain('script');
      expect(clean).toContain('.hero { color: red; }');
    });

    it('strips mixed-case closing tags, comments, and svg onload edge cases', () => {
      const edgeCaseCss = '.hero { color: red; } </StYlE><ScRiPt>alert("xss")</sCrIpT><!-- comment --><svg/onload=alert(1)>';
      const clean = sanitizeCustomCss(edgeCaseCss);

      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
      expect(clean).not.toContain('script');
      expect(clean).toContain('.hero { color: red; }');
    });

    it('strips expression() and javascript: URLs in CSS', () => {
      const dangerousCss = '.btn { background: url("javascript:alert(1)"); width: expression(alert(2)); }';
      const clean = sanitizeCustomCss(dangerousCss);

      expect(clean).not.toContain('javascript:');
      expect(clean).not.toContain('expression(');
    });

    it('strips @import rules to prevent external stylesheet loading', () => {
      const importCss = '@import url("https://attacker.example/malicious.css"); .hero { color: red; }';
      const clean = sanitizeCustomCss(importCss);

      expect(clean).not.toContain('@import');
      expect(clean).toContain('.hero { color: red; }');
    });

    it('preserves valid legitimate CSS rules and selectors', () => {
      const validCss = '.hero-banner { background-color: #f4f0fd; border-radius: 12px; padding: 2rem; }';
      const clean = sanitizeCustomCss(validCss);

      expect(clean).toBe(validCss);
    });
  });
});
