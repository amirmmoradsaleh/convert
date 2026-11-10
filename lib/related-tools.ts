import { getToolBySlug, ToolDefinition } from './tools';

/**
 * Resolves a list of tool slugs into ToolDefinition objects from the Tool Registry.
 * Filters out any unrecognized slugs safely.
 */
export function resolveRelatedTools(slugs: string[]): ToolDefinition[] {
  return slugs
    .map((slug) => getToolBySlug(slug))
    .filter((tool): tool is ToolDefinition => Boolean(tool));
}
