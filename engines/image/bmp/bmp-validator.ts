import { ToolError } from '../../shared/errors';
import { hasBmpMagicBytes } from '../../shared/validation';
import type { BmpDimensions, BmpValidationResult } from './bmp-types';

export { hasBmpMagicBytes };

export const BMP_LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_DIMENSION: 8192, // 8192px max raster limit
  MAX_BATCH_FILES: 20,
};

/**
 * Parses header information and dimensions from a BMP buffer.
 */
export function parseBmpDimensions(buffer: ArrayBuffer | Uint8Array): BmpDimensions | null {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 26 || !hasBmpMagicBytes(bytes)) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    const dibHeaderSize = view.getUint32(14, true);
    if (dibHeaderSize < 12) {
      return null;
    }

    let width = 0;
    let height = 0;
    let isTopDown = false;
    let planes = 1;
    let bpp = 24;
    let compression = 0;

    if (dibHeaderSize === 12) {
      // BITMAPCOREHEADER / OS/2 1.x
      if (bytes.length < 26) return null;
      width = view.getUint16(18, true);
      height = view.getUint16(20, true);
      planes = view.getUint16(22, true);
      bpp = view.getUint16(24, true);
      compression = 0;
    } else if (dibHeaderSize >= 40) {
      // BITMAPINFOHEADER and modern extensions (V2..V5)
      if (bytes.length < 14 + Math.min(dibHeaderSize, 40)) return null;
      width = view.getInt32(18, true);
      const rawHeight = view.getInt32(22, true);
      planes = view.getUint16(26, true);
      bpp = view.getUint16(28, true);
      compression = view.getUint32(30, true);

      if (rawHeight < 0) {
        isTopDown = true;
        height = Math.abs(rawHeight);
      } else {
        isTopDown = false;
        height = rawHeight;
      }
    } else {
      return null;
    }

    if (planes !== 1) {
      return null;
    }

    return {
      width,
      height,
      isTopDown,
      bpp,
      compression,
    };
  } catch {
    return null;
  }
}

/**
 * Validates a BMP byte buffer against size, signature, headers, dimensions, and memory limits.
 */
export function validateBmpBuffer(buffer: ArrayBuffer | Uint8Array): BmpValidationResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // 1. Signature Check ('BM' -> 0x42, 0x4D)
  if (!hasBmpMagicBytes(bytes)) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid BMP image.'),
    };
  }

  // 2. Minimum length check (14 header + 12 DIB = 26 bytes)
  if (bytes.length < 26) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid BMP image.'),
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // 3. Pixel Data Offset & DIB Header Validation
  const pixelOffset = view.getUint32(10, true);
  const dibHeaderSize = view.getUint32(14, true);

  if (dibHeaderSize < 12 || dibHeaderSize > 1024 * 1024) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file has a malformed BMP header.'),
    };
  }

  if (pixelOffset < 14 + dibHeaderSize) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file has an invalid BMP pixel offset.'),
    };
  }

  // 4. Dimension & Field Parsing
  const dimensions = parseBmpDimensions(bytes);
  if (!dimensions) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid BMP image.'),
    };
  }

  const { width, height, bpp, compression } = dimensions;

  // 5. Check for valid positive dimensions
  if (width <= 0 || !Number.isFinite(width)) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file has invalid BMP image dimensions.'),
    };
  }

  if (height <= 0 || !Number.isFinite(height)) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file has invalid BMP image dimensions.'),
    };
  }

  // 6. Memory Limits Check (max 8192px)
  if (width > BMP_LIMITS.MAX_DIMENSION || height > BMP_LIMITS.MAX_DIMENSION) {
    return {
      valid: false,
      error: new ToolError(
        'BROWSER_MEMORY_ERROR',
        'This BMP is too large to process in your browser.'
      ),
      dimensions,
    };
  }

  // 7. Bit depth validation
  const validBpps = [1, 4, 8, 16, 24, 32];
  if (!validBpps.includes(bpp)) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This BMP format is not supported by your browser.'
      ),
      dimensions,
    };
  }

  // 8. Integer Overflow / Impossible Size Protection
  // Stride is rounded up to the nearest multiple of 4 bytes
  const rowStride = Math.floor((width * bpp + 31) / 32) * 4;
  const rawPixelBytes = rowStride * height;

  if (!Number.isSafeInteger(rowStride) || !Number.isSafeInteger(rawPixelBytes) || rawPixelBytes < 0) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This BMP file contains corrupted dimension or size values.'),
      dimensions,
    };
  }

  // If compression is unsupported or unknown
  // 0 = BI_RGB, 1 = BI_RLE8, 2 = BI_RLE4, 3 = BI_BITFIELDS, 4 = BI_JPEG, 5 = BI_PNG, 6 = BI_ALPHABITFIELDS
  if (compression > 6) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This BMP format is not supported by your browser.'
      ),
      dimensions,
    };
  }

  return {
    valid: true,
    dimensions,
    dibHeaderSize,
  };
}

/**
 * Validates a user-provided BMP file object (extension, size, magic bytes, dimensions).
 */
export async function validateBmpFile(file: File): Promise<BmpValidationResult> {
  // 1. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'bmp') {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'Only BMP image files (.bmp) are supported.'
      ),
    };
  }

  // 2. File size limit check (50 MB)
  if (file.size > BMP_LIMITS.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError(
        'FILE_TOO_LARGE',
        'This file is too large. Maximum allowed BMP size is 50 MB.'
      ),
    };
  }

  // 3. Header inspection (read first 4 KB for headers and descriptors)
  try {
    const sliceSize = Math.min(file.size, 4096);
    const slice = file.slice(0, sliceSize);
    const arrayBuffer = await slice.arrayBuffer();

    const bufferRes = validateBmpBuffer(arrayBuffer);
    if (!bufferRes.valid) {
      return bufferRes;
    }

    return {
      valid: true,
      dimensions: bufferRes.dimensions,
      dibHeaderSize: bufferRes.dibHeaderSize,
    };
  } catch {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid BMP image.'),
    };
  }
}
