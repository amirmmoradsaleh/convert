import { ToolError } from '../../shared/errors';
import { hasGifMagicBytes } from '../../shared/validation';
import type { GifDimensions, GifValidationResult } from './gif-types';

export { hasGifMagicBytes };

export const GIF_LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_DIMENSION: 8192, // 8192px width and height max raster limit
  MAX_BATCH_FILES: 20,
};

/**
 * Parses logical screen dimensions from GIF header (bytes 6-9, little endian).
 */
export function parseGifDimensions(buffer: ArrayBuffer | Uint8Array): GifDimensions | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 10 || !hasGifMagicBytes(bytes)) {
    return null;
  }

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

export const isAnimatedGif = detectGifAnimation;

export function detectGifAnimation(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 13 || !hasGifMagicBytes(bytes)) {
    return false;
  }

  let imageDescriptorCount = 0;
  // Skip header (6 bytes) and logical screen descriptor (7 bytes)
  let offset = 13;

  // If Global Color Table is present, skip it
  const packed = bytes[10];
  const hasGct = (packed & 0x80) !== 0;
  if (hasGct) {
    const gctSize = 3 * (1 << ((packed & 0x07) + 1));
    offset += gctSize;
  }

  while (offset < bytes.length) {
    const blockType = bytes[offset];
    if (blockType === 0x3b) {
      // GIF trailer
      break;
    }

    if (blockType === 0x2c) {
      // Image descriptor
      imageDescriptorCount++;
      if (imageDescriptorCount > 1) {
        return true;
      }
      // Image descriptor is 10 bytes: 0x2c + left(2) + top(2) + width(2) + height(2) + packed(1)
      if (offset + 10 > bytes.length) break;
      const imgPacked = bytes[offset + 9];
      offset += 10;
      // If Local Color Table present, skip it
      if ((imgPacked & 0x80) !== 0) {
        const lctSize = 3 * (1 << ((imgPacked & 0x07) + 1));
        offset += lctSize;
      }
      // Skip LZW min code size
      if (offset >= bytes.length) break;
      offset += 1;
      // Skip sub-blocks
      while (offset < bytes.length) {
        const subBlockSize = bytes[offset];
        offset += 1;
        if (subBlockSize === 0) break;
        offset += subBlockSize;
      }
    } else if (blockType === 0x21) {
      // Extension block
      offset += 2; // skip 0x21 and label
      while (offset < bytes.length) {
        const subBlockSize = bytes[offset];
        offset += 1;
        if (subBlockSize === 0) break;
        offset += subBlockSize;
      }
    } else {
      // Unknown block byte or padding
      offset++;
    }
  }

  return imageDescriptorCount > 1;
}

/**
 * Validates a GIF byte buffer directly.
 */
export function validateGifBuffer(buffer: ArrayBuffer | Uint8Array): GifValidationResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (!hasGifMagicBytes(bytes)) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid GIF image.'),
    };
  }

  const dimensions = parseGifDimensions(bytes);
  if (!dimensions) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid GIF image.'),
    };
  }

  if (dimensions.width > GIF_LIMITS.MAX_DIMENSION || dimensions.height > GIF_LIMITS.MAX_DIMENSION) {
    return {
      valid: false,
      error: new ToolError('BROWSER_MEMORY_ERROR', 'This GIF is too large to process in your browser.'),
      dimensions,
    };
  }

  const isAnimated = detectGifAnimation(bytes);
  const version = bytes[4] === 0x37 ? 'GIF87a' : 'GIF89a';

  return {
    valid: true,
    dimensions,
    version,
    isAnimated,
  };
}

/**
 * Validates a GIF File object against size limits, extension, MIME, magic bytes, and raster limits.
 */
export async function validateGifFile(file: File): Promise<GifValidationResult> {
  // 1. Size limit check (50 MB)
  if (file.size > GIF_LIMITS.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'gif') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only GIF files are supported.'),
    };
  }

  // 3. MIME validation (reject explicit conflicting types)
  const conflictingMimes = [
    'image/png',
    'application/pdf',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/svg+xml',
    'text/plain',
    'application/zip',
  ];
  if (file.type && conflictingMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid GIF image.'),
    };
  }

  // 4. Header & Magic Bytes check
  const headerSlice = file.slice(0, 1024);
  const headerBuffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(headerBuffer);

  if (!hasGifMagicBytes(bytes)) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid GIF image.'),
    };
  }

  const version = bytes[4] === 0x37 ? 'GIF87a' : 'GIF89a';
  const dimensions = parseGifDimensions(bytes);

  if (!dimensions) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid GIF image.'),
    };
  }

  // 5. Dimension safety limit (8192px)
  if (dimensions.width > GIF_LIMITS.MAX_DIMENSION || dimensions.height > GIF_LIMITS.MAX_DIMENSION) {
    return {
      valid: false,
      error: new ToolError('BROWSER_MEMORY_ERROR', 'This GIF is too large to process in your browser.'),
      dimensions,
    };
  }

  // Check animation flag if file size is small enough to scan quickly
  let isAnimated = false;
  if (file.size < 5 * 1024 * 1024) {
    try {
      const fullBuffer = await file.arrayBuffer();
      isAnimated = isAnimatedGif(fullBuffer);
    } catch {
      // Non-fatal, default to false
    }
  }

  return {
    valid: true,
    dimensions,
    version,
    isAnimated,
  };
}
