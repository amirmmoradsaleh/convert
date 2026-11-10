export type ContentBlockType =
  | 'hero'
  | 'section'
  | 'heading'
  | 'paragraph'
  | 'rich_text'
  | 'image'
  | 'link'
  | 'cta'
  | 'feature'
  | 'features'
  | 'how_to_use'
  | 'how_to'
  | 'related_tools'
  | 'benefits_trust'
  | 'intro'
  | 'faq'
  | 'tool_ref'
  | 'cards'
  | 'privacy_note'
  | 'use_cases'
  | 'supported_formats'
  | 'technical_details'
  | 'popular_tools'
  | 'hubs'
  | 'pricing'
  | 'spacer'
  | 'custom_html'
  | 'container';

import {
  MAX_CONTAINER_DEPTH,
  isSupportedContainerChildType,
  sanitizeContainerSettings,
  DEFAULT_CONTAINER_SETTINGS,
  type ContainerBlockSettings,
} from './container-contract';

export interface UniversalContentBlock {
  id: string;
  type: ContentBlockType;
  enabled: boolean;
  order: number;
  content: Record<string, any>;
  settings?: Record<string, any>;
  // Additive root keys for backward compatibility with legacy rendering engines
  [key: string]: any;
}

export interface ContentBlockClipboard {
  version: number;
  block: UniversalContentBlock;
}

/**
 * Safely normalizes any legacy or arbitrary block shape into the stable UniversalContentBlock structure.
 * Standardizes content under block.content while copying content keys to the root for complete backward compatibility.
 */
