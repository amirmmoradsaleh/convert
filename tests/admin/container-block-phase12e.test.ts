import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_CONTAINER_DEPTH,
  DEFAULT_CONTAINER_SETTINGS,
  UNSUPPORTED_CONTAINER_CHILD_TYPES,
  isSupportedContainerChildType,
  sanitizeContainerSettings,
  getContainerWrapperClasses,
  getContainerInnerClasses,
  type ContainerBlockSettings,
} from '../../lib/cms/container-contract';
import {
  normalizeBlock,
  duplicateBlock,
  UniversalContentBlock,
} from '../../lib/cms/blocks';
import {
  serializeBlockPayload,
  deserializeBlockPayload,
  getBlockLabel,
  checkBlockDestinationCompatibility,
  BLOCK_CLIPBOARD_FORMAT,
  BLOCK_CLIPBOARD_VERSION,
} from '../../lib/cms/block-clipboard';
import { validateAndSanitizeBlock } from '../../lib/admin/validation';

describe('Phase 12.1-E: Container Block Architecture & Contracts', () => {
  describe('1. Default Settings Schema & Presets', () => {
    it('provides standard default settings matching design tokens', () => {
      expect(DEFAULT_CONTAINER_SETTINGS).toEqual({
        innerWidth: 'default',
        layout: 'vertical',
        gridCols: 2,
        gap: 'md',
        align: 'stretch',
        padding: 'md',
        background: 'transparent',
        borderRadius: 'xl',
        border: 'none',
      });
      expect(MAX_CONTAINER_DEPTH).toBe(2);
    });

    it('returns default settings when input is empty or null', () => {
      expect(sanitizeContainerSettings(null)).toEqual(DEFAULT_CONTAINER_SETTINGS);
      expect(sanitizeContainerSettings(undefined)).toEqual(DEFAULT_CONTAINER_SETTINGS);
      expect(sanitizeContainerSettings({})).toEqual(DEFAULT_CONTAINER_SETTINGS);
    });

    it('preserves valid container settings within approved whitelists', () => {
      const customSettings: ContainerBlockSettings = {
        innerWidth: 'wide',
        layout: 'grid',
        gridCols: 3,
        gap: 'lg',
        align: 'center',
        padding: 'xl',
        background: 'muted',
        borderRadius: '2xl',
        border: 'primary',
      };

      const sanitized = sanitizeContainerSettings(customSettings);
      expect(sanitized).toEqual(customSettings);
    });

    it('rejects unapproved values, CSS injections, and arbitrary properties', () => {
      const maliciousSettings = {
        innerWidth: 'ultra-wide; background: red',
        layout: 'flex; position: fixed',
        gridCols: 12,
        gap: '100px',
        align: 'baseline',
        padding: '1000px',
        background: 'url(https://malicious.com/tracker.png)',
        borderRadius: '500px',
        border: '<script>alert(1)</script>',
        extraDangerousProp: 'exec()',
      };

      const sanitized = sanitizeContainerSettings(maliciousSettings);
      // All invalid properties must fallback to safe defaults
      expect(sanitized.innerWidth).toBe(DEFAULT_CONTAINER_SETTINGS.innerWidth);
      expect(sanitized.layout).toBe(DEFAULT_CONTAINER_SETTINGS.layout);
      expect(sanitized.gridCols).toBe(DEFAULT_CONTAINER_SETTINGS.gridCols);
      expect(sanitized.gap).toBe(DEFAULT_CONTAINER_SETTINGS.gap);
      expect(sanitized.align).toBe(DEFAULT_CONTAINER_SETTINGS.align);
      expect(sanitized.padding).toBe(DEFAULT_CONTAINER_SETTINGS.padding);
      expect(sanitized.background).toBe(DEFAULT_CONTAINER_SETTINGS.background);
      expect(sanitized.borderRadius).toBe(DEFAULT_CONTAINER_SETTINGS.borderRadius);
      expect(sanitized.border).toBe(DEFAULT_CONTAINER_SETTINGS.border);
      expect((sanitized as any).extraDangerousProp).toBeUndefined();
    });
  });

  describe('2. Responsive Layout & Wrapper Classes', () => {
    it('generates appropriate responsive wrapper classes for container width, padding, background, border, and radius', () => {
      const narrowClasses = getContainerWrapperClasses({
        innerWidth: 'narrow',
        padding: 'sm',
        background: 'white',
        border: 'subtle',
        borderRadius: 'lg',
      });

      expect(narrowClasses).toContain('max-w-3xl mx-auto');
      expect(narrowClasses).toContain('p-3 sm:p-4');
      expect(narrowClasses).toContain('bg-white');
      expect(narrowClasses).toContain('border border-[#E4E2F0]');
      expect(narrowClasses).toContain('rounded-xl');

      const fullClasses = getContainerWrapperClasses({
        innerWidth: 'full',
        padding: 'none',
        background: 'transparent',
        border: 'none',
      });

      expect(fullClasses).toContain('w-full');
      expect(fullClasses).toContain('p-0');
      expect(fullClasses).toContain('bg-transparent');
      expect(fullClasses).toContain('border-0');
    });

    it('generates mobile-first responsive inner classes for vertical, horizontal, and grid layouts', () => {
      // 1. Vertical layout
      const verticalClasses = getContainerInnerClasses({ layout: 'vertical', gap: 'md', align: 'stretch' });
      expect(verticalClasses).toBe('flex flex-col items-stretch justify-start gap-6 w-full');

      // 2. Horizontal layout: mobile stacks (flex-col), tablet/desktop aligns horizontally (sm:flex-row)
      const horizontalClasses = getContainerInnerClasses({ layout: 'horizontal', gap: 'sm', align: 'center' });
      expect(horizontalClasses).toContain('flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 w-full');

      // 3. Grid layout: mobile stacks (grid-cols-1), tablet has 2 cols (sm:grid-cols-2), desktop has specified cols (lg:grid-cols-3)
      const grid3Classes = getContainerInnerClasses({ layout: 'grid', gridCols: 3, gap: 'lg' });
      expect(grid3Classes).toBe('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 w-full');

      const grid4Classes = getContainerInnerClasses({ layout: 'grid', gridCols: 4, gap: 'none' });
      expect(grid4Classes).toBe('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 w-full');
    });
  });

  describe('3. Nesting Boundary & Child Block Validation', () => {
    it('permits standard content block types as children inside a container', () => {
      const allowedTypes = [
        'heading',
        'paragraph',
        'rich_text',
        'image',
        'link',
        'cta',
        'feature',
        'features',
        'how_to_use',
        'faq',
        'privacy_note',
        'use_cases',
        'supported_formats',
        'technical_details',
        'custom_html',
      ];

      for (const type of allowedTypes) {
        const check = isSupportedContainerChildType(type, 1);
        expect(check.supported).toBe(true);
        expect(check.reason).toBeUndefined();
      }
    });

    it('rejects top-level singleton page sections from being nested inside containers', () => {
      expect(UNSUPPORTED_CONTAINER_CHILD_TYPES).toEqual(['hero', 'popular_tools', 'hubs', 'pricing']);

      for (const type of UNSUPPORTED_CONTAINER_CHILD_TYPES) {
        const check = isSupportedContainerChildType(type, 1);
        expect(check.supported).toBe(false);
        expect(check.reason).toContain('top-level page section');
      }
    });

    it('enforces maximum container depth limit (MAX_CONTAINER_DEPTH = 2)', () => {
      // Level 1 container containing a sub-container is permitted (currentDepth = 1 < 2)
      const depth1Check = isSupportedContainerChildType('container', 1);
      expect(depth1Check.supported).toBe(true);

      // Level 2 container attempting to contain a sub-container is rejected (currentDepth = 2 >= 2)
      const depth2Check = isSupportedContainerChildType('container', 2);
      expect(depth2Check.supported).toBe(false);
      expect(depth2Check.reason).toContain('Maximum container nesting depth of 2 exceeded');
    });
  });

  describe('4. Recursive Normalization & Backward Compatibility', () => {
    it('normalizes container block, populating settings and children deterministically', () => {
      const rawBlock = {
        id: 'cont-1',
        type: 'container',
        settings: {
          innerWidth: 'wide',
          layout: 'grid',
          gridCols: 2,
        },
        content: {
          blocks: [
            {
              id: 'child-1',
              type: 'heading',
              text: 'Child Title',
              level: 3,
            },
            {
              id: 'child-2',
              type: 'paragraph',
              text: 'Child body text.',
            },
          ],
        },
      };

      const normalized = normalizeBlock(rawBlock);

      expect(normalized.id).toBe('cont-1');
      expect(normalized.type).toBe('container');
      expect(normalized.settings?.innerWidth).toBe('wide');
      expect(normalized.settings?.layout).toBe('grid');
      expect(normalized.content?.blocks).toHaveLength(2);

      // Child blocks normalized properly
      expect(normalized.content?.blocks[0].type).toBe('heading');
      expect(normalized.content?.blocks[0].content?.text).toBe('Child Title');
      expect(normalized.content?.blocks[1].type).toBe('paragraph');
      expect(normalized.content?.blocks[1].content?.text).toBe('Child body text.');

      // Root compatibility keys mirrored
      expect(normalized.blocks).toBe(normalized.content.blocks);
      expect(normalized.children).toBe(normalized.content.blocks);
    });

    it('supports legacy content.children or root blocks property during normalization', () => {
      const legacyBlock = {
        id: 'cont-legacy',
        type: 'wrapper', // alias for container
        children: [
          { type: 'paragraph', text: 'Legacy child' },
        ],
      };

      const normalized = normalizeBlock(legacyBlock);
      expect(normalized.type).toBe('container');
      expect(normalized.content?.blocks).toHaveLength(1);
      expect(normalized.content?.blocks[0].content?.text).toBe('Legacy child');
    });

    it('filters out unsupported child blocks during normalization', () => {
      const rawBlockWithHero = {
        id: 'cont-invalid',
        type: 'container',
        content: {
          blocks: [
            { type: 'hero', title: 'Forbidden Hero' },
            { type: 'paragraph', text: 'Allowed paragraph' },
            { type: 'pricing', title: 'Forbidden Pricing' },
          ],
        },
      };

      const normalized = normalizeBlock(rawBlockWithHero);
      // Hero and pricing should be omitted
      expect(normalized.content?.blocks).toHaveLength(1);
      expect(normalized.content?.blocks[0].type).toBe('paragraph');
    });

    it('stops recursing when nesting depth exceeds MAX_CONTAINER_DEPTH', () => {
      // 3-level deep nested container
      const deepContainer = {
        id: 'depth-0',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'depth-1',
              type: 'container',
              content: {
                blocks: [
                  {
                    id: 'depth-2-forbidden',
                    type: 'container',
                    content: {
                      blocks: [
                        { type: 'paragraph', text: 'Too deep' },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      const normalized = normalizeBlock(deepContainer);
      const childContainer = normalized.content?.blocks[0];
      expect(childContainer).toBeDefined();
      expect(childContainer.type).toBe('container');

      // The 3rd-level container cannot be added as child because depth limit is reached
      expect(childContainer.content?.blocks).toHaveLength(0);
    });
  });

  describe('5. Block Duplication with Fresh Descendant IDs', () => {
    it('regenerates unique IDs for the container and all nested child blocks upon duplication', () => {
      const sourceBlock: UniversalContentBlock = {
        id: 'blk-parent-original',
        type: 'container',
        enabled: true,
        order: 1,
        settings: { ...DEFAULT_CONTAINER_SETTINGS },
        content: {
          settings: { ...DEFAULT_CONTAINER_SETTINGS },
          blocks: [
            {
              id: 'blk-child-1-original',
              type: 'heading',
              enabled: true,
              order: 0,
              content: { text: 'Heading Original', level: 2 },
            },
            {
              id: 'blk-child-2-original',
              type: 'paragraph',
              enabled: true,
              order: 1,
              content: { text: 'Paragraph Original' },
            },
          ],
        },
      };

      const duplicate = duplicateBlock(sourceBlock);

      // Container has fresh ID
      expect(duplicate.id).not.toBe(sourceBlock.id);
      expect(duplicate.id.startsWith('blk-')).toBe(true);

      // Child blocks have fresh IDs
      const dupChildren = duplicate.content?.blocks;
      expect(dupChildren).toHaveLength(2);
      expect(dupChildren[0].id).not.toBe('blk-child-1-original');
      expect(dupChildren[0].id.startsWith('blk-')).toBe(true);
      expect(dupChildren[1].id).not.toBe('blk-child-2-original');
      expect(dupChildren[1].id.startsWith('blk-')).toBe(true);

      // Ensure content deep-cloning
      dupChildren[0].content.text = 'Modified Heading';
      expect(sourceBlock.content.blocks[0].content.text).toBe('Heading Original');
    });
  });

  describe('6. Clipboard Integration (Recursive Copy & Paste)', () => {
    it('reports correct block label and allows container across all destination pages', () => {
      expect(getBlockLabel('container')).toBe('Container');

      expect(checkBlockDestinationCompatibility('container', 'page').compatible).toBe(true);
      expect(checkBlockDestinationCompatibility('container', 'home').compatible).toBe(true);
      expect(checkBlockDestinationCompatibility('container', 'tool').compatible).toBe(true);
    });

    it('serializes a container block into portable payload, recursively stripping IDs from all child blocks', () => {
      const containerToCopy: UniversalContentBlock = {
        id: 'container-db-123',
        pageId: 'page-abc',
        authorId: 'user-xyz',
        type: 'container',
        enabled: true,
        order: 2,
        settings: {
          innerWidth: 'wide',
          layout: 'horizontal',
          gap: 'lg',
        },
        content: {
          blocks: [
            {
              id: 'child-db-456',
              pageId: 'page-abc',
              authorId: 'user-xyz',
              type: 'cta',
              content: {
                id: 'cta-sub-id',
                buttonText: 'Action',
                href: '/tools/image-to-pdf',
              },
            },
          ],
        },
      };

      const payload = serializeBlockPayload(containerToCopy);

      expect(payload.format).toBe(BLOCK_CLIPBOARD_FORMAT);
      expect(payload.version).toBe(BLOCK_CLIPBOARD_VERSION);
      expect(payload.type).toBe('container');
      expect((payload as any).id).toBeUndefined();
      expect((payload as any).pageId).toBeUndefined();

      // Child blocks have IDs and audit properties stripped
      const childPayload = payload.content?.blocks[0];
      expect(childPayload.id).toBeUndefined();
      expect(childPayload.pageId).toBeUndefined();
      expect(childPayload.authorId).toBeUndefined();
      expect(childPayload.content?.id).toBeUndefined();
      expect(childPayload.content?.buttonText).toBe('Action');
    });

    it('deserializes a portable container payload, recursively assigning fresh IDs to all children', () => {
      const payload = {
        format: BLOCK_CLIPBOARD_FORMAT,
        version: BLOCK_CLIPBOARD_VERSION,
        type: 'container' as const,
        settings: {
          innerWidth: 'narrow',
          layout: 'vertical',
          gap: 'md',
        },
        content: {
          blocks: [
            {
              type: 'heading',
              content: { level: 2, text: 'Pasted Section' },
            },
            {
              type: 'paragraph',
              content: { text: 'Pasted body copy.' },
            },
          ],
        },
      };

      const result = deserializeBlockPayload(payload, 'tool', 5);

      expect(result.success).toBe(true);
      expect(result.block).toBeDefined();

      const pastedContainer = result.block!;
      expect(pastedContainer.type).toBe('container');
      expect(pastedContainer.id.startsWith('blk-')).toBe(true);
      expect(pastedContainer.order).toBe(5);

      const pastedChildren = pastedContainer.content?.blocks;
      expect(pastedChildren).toHaveLength(2);
      expect(pastedChildren[0].id.startsWith('blk-')).toBe(true);
      expect(pastedChildren[1].id.startsWith('blk-')).toBe(true);
      expect(pastedChildren[0].id).not.toBe(pastedChildren[1].id);
    });
  });

  describe('7. Security & Input Sanitization (validateAndSanitizeBlock)', () => {
    it('validates and sanitizes container block with valid children', () => {
      const validContainer = {
        id: 'valid-cont',
        type: 'container',
        settings: {
          innerWidth: 'default',
          layout: 'vertical',
        },
        content: {
          blocks: [
            {
              type: 'heading',
              content: { level: 2, text: 'Valid Heading' },
            },
            {
              type: 'cta',
              content: { buttonText: 'Click', href: 'https://convert24.net/tools' },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(validContainer);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedBlock).toBeDefined();
      expect(res.sanitizedBlock.content.blocks).toHaveLength(2);
    });

    it('fails validation when container contains an unsafe URL in a child block', () => {
      const dangerousContainer = {
        id: 'evil-cont',
        type: 'container',
        content: {
          blocks: [
            {
              type: 'cta',
              content: { buttonText: 'Attack', href: 'javascript:alert(document.cookie)' },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(dangerousContainer);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Unsafe URL detected in cta');
    });

    it('fails validation when container contains an unsupported top-level section', () => {
      const containerWithHero = {
        id: 'invalid-cont-hero',
        type: 'container',
        content: {
          blocks: [
            {
              type: 'hero',
              content: { title: 'Nested Hero' },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(containerWithHero);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('top-level page section and cannot be nested inside a container');
    });

    it('fails validation when container exceeds maximum nesting depth', () => {
      const containerTooDeep = {
        id: 'depth-1',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'depth-2',
              type: 'container',
              content: {
                blocks: [
                  {
                    id: 'depth-3',
                    type: 'container',
                    content: { blocks: [] },
                  },
                ],
              },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(containerTooDeep);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Maximum container nesting depth of 2 exceeded');
    });
  });

  describe('7. Phase 12.1-E.5: Validation Regression & Release Gate Invariants', () => {
    it('rejects invalid child block types rather than silently removing them', () => {
      const containerWithPricing = {
        id: 'cont-pricing',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'child-pricing',
              type: 'pricing',
              content: { title: 'Pro Plan' },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(containerWithPricing);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('pricing');
      expect(res.error).toContain('cannot be nested inside a container');

      const containerWithPopularTools = {
        id: 'cont-popular',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'child-pop-tools',
              type: 'popular_tools',
              content: { heading: 'Popular Converters' },
            },
          ],
        },
      };

      const resPop = validateAndSanitizeBlock(containerWithPopularTools);
      expect(resPop.isValid).toBe(false);
      expect(resPop.error).toContain('popular_tools');
      expect(resPop.error).toContain('cannot be nested inside a container');
    });

    it('rejects excessive container nesting beyond MAX_CONTAINER_DEPTH', () => {
      expect(MAX_CONTAINER_DEPTH).toBe(2);

      const threeLevelContainer = {
        id: 'lvl-1',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'lvl-2',
              type: 'container',
              content: {
                blocks: [
                  {
                    id: 'lvl-3',
                    type: 'container',
                    content: {
                      blocks: [
                        { id: 'p-deep', type: 'paragraph', content: { text: 'Too deep' } },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(threeLevelContainer);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Maximum container nesting depth of 2 exceeded');
    });

    it('valid nested containers remain valid within the configured depth limit', () => {
      const validNestedContainer = {
        id: 'outer-c',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'inner-c',
              type: 'container',
              content: {
                blocks: [
                  {
                    id: 'inner-heading',
                    type: 'heading',
                    content: { level: 3, text: 'Nested Sub-heading' },
                  },
                  {
                    id: 'inner-p',
                    type: 'paragraph',
                    content: { text: 'Nested sub-paragraph content.' },
                  },
                ],
              },
            },
          ],
        },
      };

      const res = validateAndSanitizeBlock(validNestedContainer);
      expect(res.isValid).toBe(true);
      expect(res.sanitizedBlock).toBeDefined();
      const outer = res.sanitizedBlock;
      expect(outer.content.blocks).toHaveLength(1);
      const inner = outer.content.blocks[0];
      expect(inner.type).toBe('container');
      expect(inner.content.blocks).toHaveLength(2);
      expect(inner.content.blocks[0].content.text).toBe('Nested Sub-heading');
      expect(inner.content.blocks[1].content.text).toBe('Nested sub-paragraph content.');
    });

    it('valid child content survives normalization and round-trip serialization', () => {
      const complexContainer = {
        id: 'full-test-cont',
        type: 'container',
        settings: {
          innerWidth: 'wide',
          layout: 'grid',
          gridCols: 3,
          gap: 'lg',
          align: 'center',
          padding: 'xl',
          background: 'indigo',
          borderRadius: '2xl',
          border: 'subtle',
        },
        content: {
          blocks: [
            {
              id: 'c-head',
              type: 'heading',
              content: { level: 2, text: 'Container Main Heading' },
            },
            {
              id: 'c-para',
              type: 'paragraph',
              content: { text: 'Container explanatory body text.' },
            },
            {
              id: 'c-cta',
              type: 'cta',
              content: {
                title: 'Action Banner',
                description: 'Click below to convert',
                buttonText: 'Get Started',
                href: '/tools/pdf-merge',
                variant: 'primary',
              },
            },
            {
              id: 'c-html',
              type: 'custom_html',
              content: {
                html: '<div class="banner">Custom Banner Content</div>',
                css: '.banner { padding: 1rem; }',
              },
            },
          ],
        },
      };

      const normalized = normalizeBlock(complexContainer);
      expect(normalized.type).toBe('container');
      expect(normalized.content.blocks).toHaveLength(4);

      // JSON round-trip serialization simulation
      const serialized = JSON.stringify(normalized);
      const reParsed = JSON.parse(serialized);

      expect(reParsed.content.blocks[0].content.text).toBe('Container Main Heading');
      expect(reParsed.content.blocks[0].content.level).toBe(2);
      expect(reParsed.content.blocks[1].content.text).toBe('Container explanatory body text.');
      expect(reParsed.content.blocks[2].content.buttonText).toBe('Get Started');
      expect(reParsed.content.blocks[2].content.href).toBe('/tools/pdf-merge');
      expect(reParsed.content.blocks[3].content.html).toContain('Custom Banner Content');
      expect(reParsed.settings.layout).toBe('grid');
      expect(reParsed.settings.gridCols).toBe(3);
    });

    it('content.blocks, blocks, and children remain consistent wherever required', () => {
      const rawContainer = {
        id: 'sync-test-cont',
        type: 'container',
        content: {
          blocks: [
            { id: 'sync-h', type: 'heading', content: { text: 'Heading' } },
            { id: 'sync-p', type: 'paragraph', content: { text: 'Paragraph' } },
          ],
        },
      };

      const normalized = normalizeBlock(rawContainer);
      expect(normalized.content.blocks).toBeDefined();
      expect(normalized.blocks).toBe(normalized.content.blocks);
      expect(normalized.children).toBe(normalized.content.blocks);

      const duplicated = duplicateBlock(normalized);
      expect(duplicated.content.blocks).toBeDefined();
      expect(duplicated.blocks).toBe(duplicated.content.blocks);
      expect(duplicated.children).toBe(duplicated.content.blocks);
    });

    it('clipboard serialization strips old identifiers and paste creates fresh identifiers recursively', () => {
      const containerWithDbIds: UniversalContentBlock = {
        id: 'db-cont-id-12345',
        type: 'container',
        order: 1,
        enabled: true,
        settings: { ...DEFAULT_CONTAINER_SETTINGS },
        content: {
          id: 'db-cont-content-id',
          pageId: 'page-abc-123',
          authorId: 'user-xyz-456',
          revisionId: 'rev-001',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          blocks: [
            {
              id: 'db-child-id-67890',
              type: 'cta',
              order: 1,
              enabled: true,
              content: {
                id: 'db-child-content-id',
                pageId: 'page-abc-123',
                title: 'Click Me',
                buttonText: 'Action',
                href: '/test',
              },
            },
          ],
        },
      };

      const payload = serializeBlockPayload(containerWithDbIds);
      // Verify stripped root identifiers
      expect((payload as any).id).toBeUndefined();
      expect(payload.content.id).toBeUndefined();
      expect(payload.content.pageId).toBeUndefined();
      expect(payload.content.authorId).toBeUndefined();
      expect(payload.content.revisionId).toBeUndefined();

      // Verify stripped nested child identifiers
      const childInPayload = payload.content.blocks[0];
      expect(childInPayload.id).toBeUndefined();
      expect(childInPayload.content?.id).toBeUndefined();
      expect(childInPayload.content?.pageId).toBeUndefined();

      // Deserialize payload into fresh block
      const deserialized = deserializeBlockPayload(payload, 'page', 5);
      expect(deserialized.success).toBe(true);
      expect(deserialized.block).toBeDefined();

      const pastedBlock = deserialized.block!;
      expect(pastedBlock.id).not.toBe('db-cont-id-12345');
      expect(pastedBlock.id.startsWith('blk-')).toBe(true);
      expect(pastedBlock.order).toBe(5);

      const pastedChild = pastedBlock.content.blocks[0];
      expect(pastedChild.id).toBeDefined();
      expect(pastedChild.id).not.toBe('db-child-id-67890');
      expect(pastedChild.id.startsWith('blk-')).toBe(true);
      expect(pastedChild.content.title).toBe('Click Me');
      expect(pastedChild.content.buttonText).toBe('Action');
      expect(pastedChild.content.href).toBe('/test');
    });

    it('failed validation prevents persistence of malformed content', () => {
      const malformedContainer = {
        id: 'bad-cont',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'bad-cta',
              type: 'cta',
              content: { buttonText: 'Evil Link', href: 'javascript:exploit()' },
            },
          ],
        },
      };

      // Simulates API route persistence guard
      const simulateSaveDraft = (blocks: any[]): { status: number; persisted: boolean; error?: string } => {
        for (let i = 0; i < blocks.length; i++) {
          const check = validateAndSanitizeBlock(blocks[i]);
          if (!check.isValid) {
            return { status: 400, persisted: false, error: check.error };
          }
        }
        return { status: 200, persisted: true };
      };

      const result = simulateSaveDraft([malformedContainer]);
      expect(result.status).toBe(400);
      expect(result.persisted).toBe(false);
      expect(result.error).toContain('Unsafe URL detected in cta');
    });
  });
});
