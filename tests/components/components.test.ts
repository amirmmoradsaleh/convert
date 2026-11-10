import { describe, it, expect } from 'vitest';
import { getAllTools } from '../../lib/tools';
import { getAllFormats, getFormatBySlug } from '../../lib/formats';
import { getHumanErrorMessage } from '../../engines/shared/errors';
import { formatBytes } from '../../engines/shared/file-utils';

describe('Shared Foundations and Registries', () => {
  it('should have exactly 25 tools defined in the Tool Registry', () => {
    const allTools = getAllTools();
    expect(allTools.length).toBe(25);
  });

  it('should have unique slugs for all 25 tools', () => {
    const slugs = getAllTools().map((t) => t.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(25);
  });

  it('should have all 5 core formats registered', () => {
    const formats = getAllFormats();
    expect(formats.length).toBe(5);
    expect(getFormatBySlug('jpg')).toBeDefined();
    expect(getFormatBySlug('png')).toBeDefined();
    expect(getFormatBySlug('webp')).toBeDefined();
    expect(getFormatBySlug('heic')).toBeDefined();
    expect(getFormatBySlug('pdf')).toBeDefined();
  });

  it('should provide human-readable error messages for all error codes', () => {
    expect(getHumanErrorMessage('FILE_TOO_LARGE')).toContain('50 MB');
    expect(getHumanErrorMessage('INVALID_FILE')).toBeTruthy();
  });

  it('should format bytes cleanly', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024 * 5)).toBe('5 MB');
  });
});
