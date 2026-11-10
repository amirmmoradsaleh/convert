import { ToolError } from './errors';

export const VALIDATION_LIMITS = {
  MAX_IMAGE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_PDF_SIZE_BYTES: 100 * 1024 * 1024,   // 100 MB
  MAX_FILE_COUNT: 20,
  MAX_BATCH_FILES: 20,
} as const;

export interface ValidationRule {
  allowedExtensions?: string[];
  allowedMimes?: string[];
  maxSizeBytes?: number;
  maxCount?: number;
  checkMagicBytes?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: ToolError;
}

export function validateFileCount(files: File[], maxCount = VALIDATION_LIMITS.MAX_FILE_COUNT): ValidationResult {
  if (files.length === 0) {
    return { valid: false, error: new ToolError('INVALID_FILE', 'Please select at least one file.') };
  }
  if (files.length > maxCount) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', `You can only process up to ${maxCount} files at a time.`),
    };
  }
  return { valid: true };
}

export function validateFileSize(file: File, isPdf = false): ValidationResult {
  const max = isPdf ? VALIDATION_LIMITS.MAX_PDF_SIZE_BYTES : VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES;
  const maxMb = isPdf ? '100 MB' : '50 MB';

  if (file.size > max) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', `"${file.name}" exceeds the maximum allowable size of ${maxMb}.`),
    };
  }
  return { valid: true };
}

export function validateFileExtension(file: File, allowedExtensions: string[]): ValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const normalizedAllowed = allowedExtensions.map((e) => e.replace('.', '').toLowerCase());

  if (!normalizedAllowed.includes(ext)) {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', `File extension ".${ext}" is not supported. Allowed: ${allowedExtensions.join(', ')}`),
    };
  }
  return { valid: true };
}

export function validateFileMime(file: File, allowedMimes: string[]): ValidationResult {
  if (allowedMimes.length > 0 && file.type) {
    const isAllowed = allowedMimes.some((m) => {
      if (m.endsWith('/*')) {
        return file.type.startsWith(m.replace('/*', ''));
      }
      return file.type.toLowerCase() === m.toLowerCase();
    });

    if (!isAllowed) {
      return {
        valid: false,
        error: new ToolError('UNSUPPORTED_FORMAT', `MIME type "${file.type}" is not supported.`),
      };
    }
  }
  return { valid: true };
}

/**
 * Checks if the given buffer starts with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
 */
export function hasPdfMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 5) return false;
  // A PDF file signature %PDF-
  for (let i = 0; i < Math.min(bytes.length - 4, 1024); i++) {
    if (
      bytes[i] === 0x25 && // '%'
      bytes[i + 1] === 0x50 && // 'P'
      bytes[i + 2] === 0x44 && // 'D'
      bytes[i + 3] === 0x46 && // 'F'
      bytes[i + 4] === 0x2d // '-'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the given buffer starts with the JPEG SOI signature: FF D8 FF
 */
export function hasJpegMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 3) return false;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Checks if the given buffer starts with the PNG signature: 89 50 4E 47 0D 0A 1A 0A
 */
export function hasPngMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 8) return false;
  return (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/**
 * Checks if the given buffer starts with RIFF (bytes 0-3) and WEBP (bytes 8-11)
 */
export function hasWebpMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46 && // 'F'
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x45 && // 'E'
    bytes[10] === 0x42 && // 'B'
    bytes[11] === 0x50    // 'P'
  );
}

/**
 * Checks if a byte buffer represents an animated WebP file.
 * Evaluates the VP8X header animation flag (bit 1 of flags byte) and scans for ANIM/ANMF chunks.
 */
export function isAnimatedWebp(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 20) return false;
  if (!hasWebpMagicBytes(bytes)) return false;

  // Check VP8X chunk (offset 12..15: 'VP8X')
  if (
    bytes[12] === 0x56 && // 'V'
    bytes[13] === 0x50 && // 'P'
    bytes[14] === 0x38 && // '8'
    bytes[15] === 0x58    // 'X'
  ) {
    if (bytes.length >= 21) {
      // Flags byte is at offset 20. Bit 1 (0x02) = Animation
      const flags = bytes[20];
      if ((flags & 0x02) !== 0) {
        return true;
      }
    }
  }

  // Scan for 'ANIM' or 'ANMF' FourCC chunks in the RIFF header
  const maxScan = Math.min(bytes.length - 4, 4096);
  for (let i = 12; i < maxScan; i++) {
    if (
      bytes[i] === 0x41 && // 'A'
      bytes[i + 1] === 0x4e && // 'N'
      bytes[i + 2] === 0x49 && // 'I'
      bytes[i + 3] === 0x4d    // 'M'
    ) {
      return true;
    }
    if (
      bytes[i] === 0x41 && // 'A'
      bytes[i + 1] === 0x4e && // 'N'
      bytes[i + 2] === 0x4d && // 'M'
      bytes[i + 3] === 0x46    // 'F'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a byte buffer starts with the BMP 'BM' signature (0x42, 0x4D).
 */
export function hasBmpMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 2) return false;
  return bytes[0] === 0x42 && bytes[1] === 0x4D;
}

