import path from 'path';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const MIME_EXTENSION_MAP: Record<AllowedMimeType, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
};

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedFilename: string;
  detectedMimeType: AllowedMimeType;
}

/**
 * Strips path traversal sequences, converts spaces to dashes, keeps only safe chars.
 */
export function sanitizeFilename(rawFilename: string): string {
  const base = path.basename(rawFilename);
  const rawExt = path.extname(base);
  const nameWithoutExt = path.basename(base, rawExt);
  const ext = rawExt.toLowerCase();

  const cleanName = nameWithoutExt
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');

  const hasAlphanumeric = /[a-z0-9]/.test(cleanName);
  const safeName = hasAlphanumeric ? cleanName : 'asset';
  return `${safeName}${ext}`;
}

/**
 * Validates file buffer, size, MIME type, extension consistency, and SVG security.
 */
export function validateMediaUpload(
  buffer: Buffer,
  originalFilename: string,
  declaredMimeType: string
): FileValidationResult {
  // 1. File size check
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      error: 'Empty file payload.',
      sanitizedFilename: '',
      detectedMimeType: 'image/jpeg',
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the 10 MB maximum limit (${(buffer.length / (1024 * 1024)).toFixed(1)} MB).`,
      sanitizedFilename: '',
      detectedMimeType: 'image/jpeg',
    };
  }

  // 2. Traversal or unsafe filename check
  if (originalFilename.includes('..') || originalFilename.includes('/') || originalFilename.includes('\\')) {
    return {
      isValid: false,
      error: 'Path traversal sequences are not allowed in filenames.',
      sanitizedFilename: '',
      detectedMimeType: 'image/jpeg',
    };
  }

  // 3. MIME validation
  const normalizedMime = declaredMimeType.trim().toLowerCase() as AllowedMimeType;
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    return {
      isValid: false,
      error: `Unsupported file type '${declaredMimeType}'. Allowed types: JPEG, PNG, WebP, GIF, SVG.`,
      sanitizedFilename: '',
      detectedMimeType: normalizedMime,
    };
  }

  // 4. Extension consistency check
  const ext = path.extname(originalFilename).toLowerCase();
  const allowedExts = MIME_EXTENSION_MAP[normalizedMime] || [];
  if (!allowedExts.includes(ext)) {
    return {
      isValid: false,
      error: `File extension '${ext}' does not match MIME type '${normalizedMime}'. Expected: ${allowedExts.join(', ')}.`,
      sanitizedFilename: '',
      detectedMimeType: normalizedMime,
    };
  }

  // 5. Magic byte / header verification
  const magicCheck = verifyMagicBytes(buffer, normalizedMime);
  if (!magicCheck.valid) {
    return {
      isValid: false,
      error: magicCheck.error || 'File header does not match declared image format.',
      sanitizedFilename: '',
      detectedMimeType: normalizedMime,
    };
  }

  // 6. SVG Security inspection
  if (normalizedMime === 'image/svg+xml') {
    const svgText = buffer.toString('utf8');
    const svgCheck = inspectSvgSecurity(svgText);
    if (!svgCheck.isSafe) {
      return {
        isValid: false,
        error: svgCheck.reason || 'Unsafe SVG content detected.',
        sanitizedFilename: '',
        detectedMimeType: normalizedMime,
      };
    }
  }

  const sanitized = sanitizeFilename(originalFilename);

  return {
    isValid: true,
    sanitizedFilename: sanitized,
    detectedMimeType: normalizedMime,
  };
}

function verifyMagicBytes(buffer: Buffer, mimeType: AllowedMimeType): { valid: boolean; error?: string } {
  if (buffer.length < 8) return { valid: false, error: 'File is too small to be a valid image.' };

  switch (mimeType) {
    case 'image/jpeg':
      // FF D8 FF
      if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid JPEG magic bytes.' };

    case 'image/png':
      // 89 50 4E 47 0D 0A 1A 0A
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      ) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid PNG magic bytes.' };

    case 'image/gif': {
      // GIF87a or GIF89a
      const gifHeader = buffer.subarray(0, 6).toString('ascii');
      if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid GIF magic bytes.' };
    }

    case 'image/webp': {
      // RIFF .... WEBP
      const riff = buffer.subarray(0, 4).toString('ascii');
      const webp = buffer.subarray(8, 12).toString('ascii');
      if (riff === 'RIFF' && webp === 'WEBP') {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid WebP magic bytes.' };
    }

    case 'image/svg+xml': {
      // Check for <svg in initial 2048 bytes
      const prefix = buffer.subarray(0, Math.min(buffer.length, 2048)).toString('utf8').toLowerCase();
      if (prefix.includes('<svg') || prefix.includes('<?xml')) {
        return { valid: true };
      }
      return { valid: false, error: 'Invalid SVG content: missing <svg> element.' };
    }

    default:
      return { valid: false, error: 'Unknown MIME type.' };
  }
}

/**
 * Strict SVG Security Inspector:
 * Disallows scripts, iframes, foreignObject, javascript: URIs, and inline event handlers.
 */
export function inspectSvgSecurity(svgText: string): { isSafe: boolean; reason?: string } {
  const lower = svgText.toLowerCase();

  const dangerousTags = ['<script', '<iframe', '<object', '<embed', '<foreignobject', '<applet'];
  for (const tag of dangerousTags) {
    if (lower.includes(tag)) {
      return { isSafe: false, reason: `SVG contains prohibited tag '${tag.replace('<', '')}'.` };
    }
  }

  // Dangerous attribute schemes
  if (lower.includes('javascript:') || lower.includes('vbscript:') || lower.includes('data:text/html')) {
    return { isSafe: false, reason: 'SVG contains prohibited scripting URL scheme.' };
  }

  // Dangerous inline event handlers (e.g. onload, onerror, onclick)
  const eventRegex = /\bon[a-z]{3,15}\s*=/i;
  if (eventRegex.test(svgText)) {
    return { isSafe: false, reason: 'SVG contains prohibited inline event handlers.' };
  }

  return { isSafe: true };
}

/**
 * Lightweight dimensions extractor without large image processing libraries (sharp/jimp).
 * Extracts dimensions from image binary headers for PNG, GIF, JPEG, WebP, SVG.
 * Returns { width: null, height: null } if format cannot be reliably parsed.
 */
export function extractImageDimensions(
  buffer: Buffer,
  mimeType: AllowedMimeType
): { width: number | null; height: number | null } {
  try {
    switch (mimeType) {
      case 'image/png': {
        // In PNG, IHDR chunk is immediately after the 8-byte signature:
        // Bytes 16-19 = Width, Bytes 20-23 = Height (Big Endian)
        if (buffer.length >= 24) {
          const width = buffer.readUInt32BE(16);
          const height = buffer.readUInt32BE(20);
          return { width, height };
        }
        break;
      }

      case 'image/gif': {
        // GIF screen descriptor width/height at bytes 6-9 (Little Endian)
        if (buffer.length >= 10) {
          const width = buffer.readUInt16LE(6);
          const height = buffer.readUInt16LE(8);
          return { width, height };
        }
        break;
      }

      case 'image/webp': {
        if (buffer.length >= 30) {
          const format = buffer.subarray(12, 16).toString('ascii');
          if (format === 'VP8 ') {
            // Lossy VP8: bytes 26-29
            const width = buffer.readUInt16LE(26) & 0x3fff;
            const height = buffer.readUInt16LE(28) & 0x3fff;
            return { width, height };
          } else if (format === 'VP8L') {
            // Lossless VP8L: 14 bits width, 14 bits height
            const b1 = buffer[21];
            const b2 = buffer[22];
            const b3 = buffer[23];
            const b4 = buffer[24];
            const width = 1 + (((b2 & 0x3f) << 8) | b1);
            const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
            return { width, height };
          } else if (format === 'VP8X') {
            // Extended VP8X: 24 bits canvas width at 24-26, height at 27-29
            const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
            const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
            return { width, height };
          }
        }
        break;
      }

      case 'image/jpeg': {
        // Scan markers for SOF0 (0xFFC0) or SOF2 (0xFFC2)
        let offset = 2;
        while (offset < buffer.length - 8) {
          if (buffer[offset] !== 0xff) {
            offset++;
            continue;
          }
          const marker = buffer[offset + 1];
          // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          // Move past marker and segment length
          const segmentLength = buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        }
        break;
      }

      case 'image/svg+xml': {
        const svgStr = buffer.toString('utf8');
        // Try viewBox first: viewBox="minX minY width height"
        const viewBoxMatch = svgStr.match(/viewBox\s*=\s*["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
        if (viewBoxMatch) {
          const width = Math.round(parseFloat(viewBoxMatch[3]));
          const height = Math.round(parseFloat(viewBoxMatch[4]));
          if (!isNaN(width) && !isNaN(height)) {
            return { width, height };
          }
        }
        // Fallback to width/height attributes
        const widthMatch = svgStr.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i);
        const heightMatch = svgStr.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);
        if (widthMatch && heightMatch) {
          const width = Math.round(parseFloat(widthMatch[1]));
          const height = Math.round(parseFloat(heightMatch[1]));
          if (!isNaN(width) && !isNaN(height)) {
            return { width, height };
          }
        }
        break;
      }
    }
  } catch {
    // If parsing fails for any reason, return null dimensions safely
  }

  return { width: null, height: null };
}
