import { describe, it, expect } from 'vitest';
import { getToolsByCategory, getToolBySlug } from '../../lib/tools';
import { VALIDATION_LIMITS, validateFileSize } from '../../engines/shared/validation';

describe('Image Engine Base Architecture', () => {
  it('should register all 17 image tools', () => {
    const converters = getToolsByCategory('image-converter');
    const utilities = getToolsByCategory('image-utility');
    expect(converters.length).toBe(13);
    expect(utilities.length).toBe(4);
    expect(converters.length + utilities.length).toBe(17);
  });

  it('should resolve rotate-image tool definition correctly', () => {
    const tool = getToolBySlug('rotate-image');
    expect(tool).toBeDefined();
    expect(tool?.name).toBe('Rotate Image');
    expect(tool?.category).toBe('image-utility');
    expect(tool?.inputFormats).toContain('jpg');
    expect(tool?.outputFormats).toContain('jpg');
    expect(tool?.clientSide).toBe(true);
  });

  it('should enforce image max size limits of 50 MB', () => {
    expect(VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES).toBe(50 * 1024 * 1024);

    const validMockFile = new File(['mock content'], 'test.jpg', { type: 'image/jpeg' });
    const check = validateFileSize(validMockFile, false);
    expect(check.valid).toBe(true);
  });
});
