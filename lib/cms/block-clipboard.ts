import {
  UniversalContentBlock,
  ContentBlockType,
  normalizeBlock,
  duplicateBlock,
} from './blocks';
import { validateAndSanitizeBlock } from '@/lib/admin/validation';

export const BLOCK_CLIPBOARD_FORMAT = 'convert24/cms-block';
export const BLOCK_CLIPBOARD_VERSION = 1;
export const CLIPBOARD_STORAGE_KEY = 'c24_cms_clipboard_block';
export const CLIPBOARD_EVENT_NAME = 'c24_block_clipboard_changed';

export type DestinationPageType = 'page' | 'home' | 'tool';

export interface PortableBlockPayload {
  format: typeof BLOCK_CLIPBOARD_FORMAT;
  version: number;
  type: ContentBlockType;
  content: Record<string, any>;
  settings?: Record<string, any>;
  metadata?: {
    copiedAt: string;
    sourceType?: string;
  };
}

/**
 * Returns a human-friendly label for any block type.
 */
export function getBlockLabel(type: string): string {
  switch (type) {
    case 'hero':
      return 'Hero';
    case 'intro':
      return 'Introduction';
    case 'how_to_use':
    case 'how_to':
      return 'How-To Steps';
    case 'features':
      return 'Features Grid';
    case 'feature':
      return 'Feature Card';
    case 'supported_formats':
      return 'Supported Formats';
    case 'technical_details':
      return 'Technical Specs';
    case 'privacy_note':
      return 'Privacy & Guarantee';
    case 'use_cases':
      return 'Use Cases';
    case 'faq':
      return 'FAQ';
    case 'related_tools':
      return 'Related Tools';
    case 'cta':
      return 'Call to Action';
    case 'pricing':
      return 'Pricing Table';
    case 'hubs':
      return 'Discovery Hubs';
    case 'popular_tools':
      return 'Popular Tools';
    case 'image':
      return 'Image & Media';
    case 'link':
      return 'Text Link';
    case 'heading':
      return 'Heading';
    case 'paragraph':
      return 'Paragraph';
    case 'rich_text':
      return 'Rich Text';
    case 'custom_html':
      return 'Custom HTML';
    case 'section':
      return 'Section Container';
    case 'container':
      return 'Container';
    case 'spacer':
      return 'Spacer';
    default:
      return type.replace(/_/g, ' ');
  }
}

/**
 * Recursively strips database and audit IDs from nested child blocks.
 */
function recursivelyCleanChildBlocks(children: any[]): any[] {
  if (!Array.isArray(children)) return [];
  return children.map((c) => {
    if (!c || typeof c !== 'object') return c;
    const copy = JSON.parse(JSON.stringify(c));
    delete copy.id;
    delete copy.pageId;
    delete copy.authorId;
    delete copy.revisionId;
    delete copy.createdAt;
    delete copy.updatedAt;
    if (copy.content && typeof copy.content === 'object') {
      delete copy.content.id;
      delete copy.content.pageId;
      delete copy.content.authorId;
      delete copy.content.revisionId;
      delete copy.content.createdAt;
      delete copy.content.updatedAt;
      if (Array.isArray(copy.content.blocks)) {
        copy.content.blocks = recursivelyCleanChildBlocks(copy.content.blocks);
      }
    }
    if (Array.isArray(copy.blocks)) {
      copy.blocks = recursivelyCleanChildBlocks(copy.blocks);
    }
    return copy;
  });
}

/**
 * Serializes a block into a portable, versioned payload.
 * Strips database IDs, page IDs, author IDs, and destination-specific metadata.
 */
export function serializeBlockPayload(block: UniversalContentBlock): PortableBlockPayload {
  const normalized = normalizeBlock(block);

  // Deep clone content and settings to sever any references
  const cleanContent = JSON.parse(JSON.stringify(normalized.content || {}));
  const cleanSettings = JSON.parse(JSON.stringify(normalized.settings || {}));

  // Ensure any transient or destination-specific identifiers are removed
  delete cleanContent.id;
  delete cleanContent.pageId;
  delete cleanContent.authorId;
  delete cleanContent.revisionId;
  delete cleanContent.createdAt;
  delete cleanContent.updatedAt;

  if (normalized.type === 'container' && Array.isArray(cleanContent.blocks)) {
    cleanContent.blocks = recursivelyCleanChildBlocks(cleanContent.blocks);
  }

  return {
    format: BLOCK_CLIPBOARD_FORMAT,
    version: BLOCK_CLIPBOARD_VERSION,
    type: normalized.type,
    content: cleanContent,
    settings: cleanSettings,
    metadata: {
      copiedAt: new Date().toISOString(),
      sourceType: normalized.type,
    },
  };
}

