import { getToolBySlug, ToolDefinition } from '@/lib/tools';
import { normalizeBlock, UniversalContentBlock } from './blocks';

/**
 * Phase 07C-2: Core Image Format Converters (Batch 1)
 * Exactly 8 tools migrated in this batch.
 */
export const BATCH_1_TOOL_SLUGS = [
  'jpg-to-png',
  'jpg-to-webp',
  'webp-to-jpg',
  'png-to-webp',
  'webp-to-png',
  'svg-to-png',
  'gif-to-png',
  'bmp-to-png',
] as const;

export type Batch1ToolSlug = typeof BATCH_1_TOOL_SLUGS[number];

export function isBatch1Tool(slug: string): slug is Batch1ToolSlug {
  return (BATCH_1_TOOL_SLUGS as readonly string[]).includes(slug);
}

/**
 * Converts any canonical tool from the registry into structured UniversalContentBlock[]
 * preserving 100% of the canonical text, headings, steps, features, FAQs, and metadata.
 */
export function generateCanonicalBlocksForTool(slugOrTool: string | ToolDefinition): UniversalContentBlock[] {
  const tool = typeof slugOrTool === 'string' ? getToolBySlug(slugOrTool) : slugOrTool;
  if (!tool) return [];

  const blocks: UniversalContentBlock[] = [];
  let order = 0;

  // 1. Hero Block
  blocks.push(
    normalizeBlock(
      {
        id: `blk-${tool.slug}-hero`,
        type: 'hero',
        enabled: true,
        order: order++,
        content: {
          title: tool.h1,
          description: tool.valueProposition || tool.description || tool.intro,
        },
      },
      order - 1
    )
  );

  // 2. Benefits / Trust Row
  blocks.push(
    normalizeBlock(
      {
        id: `blk-${tool.slug}-benefits`,
        type: 'benefits_trust',
        enabled: true,
        order: order++,
        content: {
          items: [
            { id: 'itm-b1', enabled: true, icon: 'Zap', text: 'Fast & Local' },
            { id: 'itm-b2', enabled: true, icon: 'Check', text: '100% Free' },
            { id: 'itm-b3', enabled: true, icon: 'Shield', text: 'No Signup' },
            { id: 'itm-b4', enabled: true, icon: 'Lock', text: 'Client-Side Privacy' },
          ],
        },
      },
      order - 1
    )
  );

  // 3. How to Use Steps
  if (tool.howTo && tool.howTo.length > 0) {
    blocks.push(
      normalizeBlock(
        {
          id: `blk-${tool.slug}-how-to`,
          type: 'how_to_use',
          enabled: true,
          order: order++,
          content: {
            heading: `How to Use ${tool.name}`,
            description: 'Follow these simple steps to process your files directly in your browser.',
            items: tool.howTo.map((step, idx) => ({
              id: `itm-h-${idx + 1}`,
              enabled: true,
              title: step.title,
              description: step.description,
            })),
          },
        },
        order - 1
      )
    );
  }

  // 4. Related Tools
  const relatedSlugs =
    tool.relatedTools && tool.relatedTools.length > 0
      ? tool.relatedTools.slice(0, 4)
      : (tool.youMayAlsoNeed || []).slice(0, 4);

  if (relatedSlugs.length > 0) {
    blocks.push(
      normalizeBlock(
        {
          id: `blk-${tool.slug}-related`,
          type: 'related_tools',
          enabled: true,
          order: order++,
          content: {
            heading: 'Related Tools',
            slugs: relatedSlugs,
          },
        },
        order - 1
      )
    );
  }

  // 5. Intro / About Section
  if (tool.intro) {
    blocks.push(
      normalizeBlock(
        {
          id: `blk-${tool.slug}-intro`,
          type: 'intro',
          enabled: true,
          order: order++,
          content: {
            heading: `About ${tool.name}`,
            text: tool.intro,
          },
        },
        order - 1
      )
    );
  }

  // 6. Features Grid
  const featuresList =
    tool.features && tool.features.length > 0
      ? tool.features.map((feat, idx) => ({
          id: `itm-f-${idx + 1}`,
          enabled: true,
          title: feat.title,
          description: feat.description,
        }))
      : [
          {
            id: 'itm-f-1',
            enabled: true,
            title: '100% Privacy',
            description: 'Files are processed directly in your browser. Nothing is saved or sent to external servers.',
          },
          {
            id: 'itm-f-2',
            enabled: true,
            title: 'Lightning Fast',
            description: 'Instant conversion without server queuing delays or upload wait times.',
          },
          {
            id: 'itm-f-3',
            enabled: true,
            title: 'Free Forever',
            description: 'No subscriptions, credit card requirements, or artificial limits on conversions.',
          },
        ];

  blocks.push(
    normalizeBlock(
      {
        id: `blk-${tool.slug}-features`,
        type: 'features',
        enabled: true,
        order: order++,
        content: {
          heading: `Key Features of ${tool.name}`,
          description: 'Engineered for speed, privacy, and seamless browser-based processing.',
          items: featuresList,
        },
      },
      order - 1
    )
  );

  // 7. Privacy Note (if present)
  if (tool.privacyNote) {
    blocks.push(
      normalizeBlock(
        {
          id: `blk-${tool.slug}-privacy`,
          type: 'privacy_note',
          enabled: true,
          order: order++,
          content: {
            title: tool.privacyNote.title,
            description: tool.privacyNote.description,
            bullets: tool.privacyNote.bullets || [],
          },
        },
        order - 1
      )
    );
  }

  // 8. Common Use Cases (if present)
  if (tool.useCases && tool.useCases.length > 0) {
    blocks.push(
      normalizeBlock(
        {
          id: `blk-${tool.slug}-use-cases`,
          type: 'use_cases',
          enabled: true,
          order: order++,
          content: {
            heading: `Common Use Cases for ${tool.name}`,
            description: 'Practical scenarios where this tool saves time and streamlines workflows.',
            items: tool.useCases.map((uc, idx) => ({
              id: `itm-uc-${idx + 1}`,
              enabled: true,
              title: uc.title,
              description: uc.description,
            })),
          },
        },
        order - 1
      )
    );
  }

  // 9. FAQ Section
  if (tool.faq && tool.faq.length > 0) {
    blocks.push(
      normalizeBlock(
        {
          id: `blk-${tool.slug}-faq`,
          type: 'faq',
          enabled: true,
          order: order++,
          content: {
            heading: `Frequently Asked Questions about ${tool.name}`,
            items: tool.faq.map((item, idx) => ({
              id: `itm-q-${idx + 1}`,
              enabled: true,
              question: item.question,
              answer: item.answer,
            })),
          },
        },
        order - 1
      )
    );
  }

  // 10. CTA Block
  blocks.push(
    normalizeBlock(
      {
        id: `blk-${tool.slug}-cta`,
        type: 'cta',
        enabled: true,
        order: order++,
        content: {
          title: 'Need more conversion options?',
          description: 'Convert24 features a whole suite of free, safe, and lightning-fast image utilities right inside your browser.',
          buttonText: 'Explore All Tools',
          href: '/',
        },
      },
      order - 1
    )
  );

  return blocks;
}

/**
 * Pre-computed, deterministic block definitions for the 8 Batch 1 tools.
 */
export const BATCH_1_DEFAULT_BLOCKS: Record<Batch1ToolSlug, UniversalContentBlock[]> = {
  'jpg-to-png': generateCanonicalBlocksForTool('jpg-to-png'),
  'jpg-to-webp': generateCanonicalBlocksForTool('jpg-to-webp'),
  'webp-to-jpg': generateCanonicalBlocksForTool('webp-to-jpg'),
  'png-to-webp': generateCanonicalBlocksForTool('png-to-webp'),
  'webp-to-png': generateCanonicalBlocksForTool('webp-to-png'),
  'svg-to-png': generateCanonicalBlocksForTool('svg-to-png'),
  'gif-to-png': generateCanonicalBlocksForTool('gif-to-png'),
  'bmp-to-png': generateCanonicalBlocksForTool('bmp-to-png'),
};

export function getBatch1ToolBlocks(slug: string): UniversalContentBlock[] | null {
  if (isBatch1Tool(slug)) {
    return BATCH_1_DEFAULT_BLOCKS[slug];
  }
  return null;
}