export function normalizeBlock(block: any, defaultOrder = 0, currentDepth = 0): UniversalContentBlock {
  if (!block || typeof block !== 'object') {
    return {
      id: `blk-${Math.random().toString(36).substring(2, 9)}`,
      type: 'paragraph',
      enabled: false,
      order: defaultOrder,
      content: { text: '' },
      settings: {},
      text: '',
    };
  }

  const id = block.id || `blk-${Math.random().toString(36).substring(2, 9)}`;
  
  let type: ContentBlockType;
  const rawType = String(block.type || 'paragraph').toLowerCase();

  const validTypes: ContentBlockType[] = [
    'hero',
    'section',
    'heading',
    'paragraph',
    'rich_text',
    'image',
    'link',
    'cta',
    'feature',
    'features',
    'how_to_use',
    'how_to',
    'related_tools',
    'benefits_trust',
    'intro',
    'faq',
    'tool_ref',
    'cards',
    'privacy_note',
    'use_cases',
    'supported_formats',
    'technical_details',
    'popular_tools',
    'hubs',
    'pricing',
    'spacer',
    'custom_html',
    'container',
  ];

  if (validTypes.includes(rawType as any)) {
    type = rawType as ContentBlockType;
  } else if (rawType === 'button') {
    type = 'cta';
  } else if (rawType === 'formats' || rawType === 'format_support') {
    type = 'supported_formats';
  } else if (rawType === 'tech_specs' || rawType === 'technical_specs' || rawType === 'limitations') {
    type = 'technical_details';
  } else if (rawType === 'html' || rawType === 'customhtml' || rawType === 'embed_html') {
    type = 'custom_html';
  } else if (rawType === 'box' || rawType === 'wrapper' || rawType === 'group') {
    type = 'container';
  } else {
    // Graceful handling of unknown types
    type = 'paragraph';
  }

  const enabled = typeof block.enabled === 'boolean' ? block.enabled : true;
  const order = typeof block.order === 'number' ? block.order : defaultOrder;
  let settings = block.settings && typeof block.settings === 'object' ? { ...block.settings } : {};

  // Build the content payload
  let content: Record<string, any> = {};
  if (block.content && typeof block.content === 'object' && !Array.isArray(block.content)) {
    content = { ...block.content };
    // Merge any root or data properties that might be absent from block.content
    const rootOrData = block.data && typeof block.data === 'object' ? { ...block.data, ...block } : { ...block };
    const ignoreRootKeys = ['id', 'type', 'enabled', 'order', 'settings', 'content', 'data'];
    for (const [key, val] of Object.entries(rootOrData)) {
      if (!ignoreRootKeys.includes(key) && content[key] === undefined && val !== undefined) {
        content[key] = val;
      }
    }
  } else {
    // Extract legacy fields from the root or data field
    const rootOrData = block.data && typeof block.data === 'object' ? { ...block.data, ...block } : { ...block };
    
    if (type === 'heading') {
      content.level = typeof rootOrData.level === 'number' ? rootOrData.level : 2;
      content.text = String(rootOrData.text || '').trim();
    } else if (type === 'paragraph' && rawType === 'paragraph') {
      content.text = String(rootOrData.text || '').trim();
    } else if (type === 'rich_text') {
      content.html = String(rootOrData.html || '').trim();
    } else if (type === 'custom_html') {
      content.html = String(rootOrData.html || '').trim();
      if (rootOrData.css) content.css = String(rootOrData.css).trim();
      if (rootOrData.caption) content.caption = String(rootOrData.caption).trim();
    } else if (type === 'cta') {
      content.title = rootOrData.title ? String(rootOrData.title).trim() : undefined;
      content.description = rootOrData.description ? String(rootOrData.description).trim() : undefined;
      const btnText = String(rootOrData.buttonText || rootOrData.label || rootOrData.text || '').trim();
      content.buttonText = btnText;
      content.label = btnText;
      content.href = String(rootOrData.href || '').trim() || '#';
      content.variant = String(rootOrData.variant || 'primary').trim();
      if (rootOrData.secondaryLabel) content.secondaryLabel = String(rootOrData.secondaryLabel).trim();
      if (rootOrData.secondaryHref) content.secondaryHref = String(rootOrData.secondaryHref).trim();
    } else if (type === 'link') {
      content.text = String(rootOrData.text || '').trim();
      content.href = String(rootOrData.href || '').trim() || '#';
      content.isExternal = Boolean(rootOrData.isExternal);
    } else if (type === 'feature') {
      content.title = String(rootOrData.title || '').trim();
      content.description = String(rootOrData.description || '').trim();
      content.icon = rootOrData.icon ? String(rootOrData.icon).trim() : undefined;
    } else if (type === 'features') {
      content.heading = String(rootOrData.heading || '').trim();
      content.subheading = String(rootOrData.subheading || rootOrData.description || '').trim();
      content.description = content.subheading;
      content.items = Array.isArray(rootOrData.items) ? rootOrData.items : [];
    } else if (type === 'how_to_use' || type === 'how_to') {
      content.heading = String(rootOrData.heading || '').trim();
      content.description = String(rootOrData.description || '').trim();
      content.items = Array.isArray(rootOrData.items) ? rootOrData.items : [];
    } else if (type === 'faq') {
      if (rootOrData.heading) content.heading = String(rootOrData.heading).trim();
      if (Array.isArray(rootOrData.items)) {
        content.items = rootOrData.items;
      } else {
        content.question = String(rootOrData.question || '').trim();
        content.answer = String(rootOrData.answer || '').trim();
      }
    } else if (type === 'image') {
      content.src = String(rootOrData.src || '').trim();
      content.alt = String(rootOrData.alt || '').trim();
      content.caption = rootOrData.caption ? String(rootOrData.caption).trim() : undefined;
    } else if (type === 'section') {
      content.title = String(rootOrData.title || '').trim();
      content.description = rootOrData.description ? String(rootOrData.description).trim() : undefined;
    } else if (type === 'intro') {
      content.heading = String(rootOrData.heading || '').trim();
      content.text = String(rootOrData.text || '').trim();
      if (rootOrData.html) content.html = String(rootOrData.html).trim();
    } else if (type === 'privacy_note') {
      content.title = String(rootOrData.title || '').trim();
      content.description = String(rootOrData.description || '').trim();
      content.bullets = Array.isArray(rootOrData.bullets) ? rootOrData.bullets : [];
    } else if (type === 'use_cases') {
      content.heading = String(rootOrData.heading || '').trim();
      content.description = rootOrData.description ? String(rootOrData.description).trim() : undefined;
      content.items = Array.isArray(rootOrData.items) ? rootOrData.items : [];
    } else if (type === 'supported_formats') {
      content.heading = String(rootOrData.heading || '').trim();
      content.description = String(rootOrData.description || '').trim();
      content.inputFormats = Array.isArray(rootOrData.inputFormats) ? rootOrData.inputFormats : [];
      content.outputFormats = Array.isArray(rootOrData.outputFormats) ? rootOrData.outputFormats : [];
      content.notes = rootOrData.notes ? String(rootOrData.notes).trim() : undefined;
    } else if (type === 'technical_details') {
      content.heading = String(rootOrData.heading || '').trim();
      content.description = String(rootOrData.description || '').trim();
      content.specs = Array.isArray(rootOrData.specs) ? rootOrData.specs : [];
      content.limitations = Array.isArray(rootOrData.limitations) ? rootOrData.limitations : [];
    } else if (type === 'benefits_trust') {
      content.items = Array.isArray(rootOrData.items) ? rootOrData.items : [];
    } else if (type === 'spacer') {
      content.height = typeof rootOrData.height === 'number' ? rootOrData.height : 24;
    } else if (type === 'pricing') {
      content.badge = rootOrData.badge ? String(rootOrData.badge).trim() : undefined;
      content.title = String(rootOrData.title || '').trim();
      content.description = String(rootOrData.description || '').trim();
      content.planName = String(rootOrData.planName || 'Standard plan').trim();
      content.price = String(rootOrData.price || '$0').trim();
      content.period = String(rootOrData.period || '/ forever').trim();
      content.items = Array.isArray(rootOrData.items) ? rootOrData.items : [];
      content.buttonText = String(rootOrData.buttonText || '').trim();
      content.buttonHref = String(rootOrData.buttonHref || '#explore-hubs').trim();
    } else if (type === 'popular_tools') {
      content.heading = String(rootOrData.heading || 'Popular tools').trim();
      content.subheading = String(rootOrData.subheading || '').trim();
      content.exploreText = String(rootOrData.exploreText || 'Explore all tools').trim();
      content.exploreHref = String(rootOrData.exploreHref || '#explore-hubs').trim();
    } else if (type === 'hubs') {
      content.heading = String(rootOrData.heading || 'Explore all tools').trim();
      content.subheading = String(rootOrData.subheading || '').trim();
      content.imageHubTitle = String(rootOrData.imageHubTitle || '').trim();
      content.imageHubDescription = String(rootOrData.imageHubDescription || '').trim();
      content.imageHubButton = String(rootOrData.imageHubButton || '').trim();
      content.imageHubHref = String(rootOrData.imageHubHref || '').trim();
      content.pdfHubTitle = String(rootOrData.pdfHubTitle || '').trim();
      content.pdfHubDescription = String(rootOrData.pdfHubDescription || '').trim();
      content.pdfHubButton = String(rootOrData.pdfHubButton || '').trim();
      content.pdfHubHref = String(rootOrData.pdfHubHref || '').trim();
    } else if (type === 'related_tools') {
      content.heading = String(rootOrData.heading || 'Related Tools').trim();
      content.slugs = Array.isArray(rootOrData.slugs) ? rootOrData.slugs : [];
    } else {
      // General fallback copy of root fields
      const ignoreKeys = ['id', 'type', 'enabled', 'order', 'settings', 'content', 'data'];
      for (const [key, value] of Object.entries(rootOrData)) {
        if (!ignoreKeys.includes(key)) {
          content[key] = value;
        }
      }
    }
  }

  if (type === 'container') {
    const rawSettings = block.settings || content.settings || {};
    const sanitizedSettings = sanitizeContainerSettings(rawSettings);
    settings = sanitizedSettings;
    content.settings = sanitizedSettings;

    const rawChildBlocks = Array.isArray(content.blocks)
      ? content.blocks
      : Array.isArray(content.children)
      ? content.children
      : Array.isArray(block.blocks)
      ? block.blocks
      : Array.isArray(block.children)
      ? block.children
      : [];

    const normalizedChildBlocks: UniversalContentBlock[] = [];
    if (currentDepth < MAX_CONTAINER_DEPTH) {
      for (let i = 0; i < rawChildBlocks.length; i++) {
        const child = rawChildBlocks[i];
        if (child && typeof child === 'object') {
          const childType = String(child.type || '').toLowerCase();
          const support = isSupportedContainerChildType(childType, currentDepth + 1);
          if (support.supported) {
            normalizedChildBlocks.push(normalizeBlock(child, i, currentDepth + 1));
          }
        }
      }
    }
    content.blocks = normalizedChildBlocks;
  }

  // Create the base normalized structure
  const normalized: UniversalContentBlock = {
    id,
    type,
    enabled,
    order,
    content,
    settings,
  };

  // Additive compatibility mapping: populate root fields from content
  for (const [key, value] of Object.entries(content)) {
    normalized[key] = value;
  }

  if (type === 'container') {
    normalized.settings = content.settings || settings;
    normalized.blocks = content.blocks || [];
    normalized.children = content.blocks || [];
  }

  return normalized;
}

