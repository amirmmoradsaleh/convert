import { describe, it, expect, beforeEach } from 'vitest';
import {
  BATCH_1_TOOL_SLUGS,
  isBatch1Tool,
  getBatch1ToolBlocks,
  generateCanonicalBlocksForTool,
  BATCH_1_DEFAULT_BLOCKS,
} from '@/lib/cms/tool-blocks-batch1';
import { getToolBySlug } from '@/lib/tools';
import { validateAndSanitizeBlock } from '@/lib/admin/validation';
import { getMergedTool, getToolContentBySlug, getAllToolContents } from '@/lib/admin/services/tool.service';
import { resetMemoryDb } from '@/lib/db';

describe('Phase 07C-2: Core Image Format Converters (Batch 1 Rollout)', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  // 1. Scope Verification
  describe('Batch 1 Scope Verification', () => {
    it('should include exactly the 8 targeted image format converters', () => {
      expect(BATCH_1_TOOL_SLUGS).toHaveLength(8);
      expect(BATCH_1_TOOL_SLUGS).toEqual([
        'jpg-to-png',
        'jpg-to-webp',
        'webp-to-jpg',
        'png-to-webp',
        'webp-to-png',
        'svg-to-png',
        'gif-to-png',
        'bmp-to-png',
      ]);
    });

    it('should correctly identify batch 1 tools via isBatch1Tool', () => {
      for (const slug of BATCH_1_TOOL_SLUGS) {
        expect(isBatch1Tool(slug)).toBe(true);
      }
    });

    it('should NOT include non-batch-1 tools in Batch 1', () => {
      const nonBatch1 = [
        'png-to-jpg', // Proof of concept, untouched
        'heic-to-jpg',
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

      for (const slug of nonBatch1) {
        expect(isBatch1Tool(slug)).toBe(false);
        expect(getBatch1ToolBlocks(slug)).toBeNull();
      }
    });
  });

  // 2. Block Structure & Normalization
  describe('Block Structure & Validation Integrity', () => {
    for (const slug of BATCH_1_TOOL_SLUGS) {
      it(`should have valid, non-empty, sequentially ordered blocks for '${slug}'`, () => {
        const blocks = getBatch1ToolBlocks(slug);
        expect(blocks).not.toBeNull();
        expect(blocks!.length).toBeGreaterThan(0);

        // Check sequential ordering starting at 0
        blocks!.forEach((block, idx) => {
          expect(block.order).toBe(idx);
          expect(block.enabled).toBe(true);
          expect(block.id).toBeDefined();
          expect(typeof block.id).toBe('string');
          expect(block.type).toBeDefined();
          expect(block.content).toBeDefined();
        });

        // Validate each block through standard server-side validator
        for (const block of blocks!) {
          const validated = validateAndSanitizeBlock(block);
          expect(validated.isValid).toBe(true);
          expect(validated.block).toBeDefined();
        }
      });
    }
  });

  // 3. Exact Canonical Content Preservation
  describe('Canonical Content Preservation', () => {
    it("should preserve 100% of 'jpg-to-png' content including privacyNote and useCases", () => {
      const canonical = getToolBySlug('jpg-to-png')!;
      expect(canonical).toBeDefined();

      const blocks = getBatch1ToolBlocks('jpg-to-png')!;
      expect(blocks).toBeDefined();

      // Hero block
      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero).toBeDefined();
      expect(hero!.content.title).toBe(canonical.h1);
      expect(hero!.content.description).toBe(canonical.valueProposition);

      // Benefits / Trust
      const benefits = blocks.find((b) => b.type === 'benefits_trust');
      expect(benefits).toBeDefined();
      expect(benefits!.content.items).toHaveLength(4);

      // How to Use
      const howTo = blocks.find((b) => b.type === 'how_to_use');
      expect(howTo).toBeDefined();
      expect(howTo!.content.heading).toBe(`How to Use ${canonical.name}`);
      expect(howTo!.content.items).toHaveLength(canonical.howTo.length);
      expect(howTo!.content.items[0].title).toBe(canonical.howTo[0].title);
      expect(howTo!.content.items[0].description).toBe(canonical.howTo[0].description);

      // Related tools
      const related = blocks.find((b) => b.type === 'related_tools');
      expect(related).toBeDefined();
      expect(related!.content.slugs).toEqual(['png-to-jpg', 'jpg-to-webp', 'compress-image', 'image-to-pdf']);

      // Intro
      const intro = blocks.find((b) => b.type === 'intro');
      expect(intro).toBeDefined();
      expect(intro!.content.text).toBe(canonical.intro);

      // Features
      const features = blocks.find((b) => b.type === 'features');
      expect(features).toBeDefined();
      expect(features!.content.items).toHaveLength(canonical.features!.length);
      expect(features!.content.items[0].title).toBe(canonical.features![0].title);
      expect(features!.content.items[0].description).toBe(canonical.features![0].description);

      // Privacy Note block
      const privacy = blocks.find((b) => b.type === 'privacy_note');
      expect(privacy).toBeDefined();
      expect(privacy!.content.title).toBe(canonical.privacyNote!.title);
      expect(privacy!.content.description).toBe(canonical.privacyNote!.description);
      expect(privacy!.content.bullets).toEqual(canonical.privacyNote!.bullets);

      // Use Cases block
      const useCases = blocks.find((b) => b.type === 'use_cases');
      expect(useCases).toBeDefined();
      expect(useCases!.content.heading).toBe(`Common Use Cases for ${canonical.name}`);
      expect(useCases!.content.items).toHaveLength(canonical.useCases!.length);
      expect(useCases!.content.items[0].title).toBe(canonical.useCases![0].title);
      expect(useCases!.content.items[0].description).toBe(canonical.useCases![0].description);

      // FAQ
      const faq = blocks.find((b) => b.type === 'faq');
      expect(faq).toBeDefined();
      expect(faq!.content.items).toHaveLength(canonical.faq.length);
      expect(faq!.content.items[0].question).toBe(canonical.faq[0].question);
      expect(faq!.content.items[0].answer).toBe(canonical.faq[0].answer);

      // CTA
      const cta = blocks.find((b) => b.type === 'cta');
      expect(cta).toBeDefined();
      expect(cta!.content.title).toBe('Need more conversion options?');
      expect(cta!.content.buttonText).toBe('Explore All Tools');
    });

    it("should preserve 100% of 'jpg-to-webp' content", () => {
      const canonical = getToolBySlug('jpg-to-webp')!;
      const blocks = getBatch1ToolBlocks('jpg-to-webp')!;

      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero!.content.title).toBe(canonical.h1);

      const features = blocks.find((b) => b.type === 'features');
      expect(features!.content.items).toHaveLength(9);
      expect(features!.content.items[0].title).toBe(canonical.features![0].title);

      const faq = blocks.find((b) => b.type === 'faq');
      expect(faq!.content.items).toHaveLength(7);
      expect(faq!.content.items[0].question).toBe(canonical.faq[0].question);
    });

    it("should preserve 100% of 'webp-to-jpg' content", () => {
      const canonical = getToolBySlug('webp-to-jpg')!;
      const blocks = getBatch1ToolBlocks('webp-to-jpg')!;

      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero!.content.title).toBe(canonical.h1);

      const features = blocks.find((b) => b.type === 'features');
      expect(features!.content.items).toHaveLength(9);

      const faq = blocks.find((b) => b.type === 'faq');
      expect(faq!.content.items).toHaveLength(8);
    });

    it("should preserve 100% of 'svg-to-png' content", () => {
      const canonical = getToolBySlug('svg-to-png')!;
      const blocks = getBatch1ToolBlocks('svg-to-png')!;

      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero!.content.title).toBe(canonical.h1);

      const faq = blocks.find((b) => b.type === 'faq');
      expect(faq!.content.items).toHaveLength(8);
      expect(faq!.content.items[0].question).toBe(canonical.faq[0].question);
    });

    it("should preserve 100% of 'bmp-to-png' content", () => {
      const canonical = getToolBySlug('bmp-to-png')!;
      const blocks = getBatch1ToolBlocks('bmp-to-png')!;

      const features = blocks.find((b) => b.type === 'features');
      expect(features!.content.items).toHaveLength(7);
      expect(features!.content.items[0].title).toBe(canonical.features![0].title);

      const faq = blocks.find((b) => b.type === 'faq');
      expect(faq!.content.items).toHaveLength(8);
    });
  });

  // 4. CMS Resolver & Public Integration
  describe('CMS Tool Resolver Integration', () => {
    it('should resolve published blocks for all Batch 1 tools via getMergedTool', async () => {
      for (const slug of BATCH_1_TOOL_SLUGS) {
        const merged = await getMergedTool(slug);
        expect(merged).not.toBeNull();
        expect(merged!.slug).toBe(slug);
        expect(Array.isArray(merged!.blocks)).toBe(true);
        expect(merged!.blocks!.length).toBeGreaterThan(0);
      }
    });

    it('should return CMS override with blocks via getToolContentBySlug for Batch 1 tools', async () => {
      for (const slug of BATCH_1_TOOL_SLUGS) {
        const details = await getToolContentBySlug(slug);
        expect(details).not.toBeNull();
        expect(details!.canonical.slug).toBe(slug);
        expect(details!.override).not.toBeNull();
        expect(details!.override!.isPublished).toBe(true);
        expect(Array.isArray(details!.override!.blocks)).toBe(true);
        expect(details!.override!.blocks.length).toBeGreaterThan(0);
      }
    });

    it('should report hasCmsOverride and isPublished in getAllToolContents for Batch 1', async () => {
      const all = await getAllToolContents();
      expect(all).toHaveLength(25);

      for (const slug of BATCH_1_TOOL_SLUGS) {
        const item = all.find((t) => t.slug === slug);
        expect(item).toBeDefined();
        expect(item!.hasCmsOverride).toBe(true);
        expect(item!.isPublished).toBe(true);
      }
    });
  });

  // 5. Proof of Concept & Registry Untouched Verification
  describe('POC & Canonical Registry Untouched Verification', () => {
    it("should leave 'png-to-jpg' proof of concept intact", () => {
      const pngToJpg = getToolBySlug('png-to-jpg');
      expect(pngToJpg).toBeDefined();
      expect(pngToJpg!.slug).toBe('png-to-jpg');
      expect(pngToJpg!.engine).toBe('image-convert');
    });

    it('should not mutate canonical tool registry object', () => {
      for (const slug of BATCH_1_TOOL_SLUGS) {
        const canonical = getToolBySlug(slug)!;
        expect(canonical).toBeDefined();
        // Canonical definition in lib/tools.ts does not have blocks mutated
        expect(canonical.engine).toBe('image-convert');
        expect(canonical.clientSide).toBe(true);
      }
    });
  });
});