/**
 * Checks if a byte buffer starts with the GIF87a or GIF89a signature.
 * GIF87a: 47 49 46 38 37 61
 * GIF89a: 47 49 46 38 39 61
 */
export function hasGifMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 6) return false;

  return (
    bytes[0] === 0x47 && // 'G'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x38 && // '8'
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // '7' or '9'
    bytes[5] === 0x61 // 'a'
  );
}

/**
 * Checks if a byte buffer matches ISO Base Media File Format containing HEIC/HEIF brands.
 * Bytes 4-7 are 'ftyp', followed by major brand or compatible brands matching HEIC/HEIF specifications.
 */
export function hasHeicMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 12) return false;

  // Offset 4..7 must be 'ftyp'
  if (
    bytes[4] !== 0x66 || // 'f'
    bytes[5] !== 0x74 || // 't'
    bytes[6] !== 0x79 || // 'y'
    bytes[7] !== 0x70    // 'p'
  ) {
    return false;
  }

  const decoder = new TextDecoder('utf-8');
  const validBrands = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

  // Major brand check (offset 8..12)
  const majorBrand = decoder.decode(bytes.subarray(8, 12)).toLowerCase().trim();
  if (validBrands.has(majorBrand)) {
    return true;
  }

  // Compatible brands check (starting at offset 16)
  const boxLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  const maxOffset = Math.min(bytes.length, boxLength > 0 ? boxLength : bytes.length, 128);

  for (let offset = 16; offset + 4 <= maxOffset; offset += 4) {
    const brand = decoder.decode(bytes.subarray(offset, offset + 4)).toLowerCase().trim();
    if (validBrands.has(brand)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates magic-byte signature from the first bytes of a file.
 */
export async function validateMagicBytes(
  file: File | Blob,
  expectedType: 'jpeg' | 'png' | 'pdf' | 'webp' | 'heic' | 'gif' | 'bmp' = 'jpeg'
): Promise<ValidationResult> {
  try {
    const slice = file.slice(0, 128);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (expectedType === 'jpeg') {
      if (!hasJpegMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid JPEG image.'),
        };
      }
    } else if (expectedType === 'png') {
      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      if (!hasPngMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid PNG image.'),
        };
      }
    } else if (expectedType === 'webp') {
      // WebP container signature: RIFF at bytes 0-3, WEBP at bytes 8-11
      if (!hasWebpMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid WebP image.'),
        };
      }
    } else if (expectedType === 'heic') {
      // HEIC container signature: ftyp box with heic/heif brand
      if (!hasHeicMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid HEIC image.'),
        };
      }
    } else if (expectedType === 'gif') {
      // GIF magic bytes: GIF87a or GIF89a
      if (!hasGifMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid GIF image.'),
        };
      }
    } else if (expectedType === 'bmp') {
      // BMP magic bytes: BM (0x42 0x4D)
      if (!hasBmpMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid BMP image.'),
        };
      }
    } else if (expectedType === 'pdf') {
      // PDF magic bytes: %PDF (25 50 44 46)
      const isPdf =
        bytes.length >= 4 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46;
      if (!isPdf) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid PDF document.'),
        };
      }
    }

    return { valid: true };
  } catch {
    const errorMsg =
      expectedType === 'png'
        ? 'This file is not a valid PNG image.'
        : expectedType === 'webp'
        ? 'This file is not a valid WebP image.'
        : expectedType === 'heic'
        ? 'This file is not a valid HEIC image.'
        : expectedType === 'gif'
        ? 'This file is not a valid GIF image.'
        : expectedType === 'pdf'
        ? 'This file is not a valid PDF document.'
        : 'This file is not a valid JPEG image.';
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', errorMsg),
    };
  }
}

/**
 * Complete validation pipeline for PNG files:
 * File -> Size -> Extension -> MIME -> Magic Bytes -> Ready
 */
export async function validatePngFile(file: File): Promise<ValidationResult> {
  // 1. Size validation
  if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension validation
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'png') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only PNG files are supported.'),
    };
  }

  // 3. MIME validation (if MIME provided by browser)
  if (file.type && file.type.toLowerCase() !== 'image/png' && file.type.toLowerCase() !== 'application/octet-stream') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only PNG files are supported.'),
    };
  }

  // 4. Magic byte validation (89 50 4E 47 0D 0A 1A 0A)
  const magicCheck = await validateMagicBytes(file, 'png');
  if (!magicCheck.valid) {
    return magicCheck;
  }

  return { valid: true };
}

/**
 * Complete validation pipeline for JPG/JPEG files:
 * File -> Size -> Extension -> MIME -> Magic Bytes -> Ready
 */
