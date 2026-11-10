import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMergedTool,
  getToolContentBySlug,
  getAllToolContents,
  upsertToolContent,
  publishTool,
  unpublishTool,
  getToolRevisions,
  getToolRevisionById,
  restoreToolRevision,
} from '@/lib/admin/services/tool.service';
import { getPublishedTool, getPreviewTool, buildToolMetadata } from '@/lib/cms/tool-resolver';
import { getAllTools, getToolBySlug } from '@/lib/tools';
import { validateToolPayload } from '@/lib/admin/validation';
import { resetMemoryDb, getDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';

describe('Admin CMS Phase 03 — Tools CMS Unit & Integration Tests', () => {
  const superAdmin: AdminUserSession = {
    id: 'super-admin-01',
    email: 'admin@filetools.local',
    name: 'Super Administrator',
    role: 'SUPER_ADMIN',
  };

  const editor: AdminUserSession = {
    id: 'editor-01',
    email: 'editor@filetools.local',
    name: 'Content Editor',
    role: 'EDITOR',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Exact 25-Tool Registry & Identity Boundaries', () => {
    it('recognizes exactly all 25 canonical tools and no extra or missing tools', () => {
      const canonicalTools = getAllTools();
      expect(canonicalTools.length).toBe(25);

      const requiredSlugs = [
        'jpg-to-png', 'png-to-jpg', 'jpg-to-webp', 'webp-to-jpg', 'png-to-webp',
        'webp-to-png', 'heic-to-jpg', 'svg-to-png', 'gif-to-png', 'bmp-to-png',
        'compress-image', 'resize-image', 'crop-image', 'rotate-image',
        'image-to-pdf', 'jpg-to-pdf', 'png-to-pdf', 'pdf-to-jpg', 'pdf-to-png',
        'merge-pdf', 'split-pdf', 'compress-pdf', 'rotate-pdf', 'delete-pdf-pages',
        'reorder-pdf-pages',
      ];

      expect(canonicalTools.map((t) => t.slug)).toEqual(requiredSlugs);

      for (const slug of requiredSlugs) {
        expect(getToolBySlug(slug)).toBeDefined();
      }
    });

    it('rejects CMS modifications for non-canonical slugs', async () => {
      await expect(
        upsertToolContent('flip-image', { customH1: 'Fake Tool' }, editor)
      ).rejects.toThrow(/not found in canonical tool registry/i);

      await expect(
        upsertToolContent('color-palette-extractor', { customH1: 'Another Fake' }, editor)
      ).rejects.toThrow(/not found in canonical tool registry/i);
    });

    it('returns null when querying public resolver for unknown slugs', async () => {
      const tool = await getPublishedTool('non-existent-tool');
      expect(tool).toBeNull();
    });
  });

  describe('2. Public Content Resolver & Fallback Safety', () => {
    it('returns canonical code defaults when no CMS record exists', async () => {
      const canonical = getToolBySlug('png-to-webp')!;
      const resolved = await getPublishedTool('png-to-webp');

      expect(resolved).not.toBeNull();
      expect(resolved?.h1).toBe(canonical.h1);
      expect(resolved?.intro).toBe(canonical.intro);
      expect(resolved?.howTo).toEqual(canonical.howTo);
      expect(resolved?.features).toEqual(canonical.features);
      expect(resolved?.faq).toEqual(canonical.faq);
    });

    it('strictly isolates draft CMS records from public visitors', async () => {
      const canonical = getToolBySlug('png-to-webp')!;

      // Save as DRAFT (isPublished: false)
      await upsertToolContent(
        'png-to-webp',
        {
          customH1: 'Super Secret Draft Heading',
          customIntro: 'Draft intro not yet approved for public viewing.',
          isPublished: false,
        },
        editor
      );

      // Public resolver must still return canonical content!
      const publicTool = await getPublishedTool('png-to-webp');
      expect(publicTool?.h1).toBe(canonical.h1);
      expect(publicTool?.intro).toBe(canonical.intro);
      expect(publicTool?.h1).not.toBe('Super Secret Draft Heading');

      // Admin preview mode MUST display draft content
      const previewTool = await getPreviewTool('png-to-webp');
      expect(previewTool?.h1).toBe('Super Secret Draft Heading');
      expect(previewTool?.intro).toBe('Draft intro not yet approved for public viewing.');
    });

    it('displays published CMS overrides on public routes after publishing', async () => {
      const canonical = getToolBySlug('webp-to-jpg')!;

      // Save draft
      await upsertToolContent(
        'webp-to-jpg',
        {
          customH1: 'Instant High-Quality WebP to JPG Converter',
          customDescription: 'Fast, secure in-browser conversion.',
        },
        editor
      );

      // Publish tool
      await publishTool('webp-to-jpg', superAdmin);

      // Public resolver now serves CMS content
      const publicTool = await getPublishedTool('webp-to-jpg');
      expect(publicTool?.h1).toBe('Instant High-Quality WebP to JPG Converter');
      expect(publicTool?.description).toBe('Fast, secure in-browser conversion.');
      // Untouched properties remain canonical
      expect(publicTool?.intro).toBe(canonical.intro);
    });

    it('immediately reverts public visitors to canonical defaults when unpublished', async () => {
      const canonical = getToolBySlug('jpg-to-png')!;

      await upsertToolContent(
        'jpg-to-png',
        {
          customH1: 'Temporary Custom H1',
          isPublished: true,
        },
        editor
      );

      // Verify published
      let tool = await getPublishedTool('jpg-to-png');
      expect(tool?.h1).toBe('Temporary Custom H1');

      // Unpublish
      await unpublishTool('jpg-to-png', superAdmin);

      // Public visitor receives canonical code default
      tool = await getPublishedTool('jpg-to-png');
      expect(tool?.h1).toBe(canonical.h1);
      expect(tool?.h1).not.toBe('Temporary Custom H1');
    });
  });

  describe('3. Partial Override Precedence', () => {
    it('merges partial CMS overrides without dropping canonical sections', async () => {
      const canonical = getToolBySlug('merge-pdf')!;

      // Case A: Only override H1
      await upsertToolContent(
        'merge-pdf',
        {
          customH1: 'Combine Multiple PDF Files Easily',
          isPublished: true,
        },
        editor
      );

      let merged = await getMergedTool('merge-pdf');
      expect(merged?.h1).toBe('Combine Multiple PDF Files Easily');
      expect(merged?.intro).toBe(canonical.intro);
      expect(merged?.howTo).toEqual(canonical.howTo);
      expect(merged?.features).toEqual(canonical.features);
      expect(merged?.faq).toEqual(canonical.faq);
      expect(merged?.relatedTools).toEqual(canonical.relatedTools);

      // Case B: Override H1 + FAQ
      const customFaq = [
        { question: 'What is the limit?', answer: 'Up to 20 PDF documents.' },
        { question: 'Are files uploaded?', answer: 'Never. Processing is 100% local.' },
      ];

      await upsertToolContent(
        'merge-pdf',
        {
          customH1: 'Combine Multiple PDF Files Easily v2',
          customFaq,
          isPublished: true,
        },
        editor
      );

      merged = await getMergedTool('merge-pdf');
      expect(merged?.h1).toBe('Combine Multiple PDF Files Easily v2');
      expect(merged?.faq).toEqual(customFaq);
      expect(merged?.howTo).toEqual(canonical.howTo);
      expect(merged?.features).toEqual(canonical.features);
      expect(merged?.relatedTools).toEqual(canonical.relatedTools);
    });
  });

  describe('4. Input Validation & Content Security', () => {
    it('validates related tools and rejects self-reference and unknown slugs', () => {
      // Valid related tools
      const valid = validateToolPayload('jpg-to-png', {
        customRelatedTools: ['png-to-jpg', 'jpg-to-webp'],
      });
      expect(valid.isValid).toBe(true);

      // Self-reference rejected
      const selfRef = validateToolPayload('jpg-to-png', {
        customRelatedTools: ['jpg-to-png', 'png-to-jpg'],
      });
      expect(selfRef.isValid).toBe(false);
      expect(selfRef.report.errors.some((e) => e.message.includes('reference itself'))).toBe(true);

      // Unknown slug rejected
      const unknownSlug = validateToolPayload('jpg-to-png', {
        customRelatedTools: ['flip-image-pro', 'png-to-jpg'],
      });
      expect(unknownSlug.isValid).toBe(false);
      expect(unknownSlug.report.errors.some((e) => e.message.includes('not one of the 25 canonical tools'))).toBe(true);
    });

    it('validates how-to and FAQ structure', () => {
      const invalidHowTo = validateToolPayload('compress-image', {
        customHowTo: [{ title: '', description: 'Missing title' }],
      });
      expect(invalidHowTo.isValid).toBe(false);

      const invalidFaq = validateToolPayload('compress-image', {
        customFaq: [{ question: 'Missing answer?', answer: '' }],
      });
      expect(invalidFaq.isValid).toBe(false);
    });

    it('validates JSON-LD to prevent XSS script injection', () => {
      const maliciousJson = validateToolPayload('rotate-image', {
        seo: {
          schemaJson: '<script>alert("xss")</script>' as any,
        },
      });
      expect(maliciousJson.isValid).toBe(false);

      const validJson = validateToolPayload('rotate-image', {
        seo: {
          schemaJson: { '@context': 'https://schema.org', '@type': 'SoftwareApplication' },
        },
      });
      expect(validJson.isValid).toBe(true);
    });
  });

  describe('5. SEO Metadata Integration', () => {
    it('correctly merges SEO title, meta description, robots and canonical tags', async () => {
      await upsertToolContent(
        'split-pdf',
        {
          seo: {
            seoTitle: 'Split PDF Pages Online Free – Advanced PDF Cutter',
            metaDescription: 'Extract pages from your PDF documents with custom ranges.',
            canonicalUrl: 'https://example.com/tools/split-pdf',
            robotsIndex: false,
            robotsFollow: true,
            ogTitle: 'Social OG Split PDF',
          },
          isPublished: true,
        },
        editor
      );

      const defaultMeta = {
        title: 'Default Split PDF Title',
        description: 'Default Split PDF Description',
      };

      const builtMeta = await buildToolMetadata('split-pdf', defaultMeta);
      expect(builtMeta.title).toBe('Split PDF Pages Online Free – Advanced PDF Cutter');
      expect(builtMeta.description).toBe('Extract pages from your PDF documents with custom ranges.');
      expect(builtMeta.alternates?.canonical).toBe('https://example.com/tools/split-pdf');
      expect(builtMeta.robots).toEqual({ index: false, follow: true });
      expect((builtMeta.openGraph as any)?.title).toBe('Social OG Split PDF');
    });
  });

  describe('6. Revisions History & Immutability', () => {
    it('creates immutable revisions on edits and successfully restores previous states', async () => {
      // 1. Initial save
      await upsertToolContent(
        'compress-pdf',
        { customH1: 'Version 1 Heading', reason: 'Created Version 1' },
        editor
      );

      // 2. Second save
      await upsertToolContent(
        'compress-pdf',
        { customH1: 'Version 2 Heading', reason: 'Created Version 2' },
        editor
      );

      // 3. Inspect revisions
      const revs = await getToolRevisions('compress-pdf');
      expect(revs.length).toBeGreaterThanOrEqual(2);
      expect(revs[0].reason).toBe('Created Version 2');
      expect(revs[1].reason).toBe('Created Version 1');

      // 4. Restore Version 1
      const v1RevId = revs[1].id;
      const restored = await restoreToolRevision('compress-pdf', v1RevId, superAdmin);

      expect(restored?.override?.customH1).toBe('Version 1 Heading');

      // 5. Verify a new revision was recorded documenting the restore
      const revsAfterRestore = await getToolRevisions('compress-pdf');
      expect(revsAfterRestore.length).toBe(revs.length + 1);
      expect(revsAfterRestore[0].reason).toContain(`Restored from revision ${v1RevId}`);

      // 6. Verify historical revision remained unchanged
      const historicalV1 = await getToolRevisionById('compress-pdf', v1RevId);
      expect(historicalV1?.id).toBe(v1RevId);
      expect((historicalV1?.contentSnapshot as any)?.customH1).toBe('Version 1 Heading');
    });
  });

  describe('7. Tools Directory Listing Service', () => {
    it('returns all 25 tools with categories, formats, and CMS statuses', async () => {
      const list = await getAllToolContents();
      expect(list.length).toBe(25);

      const jpgToPng = list.find((t) => t.slug === 'jpg-to-png')!;
      expect(jpgToPng).toBeDefined();
      expect(jpgToPng.inputFormats).toEqual(['jpg', 'jpeg']);
      expect(jpgToPng.outputFormats).toEqual(['png']);
      expect(jpgToPng.category).toBe('image-converter');
    });
  });
});
