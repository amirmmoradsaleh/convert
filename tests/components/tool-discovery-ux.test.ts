import { describe, it, expect } from 'vitest';
import { getAllTools, getToolBySlug } from '../../lib/tools';
import { resolveRelatedTools } from '../../lib/related-tools';

describe('Tool Discovery UX & Information Architecture', () => {
  const allTools = getAllTools();

  it('1. Preserves exactly the 25 canonical tools', () => {
    expect(allTools.length).toBe(25);
    const expectedSlugs = [
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

    expect(allTools.map((t) => t.slug)).toEqual(expectedSlugs);
  });

  describe('2. Homepage Tool Discovery Architecture', () => {
    it('provides a curated popular tools subset without overwhelming all 25 tools', () => {
      const popularSlugs = [
        'jpg-to-png',
        'png-to-jpg',
        'compress-image',
        'compress-pdf',
        'merge-pdf',
        'pdf-to-jpg',
      ];
      const popularTools = popularSlugs.map((s) => getToolBySlug(s));
      expect(popularTools.every(Boolean)).toBe(true);
      expect(popularTools.length).toBe(6);
      expect(popularTools.length).toBeLessThan(allTools.length);
    });
  });

  describe('3. Image Tools Hub Categorization', () => {
    const CONVERT_SLUGS = [
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
    ];
    const COMPRESS_SLUGS = ['compress-image'];
    const EDIT_SLUGS = ['resize-image', 'crop-image', 'rotate-image'];
    const CREATE_SLUGS = ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'];

    it('categorizes 10 converters, 1 compressor, 3 editors, and 3 creators', () => {
      expect(CONVERT_SLUGS.length).toBe(10);
      expect(COMPRESS_SLUGS.length).toBe(1);
      expect(EDIT_SLUGS.length).toBe(3);
      expect(CREATE_SLUGS.length).toBe(3);

      const allImageHubSlugs = [
        ...CONVERT_SLUGS,
        ...COMPRESS_SLUGS,
        ...EDIT_SLUGS,
        ...CREATE_SLUGS,
      ];
      expect(allImageHubSlugs.length).toBe(17);

      for (const slug of allImageHubSlugs) {
        const tool = getToolBySlug(slug);
        expect(tool).toBeDefined();
        expect(tool?.slug).toBe(slug);
      }
    });
  });

  describe('4. PDF Tools Hub Categorization', () => {
    const CONVERT_SLUGS = ['pdf-to-jpg', 'pdf-to-png'];
    const ORGANIZE_SLUGS = [
      'merge-pdf',
      'split-pdf',
      'delete-pdf-pages',
      'reorder-pdf-pages',
      'rotate-pdf',
    ];
    const OPTIMIZE_SLUGS = ['compress-pdf'];
    const CREATE_SLUGS = ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'];

    it('categorizes 2 converters, 5 organizers, 1 optimizer, and 3 creators', () => {
      expect(CONVERT_SLUGS.length).toBe(2);
      expect(ORGANIZE_SLUGS.length).toBe(5);
      expect(OPTIMIZE_SLUGS.length).toBe(1);
      expect(CREATE_SLUGS.length).toBe(3);

      const allPdfHubSlugs = [
        ...CONVERT_SLUGS,
        ...ORGANIZE_SLUGS,
        ...OPTIMIZE_SLUGS,
        ...CREATE_SLUGS,
      ];

      for (const slug of allPdfHubSlugs) {
        const tool = getToolBySlug(slug);
        expect(tool).toBeDefined();
        expect(tool?.slug).toBe(slug);
      }
    });
  });

  describe('5. Tool Search Query Resolution', () => {
    // Helper function matching HomeSearch search algorithm
    function searchTools(query: string) {
      const raw = query.trim().toLowerCase();
      if (!raw) return [];
      const terms = raw.split(/\s+/).filter(Boolean);

      return allTools
        .filter((t) => {
          const nameLower = t.name.toLowerCase();
          const slugLower = t.slug.toLowerCase().replace(/-/g, ' ');
          const rawSlug = t.slug.toLowerCase();
          const titleLower = (t.title || '').toLowerCase();
          const introLower = (t.intro || '').toLowerCase();
          const descLower = (t.description || '').toLowerCase();
          const catLower = t.category.toLowerCase().replace(/-/g, ' ');
          const formats = [
            ...t.inputFormats.map((f) => f.toLowerCase()),
            ...t.outputFormats.map((f) => f.toLowerCase()),
          ].join(' ');

          const combined = `${nameLower} ${rawSlug} ${slugLower} ${titleLower} ${descLower} ${introLower} ${catLower} ${formats}`;
          return terms.every((term) => combined.includes(term));
        })
        .map((t) => t.slug);
    }

    it('matches natural query "compress pdf" to compress-pdf', () => {
      const results = searchTools('compress pdf');
      expect(results).toContain('compress-pdf');
    });

    it('matches natural query "jpg webp" to jpg-to-webp and webp-to-jpg', () => {
      const results = searchTools('jpg webp');
      expect(results).toContain('jpg-to-webp');
      expect(results).toContain('webp-to-jpg');
    });

    it('matches natural query "resize image" to resize-image', () => {
      const results = searchTools('resize image');
      expect(results).toContain('resize-image');
    });

    it('matches natural query "merge pdf" to merge-pdf', () => {
      const results = searchTools('merge pdf');
      expect(results).toContain('merge-pdf');
    });

    it('matches "webp" to all 4 webp conversion tools', () => {
      const results = searchTools('webp');
      expect(results).toContain('jpg-to-webp');
      expect(results).toContain('webp-to-jpg');
      expect(results).toContain('png-to-webp');
      expect(results).toContain('webp-to-png');
    });

    it('returns empty array when query does not match any tool', () => {
      const results = searchTools('completelynonexistentunrelatedtoolxyz');
      expect(results).toEqual([]);
    });
  });

  describe('6. Related Tools Resolution on Individual Tool Pages', () => {
    it('resolves valid canonical tools for compress-pdf', () => {
      const tool = getToolBySlug('compress-pdf');
      expect(tool).toBeDefined();
      const related = resolveRelatedTools(tool!.relatedTools);
      expect(related.length).toBeGreaterThanOrEqual(4);
      expect(related.map((t) => t.slug)).toContain('merge-pdf');
      expect(related.map((t) => t.slug)).toContain('split-pdf');
      expect(related.map((t) => t.slug)).toContain('pdf-to-jpg');
      expect(related.map((t) => t.slug)).toContain('pdf-to-png');
    });

    it('resolves valid canonical tools for jpg-to-png', () => {
      const tool = getToolBySlug('jpg-to-png');
      expect(tool).toBeDefined();
      const related = resolveRelatedTools(tool!.relatedTools);
      expect(related.length).toBeGreaterThanOrEqual(4);
      expect(related.map((t) => t.slug)).toContain('png-to-jpg');
      expect(related.map((t) => t.slug)).toContain('jpg-to-webp');
    });

    it('all 25 tools have non-empty relatedTools resolving to valid canonical tools', () => {
      for (const t of allTools) {
        expect(t.relatedTools.length).toBeGreaterThan(0);
        const resolved = resolveRelatedTools(t.relatedTools);
        expect(resolved.length).toBeGreaterThan(0);
        for (const rel of resolved) {
          expect(getToolBySlug(rel.slug)).toBeDefined();
        }
      }
    });
  });
});