export async function validateJpegFile(file: File): Promise<ValidationResult> {
  // 1. Size validation
  if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension validation
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'jpg' && ext !== 'jpeg') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only JPG and JPEG files are supported.'),
    };
  }

  // 3. MIME validation (if MIME provided by browser)
  if (file.type && file.type.toLowerCase() !== 'image/jpeg') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only JPG and JPEG files are supported.'),
    };
  }

  // 4. Magic byte validation (FF D8 FF)
  const magicCheck = await validateMagicBytes(file, 'jpeg');
  if (!magicCheck.valid) {
    return magicCheck;
  }

  return { valid: true };
}

/**
 * Complete validation pipeline for WebP files:
 * File -> Size -> Extension -> MIME -> Magic Bytes -> Ready
 */
export async function validateWebpFile(file: File): Promise<ValidationResult> {
  // 1. Size validation
  if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension validation
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'webp') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only WebP files are supported.'),
    };
  }

  // 3. MIME validation (if MIME provided by browser)
  if (
    file.type &&
    file.type.toLowerCase() !== 'image/webp' &&
    file.type.toLowerCase() !== 'application/octet-stream'
  ) {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only WebP files are supported.'),
    };
  }

  // 4. Magic byte validation (RIFF....WEBP)
  const magicCheck = await validateMagicBytes(file, 'webp');
  if (!magicCheck.valid) {
    return magicCheck;
  }

  return { valid: true };
}

/**
 * Complete validation pipeline for HEIC files:
 * File -> Size -> Extension -> MIME -> Container / ftyp validation -> Ready
 */
export async function validateHeicFile(file: File): Promise<ValidationResult> {
  // 1. Size validation
  if (file.size > VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension validation
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'heic') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only HEIC files are supported.'),
    };
  }

  // 3. MIME validation (reject explicit known conflicting types like image/png, application/pdf, etc.)
  const conflictingMimes = [
    'image/png',
    'application/pdf',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/svg+xml',
    'text/plain',
    'application/zip',
  ];
  if (file.type && conflictingMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid HEIC image.'),
    };
  }

  // 4. Container / ftyp validation with HEIC/HEIF brands
  const magicCheck = await validateMagicBytes(file, 'heic');
  if (!magicCheck.valid) {
    return magicCheck;
  }

  return { valid: true };
}

export {
  validateSvgFile,
  validateSvgContent,
  parseViewBox,
  parseLengthToPixels,
  scanSvgSecurity,
} from '../image/svg/svg-validator';

export {
  validateGifFile,
  parseGifDimensions,
  isAnimatedGif,
  GIF_LIMITS,
} from '../image/gif/gif-validator';

export {
  validateBmpFile,
  validateBmpBuffer,
  parseBmpDimensions,
  BMP_LIMITS,
} from '../image/bmp/bmp-validator';

export const COMPRESS_IMAGE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_BATCH_FILES: 20,
  MAX_DIMENSION: 8192,
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
  ALLOWED_MIMES: ['image/jpeg', 'image/png', 'image/webp'],
};

/**
 * Validates an image file intended for compression.
 * Checks size, extension, MIME, binary magic bytes, animated WebP restriction, and header format.
 */
export async function validateCompressibleImageFile(file: File): Promise<ValidationResult> {
  // 1. Size validation
  if (file.size > COMPRESS_IMAGE_LIMITS.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension validation
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!COMPRESS_IMAGE_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only JPG, JPEG, PNG, and WebP files are supported for compression.'),
    };
  }

  // 3. MIME validation (if provided by browser)
  const conflictingMimes = [
    'application/pdf',
    'image/gif',
    'image/bmp',
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'text/plain',
    'application/zip',
  ];
  if (file.type && conflictingMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only JPG, JPEG, PNG, and WebP files are supported for compression.'),
    };
  }

  // 4. Binary signature validation
  try {
    const slice = file.slice(0, 4096);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (ext === 'jpg' || ext === 'jpeg') {
      if (!hasJpegMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid JPEG image.'),
        };
      }
    } else if (ext === 'png') {
      if (!hasPngMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid PNG image.'),
        };
      }
    } else if (ext === 'webp') {
      if (!hasWebpMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid WebP image.'),
        };
      }
      if (isAnimatedWebp(bytes)) {
        return {
          valid: false,
          error: new ToolError('UNSUPPORTED_FORMAT', 'Animated WebP files are not supported by this compression tool.'),
        };
      }
    }
  } catch {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'Could not read image file header for validation.'),
    };
  }

  return { valid: true };
}

export function validateFile(file: File, rules: ValidationRule): ValidationResult {
  const isPdf = rules.allowedExtensions?.some((ext) => ext.toLowerCase().includes('pdf')) || false;
  
  const sizeCheck = validateFileSize(file, isPdf);
  if (!sizeCheck.valid) return sizeCheck;

  if (rules.allowedExtensions && rules.allowedExtensions.length > 0) {
    const extCheck = validateFileExtension(file, rules.allowedExtensions);
    if (!extCheck.valid) return extCheck;
  }

  if (rules.allowedMimes && rules.allowedMimes.length > 0) {
    const mimeCheck = validateFileMime(file, rules.allowedMimes);
    if (!mimeCheck.valid) return mimeCheck;
  }

  return { valid: true };
}