/**
 * Serializes a block to a JSON string for transfer.
 */
export function serializeBlockForClipboard(block: UniversalContentBlock): string {
  return JSON.stringify(serializeBlockPayload(block), null, 2);
}

/**
 * Validates destination compatibility for a given block type.
 */
export function checkBlockDestinationCompatibility(
  blockType: string,
  destination: DestinationPageType
): { compatible: boolean; reason?: string } {
  const type = String(blockType).toLowerCase();

  if (destination === 'tool') {
    if (type === 'popular_tools' || type === 'hubs') {
      return {
        compatible: false,
        reason: 'Discovery hubs and popular tools blocks are specific to the homepage tool directory.',
      };
    }
    if (type === 'pricing') {
      return {
        compatible: false,
        reason: 'Pricing blocks cannot be pasted into tool pages as tool pages do not support pricing tables.',
      };
    }
  }

  if (destination === 'page') {
    if (type === 'popular_tools' || type === 'hubs') {
      return {
        compatible: false,
        reason: 'Discovery hubs and popular tools blocks are specific to the homepage tool directory.',
      };
    }
  }

  if (destination === 'home') {
    if (type === 'hero') {
      return {
        compatible: false,
        reason: 'The homepage already contains a primary Hero section at the top.',
      };
    }
  }

  return { compatible: true };
}

/**
 * Deserializes an untrusted clipboard payload into an independent UniversalContentBlock with a fresh ID.
 * Applies schema normalization, destination compatibility checks, and security sanitization.
 */
