import { ToolDefinition, getToolBySlug, getAllTools } from '@/lib/tools';
import {
  ContentBlockType,
  UniversalContentBlock,
  normalizeBlock,
} from './blocks';
import { sanitizeRichTextHtml, isSafeUrl } from '@/lib/admin/validation';

/**
 * Convert24 — Phase 3: Tool Content Contract
 * Versionable, typed specification for tool landing page content.
 */
export const TOOL_CONTENT_CONTRACT_VERSION = '1.0.0';

/**
 * The 9 canonical semantic sections required on every tool landing page.
 */
export const TOOL_SEMANTIC_SECTIONS = [
  'intro',
  'how_to_use',
  'features',
  'supported_formats',
  'use_cases',
  'technical_details',
  'privacy_note',
  'faq',
  'related_tools',
] as const;

export type ToolSemanticSection = (typeof TOOL_SEMANTIC_SECTIONS)[number];

/**
 * Deterministic layout order for tool landing page blocks.
 * Conversion UI executes between hero/benefits and intro.
 */
export const CANONICAL_TOOL_BLOCK_ORDER: Record<string, number> = {
  hero: 0,
  benefits_trust: 1,
  intro: 2,
  how_to_use: 3,
  how_to: 3,
  supported_formats: 4,
  features: 5,
  technical_details: 6,
  privacy_note: 7,
  use_cases: 8,
  faq: 9,
  related_tools: 10,
  cta: 11,
};

// 1. Introduction Contract
export interface ToolIntroContent {
  heading?: string;
  text?: string;
  html?: string;
}

// 2. How-To Instructions Contract
export interface ToolHowToStep {
  id?: string;
  title: string;
  description: string;
  enabled?: boolean;
}

export interface ToolHowToContent {
  heading?: string;
  description?: string;
  items: ToolHowToStep[];
}

// 3. Features Contract
export interface ToolFeatureItem {
  id?: string;
  title: string;
  description: string;
  icon?: string;
  enabled?: boolean;
}

export interface ToolFeaturesContent {
  heading?: string;
  description?: string;
  items: ToolFeatureItem[];
}

// 4. Supported Formats Contract
export interface ToolSupportedFormatsContent {
  heading?: string;
  description?: string;
  inputFormats: string[];
  outputFormats: string[];
  notes?: string;
}

// 5. Use Cases Contract
export interface ToolUseCaseItem {
  id?: string;
  title: string;
  description: string;
  icon?: string;
  enabled?: boolean;
}

export interface ToolUseCasesContent {
  heading?: string;
  description?: string;
  items: ToolUseCaseItem[];
}

// 6. Technical Details & Limitations Contract
export interface ToolTechnicalSpec {
  label: string;
  value: string;
  notes?: string;
}

export interface ToolTechnicalDetailsContent {
  heading?: string;
  description?: string;
  specs: ToolTechnicalSpec[];
  limitations?: string[];
}

// 7. Privacy & Processing Information Contract
export interface ToolPrivacyContent {
  title?: string;
  description?: string;
  bullets?: string[];
  guaranteeBadge?: string;
}

// 8. FAQ Contract
export interface ToolFaqItem {
  id?: string;
  question: string;
  answer: string;
  enabled?: boolean;
}

export interface ToolFaqContent {
  heading?: string;
  items: ToolFaqItem[];
}

// 9. Related Tools Contract
export interface ToolRelatedToolsContent {
  heading?: string;
  slugs: string[];
}

/**
 * Result of validating a tool content block against its contract.
 */
export interface BlockValidationResult<T = Record<string, any>> {
  valid: boolean;
  sanitizedContent: T;
  errors: string[];
}

/**
 * Strips script tags, trims strings, and removes potential XSS payloads.
 */
function cleanString(val: unknown, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
}

/**
 * Validates and sanitizes Section 1: Introduction block.
 */
