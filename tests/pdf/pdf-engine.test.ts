import { describe, it, expect } from 'vitest';
import { getToolsByCategory, getToolBySlug } from '../../lib/tools';
import { parsePageRangeString } from '../../engines/pdf/utils';
import { VALIDATION_LIMITS } from '../../engines/shared/validation';

describe('PDF Engine Base Architecture', () => {
  it('should register all PDF tools', () => {
    const converters = getToolsByCategory('pdf-converter');
    const utilities = getToolsByCategory('pdf-utility');
    expect(converters.length).toBe(2);
    expect(utilities.length).toBe(6);
    expect(converters.length + utilities.length).toBe(8);
  });

  it('should resolve merge-pdf and split-pdf tool definitions', () => {
    const mergeTool = getToolBySlug('merge-pdf');
    const splitTool = getToolBySlug('split-pdf');

    expect(mergeTool?.category).toBe('pdf-utility');
    expect(splitTool?.category).toBe('pdf-utility');
    expect(mergeTool?.inputFormats).toContain('pdf');
  });

  it('should correctly parse page range strings', () => {
    const parsed = parsePageRangeString('1-3, 5, 8-10', 12);
    expect(parsed).toEqual([1, 2, 3, 5, 8, 9, 10]);
  });

  it('should enforce 100 MB limit for PDF files', () => {
    expect(VALIDATION_LIMITS.MAX_PDF_SIZE_BYTES).toBe(100 * 1024 * 1024);
  });
});