export function deserializeBlockPayload(
  rawPayload: any,
  destination?: DestinationPageType,
  currentBlocksCount = 0
): { success: boolean; block?: UniversalContentBlock; error?: string } {
  try {
    let payload = rawPayload;
    if (typeof payload === 'string') {
      payload = JSON.parse(payload);
    }

    if (!payload || typeof payload !== 'object') {
      return { success: false, error: 'Clipboard payload is empty or not a valid object.' };
    }

    // Check payload format and version
    const isStandardFormat = payload.format === BLOCK_CLIPBOARD_FORMAT;
    const isLegacyFormat = payload.version === 1 && Boolean(payload.block);

    if (!isStandardFormat && !isLegacyFormat) {
      return {
        success: false,
        error: 'Unrecognized clipboard format. Please copy a valid Convert24 CMS block.',
      };
    }

    if (payload.version !== BLOCK_CLIPBOARD_VERSION) {
      return {
        success: false,
        error: `Unsupported clipboard payload version (${payload.version}). Expected version ${BLOCK_CLIPBOARD_VERSION}.`,
      };
    }

    // Extract block type, content, and settings
    let type: ContentBlockType;
    let content: Record<string, any>;
    let settings: Record<string, any>;

    if (isStandardFormat) {
      type = payload.type;
      content = payload.content || {};
      settings = payload.settings || {};
    } else {
      type = payload.block.type;
      content = payload.block.content || {};
      settings = payload.block.settings || {};
    }

    if (!type) {
      return { success: false, error: 'Block type is missing from clipboard payload.' };
    }

    // Check destination compatibility
    if (destination) {
      const compat = checkBlockDestinationCompatibility(type, destination);
      if (!compat.compatible) {
        return { success: false, error: compat.reason || 'Block is incompatible with this page type.' };
      }
    }

    // Generate a fresh unique block ID (never reuse source ID)
    const newId = `blk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    // Create a deep copy of content and settings
    const clonedContent = JSON.parse(JSON.stringify(content));
    const clonedSettings = JSON.parse(JSON.stringify(settings));

    // For container blocks, recursively assign fresh IDs to all nested child blocks
    function recursivelyAssignFreshIds(children: any[]): any[] {
      if (!Array.isArray(children)) return [];
      return children.map((c, idx) => {
        if (!c || typeof c !== 'object') return c;
        const copy = JSON.parse(JSON.stringify(c));
        copy.id = `blk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}-${idx}`;
        copy.order = idx;
        if (copy.content && typeof copy.content === 'object') {
          copy.content.id = copy.id;
          if (Array.isArray(copy.content.blocks)) {
            copy.content.blocks = recursivelyAssignFreshIds(copy.content.blocks);
          }
        }
        if (Array.isArray(copy.blocks)) {
          copy.blocks = copy.content?.blocks || recursivelyAssignFreshIds(copy.blocks);
        }
        if (copy.type === 'container') {
          copy.blocks = copy.content?.blocks || [];
          copy.children = copy.content?.blocks || [];
        }
        return copy;
      });
    }

    if (type === 'container' && Array.isArray(clonedContent.blocks)) {
      clonedContent.blocks = recursivelyAssignFreshIds(clonedContent.blocks);
    }

    // Construct candidate block
    const candidateBlock: UniversalContentBlock = {
      id: newId,
      type,
      enabled: true,
      order: currentBlocksCount,
      content: clonedContent,
      settings: clonedSettings,
    };

    // Mirror cloned content keys to root for backward-compatibility
    for (const [key, value] of Object.entries(clonedContent)) {
      candidateBlock[key] = value;
    }

    if (type === 'container') {
      candidateBlock.blocks = clonedContent.blocks;
      candidateBlock.children = clonedContent.blocks;
    }

    // Validate and sanitize content (URL safety, rich text sanitization)
    const validationResult = validateAndSanitizeBlock(candidateBlock);
    if (!validationResult.isValid || !validationResult.block) {
      return {
        success: false,
        error: validationResult.error || 'Pasted block content failed security validation.',
      };
    }

    return {
      success: true,
      block: validationResult.block,
    };
  } catch {
    return {
      success: false,
      error: 'Failed to parse clipboard data. Data may be corrupted.',
    };
  }
}

/**
 * Copies a block to the clipboard.
 * Writes to sessionStorage (for guaranteed in-session cross-page persistence without permissions)
 * and attempts system clipboard write via navigator.clipboard (if permitted).
 */
export async function copyBlockToClipboard(
  block: UniversalContentBlock
): Promise<{ success: boolean; message: string }> {
  try {
    const payloadStr = serializeBlockForClipboard(block);
    const label = getBlockLabel(block.type);

    // 1. In-editor fallback storage (guaranteed to work across pages in the same session without permissions)
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, payloadStr);
      window.dispatchEvent(
        new CustomEvent(CLIPBOARD_EVENT_NAME, {
          detail: { type: block.type, label },
        })
      );
    }

    // 2. Best-effort system clipboard write (requires browser permission)
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(payloadStr);
      } catch {
        // System clipboard write may fail if document is not focused; sessionStorage guarantees in-editor transfer
      }
    }

    return {
      success: true,
      message: `"${label}" block copied. You can paste it into any supported page.`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to copy block: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * Pastes a block from the clipboard into the current destination.
 * Checks system clipboard first, falling back to in-editor sessionStorage if access is denied or empty.
 */
export async function pasteBlockFromClipboard(
  destination: DestinationPageType,
  currentBlocksCount = 0
): Promise<{ success: boolean; block?: UniversalContentBlock; error?: string }> {
  let payloadStr: string | null = null;

  // 1. Try reading from system clipboard if available
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.includes(BLOCK_CLIPBOARD_FORMAT)) {
        payloadStr = text;
      }
    } catch {
      // Permission denied or not allowed; fall back to in-editor sessionStorage
    }
  }

  // 2. In-editor fallback: read from sessionStorage
  if (!payloadStr && typeof window !== 'undefined' && window.sessionStorage) {
    payloadStr = window.sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
  }

  if (!payloadStr) {
    return {
      success: false,
      error: 'Clipboard is empty. Copy a block first.',
    };
  }

  return deserializeBlockPayload(payloadStr, destination, currentBlocksCount);
}

/**
 * Synchronously checks if a block is currently stored in the in-editor clipboard.
 */
export function getClipboardState(): {
  hasContent: boolean;
  type?: ContentBlockType;
  label?: string;
} {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { hasContent: false };
  }

  try {
    const raw = window.sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
    if (!raw) return { hasContent: false };

    const parsed = JSON.parse(raw);
    const type = parsed.type || parsed.block?.type;
    if (!type) return { hasContent: false };

    return {
      hasContent: true,
      type,
      label: getBlockLabel(type),
    };
  } catch {
    return { hasContent: false };
  }
}

/**
 * Clears the in-editor clipboard storage.
 */
export function clearBlockClipboard(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(CLIPBOARD_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT_NAME, { detail: null }));
  }
}

/**
 * Convenience helper to deserialize clipboard string and return block or null.
 */
export function deserializeAndPasteBlock(
  clipboardStr: string,
  currentBlocksCount = 0
): UniversalContentBlock | null {
  const result = deserializeBlockPayload(clipboardStr, undefined, currentBlocksCount);
  return result.success && result.block ? result.block : null;
}
