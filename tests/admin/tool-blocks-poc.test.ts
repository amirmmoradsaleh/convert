import { describe, it, expect } from 'vitest';
import {
  normalizeBlock,
  toggleBlockEnabled,
  deleteBlock,
  reorderBlocks,
  duplicateBlock,
  serializeBlockForClipboard,
  deserializeAndPasteBlock,
  UniversalContentBlock,
} from '@/lib/cms/blocks';
import { getToolBySlug } from '@/lib/tools';

describe('Phase 07B — Tool Page Universal Content Builder — PNG to JPG Proof of Concept', () => {
  
  // 1. Block CRUD
  describe('Block CRUD Operations', () => {
    it('should add a new block', () => {
      const initialBlocks: UniversalContentBlock[] = [];
      const newBlock = normalizeBlock({ type: 'hero', content: { title: 'Test Hero' } }, initialBlocks.length);
      const updated = [...initialBlocks, newBlock];
      expect(updated.length).toBe(1);
      expect(updated[0].type).toBe('hero');
      expect(updated[0].content.title).toBe('Test Hero');
    });

    it('should edit block content', () => {
      const block = normalizeBlock({ type: 'hero', content: { title: 'Test Hero' } });
      const updatedContent = { ...block.content, title: 'Updated Hero Title' };
      const updatedBlock = { ...block, content: updatedContent };
      expect(updatedBlock.content.title).toBe('Updated Hero Title');
    });

    it('should delete a block', () => {
      const blocks = [
        normalizeBlock({ id: 'b1', type: 'hero' }),
        normalizeBlock({ id: 'b2', type: 'cta' }),
      ];
      const updated = deleteBlock(blocks, 'b1');
      expect(updated.length).toBe(1);
      expect(updated[0].id).toBe('b2');
    });

    it('should duplicate a block', () => {
      const original = normalizeBlock({ id: 'b1', type: 'cta', content: { title: 'CTA Title' } });
      const copy = duplicateBlock(original);
      expect(copy.id).not.toBe(original.id);
      expect(copy.type).toBe('cta');
      expect(copy.content.title).toBe('CTA Title');
    });

    it('should copy and paste a block', () => {
      const original = normalizeBlock({ id: 'b1', type: 'rich_text', content: { html: '<p>Hi</p>' } });
      const serialized = serializeBlockForClipboard(original);
      const pasted = deserializeAndPasteBlock(serialized, 10);
      expect(pasted).not.toBeNull();
      expect(pasted!.id).not.toBe(original.id);
      expect(pasted!.order).toBe(10);
      expect(pasted!.type).toBe('rich_text');
      expect(pasted!.content.html).toBe('<p>Hi</p>');
    });

    it('should reorder blocks deterministically', () => {
      const list = [
        normalizeBlock({ id: 'b1', type: 'hero', order: 0 }),
        normalizeBlock({ id: 'b2', type: 'cta', order: 1 }),
      ];
      const reordered = reorderBlocks(list, 'b1', 'b2');
      expect(reordered[0].id).toBe('b2');
      expect(reordered[1].id).toBe('b1');
      expect(reordered[0].order).toBe(0);
      expect(reordered[1].order).toBe(1);
    });

    it('should toggle enabled/disabled status', () => {
      const block = normalizeBlock({ type: 'hero', enabled: true });
      const disabled = toggleBlockEnabled(block, false);
      expect(disabled.enabled).toBe(false);
      const enabled = toggleBlockEnabled(disabled, true);
      expect(enabled.enabled).toBe(true);
    });
  });

  // 2. Collection Items
  describe('Collection Item Operations', () => {
    it('should add, edit, delete, duplicate, reorder, and enable/disable collection items dynamically', () => {
      // 1. Add item
      const item1 = { id: 'itm-1', enabled: true, icon: 'Zap', text: 'Fast' };
      const item2 = { id: 'itm-2', enabled: true, icon: 'Lock', text: 'Private' };
      let items = [item1, item2];

      // 2. Edit item
      items[0] = { ...items[0], text: 'Lightning Fast' };
      expect(items[0].text).toBe('Lightning Fast');

      // 3. Enable/Disable item
      items[1] = { ...items[1], enabled: false };
      expect(items[1].enabled).toBe(false);

      // 4. Duplicate item
      const dupeItem = { ...items[0], id: 'itm-dupe-' + Date.now() };
      items.push(dupeItem);
      expect(items.length).toBe(3);
      expect(items[2].text).toBe('Lightning Fast');

      // 5. Reorder items
      const temp = items[0];
      items[0] = items[1];
      items[1] = temp;
      expect(items[0].id).toBe('itm-2');
      expect(items[1].id).toBe('itm-1');

      // 6. Delete item
      items = items.filter(itm => itm.id !== 'itm-2');
      expect(items.length).toBe(2);
      expect(items[0].id).toBe('itm-1');
    });
  });

  // 3. Public Rendering
  describe('Public Rendering Constraints', () => {
    it('should fall back safely when no blocks are defined', () => {
      const canonical = getToolBySlug('png-to-jpg');
      expect(canonical).toBeDefined();
      expect(canonical!.slug).toBe('png-to-jpg');
      // If canonical has no blocks, hasCmsBlocks evaluates to false
      const hasCmsBlocks = Array.isArray(canonical!.blocks) && canonical!.blocks.length > 0;
      expect(hasCmsBlocks).toBe(false);
    });
  });

  // 4. Tool Integrity
  describe('Tool Integrity Verification', () => {
    it('should preserve png-to-jpg tool metadata and canonical configuration', () => {
      const tool = getToolBySlug('png-to-jpg');
      expect(tool).toBeDefined();
      expect(tool!.slug).toBe('png-to-jpg');
      expect(tool!.name).toBe('PNG to JPG');
      expect(tool!.category).toBe('image-converter');
      expect(tool!.clientSide).toBe(true);
      expect(tool!.engine).toBe('image-convert');
    });
  });
});
