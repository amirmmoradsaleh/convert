import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBlogDraft,
  updateBlogDraft,
  publishBlogPost,
  unpublishBlogPost,
  scheduleBlogPost,
  getBlogPostById,
  deleteBlogPost,
  getBlogRevisions,
  restorePostRevision,
  listCategories,
  createCategory,
  listTags,
  createTag,
} from '@/lib/admin/services/blog.service';
import {
  getPublishedPosts,
  getPublishedPostBySlug,
  getPreviewPostById,
  buildBlogPostMetadata,
  getBlogPostJsonLd,
} from '@/lib/cms/blog-resolver';
import { resetMemoryDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';
import type { Metadata } from 'next';

describe('Admin CMS Phase 04 — Blog CMS, SEO, Categories, Revisions & Public Resolver', () => {
  const author: AdminUserSession = {
    id: 'admin-author-01',
    email: 'blog-editor@filetools.local',
    name: 'Tech Editor',
    role: 'CONTENT_MANAGER',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Draft Creation, Sanitization & Reading Time', () => {
    it('creates a new draft post with automatic slug, reading time, and initial revision', async () => {
      const post = await createBlogDraft(
        {
          title: 'Understanding PNG and WebP Image Compression',
          content: 'Here is a detailed guide on how lossy and lossless algorithms compress digital images. ' + 'word '.repeat(300),
          excerpt: 'A comprehensive guide to image formats.',
          featuredImage: 'https://example.com/images/hero.png',
          featuredImageAlt: 'Compression comparison diagram',
        },
        author
      );

      expect(post.id).toBeDefined();
      expect(post.slug).toBe('understanding-png-and-webp-image-compression');
      expect(post.status).toBe('DRAFT');
      expect(post.publishedAt).toBeNull();
      expect(post.readingTime).toContain('min read');
      expect(post.featuredImage).toBe('https://example.com/images/hero.png');

      // Verify initial revision exists
      const revisions = await getBlogRevisions(post.id);
      expect(revisions.length).toBeGreaterThanOrEqual(1);
      expect(revisions[0].reason).toContain('Initial');
    });

    it('handles slug collisions gracefully by generating unique suffixes', async () => {
      const p1 = await createBlogDraft(
        {
          title: 'Duplicate Slug Guide',
          slug: 'duplicate-slug-guide',
          content: 'Content 1',
        },
        author
      );

      const p2 = await createBlogDraft(
        {
          title: 'Duplicate Slug Guide',
          slug: 'duplicate-slug-guide',
          content: 'Content 2',
        },
        author
      );

      expect(p1.slug).toBe('duplicate-slug-guide');
      expect(p2.slug).not.toBe('duplicate-slug-guide');
      expect(p2.slug).toContain('duplicate-slug-guide-');
    });
  });

  describe('2. Draft Isolation & Public Resolution Lifecycle', () => {
    it('strictly isolates draft posts from public visitors (returns null)', async () => {
      const draft = await createBlogDraft(
        {
          title: 'Secret Upcoming Feature',
          slug: 'secret-feature',
          content: 'Internal draft not for public consumption.',
        },
        author
      );

      // Public visitor cannot resolve draft
      const publicPost = await getPublishedPostBySlug('secret-feature');
      expect(publicPost).toBeNull();

      // Public listing does not contain draft
      const list = await getPublishedPosts();
      const hasDraft = list.posts.some((p) => p.slug === 'secret-feature');
      expect(hasDraft).toBe(false);

      // Authenticated admin preview CAN resolve draft
      const preview = await getPreviewPostById(draft.id);
      expect(preview).not.toBeNull();
      expect(preview?.slug).toBe('secret-feature');
      expect(preview?.status).toBe('DRAFT');
    });

    it('publishes and unpublishes posts dynamically updating public visibility', async () => {
      const post = await createBlogDraft(
        {
          title: 'How to Merge PDF Documents Safely',
          slug: 'how-to-merge-pdf-documents-safely',
          content: 'Merging PDFs in your browser without uploading to foreign servers is fast and secure.',
        },
        author
      );

      // Publish post
      const published = await publishBlogPost(post.id, author);
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();

      // Public visitor can now resolve it
      const publicPost = await getPublishedPostBySlug('how-to-merge-pdf-documents-safely');
      expect(publicPost).not.toBeNull();
      expect(publicPost?.title).toBe('How to Merge PDF Documents Safely');

      // Unpublish post back to DRAFT
      const unpublished = await unpublishBlogPost(post.id, author);
      expect(unpublished.status).toBe('DRAFT');

      // Public visitor can NO LONGER resolve it (Draft isolation)
      const afterUnpublish = await getPublishedPostBySlug('how-to-merge-pdf-documents-safely');
      expect(afterUnpublish).toBeNull();
    });

    it('scheduled posts with future dates are not visible to the public until scheduled date passes', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 7); // 7 days in future
      const post = await createBlogDraft(
        {
          title: 'Future Tech Horizons',
          slug: 'future-tech-horizons',
          content: 'Looking into tomorrow.',
        },
        author
      );

      await scheduleBlogPost(post.id, futureDate.toISOString(), author);

      // Public visitor cannot access scheduled post before time
      const publicPost = await getPublishedPostBySlug('future-tech-horizons');
      expect(publicPost).toBeNull();

      // Admin preview can still access it
      const preview = await getPreviewPostById(post.id);
      expect(preview?.status).toBe('SCHEDULED');
      expect(preview?.scheduledFor).not.toBeNull();
    });

    it('falls back to static articles when a slug is not found in database', async () => {
      // 'understanding-image-compression-lossy-vs-lossless' is one of the 4 canonical static articles
      const article = await getPublishedPostBySlug('understanding-image-compression-lossy-vs-lossless');
      expect(article).not.toBeNull();
      expect(article?.slug).toBe('understanding-image-compression-lossy-vs-lossless');
      expect(article?.status).toBe('PUBLISHED');
      expect(article?.author?.name).toBeDefined();
    });
  });

  describe('3. Categories, Tags & Filters', () => {
    it('manages categories and associates posts with categories and tags', async () => {
      const category = await createCategory({
        name: 'Tutorials',
        slug: 'tutorials',
        description: 'Step by step how-to guides',
      });

      const tag1 = await createTag({ name: 'PDF', slug: 'pdf' });
      const tag2 = await createTag({ name: 'Security', slug: 'security' });

      const post = await createBlogDraft(
        {
          title: 'Encrypted PDF Workflows',
          slug: 'encrypted-pdf-workflows',
          content: 'Securing confidential documents.',
          categoryId: category.id,
          tagIds: [tag1.id, tag2.id],
        },
        author
      );

      await publishBlogPost(post.id, author);

      const resolved = await getPublishedPostBySlug('encrypted-pdf-workflows');
      expect(resolved?.category?.slug).toBe('tutorials');
      expect(resolved?.tags?.length).toBe(2);

      // Filter by category
      const categoryPosts = await getPublishedPosts({ categorySlug: 'tutorials' });
      expect(categoryPosts.posts.some((p) => p.slug === 'encrypted-pdf-workflows')).toBe(true);

      // Filter by tag
      const tagPosts = await getPublishedPosts({ tagSlug: 'pdf' });
      expect(tagPosts.posts.some((p) => p.slug === 'encrypted-pdf-workflows')).toBe(true);
    });
  });

  describe('4. Revisions & Rollback History', () => {
    it('records revisions on edit and accurately rolls back content and SEO', async () => {
      const post = await createBlogDraft(
        {
          title: 'Version 1 Title',
          slug: 'v1-v2-test',
          content: 'Initial v1 content description.',
          seo: {
            seoTitle: 'V1 SEO Title',
            metaDescription: 'V1 meta description',
          },
        },
        author
      );

      // Update post to Version 2
      await updateBlogDraft(
        post.id,
        {
          title: 'Version 2 Updated Title',
          content: 'Brand new v2 content text.',
          seo: {
            seoTitle: 'V2 SEO Title',
            metaDescription: 'V2 meta description',
          },
        },
        author
      );

      const revisions = await getBlogRevisions(post.id);
      expect(revisions.length).toBeGreaterThanOrEqual(2);

      // Oldest revision has v1
      const initialRev = revisions[revisions.length - 1];
      expect(initialRev.contentSnapshot.title).toBe('Version 1 Title');

      // Rollback to initial revision
      const rolledBack = await restorePostRevision(post.id, initialRev.id, author);
      expect(rolledBack.title).toBe('Version 1 Title');
      expect(rolledBack.content).toBe('Initial v1 content description.');
      expect(rolledBack.seo?.seoTitle).toBe('V1 SEO Title');
    });
  });

  describe('5. SEO Metadata & Schema.org JSON-LD Generation', () => {
    it('generates complete App Router metadata for published blog posts', async () => {
      const post = await createBlogDraft(
        {
          title: 'WebP vs AVIF Comparison 2026',
          slug: 'webp-vs-avif-comparison-2026',
          content: 'Comparing next-gen image formats for web developers.',
          seo: {
            seoTitle: 'WebP vs AVIF: Which Should You Use in 2026?',
            metaDescription: 'Detailed performance benchmarks between WebP and AVIF.',
            robotsIndex: true,
            robotsFollow: true,
            ogTitle: 'WebP vs AVIF Head to Head',
          },
        },
        author
      );

      await publishBlogPost(post.id, author);

      const fallbackMeta: Metadata = {
        title: 'Default Title',
        description: 'Default Description',
      };

      const meta = await buildBlogPostMetadata('webp-vs-avif-comparison-2026', fallbackMeta);
      expect(meta.title).toBe('WebP vs AVIF: Which Should You Use in 2026?');
      expect(meta.description).toBe('Detailed performance benchmarks between WebP and AVIF.');
      expect(meta.robots).toEqual({ index: true, follow: true });
      expect((meta.openGraph as any)?.title).toBe('WebP vs AVIF Head to Head');
      expect((meta.openGraph as any)?.type).toBe('article');
    });

    it('generates valid Schema.org Article and Breadcrumb JSON-LD', async () => {
      const post = await createBlogDraft(
        {
          title: 'How to Batch Compress Images',
          slug: 'how-to-batch-compress-images',
          content: 'Step by step instructions for batch image processing.',
          featuredImage: 'https://example.com/batch.png',
        },
        author
      );

      await publishBlogPost(post.id, author);

      const jsonLd = await getBlogPostJsonLd('how-to-batch-compress-images');
      expect(jsonLd).not.toBeNull();
      expect(jsonLd?.articleSchema['@type']).toBe('Article');
      expect(jsonLd?.articleSchema.headline).toBe('How to Batch Compress Images');
      expect(jsonLd?.articleSchema.image).toContain('https://example.com/batch.png');
      expect(jsonLd?.breadcrumbSchema['@type']).toBe('BreadcrumbList');
      expect(jsonLd?.breadcrumbSchema.itemListElement.length).toBe(3);
    });
  });
});
