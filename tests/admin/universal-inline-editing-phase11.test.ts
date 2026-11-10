import { describe, it, expect } from 'vitest';
import {
  getCanonicalHomepageBlocks,
} from '@/lib/cms/homepage-contract';
import {
  duplicateBlock,
  UniversalContentBlock,
} from '@/lib/cms/blocks';
import { BLOCK_REGISTRY } from '@/lib/cms/unified-content';
import { validateAndSanitizeBlock, sanitizeCustomCss } from '@/lib/admin/validation';

describe('Phase 11 — Universal Inline Visual Editing System', () => {
  describe('1. Canonical Homepage Contract & Full Section Editability', () => {
    it('returns all 6 canonical blocks when initialized with empty or null blocks', () => {
      const blocks = getCanonicalHomepageBlocks([], 'Convert24 - In-Browser File Tools');
      expect(blocks).toHaveLength(6);

      const types = blocks.map((b) => b.type);
      expect(types).toEqual([
        'hero',
        'popular_tools',
        'hubs',
        'features',
        'pricing',
        'faq',
      ]);

      // Check hero block has custom title
      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero).toBeDefined();
      expect(hero?.content?.title).toBe('Convert24 - In-Browser File Tools');
      expect(hero?.content?.badge).toBeDefined();
      expect(hero?.content?.searchPrompt).toBeDefined();
      expect(hero?.content?.quickLinks).toBeInstanceOf(Array);
      expect(hero?.content?.quickLinks.length).toBeGreaterThan(0);
    });

    it('merges existing custom content while preserving canonical section presence', () => {
      const existingHero: UniversalContentBlock = {
        id: 'hero-custom-1',
        type: 'hero',
        order: 0,
        enabled: true,
        content: {
          title: 'Custom Hero Title',
          description: 'Custom Description',
          badge: 'Super Secure',
        },
      };

      const customFeature: UniversalContentBlock = {
        id: 'custom-extra-block',
        type: 'feature',
        order: 99,
        enabled: true,
        content: {
          title: 'Extra Custom Feature',
        },
      };

      const blocks = getCanonicalHomepageBlocks([existingHero, customFeature]);
      // Contains the 6 canonical sections (hero + 5 missing defaults) + 1 custom block = 7 blocks
      expect(blocks.length).toBe(7);

      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero?.id).toBe('hero-custom-1');
      expect(hero?.content?.title).toBe('Custom Hero Title');

      const extra = blocks.find((b) => b.id === 'custom-extra-block');
      expect(extra).toBeDefined();
      expect(extra?.content?.title).toBe('Extra Custom Feature');

      // Check remaining canonical sections were backfilled
      expect(blocks.some((b) => b.type === 'popular_tools')).toBe(true);
      expect(blocks.some((b) => b.type === 'hubs')).toBe(true);
      expect(blocks.some((b) => b.type === 'features')).toBe(true);
      expect(blocks.some((b) => b.type === 'pricing')).toBe(true);
      expect(blocks.some((b) => b.type === 'faq')).toBe(true);
    });

    it('populates popular_tools, hubs, features, pricing, and faq canonical blocks with complete content structures', () => {
      const blocks = getCanonicalHomepageBlocks([]);
      const popular = blocks.find((b) => b.type === 'popular_tools');
      expect(popular?.content?.heading).toBe('Popular tools');
      expect(popular?.content?.exploreHref).toBe('#explore-hubs');

      const hubs = blocks.find((b) => b.type === 'hubs');
      expect(hubs?.content?.heading).toBe('Explore all tools');
      expect(hubs?.content?.imageHubHref).toBe('/image-tools');
      expect(hubs?.content?.pdfHubHref).toBe('/pdf-tools');

      const features = blocks.find((b) => b.type === 'features');
      expect(features?.content?.heading).toBe('Why Use Convert24');
      expect(features?.content?.items).toBeInstanceOf(Array);
      expect(features?.content?.items.length).toBe(4);

      const pricing = blocks.find((b) => b.type === 'pricing');
      expect(pricing?.content?.badge).toBe('Pricing Plans');
      expect(pricing?.content?.price).toBe('$0');
      expect(pricing?.content?.items).toBeInstanceOf(Array);

      const faq = blocks.find((b) => b.type === 'faq');
      expect(faq?.content?.heading).toBe('Frequently Asked Questions');
      expect(faq?.content?.items).toBeInstanceOf(Array);
      expect(faq?.content?.items.length).toBeGreaterThan(0);
    });
  });

  describe('2. Universal Block Registry & Validation', () => {
    it('registers and provides definitions for all universal block types including Phase 11 additions', () => {
      expect(BLOCK_REGISTRY.popular_tools).toBeDefined();
      expect(BLOCK_REGISTRY.popular_tools.category).toBe('conversion');

      expect(BLOCK_REGISTRY.hubs).toBeDefined();
      expect(BLOCK_REGISTRY.hubs.category).toBe('layout');

      expect(BLOCK_REGISTRY.pricing).toBeDefined();
      expect(BLOCK_REGISTRY.pricing.category).toBe('conversion');

      expect(BLOCK_REGISTRY.hero).toBeDefined();
      expect(BLOCK_REGISTRY.features).toBeDefined();
      expect(BLOCK_REGISTRY.feature).toBeDefined();
      expect(BLOCK_REGISTRY.faq).toBeDefined();
      expect(BLOCK_REGISTRY.image).toBeDefined();
      expect(BLOCK_REGISTRY.rich_text).toBeDefined();
      expect(BLOCK_REGISTRY.cta).toBeDefined();
      expect(BLOCK_REGISTRY.link).toBeDefined();
      expect(BLOCK_REGISTRY.benefits_trust).toBeDefined();
      expect(BLOCK_REGISTRY.privacy_note).toBeDefined();
      expect(BLOCK_REGISTRY.how_to_use).toBeDefined();
      expect(BLOCK_REGISTRY.use_cases).toBeDefined();
      expect(BLOCK_REGISTRY.technical_details).toBeDefined();
    });

    it('validates block structures and detects unsafe URLs', () => {
      const validBlock = {
        id: 'block-123',
        type: 'heading',
        content: { text: 'Valid Heading', level: 2 },
      };
      const validResult = validateAndSanitizeBlock(validBlock);
      expect(validResult.isValid).toBe(true);

      const unsafeBlock = {
        id: 'unsafe-cta',
        type: 'cta',
        content: { href: 'javascript:alert(1)', label: 'Click Me' },
      };
      const unsafeResult = validateAndSanitizeBlock(unsafeBlock);
      expect(unsafeResult.isValid).toBe(false);
      expect(unsafeResult.error).toContain('Unsafe URL');
    });

    it('duplicates blocks with new unique IDs without mutating original block', () => {
      const original: UniversalContentBlock = {
        id: 'orig-1',
        type: 'feature',
        order: 1,
        enabled: true,
        content: { title: 'Fast Execution', description: 'Runs in browser' },
      };

      const copy = duplicateBlock(original);
      expect(copy.id).not.toBe(original.id);
      expect(copy.type).toBe(original.type);
      expect(copy.content.title).toBe(original.content.title);
      expect(copy.order).toBe(original.order);

      // Deep clone test
      copy.content.title = 'Modified Copy';
      expect(original.content.title).toBe('Fast Execution');
    });
  });

  describe('3. Custom CSS Security in Inline Editing', () => {
    it('sanitizes custom CSS during live preview rendering to prevent HTML breakout', () => {
      const benignCss = '.hero-box { background: #fafafa; border-radius: 12px; }';
      expect(sanitizeCustomCss(benignCss)).toContain('.hero-box');

      const dangerousClosingTag = '</style><script>alert("xss")</script>';
      const sanitized = sanitizeCustomCss(dangerousClosingTag);
      expect(sanitized).not.toContain('</style>');
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });
  });
});
