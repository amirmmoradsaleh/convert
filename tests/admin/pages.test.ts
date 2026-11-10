import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDraftPage,
  updateDraftPage,
  publishPage,
  unpublishPage,
  getPageBySlug,
  getPageRevisions,
} from '@/lib/admin/services/page.service';
import { resetMemoryDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';

describe('Admin CMS Phase 01 — Pages, Content & SEO Foundation', () => {
  const author: AdminUserSession = {
    id: 'author-1',
    email: 'cm@filetools.local',
    name: 'Content Manager',
    role: 'CONTENT_MANAGER',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('Page Creation & Drafting', () => {
    it('creates a new draft page with structured blocks and SEO metadata', async () => {
      const page = await createDraftPage(
        {
          slug: 'pricing',
          name: 'Pricing & Plans',
          status: 'DRAFT',
          blocks: [
            {
              id: 'b-1',
              type: 'heading',
              data: { text: 'Free Forever', level: 1 },
            },
            {
              id: 'b-2',
              type: 'paragraph',
              data: { text: 'All file tools are 100% free with no subscriptions.' },
            },
          ],
          seo: {
            seoTitle: 'Pricing – Free Online File Tools',
            metaDescription: '100% free online conversion and editing with zero paywalls.',
            canonicalUrl: 'https://example.com/pricing',
            robotsIndex: true,
            robotsFollow: true,
            focusKeyword: 'free file tools',
          },
        },
        author
      );

      expect(page.id).toBeDefined();
      expect(page.slug).toBe('pricing');
      expect(page.name).toBe('Pricing & Plans');
      expect(page.status).toBe('DRAFT');
      expect((page as any).content?.blocks.length).toBe(2);
      expect((page as any).seo?.seoTitle).toBe('Pricing – Free Online File Tools');
      expect((page as any).seo?.focusKeyword).toBe('free file tools');
    });

    it('rejects creating a page with an already existing slug', async () => {
      await createDraftPage(
        { slug: 'faq-hub', name: 'FAQ Hub', status: 'DRAFT' },
        author
      );

      await expect(
        createDraftPage(
          { slug: 'faq-hub', name: 'Duplicate FAQ Hub', status: 'DRAFT' },
          author
        )
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe('Draft & Publishing Lifecycle', () => {
    it('does not expose unpublished draft content to the public lookup', async () => {
      const page = await createDraftPage(
        { slug: 'draft-feature', name: 'Upcoming Feature', status: 'DRAFT' },
        author
      );

      // Public lookup with publishedOnly = true
      const publicResult = await getPageBySlug('draft-feature', true);
      expect(publicResult).toBeNull();

      // Admin lookup with publishedOnly = false
      const adminResult = await getPageBySlug('draft-feature', false);
      expect(adminResult).not.toBeNull();
      expect(adminResult?.id).toBe(page.id);
    });

    it('publishes a page and sets publishedAt timestamp and isPublished flag', async () => {
      const page = await createDraftPage(
        { slug: 'release-notes', name: 'Release Notes', status: 'DRAFT' },
        author
      );

      const published = await publishPage(page.id, author);
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();

      // Now public lookup succeeds
      const publicResult = await getPageBySlug('release-notes', true);
      expect(publicResult).not.toBeNull();
      expect(publicResult?.status).toBe('PUBLISHED');
    });

    it('unpublishes a page and revokes public visibility', async () => {
      const page = await createDraftPage(
        { slug: 'secret-page', name: 'Secret Page', status: 'DRAFT' },
        author
      );

      await publishPage(page.id, author);
      expect(await getPageBySlug('secret-page', true)).not.toBeNull();

      await unpublishPage(page.id, author);
      expect(await getPageBySlug('secret-page', true)).toBeNull();
    });
  });

  describe('Content Versioning & Revision Snapshots', () => {
    it('creates immutable revisions on creation, updates, and publishing', async () => {
      const page = await createDraftPage(
        { slug: 'terms-updated', name: 'Updated Terms', status: 'DRAFT' },
        author
      );

      await updateDraftPage(
        page.id,
        {
          name: 'Updated Terms of Service 2026',
          blocks: [{ id: 'b-1', type: 'paragraph', data: { text: 'New clause' } }],
          reason: 'Added GDPR section',
        },
        author
      );

      await publishPage(page.id, author);

      const revisions = await getPageRevisions(page.id);
      expect(revisions.length).toBe(3); // Initial creation + update + publish

      expect(revisions[0].reason).toBe('Published page');
      expect(revisions[1].reason).toBe('Added GDPR section');
      expect(revisions[2].reason).toBe('Initial creation');
    });
  });
});