/**
 * Normalizes an array of arbitrary blocks, filters out invalid ones, and enforces deterministic ordering.
 */
export function normalizeBlocksList(blocks: any[] | null | undefined): UniversalContentBlock[] {
  if (!Array.isArray(blocks)) return [];
  
  return blocks
    .map((b, idx) => normalizeBlock(b, idx))
    .sort((a, b) => a.order - b.order);
}

/**
 * Enables or disables a block.
 */
export function toggleBlockEnabled(block: UniversalContentBlock, enabled?: boolean): UniversalContentBlock {
  const nextEnabled = typeof enabled === 'boolean' ? enabled : !block.enabled;
  return {
    ...block,
    enabled: nextEnabled,
  };
}

/**
 * Deletes a block from a block list.
 */
export function deleteBlock(blocks: UniversalContentBlock[], blockId: string): UniversalContentBlock[] {
  return blocks.filter((b) => b.id !== blockId);
}

/**
 * Reorders blocks deterministically based on active/over drop targets.
 */
export function reorderBlocks(blocks: UniversalContentBlock[], activeId: string, overId: string): UniversalContentBlock[] {
  const oldIndex = blocks.findIndex((b) => b.id === activeId);
  const newIndex = blocks.findIndex((b) => b.id === overId);
  if (oldIndex === -1 || newIndex === -1) return blocks;

  const result = [...blocks];
  const [removed] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, removed);

  return result.map((b, idx) => ({
    ...b,
    order: idx,
  }));
}