export function validateToolIntroBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolIntroContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(
    raw.heading,
    canonicalTool ? `About ${canonicalTool.name}` : 'About This Tool'
  );
  const text = cleanString(raw.text, canonicalTool?.intro || '');
  const html = raw.html ? sanitizeRichTextHtml(String(raw.html)) : undefined;

  if (!text && !html) {
    errors.push('Intro block must contain non-empty text or html content.');
  }

  return {
    valid: errors.length === 0,
    sanitizedContent: {
      heading,
      text: text || undefined,
      html: html || undefined,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 2: How-to Instructions block.
 */
export function validateToolHowToBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolHowToContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(
    raw.heading,
    canonicalTool ? `How to Use ${canonicalTool.name}` : 'How to Use This Tool'
  );
  const description = cleanString(
    raw.description,
    'Follow these simple steps to process your files directly in your browser.'
  );

  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.steps)
    ? raw.steps
    : canonicalTool?.howTo || [];

  const items: ToolHowToStep[] = rawItems
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any, idx: number) => ({
      id: cleanString(item.id, `itm-how-${idx + 1}`),
      title: cleanString(item.title, `Step ${idx + 1}`),
      description: cleanString(item.description, ''),
      enabled: item.enabled !== false,
    }))
    .filter((step: ToolHowToStep) => step.title.length > 0 && step.description.length > 0);

  if (items.length === 0) {
    errors.push('How-to block must contain at least one valid step with title and description.');
  }

  return {
    valid: errors.length === 0,
    sanitizedContent: {
      heading,
      description,
      items,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 3: Features block.
 */
export function validateToolFeaturesBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolFeaturesContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(
    raw.heading,
    canonicalTool ? `Key Features of ${canonicalTool.name}` : 'Key Features'
  );
  const description = cleanString(
    raw.description,
    'Engineered for speed, privacy, and seamless browser-based processing.'
  );

  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : canonicalTool?.features || [];

  const items: ToolFeatureItem[] = rawItems
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any, idx: number) => ({
      id: cleanString(item.id, `itm-feat-${idx + 1}`),
      title: cleanString(item.title, `Feature ${idx + 1}`),
      description: cleanString(item.description, ''),
      icon: cleanString(item.icon, 'Zap'),
      enabled: item.enabled !== false,
    }))
    .filter((feat: ToolFeatureItem) => feat.title.length > 0 && feat.description.length > 0);

  if (items.length === 0) {
    errors.push('Features block must contain at least one valid feature item.');
  }

  return {
    valid: errors.length === 0,
    sanitizedContent: {
      heading,
      description,
      items,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 4: Supported Input & Output Formats block.
 */
export function validateToolSupportedFormatsBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolSupportedFormatsContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(raw.heading, 'Supported File Formats');
  const description = cleanString(
    raw.description,
    'Review all compatible input formats and available target output specifications.'
  );

  const inputFormats: string[] = Array.isArray(raw.inputFormats)
    ? raw.inputFormats.map((f: any) => cleanString(f).toUpperCase()).filter(Boolean)
    : (canonicalTool?.inputFormats || []).map((f) => f.toUpperCase());

  const outputFormats: string[] = Array.isArray(raw.outputFormats)
    ? raw.outputFormats.map((f: any) => cleanString(f).toUpperCase()).filter(Boolean)
    : (canonicalTool?.outputFormats || []).map((f) => f.toUpperCase());

  const notes = cleanString(
    raw.notes,
    'All conversions process 100% locally in browser memory without size queues.'
  );

  if (inputFormats.length === 0) {
    errors.push('Supported formats block requires at least one input format.');
  }
  if (outputFormats.length === 0) {
    errors.push('Supported formats block requires at least one output format.');
  }

  return {
    valid: errors.length === 0,
    sanitizedContent: {
      heading,
      description,
      inputFormats,
      outputFormats,
      notes: notes || undefined,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 5: Use Cases block.
 */
export function validateToolUseCasesBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolUseCasesContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(
    raw.heading,
    canonicalTool ? `Common Use Cases for ${canonicalTool.name}` : 'Common Use Cases'
  );
  const description = cleanString(
    raw.description,
    'Practical scenarios where this tool saves time and streamlines workflows.'
  );

  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : canonicalTool?.useCases || [];

  const items: ToolUseCaseItem[] = rawItems
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any, idx: number) => ({
      id: cleanString(item.id, `itm-uc-${idx + 1}`),
      title: cleanString(item.title, `Use Case ${idx + 1}`),
      description: cleanString(item.description, ''),
      icon: cleanString(item.icon, 'Briefcase'),
      enabled: item.enabled !== false,
    }))
    .filter((uc: ToolUseCaseItem) => uc.title.length > 0 && uc.description.length > 0);

  return {
    valid: true,
    sanitizedContent: {
      heading,
      description,
      items,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 6: Technical Details & Limitations block.
 */
export function validateToolTechnicalDetailsBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolTechnicalDetailsContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(raw.heading, 'Technical Details & Limitations');
  const description = cleanString(
    raw.description,
    'Architecture specifications, processing constraints, and device requirements.'
  );

  const defaultSpecs: ToolTechnicalSpec[] = [
    {
      label: 'Processing Environment',
      value: canonicalTool?.clientSide !== false ? '100% Client-Side WebAssembly & HTML5 Canvas' : 'Hybrid Web Worker',
      notes: 'No external file uploads required',
    },
    {
      label: 'Maximum File Size',
      value: 'Subject to available client device RAM (recommended up to 100MB per file)',
      notes: 'No arbitrary platform cap imposed',
    },
    {
      label: 'Batch Conversion',
      value: 'Parallel multi-file queue processing',
      notes: 'Files convert concurrently in memory',
    },
    {
      label: 'Browser Compatibility',
      value: 'Modern Chrome, Safari, Firefox, Edge, and mobile browsers',
      notes: 'Requires ECMAScript 2020+ & WebAssembly support',
    },
  ];

  const rawSpecs = Array.isArray(raw.specs) ? raw.specs : defaultSpecs;
  const specs: ToolTechnicalSpec[] = rawSpecs
    .filter((spec: any) => spec && typeof spec === 'object')
    .map((spec: any) => ({
      label: cleanString(spec.label),
      value: cleanString(spec.value),
      notes: spec.notes ? cleanString(spec.notes) : undefined,
    }))
    .filter((s: ToolTechnicalSpec) => s.label.length > 0 && s.value.length > 0);

  const defaultLimitations = [
    'Conversion speed depends on local device processor performance and available memory.',
    'Very large files may require extra processing time on low-powered mobile devices.',
    'Password-protected or encrypted source files must be unlocked prior to conversion.',
  ];

  const limitations = Array.isArray(raw.limitations)
    ? raw.limitations.map((l: any) => cleanString(l)).filter(Boolean)
    : defaultLimitations;

  return {
    valid: true,
    sanitizedContent: {
      heading,
      description,
      specs,
      limitations,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 7: Privacy & Processing Information block.
 */
export function validateToolPrivacyBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolPrivacyContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const title = cleanString(
    raw.title,
    canonicalTool?.privacyNote?.title || 'Your Privacy Is 100% Protected'
  );
  const description = cleanString(
    raw.description,
    canonicalTool?.privacyNote?.description ||
      'Your files are processed directly in your browser and are never uploaded to our servers. Conversions execute locally on your device in temporary memory.'
  );

  const bullets: string[] = Array.isArray(raw.bullets)
    ? raw.bullets.map((b: any) => cleanString(b)).filter(Boolean)
    : canonicalTool?.privacyNote?.bullets || [
        'Zero Cloud Uploads: Files never leave your local device.',
        'Zero Data Logging: No conversion logs, metadata, or file copies are saved.',
        'Immediate Disposal: Browser memory releases all file buffers as soon as processing finishes.',
      ];

  const guaranteeBadge = cleanString(raw.guaranteeBadge, 'Client-Side Local Security');

  return {
    valid: true,
    sanitizedContent: {
      title,
      description,
      bullets,
      guaranteeBadge: guaranteeBadge || undefined,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 8: FAQ block.
 */
export function validateToolFaqBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolFaqContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(
    raw.heading,
    canonicalTool ? `Frequently Asked Questions about ${canonicalTool.name}` : 'Frequently Asked Questions'
  );

  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : canonicalTool?.faq || [];

  const items: ToolFaqItem[] = rawItems
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any, idx: number) => ({
      id: cleanString(item.id, `itm-faq-${idx + 1}`),
      question: cleanString(item.question),
      answer: cleanString(item.answer),
      enabled: item.enabled !== false,
    }))
    .filter((faq: ToolFaqItem) => faq.question.length > 0 && faq.answer.length > 0);

  if (items.length === 0) {
    errors.push('FAQ block must contain at least one question and answer pair.');
  }

  return {
    valid: errors.length === 0,
    sanitizedContent: {
      heading,
      items,
    },
    errors,
  };
}

/**
 * Validates and sanitizes Section 9: Related Tools block.
 * CRITICAL: strictly filters slugs against canonical tool registry to avoid broken links!
 */
export function validateToolRelatedToolsBlock(
  content: unknown,
  canonicalTool?: ToolDefinition
): BlockValidationResult<ToolRelatedToolsContent> {
  const errors: string[] = [];
  const raw = content && typeof content === 'object' ? (content as Record<string, any>) : {};

  const heading = cleanString(raw.heading, 'Related Tools');

  const rawSlugs: unknown[] = Array.isArray(raw.slugs)
    ? raw.slugs
    : Array.isArray(raw.toolSlugs)
    ? raw.toolSlugs
    : canonicalTool?.relatedTools || canonicalTool?.youMayAlsoNeed || [];

  // Strictly filter to valid canonical tool slugs
  const allCanonical = getAllTools();
  const canonicalSlugSet = new Set(allCanonical.map((t) => t.slug));

  const validSlugs: string[] = [];
  for (const s of rawSlugs) {
    if (typeof s === 'string') {
      const clean = s.trim().toLowerCase();
      if (canonicalSlugSet.has(clean) && !validSlugs.includes(clean)) {
        if (!canonicalTool || clean !== canonicalTool.slug) {
          validSlugs.push(clean);
        }
      }
    }
  }

  // Fallback to tools in the same category if empty
  if (validSlugs.length === 0 && canonicalTool) {
    const fallbackCategoryTools = allCanonical
      .filter((t) => t.category === canonicalTool.category && t.slug !== canonicalTool.slug)
      .map((t) => t.slug)
      .slice(0, 4);
    validSlugs.push(...fallbackCategoryTools);
  }

  return {
    valid: validSlugs.length > 0,
    sanitizedContent: {
      heading,
      slugs: validSlugs.slice(0, 4),
    },
    errors,
  };
}

/**
 * Generates the full 9-section canonical tool contract for any tool.
 * Content is 100% separate from conversion logic.
 */
export function generateCanonicalToolContract(toolOrSlug: string | ToolDefinition): UniversalContentBlock[] {
  const tool = typeof toolOrSlug === 'string' ? getToolBySlug(toolOrSlug) : toolOrSlug;
  if (!tool) return [];

  const blocks: UniversalContentBlock[] = [];

  // Hero Block (H1 heading is strictly reserved for the hero header)
  blocks.push(
    normalizeBlock({
      id: `blk-${tool.slug}-hero`,
      type: 'hero',
      enabled: true,
      order: CANONICAL_TOOL_BLOCK_ORDER.hero,
      content: {
        title: tool.h1,
        description: tool.valueProposition || tool.description || tool.intro,
      },
    })
  );

  // Trust / Benefits Row
  blocks.push(
    normalizeBlock({
      id: `blk-${tool.slug}-benefits`,
      type: 'benefits_trust',
      enabled: true,
      order: CANONICAL_TOOL_BLOCK_ORDER.benefits_trust,
      content: {
        items: [
          { id: 'itm-b1', enabled: true, icon: 'Zap', text: 'Fast & Local' },
          { id: 'itm-b2', enabled: true, icon: 'Check', text: '100% Free' },
          { id: 'itm-b3', enabled: true, icon: 'Shield', text: 'No Signup' },
          { id: 'itm-b4', enabled: true, icon: 'Lock', text: 'Client-Side Privacy' },
        ],
      },
    })
  );

  // 1. Introduction (H2 heading)
  const introRes = validateToolIntroBlock({}, tool);
  if (introRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-intro`,
        type: 'intro',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.intro,
        content: introRes.sanitizedContent,
      })
    );
  }

  // 2. How-To Instructions (H2 heading, numbered steps)
  const howToRes = validateToolHowToBlock({}, tool);
  if (howToRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-how-to`,
        type: 'how_to_use',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.how_to_use,
        content: howToRes.sanitizedContent,
      })
    );
  }

  // 3. Supported Formats (H2 heading)
  const formatsRes = validateToolSupportedFormatsBlock({}, tool);
  if (formatsRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-formats`,
        type: 'supported_formats',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.supported_formats,
        content: formatsRes.sanitizedContent,
      })
    );
  }

  // 4. Features (H2 heading, cards with H3 titles)
  const featRes = validateToolFeaturesBlock({}, tool);
  if (featRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-features`,
        type: 'features',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.features,
        content: featRes.sanitizedContent,
      })
    );
  }

  // 5. Technical Details & Limitations (H2 heading)
  const techRes = validateToolTechnicalDetailsBlock({}, tool);
  if (techRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-tech`,
        type: 'technical_details',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.technical_details,
        content: techRes.sanitizedContent,
      })
    );
  }

  // 6. Privacy & Processing Information (H2 heading)
  const privRes = validateToolPrivacyBlock({}, tool);
  if (privRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-privacy`,
        type: 'privacy_note',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.privacy_note,
        content: privRes.sanitizedContent,
      })
    );
  }

  // 7. Use Cases (H2 heading)
  if (tool.useCases && tool.useCases.length > 0) {
    const ucRes = validateToolUseCasesBlock({}, tool);
    if (ucRes.valid && ucRes.sanitizedContent.items.length > 0) {
      blocks.push(
        normalizeBlock({
          id: `blk-${tool.slug}-use-cases`,
          type: 'use_cases',
          enabled: true,
          order: CANONICAL_TOOL_BLOCK_ORDER.use_cases,
          content: ucRes.sanitizedContent,
        })
      );
    }
  }

  // 8. FAQ (H2 heading, accordion items)
  const faqRes = validateToolFaqBlock({}, tool);
  if (faqRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-faq`,
        type: 'faq',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.faq,
        content: faqRes.sanitizedContent,
      })
    );
  }

  // 9. Related Tools (H2 heading, validated tool cards)
  const relatedRes = validateToolRelatedToolsBlock({}, tool);
  if (relatedRes.valid) {
    blocks.push(
      normalizeBlock({
        id: `blk-${tool.slug}-related`,
        type: 'related_tools',
        enabled: true,
        order: CANONICAL_TOOL_BLOCK_ORDER.related_tools,
        content: relatedRes.sanitizedContent,
      })
    );
  }

  return sortToolBlocks(blocks);
}

/**
 * Deterministically sorts tool blocks by canonical layout hierarchy.
 */
export function sortToolBlocks(blocks: UniversalContentBlock[]): UniversalContentBlock[] {
  return [...blocks].sort((a, b) => {
    const orderA = typeof a.order === 'number' ? a.order : CANONICAL_TOOL_BLOCK_ORDER[a.type] ?? 99;
    const orderB = typeof b.order === 'number' ? b.order : CANONICAL_TOOL_BLOCK_ORDER[b.type] ?? 99;
    return orderA - orderB;
  });
}

/**
 * Normalizes, sanitizes, and verifies an arbitrary array of blocks against the tool contract.
 * Fails safely and gracefully: malformed blocks are sanitized or dropped without crashing.
 * Semantic headings are protected (competing H1s are downgraded to H2).
 */
export function normalizeToolContractBlocks(
  blocks: unknown[],
  canonicalTool?: ToolDefinition
): UniversalContentBlock[] {
  if (!Array.isArray(blocks)) {
    return canonicalTool ? generateCanonicalToolContract(canonicalTool) : [];
  }

  const result: UniversalContentBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const raw = blocks[i];
    if (!raw || typeof raw !== 'object') continue;

    const normalized = normalizeBlock(raw, i);
    if (normalized.enabled === false) continue;

    // Heading safety: prevent competing H1 headings
    if (normalized.type === 'heading' && normalized.content?.level === 1) {
      normalized.content.level = 2;
    }

    // Semantic section sanitization
    switch (normalized.type) {
      case 'intro': {
        const res = validateToolIntroBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'how_to_use':
      case 'how_to': {
        const res = validateToolHowToBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'features': {
        const res = validateToolFeaturesBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'supported_formats': {
        const res = validateToolSupportedFormatsBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'use_cases': {
        const res = validateToolUseCasesBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'technical_details': {
        const res = validateToolTechnicalDetailsBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'privacy_note': {
        const res = validateToolPrivacyBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'faq': {
        const res = validateToolFaqBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      case 'related_tools': {
        const res = validateToolRelatedToolsBlock(normalized.content, canonicalTool);
        normalized.content = res.sanitizedContent;
        break;
      }
      default:
        // Other universal blocks pass through normalized
        break;
    }

    result.push(normalized);
  }

  return sortToolBlocks(result);
}
