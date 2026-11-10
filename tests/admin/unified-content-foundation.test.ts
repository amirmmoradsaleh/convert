import { describe, it, expect, beforeEach } from 'vitest';
import {
  BLOCK_REGISTRY,
  getBlockDefinition,
  createDefaultBlock,
  buildCanonicalUrl,
  resolveUnifiedSeo,
  safeSerializeJsonLd,
  resolveUnifiedContent,
  PageType,
  UnifiedSeoData,
} from '@/lib/cms/unified-content';
import { resetMemoryDb, memoryDb } from '@/lib/db';
import { siteConfig } from '@/lib/seo';
import { getAllTools, getToolBySlug } from '@/lib/tools';
import { getAllFormats, getFormatBySlug } from '@/lib/formats';

describe('Phase 2 — Unified Content Architecture & SEO Foundation', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Universal Block Registry & Instantiation', () => {
    it('defines valid block registry metadata for all core block types', () => {
      const expectedTypes = [
        'hero',
        'section',
        'heading',
        'paragraph',
        'rich_text',
        'image',
        'link',
        'cta',
        'feature',
        'features',
        'how_to_use',
        'how_to',
        'related_tools',
        'benefits_trust',
        'intro',
        'faq',
        'tool_ref',
        'privacy_note',
        'use_cases',
        'spacer',
      ];

      for (const type of expectedTypes) {
        const def = getBlockDefinition(type as any);
        expect(def).toBeDefined();
        expect(def.type).toBe(type);
        expect(typeof def.label).toBe('string');
        expect(typeof def.description).toBe('string');
        expect(['layout', 'typography', 'media', 'conversion', 'seo']).toContain(def.category);
        expect(def.defaultContent).toBeDefined();
      }
    });

    it('creates default normalized UniversalContentBlock with unique IDs and deterministic order', () => {
      const heroBlock = createDefaultBlock('hero', 0);
      expect(heroBlock.id.startsWith('blk-')).toBe(true);
      expect(heroBlock.type).toBe('hero');
      expect(heroBlock.enabled).toBe(true);
      expect(heroBlock.order).toBe(0);
      expect(heroBlock.content.title).toBeDefined();

      const ctaBlock = createDefaultBlock('cta', 1);
      expect(ctaBlock.order).toBe(1);
      expect(ctaBlock.content.label).toBe('Get Started Now');
      expect(ctaBlock.content.variant).toBe('primary');
      // Root-level compatibility projection
      expect(ctaBlock.label).toBe('Get Started Now');
    });
  });

  describe('2. Canonical URL Resolution & Safety', () => {
    it('generates correct absolute canonical URLs from paths', () => {
      expect(buildCanonicalUrl('/')).toBe(siteConfig.url);
      expect(buildCanonicalUrl('/tools/jpg-to-png')).toBe(`${siteConfig.url}/tools/jpg-to-png`);
      expect(buildCanonicalUrl('about')).toBe(`${siteConfig.url}/about`);
    });

    it('honors valid absolute canonical URLs', () => {
      const customUrl = 'https://convert24.com/custom-canonical';
      expect(buildCanonicalUrl(customUrl)).toBe(customUrl);
    });

    it('sanitizes and blocks unsafe canonical URLs, falling back to safe path', () => {
      const unsafe = 'javascript:alert(1)';
      const safe = buildCanonicalUrl(unsafe, '/fallback-path');
      expect(safe).toBe(`${siteConfig.url}/fallback-path`);
      expect(safe).not.toContain('javascript:');
    });
  });

  describe('3. 3-Tier SEO Resolution Pipeline', () => {
    it('Tier 1: Page-specific override takes precedence over type and site defaults', () => {
      const pageSeo: UnifiedSeoData = {
        seoTitle: 'Custom Tool SEO Title',
        metaDescription: 'Custom Tool SEO Meta Description that is sufficiently descriptive.',
        canonicalUrl: 'https://convert24.com/custom-tool-url',
        robotsIndex: false,
        robotsFollow: true,
        ogTitle: 'Custom OG Title',
        ogImage: 'https://convert24.com/custom-og.jpg',
      };

      const typeDefaults = {
        title: 'Canonical Tool Title',
        description: 'Canonical Tool Description',
        canonicalPath: '/tools/jpg-to-png',
      };

      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'jpg-to-png',
        pageSeo,
        typeDefaults,
      });

      expect(resolved.title).toBe('Custom Tool SEO Title');
      expect(resolved.description).toBe('Custom Tool SEO Meta Description that is sufficiently descriptive.');
      expect((resolved.alternates as any)?.canonical).toBe('https://convert24.com/custom-tool-url');
      expect((resolved.robots as any)?.index).toBe(false);
      expect((resolved.robots as any)?.follow).toBe(true);
      expect(resolved.openGraph?.title).toBe('Custom OG Title');
      expect((resolved.openGraph?.images as any)?.[0]?.url).toBe('https://convert24.com/custom-og.jpg');
    });

    it('Tier 2: Type-specific canonical defaults take precedence when page override is absent', () => {
      const typeDefaults = {
        title: 'PNG to JPG Converter – Free Online Tool',
        description: 'Convert PNG images to JPG with adjustable quality and instant local processing.',
        canonicalPath: '/tools/png-to-jpg',
        ogImage: '/images/tools/png-to-jpg.png',
      };

      const resolved = resolveUnifiedSeo({
        pageType: 'tool',
        slug: 'png-to-jpg',
        pageSeo: null,
        typeDefaults,
      });

      expect(resolved.title).toBe('PNG to JPG Converter – Free Online Tool');
      expect(resolved.description).toBe('Convert PNG images to JPG with adjustable quality and instant local processing.');
      expect((resolved.alternates as any)?.canonical).toBe(`${siteConfig.url}/tools/png-to-jpg`);
      expect((resolved.robots as any)?.index).toBe(true);
      expect((resolved.robots as any)?.follow).toBe(true);
      expect((resolved.openGraph?.images as any)?.[0]?.url).toBe('/images/tools/png-to-jpg.png');
    });

    it('Tier 3: Falls back safely to site-wide defaults when page and type are empty', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'custom',
        slug: 'unknown-page',
        pageSeo: null,
      });

      expect(resolved.title).toBeDefined();
      expect(resolved.description).toBe(siteConfig.description);
      expect((resolved.alternates as any)?.canonical).toBe(`${siteConfig.url}/unknown-page`);
      expect((resolved.robots as any)?.index).toBe(true);
    });

    it('supports article OpenGraph type for blog posts', () => {
      const resolved = resolveUnifiedSeo({
        pageType: 'blog',
        slug: 'how-to-compress-pdf',
        pageSeo: {
          ogType: 'article',
          seoTitle: 'How to Compress PDF Without Losing Quality',
        },
      });

      expect((resolved.openGraph as any)?.type).toBe('article');
    });
  });

  describe('4. Safe JSON-LD Serialization', () => {
    it('serializes structured schema object safely', () => {
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'JPG to PNG Converter',
        applicationCategory: 'MultimediaApplication',
      };

      const serialized = safeSerializeJsonLd(schema);
      expect(serialized).not.toBeNull();
      expect(serialized).toContain('"@type":"WebApplication"');
    });

    it('strictly sanitizes and prevents script tag injection in JSON-LD', () => {
      const maliciousSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '</script><script>alert("xss")</script>',
      };

      const serialized = safeSerializeJsonLd(maliciousSchema);
      expect(serialized).not.toContain('<script');
      expect(serialized).not.toContain('</script>');
    });

    it('returns null gracefully on null or undefined schema', () => {
      expect(safeSerializeJsonLd(null)).toBeNull();
      expect(safeSerializeJsonLd(undefined)).toBeNull();
    });
  });

  describe('5. Unified Content Resolver & Non-Destructive Fallbacks', () => {
    it('resolves canonical tool safely when database has no override', async () => {
      const resolved = await resolveUnifiedContent({
        pageType: 'tool',
        slug: 'jpg-to-png',
        preview: false,
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.pageType).toBe('tool');
      expect(resolved?.slug).toBe('jpg-to-png');
      expect(resolved?.status).toBe('PUBLISHED');
      expect(resolved?.isOverridden).toBe(false);
      expect(resolved?.name).toBe('JPG to PNG');
    });

    it('isolates draft tool overrides: public visitors get canonical tool, preview visitors get draft', async () => {
      // Create a draft override in DB
      await memoryDb.toolContent.upsert({
        where: { toolSlug: 'merge-pdf' },
        create: {
          toolSlug: 'merge-pdf',
          customTitle: 'Draft Merge PDF Title (Unpublished)',
          isPublished: false,
          blocks: [
            {
              id: 'blk-draft-1',
              type: 'heading',
              text: 'Draft Heading in Progress',
            },
          ],
        },
        update: {},
      });

      // Public visitor (preview: false) MUST NOT receive draft content
      const publicResolved = await resolveUnifiedContent({
        pageType: 'tool',
        slug: 'merge-pdf',
        preview: false,
      });

      expect(publicResolved).not.toBeNull();
      expect(publicResolved?.isOverridden).toBe(false);
      expect(publicResolved?.name).not.toBe('Draft Merge PDF Title (Unpublished)');

      // Admin preview visitor (preview: true) DOES receive draft content
      const previewResolved = await resolveUnifiedContent({
        pageType: 'tool',
        slug: 'merge-pdf',
        preview: true,
      });

      expect(previewResolved).not.toBeNull();
      expect(previewResolved?.isOverridden).toBe(true);
      expect(previewResolved?.status).toBe('DRAFT');
      expect(previewResolved?.name).toBe('Draft Merge PDF Title (Unpublished)');
      expect(previewResolved?.blocks.length).toBe(1);
    });

    it('resolves format page falling back to canonical format registry', async () => {
      const resolved = await resolveUnifiedContent({
        pageType: 'format',
        slug: 'webp',
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.pageType).toBe('format');
      expect(resolved?.name).toBe('WEBP Image Format – Modern High-Efficiency Web Graphics');
      expect(resolved?.isOverridden).toBe(false);
    });

    it('resolves static pages (home, about, privacy, etc.) with safe fallbacks', async () => {
      const home = await resolveUnifiedContent({ pageType: 'home', slug: 'home' });
      expect(home).not.toBeNull();
      expect(home?.name).toBe('Home Page');

      const about = await resolveUnifiedContent({ pageType: 'static', slug: 'about' });
      expect(about).not.toBeNull();
      expect(about?.name).toBe('About Us');
    });

    it('resolves blog post falling back to static articles if not in DB', async () => {
      const resolved = await resolveUnifiedContent({
        pageType: 'blog',
        slug: 'understanding-image-compression-lossy-vs-lossless',
      });

      expect(resolved).not.toBeNull();
      expect(resolved?.pageType).toBe('blog');
      expect(resolved?.name).toBe('Understanding Image Compression: Lossy vs Lossless Explained');
      expect(resolved?.isOverridden).toBe(false);
    });

    it('returns null for nonexistent tools or format pages', async () => {
      const unknownTool = await resolveUnifiedContent({
        pageType: 'tool',
        slug: 'nonexistent-tool-slug',
      });
      expect(unknownTool).toBeNull();

      const unknownFormat = await resolveUnifiedContent({
        pageType: 'format',
        slug: 'nonexistent-format-slug',
      });
      expect(unknownFormat).toBeNull();
    });
  });

  describe('6. Protected Boundaries Verification', () => {
    it('verifies all 25 canonical tools are intact and resolvable', () => {
      const allTools = getAllTools();
      expect(allTools.length).toBe(25);

      const requiredSlugs = [
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

      for (const slug of requiredSlugs) {
        const tool = getToolBySlug(slug);
        expect(tool).toBeDefined();
        expect(tool?.slug).toBe(slug);
      }
    });

    it('verifies all canonical formats are intact and resolvable', () => {
      const allFormats = getAllFormats();
      expect(allFormats.length).toBeGreaterThanOrEqual(5);

      for (const fmt of allFormats) {
        expect(getFormatBySlug(fmt.slug)).toBeDefined();
      }
    });
  });
});