/**
 * Duplicates a block. Creates a NEW block with a fresh ID and deep-cloned independent content/settings.
 * For container blocks, recursively duplicates all child blocks to ensure fresh IDs for descendants.
 */
export function duplicateBlock(block: UniversalContentBlock): UniversalContentBlock {
  const newId = `blk-${Math.random().toString(36).substring(2, 9)}`;
  const contentCopy = JSON.parse(JSON.stringify(block.content || {}));
  const settingsCopy = JSON.parse(JSON.stringify(block.settings || {}));

  // If container, recursively duplicate all child blocks to ensure fresh IDs
  if (block.type === 'container' && Array.isArray(contentCopy.blocks)) {
    contentCopy.blocks = contentCopy.blocks.map((child: UniversalContentBlock) => duplicateBlock(child));
  }

  const duplicated: UniversalContentBlock = {
    ...block,
    id: newId,
    content: contentCopy,
    settings: settingsCopy,
  };

  // Additive compatibility mapping: populate root fields from duplicated content
  for (const [key, value] of Object.entries(contentCopy)) {
    duplicated[key] = value;
  }

  if (duplicated.type === 'container') {
    duplicated.blocks = contentCopy.blocks;
    duplicated.children = contentCopy.blocks;
  }

  return duplicated;
}

/**
 * Recursively searches for a block by id in a block tree.
 * Returns the path from root block to the target block: [root, ..., target].
 * If not found, returns an empty array.
 */
