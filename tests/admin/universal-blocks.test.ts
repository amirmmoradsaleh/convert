import { describe, it, expect } from 'vitest';
import {
  normalizeBlock,
  normalizeBlocksList,
  toggleBlockEnabled,
  deleteBlock,
  reorderBlocks,
  duplicateBlock,
  serializeBlockForClipboard,
  deserializeAndPasteBlock,
  UniversalContentBlock,
} from '@/lib/cms/blocks';
import { validateAndSanitizeBlock } from '@/lib/admin/validation';

describe('Phase 07A — Universal Content Blocks Foundation', () => {
  // Test 1: Block Normalization & 8: Backward compatibility with legacy structures
  it('1 & 8. should normalize legacy and new blocks safely, preserving existing properties and adding compatibility fields', () => {
    // A legacy heading block
    const legacyHeading = {
      id: 'legacy-h1',
      type: 'heading',
      level: 1,
      text: 'Hello World',
    };

    const normalized = normalizeBlock(legacyHeading);

    expect(normalized.id).toBe('legacy-h1');
    expect(normalized.type).toBe('heading');
    expect(normalized.enabled).toBe(true); // default true
    expect(normalized.order).toBe(0); // default 0
    expect(normalized.content).toEqual({
      level: 1,
      text: 'Hello World',
    });
    expect(normalized.settings).toEqual({});
    
    // Legacy properties must be preserved directly on the root for backward-compatible rendering
    expect(normalized.level).toBe(1);
    expect(normalized.text).toBe('Hello World');
  });

  // Test 2: Stable IDs
  it('2. should assign unique, stable IDs if a block does not have one, and keep existing IDs', () => {
    const blockWithId = {
      id: 'my-custom-stable-id',
      type: 'paragraph',
      text: 'Some paragraph',
    };
    const normalized1 = normalizeBlock(blockWithId);
    expect(normalized1.id).toBe('my-custom-stable-id');

    const blockWithoutId = {
      type: 'paragraph',
      text: 'No ID here',
    };
    const normalized2 = normalizeBlock(blockWithoutId);
    expect(normalized2.id).toBeDefined();
    expect(normalized2.id.startsWith('blk-')).toBe(true);
    
    // Check that ID remains stable upon re-normalization
    const firstId = normalized2.id;
    const normalized3 = normalizeBlock(normalized2);
    expect(normalized3.id).toBe(firstId);
  });

  // Test 3: Enabled/Disabled behavior
  it('3. should support enable/disable toggling cleanly', () => {
    const block: UniversalContentBlock = {
      id: 'b-1',
      type: 'paragraph',
      enabled: true,
      order: 0,
      content: { text: 'Paragraph' },
    };

    const disabled = toggleBlockEnabled(block, false);
    expect(disabled.enabled).toBe(false);

    const enabled = toggleBlockEnabled(disabled, true);
    expect(enabled.enabled).toBe(true);

    const toggled = toggleBlockEnabled(enabled); // toggles without second argument
    expect(toggled.enabled).toBe(false);
  });

  // Test 4: Ordering (Deterministic Ordering)
  it('4. should maintain deterministic ordering and sort correctly', () => {
    const list = [
      { id: 'blk-3', type: 'paragraph', order: 3 },
      { id: 'blk-1', type: 'heading', order: 1 },
      { id: 'blk-2', type: 'image', order: 2 },
    ];

    const normalizedList = normalizeBlocksList(list);
    
    expect(normalizedList[0].id).toBe('blk-1');
    expect(normalizedList[1].id).toBe('blk-2');
    expect(normalizedList[2].id).toBe('blk-3');

    // Test reorderBlocks helper
    const reordered = reorderBlocks(normalizedList, 'blk-1', 'blk-2');
    // blk-1 was at index 0, blk-2 at index 1. Moving blk-1 over blk-2 moves it after blk-2
    expect(reordered[0].id).toBe('blk-2');
    expect(reordered[1].id).toBe('blk-1');
    expect(reordered[2].id).toBe('blk-3');

    // Verify orders are deterministic continuous integers
    expect(reordered[0].order).toBe(0);
    expect(reordered[1].order).toBe(1);
    expect(reordered[2].order).toBe(2);
  });

  // Test 5: Duplication creates a new ID
  it('5. should duplicate a block with a NEW independent ID and independent content reference', () => {
    const original: UniversalContentBlock = {
      id: 'blk-orig',
      type: 'cta',
      enabled: true,
      order: 1,
      content: { label: 'Click', href: '/tools' },
      settings: { style: 'bold' },
    };

    const copy = duplicateBlock(original);

    expect(copy.id).not.toBe(original.id);
    expect(copy.id.startsWith('blk-')).toBe(true);
    expect(copy.type).toBe(original.type);
    expect(copy.content.label).toBe('Click');

    // Make sure they are independent object references
    copy.content.label = 'Changed';
    expect(original.content.label).toBe('Click'); // unchanged original!
  });

  // Test 6 & 7: Clipboard Copy/Paste
  it('6 & 7. should serialize for copy and deserialize/paste with a new ID', () => {
    const block: UniversalContentBlock = {
      id: 'blk-source',
      type: 'rich_text',
      enabled: true,
      order: 2,
      content: { html: '<p>HTML</p>' },
      settings: { cols: 2 },
    };

    const serialized = serializeBlockForClipboard(block);
    expect(serialized).toContain('convert24/cms-block');
    expect(serialized).toContain('rich_text');

    const pasted = deserializeAndPasteBlock(serialized, 5);
    
    expect(pasted).not.toBeNull();
    expect(pasted!.id).not.toBe(block.id);
    expect(pasted!.order).toBe(5);
    expect(pasted!.type).toBe('rich_text');
    expect(pasted!.content.html).toBe('<p>HTML</p>');

    // Check independent reference
    pasted!.content.html = '<p>Changed</p>';
    expect(block.content.html).toBe('<p>HTML</p>');
  });

  // Test 9: Invalid/Unknown block handling
  it('9. should handle invalid or unknown blocks gracefully without crashing or losing content', () => {
    // 1. null block
    const nullBlock = normalizeBlock(null);
    expect(nullBlock).toBeDefined();
    expect(nullBlock.type).toBe('paragraph');

    // 2. Unknown block type should fallback to paragraph but keep extraneous fields in content
    const unknownBlock = {
      id: 'blk-weird',
      type: 'super-unsupported-carousel',
      somethingCustom: 'preserved-value',
    };

    const normalized = normalizeBlock(unknownBlock);
    expect(normalized.type).toBe('paragraph'); // default fallback
    expect(normalized.content.somethingCustom).toBe('preserved-value'); // preserved content!
    expect(normalized.somethingCustom).toBe('preserved-value'); // additive backward-compatibility root property!
  });

  // Test validateAndSanitizeBlock integration
  it('should validate and sanitize universal content blocks safely through validateAndSanitizeBlock', () => {
    // HTML Sanitization
    const blockWithScript = {
      type: 'rich_text',
      content: { html: 'Hello <script>alert(1)</script>' },
    };
    const result1 = validateAndSanitizeBlock(blockWithScript);
    expect(result1.isValid).toBe(true);
    expect(result1.block.content.html).toBe('Hello ');
    expect(result1.block.html).toBe('Hello '); // root mapping

    // Unsafe URL check
    const blockWithUnsafeUrl = {
      type: 'cta',
      content: { label: 'Click Me', href: 'javascript:alert(1)' },
    };
    const result2 = validateAndSanitizeBlock(blockWithUnsafeUrl);
    expect(result2.isValid).toBe(false);
    expect(result2.error).toContain('Unsafe URL');
  });
});
