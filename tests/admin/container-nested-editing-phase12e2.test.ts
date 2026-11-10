import { describe, it, expect } from 'vitest';
import {
  findBlockPath,
  findBlockById,
  findParentBlock,
  updateBlockInTree,
  deleteBlockFromTree,
  normalizeBlock,
  duplicateBlock,
  UniversalContentBlock,
} from '../../lib/cms/blocks';
import {
  DEFAULT_CONTAINER_SETTINGS,
  MAX_CONTAINER_DEPTH,
  ContainerBlockSettings,
  isSupportedContainerChildType,
} from '../../lib/cms/container-contract';

describe('Phase 12.1-E.2: Container Nested Child Block Selection & Editing', () => {
  // Test fixture helper: creates a tree with top-level blocks and nested containers
  const createTestBlockTree = (): UniversalContentBlock[] => [
    {
      id: 'top-heading-1',
      type: 'heading',
      order: 1,
      enabled: true,
      content: { level: 2, text: 'Top Level Heading' },
      text: 'Top Level Heading',
      level: 2,
    },
    {
      id: 'container-outer',
      type: 'container',
      order: 2,
      enabled: true,
      settings: { ...DEFAULT_CONTAINER_SETTINGS, background: 'indigo' },
      content: {
        settings: { ...DEFAULT_CONTAINER_SETTINGS, background: 'indigo' },
        title: 'Outer Container Section',
        blocks: [
          {
            id: 'child-p-1',
            type: 'paragraph',
            order: 1,
            enabled: true,
            content: { text: 'Child paragraph 1 in outer container' },
            text: 'Child paragraph 1 in outer container',
          },
          {
            id: 'child-cta-1',
            type: 'cta',
            order: 2,
            enabled: true,
            content: {
              title: 'Child CTA Title',
              description: 'Child CTA description',
              buttonText: 'Click Child CTA',
              href: '/child-cta-url',
            },
            title: 'Child CTA Title',
            description: 'Child CTA description',
            buttonText: 'Click Child CTA',
            href: '/child-cta-url',
          },
          {
            id: 'container-inner',
            type: 'container',
            order: 3,
            enabled: true,
            settings: { ...DEFAULT_CONTAINER_SETTINGS, background: 'white' },
            content: {
              settings: { ...DEFAULT_CONTAINER_SETTINGS, background: 'white' },
              title: 'Inner Nested Container',
              blocks: [
                {
                  id: 'deep-child-heading',
                  type: 'heading',
                  order: 1,
                  enabled: true,
                  content: { level: 3, text: 'Deeply Nested Heading' },
                  text: 'Deeply Nested Heading',
                  level: 3,
                },
                {
                  id: 'deep-child-paragraph',
                  type: 'paragraph',
                  order: 2,
                  enabled: true,
                  content: { text: 'Deeply nested paragraph content' },
                  text: 'Deeply nested paragraph content',
                },
              ],
            },
            blocks: [],
            children: [],
          },
        ],
      },
      blocks: [],
      children: [],
    },
    {
      id: 'top-paragraph-2',
      type: 'paragraph',
      order: 3,
      enabled: true,
      content: { text: 'Top Level Trailing Paragraph' },
      text: 'Top Level Trailing Paragraph',
    },
  ];

  describe('1. Recursive Block Search (findBlockPath & findBlockById)', () => {
    it('finds top-level blocks by id', () => {
      const tree = createTestBlockTree();
      const found = findBlockById(tree, 'top-heading-1');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('top-heading-1');
      expect(found?.type).toBe('heading');
    });

    it('finds nested child blocks inside a container (depth 1)', () => {
      const tree = createTestBlockTree();
      const found = findBlockById(tree, 'child-cta-1');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('child-cta-1');
      expect(found?.type).toBe('cta');
      expect(found?.content.buttonText).toBe('Click Child CTA');
    });

    it('finds doubly-nested child blocks inside an inner container (depth 2)', () => {
      const tree = createTestBlockTree();
      const found = findBlockById(tree, 'deep-child-heading');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('deep-child-heading');
      expect(found?.type).toBe('heading');
      expect(found?.content.text).toBe('Deeply Nested Heading');
    });

    it('returns null when block id does not exist in tree', () => {
      const tree = createTestBlockTree();
      expect(findBlockById(tree, 'non-existent-id')).toBeNull();
      expect(findBlockById(tree, '')).toBeNull();
      expect(findBlockById(tree, null)).toBeNull();
      expect(findBlockById(tree, undefined)).toBeNull();
      expect(findBlockById([], 'top-heading-1')).toBeNull();
    });

    it('provides full ancestor path from root to target block via findBlockPath', () => {
      const tree = createTestBlockTree();
      const path = findBlockPath(tree, 'deep-child-paragraph');
      expect(path.length).toBe(3);
      expect(path[0].id).toBe('container-outer');
      expect(path[1].id).toBe('container-inner');
      expect(path[2].id).toBe('deep-child-paragraph');
    });
  });

  describe('2. Parent Block Discovery (findParentBlock)', () => {
    it('returns null for top-level blocks (no parent container)', () => {
      const tree = createTestBlockTree();
      expect(findParentBlock(tree, 'top-heading-1')).toBeNull();
      expect(findParentBlock(tree, 'container-outer')).toBeNull();
      expect(findParentBlock(tree, 'top-paragraph-2')).toBeNull();
    });

    it('returns the direct outer container for depth 1 child blocks', () => {
      const tree = createTestBlockTree();
      const parent = findParentBlock(tree, 'child-p-1');
      expect(parent).not.toBeNull();
      expect(parent?.id).toBe('container-outer');
      expect(parent?.type).toBe('container');
    });

    it('returns the immediate inner container for depth 2 child blocks', () => {
      const tree = createTestBlockTree();
      const parent = findParentBlock(tree, 'deep-child-heading');
      expect(parent).not.toBeNull();
      expect(parent?.id).toBe('container-inner');
      expect(parent?.content.title).toBe('Inner Nested Container');
    });

    it('returns null for non-existent block IDs or null input', () => {
      const tree = createTestBlockTree();
      expect(findParentBlock(tree, 'random-id')).toBeNull();
      expect(findParentBlock(tree, null)).toBeNull();
      expect(findParentBlock(tree, undefined)).toBeNull();
    });
  });

  describe('3. Immutable Tree Updates (updateBlockInTree)', () => {
    it('updates a top-level block without mutating original tree', () => {
      const tree = createTestBlockTree();
      const updatedHeading: UniversalContentBlock = {
        ...tree[0],
        content: { level: 1, text: 'Updated Top Heading' },
        text: 'Updated Top Heading',
      };

      const result = updateBlockInTree(tree, updatedHeading);
      expect(result).not.toBe(tree);
      expect(result[0].content.text).toBe('Updated Top Heading');
      expect(tree[0].content.text).toBe('Top Level Heading'); // original preserved
    });

    it('updates a nested child block while preserving all siblings and container settings', () => {
      const tree = createTestBlockTree();
      const originalCta = findBlockById(tree, 'child-cta-1')!;
      const updatedCta: UniversalContentBlock = {
        ...originalCta,
        content: {
          ...originalCta.content,
          title: 'Brand New CTA Heading',
          buttonText: 'Join Convert24 Free',
        },
        title: 'Brand New CTA Heading',
        buttonText: 'Join Convert24 Free',
      };

      const result = updateBlockInTree(tree, updatedCta);

      // Verify the target block was updated
      const foundUpdated = findBlockById(result, 'child-cta-1')!;
      expect(foundUpdated.content.title).toBe('Brand New CTA Heading');
      expect(foundUpdated.content.buttonText).toBe('Join Convert24 Free');

      // Verify sibling in the same container was untouched
      const siblingP = findBlockById(result, 'child-p-1')!;
      expect(siblingP.content.text).toBe('Child paragraph 1 in outer container');

      // Verify parent container settings were untouched
      const outerContainer = findBlockById(result, 'container-outer')!;
      expect(outerContainer.settings?.background).toBe('indigo');
      expect(outerContainer.content.settings?.background).toBe('indigo');

      // Verify blocks and children arrays are kept in sync on the container
      expect(outerContainer.blocks).toBe(outerContainer.content.blocks);
      expect(outerContainer.children).toBe(outerContainer.content.blocks);

      // Verify other top-level blocks remain untouched
      expect(result[0].id).toBe('top-heading-1');
      expect(result[2].id).toBe('top-paragraph-2');

      // Original tree remains untouched (immutability)
      expect(findBlockById(tree, 'child-cta-1')?.content.title).toBe('Child CTA Title');
    });

    it('updates a doubly-nested child block (depth 2) while preserving all tree levels', () => {
      const tree = createTestBlockTree();
      const deepHeading = findBlockById(tree, 'deep-child-heading')!;
      const updatedDeepHeading: UniversalContentBlock = {
        ...deepHeading,
        content: { level: 2, text: 'Revised Deeply Nested Title' },
        text: 'Revised Deeply Nested Title',
      };

      const result = updateBlockInTree(tree, updatedDeepHeading);

      const found = findBlockById(result, 'deep-child-heading')!;
      expect(found.content.text).toBe('Revised Deeply Nested Title');

      // Sibling in the inner container preserved
      const deepP = findBlockById(result, 'deep-child-paragraph')!;
      expect(deepP.content.text).toBe('Deeply nested paragraph content');

      // Inner container preserved
      const innerContainer = findBlockById(result, 'container-inner')!;
      expect(innerContainer.content.title).toBe('Inner Nested Container');

      // Outer container preserved
      const outerContainer = findBlockById(result, 'container-outer')!;
      expect(outerContainer.settings?.background).toBe('indigo');
    });

    it('returns the same blocks array if updated block id is not in tree', () => {
      const tree = createTestBlockTree();
      const phantomBlock: UniversalContentBlock = {
        id: 'phantom-block',
        type: 'paragraph',
        order: 99,
        enabled: true,
        content: { text: 'Does not exist' },
      };

      const result = updateBlockInTree(tree, phantomBlock);
      expect(result).toEqual(tree);
    });
  });

  describe('4. Recursive Block Deletion (deleteBlockFromTree)', () => {
    it('deletes a top-level block from tree', () => {
      const tree = createTestBlockTree();
      const result = deleteBlockFromTree(tree, 'top-heading-1');
      expect(result.length).toBe(2);
      expect(findBlockById(result, 'top-heading-1')).toBeNull();
      expect(findBlockById(result, 'container-outer')).not.toBeNull();
    });

    it('deletes a nested child block from a container preserving siblings and container settings', () => {
      const tree = createTestBlockTree();
      const result = deleteBlockFromTree(tree, 'child-p-1');

      // Target child removed
      expect(findBlockById(result, 'child-p-1')).toBeNull();

      // Sibling blocks preserved
      expect(findBlockById(result, 'child-cta-1')).not.toBeNull();
      expect(findBlockById(result, 'container-inner')).not.toBeNull();

      // Outer container content.blocks has 2 children instead of 3
      const outerContainer = findBlockById(result, 'container-outer')!;
      expect(outerContainer.content.blocks.length).toBe(2);
      expect(outerContainer.blocks.length).toBe(2);
      expect(outerContainer.children.length).toBe(2);

      // Settings preserved
      expect(outerContainer.settings?.background).toBe('indigo');
    });

    it('deletes a doubly-nested child block from depth 2 container', () => {
      const tree = createTestBlockTree();
      const result = deleteBlockFromTree(tree, 'deep-child-heading');

      expect(findBlockById(result, 'deep-child-heading')).toBeNull();
      expect(findBlockById(result, 'deep-child-paragraph')).not.toBeNull();

      const innerContainer = findBlockById(result, 'container-inner')!;
      expect(innerContainer.content.blocks.length).toBe(1);
    });

    it('handles non-existent id gracefully during deletion', () => {
      const tree = createTestBlockTree();
      const result = deleteBlockFromTree(tree, 'no-such-id');
      expect(result.length).toBe(3);
      expect(findBlockById(result, 'child-p-1')).not.toBeNull();
    });
  });

  describe('5. Normalization & Duplication Integration with Depth Limits', () => {
    it('normalizes a container block with nested children recursively', () => {
      const rawContainer = {
        type: 'container',
        settings: { background: 'slate', innerWidth: 'wide' },
        content: {
          blocks: [
            { type: 'heading', content: { text: 'Raw Child Heading' } },
            { type: 'paragraph', content: { text: 'Raw Child Paragraph' } },
          ],
        },
      };

      const normalized = normalizeBlock(rawContainer);
      expect(normalized.type).toBe('container');
      expect(normalized.settings?.background).toBe('slate');
      expect(normalized.content.blocks.length).toBe(2);
      expect(normalized.content.blocks[0].type).toBe('heading');
      expect(normalized.content.blocks[0].content.text).toBe('Raw Child Heading');
      expect(normalized.blocks).toBe(normalized.content.blocks);
      expect(normalized.children).toBe(normalized.content.blocks);
    });

    it('duplicates a container block giving fresh IDs to container and all child blocks', () => {
      const originalContainer: UniversalContentBlock = {
        id: 'orig-container',
        type: 'container',
        order: 1,
        enabled: true,
        settings: { ...DEFAULT_CONTAINER_SETTINGS },
        content: {
          settings: { ...DEFAULT_CONTAINER_SETTINGS },
          blocks: [
            {
              id: 'orig-child-1',
              type: 'heading',
              order: 1,
              enabled: true,
              content: { text: 'Duplicated Heading' },
            },
            {
              id: 'orig-child-2',
              type: 'paragraph',
              order: 2,
              enabled: true,
              content: { text: 'Duplicated Paragraph' },
            },
          ],
        },
      };

      const dup = duplicateBlock(originalContainer);
      expect(dup.id).not.toBe(originalContainer.id);
      expect(dup.content.blocks.length).toBe(2);
      expect(dup.content.blocks[0].id).not.toBe('orig-child-1');
      expect(dup.content.blocks[1].id).not.toBe('orig-child-2');
      expect(dup.content.blocks[0].content.text).toBe('Duplicated Heading');
    });

    it('enforces MAX_CONTAINER_DEPTH = 2 preventing infinite or illegal nesting', () => {
      expect(MAX_CONTAINER_DEPTH).toBe(2);

      // Attempting to nest a container at depth 2 (currentDepth = 2) should be rejected
      const deeplyNestedContainer = {
        id: 'c-level-1',
        type: 'container',
        content: {
          blocks: [
            {
              id: 'c-level-2',
              type: 'container',
              content: {
                blocks: [
                  {
                    id: 'c-level-3',
                    type: 'container',
                    content: { blocks: [] },
                  },
                ],
              },
            },
          ],
        },
      };

      const normalized = normalizeBlock(deeplyNestedContainer, 0, 0);
      const level2Container = normalized.content.blocks[0];
      expect(level2Container.type).toBe('container');
      // Level 3 container should be rejected because currentDepth reaches MAX_CONTAINER_DEPTH
      expect(level2Container.content.blocks.length).toBe(0);
    });
  });

  describe('6. Data Integrity & Drawer Transition Invariants', () => {
    it('synchronizes content.blocks, blocks, and children consistently during updates', () => {
      const tree = createTestBlockTree();
      const updatedChild: UniversalContentBlock = {
        id: 'child-p-1',
        type: 'paragraph',
        order: 1,
        enabled: true,
        content: { text: 'Updated child paragraph content' },
        text: 'Updated child paragraph content',
      };

      const updatedTree = updateBlockInTree(tree, updatedChild);
      const parentContainer = updatedTree.find((b) => b.id === 'container-outer');
      expect(parentContainer).toBeDefined();
      expect(parentContainer?.content.blocks).toBeDefined();
      expect(parentContainer?.blocks).toBe(parentContainer?.content.blocks);
      expect(parentContainer?.children).toBe(parentContainer?.content.blocks);
      expect(parentContainer?.content.blocks[0].content.text).toBe('Updated child paragraph content');
    });

    it('preserves sibling blocks and parent container settings when editing a child block', () => {
      const tree = createTestBlockTree();
      const originalContainer = tree.find((b) => b.id === 'container-outer');
      const originalSiblingCta = originalContainer?.content.blocks.find((b: any) => b.id === 'child-cta-1');

      const updatedChild: UniversalContentBlock = {
        id: 'child-p-1',
        type: 'paragraph',
        order: 1,
        enabled: true,
        content: { text: 'New text for paragraph' },
      };

      const updatedTree = updateBlockInTree(tree, updatedChild);
      const updatedContainer = updatedTree.find((b) => b.id === 'container-outer');

      // Parent settings preserved
      expect(updatedContainer?.settings?.background).toBe('indigo');
      expect(updatedContainer?.content.settings?.background).toBe('indigo');
      expect(updatedContainer?.content.title).toBe('Outer Container Section');

      // Sibling block preserved exactly
      const preservedSibling = updatedContainer?.content.blocks.find((b: any) => b.id === 'child-cta-1');
      expect(preservedSibling).toBeDefined();
      expect(preservedSibling.content.title).toBe(originalSiblingCta.content.title);
      expect(preservedSibling.content.href).toBe(originalSiblingCta.content.href);
    });

    it('preserves pending child edits during drawer back navigation without discarding them', () => {
      const tree = createTestBlockTree();
      const childCTA = findBlockById(tree, 'child-cta-1');
      expect(childCTA).not.toBeNull();

      // Simulate editor editing CTA text and calling onSaveBlock prior to onSelectBlock(parent.id)
      const editedChildCTA: UniversalContentBlock = {
        ...childCTA!,
        content: {
          ...childCTA!.content,
          buttonText: 'Updated Button Text Via Drawer',
          href: '/updated-url',
        },
      };

      const updatedTree = updateBlockInTree(tree, editedChildCTA);
      const outerContainer = updatedTree.find((b) => b.id === 'container-outer');
      const reFoundCTA = outerContainer?.content.blocks.find((b: any) => b.id === 'child-cta-1');

      expect(reFoundCTA.content.buttonText).toBe('Updated Button Text Via Drawer');
      expect(reFoundCTA.content.href).toBe('/updated-url');
      // Other children remain unaffected
      expect(outerContainer?.content.blocks[0].id).toBe('child-p-1');
      expect(outerContainer?.content.blocks[2].id).toBe('container-inner');
    });

    it('enforces depth-aware child insertion guard in editor UI logic', () => {
      // Top-level container (depth 1) allows sub-containers
      const depth1ContainerCheck = isSupportedContainerChildType('container', 1);
      expect(depth1ContainerCheck.supported).toBe(true);

      // Nested container (depth 2) rejects sub-containers
      const depth2ContainerCheck = isSupportedContainerChildType('container', 2);
      expect(depth2ContainerCheck.supported).toBe(false);
      expect(depth2ContainerCheck.reason).toContain('Maximum container nesting depth of 2 exceeded');

      // Standard blocks are allowed at both depth 1 and depth 2
      expect(isSupportedContainerChildType('heading', 1).supported).toBe(true);
      expect(isSupportedContainerChildType('heading', 2).supported).toBe(true);
      expect(isSupportedContainerChildType('paragraph', 2).supported).toBe(true);
      expect(isSupportedContainerChildType('custom_html', 2).supported).toBe(true);
      expect(isSupportedContainerChildType('cta', 2).supported).toBe(true);

      // Section-level singletons are rejected at both depths
      expect(isSupportedContainerChildType('hero', 1).supported).toBe(false);
      expect(isSupportedContainerChildType('hero', 2).supported).toBe(false);
    });
  });
});