export function findBlockPath(
  blocks: UniversalContentBlock[],
  id: string
): UniversalContentBlock[] {
  if (!Array.isArray(blocks) || !id) return [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.id === id) {
      return [block];
    }
    if (block.type === 'container') {
      const childBlocks = Array.isArray(block.content?.blocks)
        ? block.content.blocks
        : Array.isArray(block.blocks)
        ? block.blocks
        : [];
      const subPath = findBlockPath(childBlocks, id);
      if (subPath.length > 0) {
        return [block, ...subPath];
      }
    }
  }

  return [];
}

/**
 * Recursively finds a block by ID in a block tree (including nested container children).
 */
export function findBlockById(
  blocks: UniversalContentBlock[],
  id: string | null | undefined
): UniversalContentBlock | null {
  if (!id) return null;
  const path = findBlockPath(blocks, id);
  return path.length > 0 ? path[path.length - 1] : null;
}

/**
 * Finds the direct parent container block for a given block ID, if nested.
 */
export function findParentBlock(
  blocks: UniversalContentBlock[],
  childId: string | null | undefined
): UniversalContentBlock | null {
  if (!childId) return null;
  const path = findBlockPath(blocks, childId);
  return path.length > 1 ? path[path.length - 2] : null;
}

/**
 * Recursively and immutably updates a block within a block tree.
 * Preserves all siblings and parent container settings.
 */
export function updateBlockInTree(
  blocks: UniversalContentBlock[],
  updatedBlock: UniversalContentBlock
): UniversalContentBlock[] {
  if (!Array.isArray(blocks) || !updatedBlock || !updatedBlock.id) {
    return blocks;
  }

  return blocks.map((block) => {
    if (block.id === updatedBlock.id) {
      return updatedBlock;
    }

    if (block.type === 'container') {
      const childBlocks = Array.isArray(block.content?.blocks)
        ? block.content.blocks
        : Array.isArray(block.blocks)
        ? block.blocks
        : [];

      if (childBlocks.length > 0) {
        const updatedChildren = updateBlockInTree(childBlocks, updatedBlock);
        const hasChange = updatedChildren.some((c, i) => c !== childBlocks[i]);
        if (hasChange) {
          const content = {
            ...(block.content || {}),
            blocks: updatedChildren,
          };
          return {
            ...block,
            content,
            blocks: updatedChildren,
            children: updatedChildren,
          };
        }
      }
    }

    return block;
  });
}

/**
 * Recursively and immutably removes a block by id from a block tree.
 * Preserves siblings and parent container settings.
 */
export function deleteBlockFromTree(
  blocks: UniversalContentBlock[],
  blockId: string
): UniversalContentBlock[] {
  if (!Array.isArray(blocks) || !blockId) {
    return blocks;
  }

  return blocks
    .filter((block) => block.id !== blockId)
    .map((block) => {
      if (block.type === 'container') {
        const childBlocks = Array.isArray(block.content?.blocks)
          ? block.content.blocks
          : Array.isArray(block.blocks)
          ? block.blocks
          : [];

        if (childBlocks.length > 0) {
          const updatedChildren = deleteBlockFromTree(childBlocks, blockId);
          if (
            updatedChildren.length !== childBlocks.length ||
            updatedChildren.some((c, i) => c !== childBlocks[i])
          ) {
            const content = {
              ...(block.content || {}),
              blocks: updatedChildren,
            };
            return {
              ...block,
              content,
              blocks: updatedChildren,
              children: updatedChildren,
            };
          }
        }
      }

      return block;
    });
}

// Re-export cross-page clipboard utilities from block-clipboard
export {
  BLOCK_CLIPBOARD_FORMAT,
  BLOCK_CLIPBOARD_VERSION,
  CLIPBOARD_STORAGE_KEY,
  CLIPBOARD_EVENT_NAME,
  type DestinationPageType,
  type PortableBlockPayload,
  getBlockLabel,
  serializeBlockPayload,
  serializeBlockForClipboard,
  checkBlockDestinationCompatibility,
  deserializeBlockPayload,
  deserializeAndPasteBlock,
  copyBlockToClipboard,
  pasteBlockFromClipboard,
  getClipboardState,
  clearBlockClipboard,
} from './block-clipboard';

export {
  sanitizeCustomHtml,
  scopeAndSanitizeCss,
  extractStylesFromHtml,
} from '@/lib/admin/validation';

export * from './container-contract';

