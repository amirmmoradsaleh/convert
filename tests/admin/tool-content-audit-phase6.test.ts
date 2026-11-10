import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getAllTools, getToolBySlug } from '@/lib/tools';
import {
  generateCanonicalToolContract,
  normalizeToolContractBlocks,
} from '@/lib/cms/tool-contract';
import { validateToolPayload } from '@/lib/admin/validation';
import { resolveUnifiedSeo } from '@/lib/cms/unified-content';
import { siteConfig } from '@/lib/seo';
import { resetMemoryDb } from '@/lib/db';

describe('Admin CMS Phase 06 — 25-Tool Content Audit & Quality Test Suite', () => {
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
  ] as const;

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Canonical 25-Tool Registry Audit', () => {
    it('contains exactly 25 tools in strict canonical order', () => {
      const tools = getAllTools();
      expect(tools.length).toBe(25);
      expect(tools.map((t) => t.slug)).toEqual(CANONICAL_25_SLUGS);
    });

    it('verifies that every tool has non-empty required content sections', () => {
      const tools = getAllTools();
      for (const tool of tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.title).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.h1).toBeTruthy();
        expect(tool.intro).toBeTruthy();

        // How to steps
        expect(Array.isArray(tool.howTo)).toBe(true);
        expect(tool.howTo.length).toBeGreaterThanOrEqual(3);
        for (const step of tool.howTo) {
          expect(step.title).toBeTruthy();
          expect(step.description).toBeTruthy();
        }

        // Features
        if (tool.features) {
          expect(tool.features.length).toBeGreaterThanOrEqual(3);
          for (const feat of tool.features) {
            expect(feat.title).toBeTruthy();
            expect(feat.description).toBeTruthy();
          }
        }

        // FAQ items
        expect(Array.isArray(tool.faq)).toBe(true);
        expect(tool.faq.length).toBeGreaterThanOrEqual(1);
        for (const q of tool.faq) {
          expect(q.question).toBeTruthy();
          expect(q.answer).toBeTruthy();
        }

        // Input & Output Formats
        expect(tool.inputFormats.length).toBeGreaterThan(0);
        expect(tool.outputFormats.length).toBeGreaterThan(0);
      }
    });

    it('verifies that all relatedTools slugs resolve to valid canonical tools without self-references', () => {
      const tools = getAllTools();
      const allSlugs = new Set(CANONICAL_25_SLUGS);

      for (const tool of tools) {
        const related = tool.relatedTools || [];
        for (const relSlug of related) {
          expect(allSlugs.has(relSlug as any)).toBe(true);
          expect(relSlug).not.toBe(tool.slug);
        }
      }
    });
  });

  describe('2. Batch A Content Audit (Tools 1–5)', () => {
    const BATCH_A = ['jpg-to-png', 'png-to-jpg', 'jpg-to-webp', 'webp-to-jpg', 'png-to-webp'] as const;

    it('validates Batch A tools against the unified content contract', () => {
      for (const slug of BATCH_A) {
        const tool = getToolBySlug(slug)!;
        expect(tool).toBeDefined();

        const blocks = generateCanonicalToolContract(tool);
        expect(blocks.length).toBeGreaterThanOrEqual(8);

        const payloadValidation = validateToolPayload(slug, { blocks });
        expect(payloadValidation.isValid).toBe(true);
      }
    });

    it('verifies Batch A SEO resolution and canonical URL consistency', () => {
      for (const slug of BATCH_A) {
        const tool = getToolBySlug(slug)!;
        const seo = resolveUnifiedSeo({
          pageType: 'tool',
          slug,
          typeDefaults: {
            title: tool.title,
            description: tool.description,
          },
        });

        expect(seo.title).toBe(tool.title);
        expect(seo.description).toBe(tool.description);
        expect((seo.alternates as any)?.canonical).toBe(`${siteConfig.url}/tools/${slug}`);
      }
    });
  });

  describe('3. Batch B Content Audit (Tools 6–10)', () => {
    const BATCH_B = ['webp-to-png', 'heic-to-jpg', 'svg-to-png', 'gif-to-png', 'bmp-to-png'] as const;

    it('validates Batch B tools against the unified content contract', () => {
      for (const slug of BATCH_B) {
        const tool = getToolBySlug(slug)!;
        expect(tool).toBeDefined();

        const blocks = generateCanonicalToolContract(tool);
        expect(blocks.length).toBeGreaterThanOrEqual(8);

        const payloadValidation = validateToolPayload(slug, { blocks });
        expect(payloadValidation.isValid).toBe(true);
      }
    });

    it('verifies Batch B local client-side processing specifications', () => {
      for (const slug of BATCH_B) {
        const tool = getToolBySlug(slug)!;
        expect(tool.clientSide).toBe(true);

        const blocks = generateCanonicalToolContract(tool);
        const techBlock = blocks.find((b) => b.type === 'technical_details');
        expect(techBlock).toBeDefined();
        const environmentSpec = techBlock?.content?.specs?.find((s: any) => s.label === 'Processing Environment');
        expect(environmentSpec?.value).toContain('Client-Side');
      }
    });
  });

  describe('4. Batch C Content Audit (Tools 11–17)', () => {
    const BATCH_C = [
      'compress-image',
      'resize-image',
      'crop-image',
      'rotate-image',
      'image-to-pdf',
      'jpg-to-pdf',
      'png-to-pdf',
    ] as const;

    it('validates Batch C tools against the unified content contract', () => {
      for (const slug of BATCH_C) {
        const tool = getToolBySlug(slug)!;
        expect(tool).toBeDefined();

        const blocks = generateCanonicalToolContract(tool);
        expect(blocks.length).toBeGreaterThanOrEqual(8);

        const payloadValidation = validateToolPayload(slug, { blocks });
        expect(payloadValidation.isValid).toBe(true);
      }
    });
  });

  describe('5. Batch D Content Audit (Tools 18–25)', () => {
    const BATCH_D = [
      'pdf-to-jpg',
      'pdf-to-png',
      'merge-pdf',
      'split-pdf',
      'compress-pdf',
      'rotate-pdf',
      'delete-pdf-pages',
      'reorder-pdf-pages',
    ] as const;

    it('validates Batch D tools against the unified content contract', () => {
      for (const slug of BATCH_D) {
        const tool = getToolBySlug(slug)!;
        expect(tool).toBeDefined();

        const blocks = generateCanonicalToolContract(tool);
        expect(blocks.length).toBeGreaterThanOrEqual(8);

        const payloadValidation = validateToolPayload(slug, { blocks });
        expect(payloadValidation.isValid).toBe(true);
      }
    });
  });

  describe('6. Semantic Heading Hierarchy & Protection Rules', () => {
    it('guarantees exactly one primary H1 header per tool page and downgrades competing H1s', () => {
      for (const slug of CANONICAL_25_SLUGS) {
        const tool = getToolBySlug(slug)!;
        const blocks = generateCanonicalToolContract(tool);

        // Only Hero block has title matching canonical h1
        const heroBlock = blocks.find((b) => b.type === 'hero');
        expect(heroBlock?.content?.title).toBe(tool.h1);

        // All other section headers are H2 or H3
        const competingH1 = {
          id: 'competing-h1',
          type: 'heading',
          order: 15,
          content: { level: 1, text: 'Malicious Competing H1' },
        };

        const normalized = normalizeToolContractBlocks([...blocks, competingH1 as any], tool);
        const heading = normalized.find((b) => b.id === 'competing-h1');
        expect(heading?.content?.level).toBe(2);
      }
    });
  });
});
