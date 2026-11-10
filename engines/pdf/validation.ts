import { ToolError } from '../shared/errors';
import {
  VALIDATION_LIMITS,
  hasJpegMagicBytes,
  hasPngMagicBytes,
  hasWebpMagicBytes,
  hasPdfMagicBytes,
  isAnimatedWebp,
} from '../shared/validation';

export const PDF_TO_JPG_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  MAX_PAGE_COUNT: 250,
  MAX_CANVAS_DIMENSION: 8192,
  MAX_CANVAS_PIXELS: 67108864, // 8192 * 8192
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const PDF_TO_PNG_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  MAX_PAGE_COUNT: 250,
  MAX_CANVAS_DIMENSION: 8192,
  MAX_CANVAS_PIXELS: 67108864, // 8192 * 8192
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const MERGE_PDF_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB per file
  MAX_BATCH_FILES: 20,
  MIN_FILES: 2,
  MAX_AGGREGATE_SIZE: 250 * 1024 * 1024, // 250 MB total batch limit
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const SPLIT_PDF_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  MAX_PAGE_COUNT: 500,
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const COMPRESS_PDF_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const ROTATE_PDF_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const DELETE_PDF_PAGES_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const REORDER_PDF_PAGES_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_FILES: 1,
  ALLOWED_EXTENSIONS: ['pdf'],
  ALLOWED_MIMES: ['application/pdf', 'application/x-pdf'],
};

export const IMAGE_TO_PDF_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_BATCH_FILES: 20,
  MAX_DIMENSION: 8192,
  MAX_PIXEL_COUNT: 67108864, // 8192 * 8192
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'webp'],
  ALLOWED_MIMES: ['image/jpeg', 'image/png', 'image/webp'],
};

export const JPG_TO_PDF_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_BATCH_FILES: 20,
  MAX_DIMENSION: 8192,
  MAX_PIXEL_COUNT: 67108864, // 8192 * 8192
  ALLOWED_EXTENSIONS: ['jpg', 'jpeg'],
  ALLOWED_MIMES: ['image/jpeg', 'image/pjpeg'],
};

export const PNG_TO_PDF_LIMITS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
  MAX_BATCH_FILES: 20,
  MAX_DIMENSION: 8192,
  MAX_PIXEL_COUNT: 67108864, // 8192 * 8192
  ALLOWED_EXTENSIONS: ['png'],
  ALLOWED_MIMES: ['image/png'],
};

export async function validatePngToPdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  // 1. File size check
  if (file.size > PNG_TO_PDF_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. The maximum image size is 50 MB.'),
    };
  }

  // 2. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!PNG_TO_PDF_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This file format is not supported. Please upload a PNG image.'
      ),
    };
  }

  // 3. MIME type check if present
  const conflictingMimes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'text/plain',
    'application/zip',
  ];
  if (
    file.type &&
    (conflictingMimes.includes(file.type.toLowerCase()) ||
      !file.type.toLowerCase().includes('png'))
  ) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This file format is not supported. Please upload a PNG image.'
      ),
    };
  }

  // 4. Binary signature check (PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A)
  try {
    const slice = file.slice(0, 4096);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (!hasPngMagicBytes(bytes)) {
      return {
        valid: false,
        error: new ToolError(
          'INVALID_FILE',
          "We couldn't read this PNG file. Please try another image."
        ),
      };
    }
  } catch {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        "We couldn't read this PNG file. Please try another image."
      ),
    };
  }

  return { valid: true };
}

export function validatePngToPdfBatch(files: File[]): { valid: boolean; error?: ToolError } {
  if (files.length === 0) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'Please select at least one image.'),
    };
  }
  if (files.length > PNG_TO_PDF_LIMITS.MAX_BATCH_FILES) {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        `You can convert up to ${PNG_TO_PDF_LIMITS.MAX_BATCH_FILES} images at a time.`
      ),
    };
  }
  return { valid: true };
}

export async function validateJpgToPdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  // 1. File size check
  if (file.size > JPG_TO_PDF_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. The maximum image size is 50 MB.'),
    };
  }

  // 2. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!JPG_TO_PDF_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'Only JPG and JPEG images are supported by this tool.'
      ),
    };
  }

  // 3. MIME type check if present
  const conflictingMimes = [
    'application/pdf',
    'image/png',
    'image/webp',
    'image/gif',
    'image/bmp',
    'image/heic',
    'image/heif',
    'image/svg+xml',
    'text/plain',
    'application/zip',
  ];
  if (
    file.type &&
    (conflictingMimes.includes(file.type.toLowerCase()) ||
      (!file.type.toLowerCase().includes('jpeg') && !file.type.toLowerCase().includes('jpg')))
  ) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'Only JPG and JPEG images are supported by this tool.'
      ),
    };
  }

  // 4. Binary signature check (JPEG magic bytes: FF D8 FF)
  try {
    const slice = file.slice(0, 4096);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (!hasJpegMagicBytes(bytes)) {
      return {
        valid: false,
        error: new ToolError(
          'INVALID_FILE',
          'This file is not a valid JPG image. Please choose a valid JPG or JPEG file.'
        ),
      };
    }
  } catch {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        'This file is not a valid JPG image. Please choose a valid JPG or JPEG file.'
      ),
    };
  }

  return { valid: true };
}

export function validateJpgToPdfBatch(files: File[]): { valid: boolean; error?: ToolError } {
  if (files.length === 0) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'Please select at least one image.'),
    };
  }
  if (files.length > JPG_TO_PDF_LIMITS.MAX_BATCH_FILES) {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        `You can convert up to ${JPG_TO_PDF_LIMITS.MAX_BATCH_FILES} images at a time.`
      ),
    };
  }
  return { valid: true };
}

export async function validateImageToPdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  // 1. File size check
  if (file.size > IMAGE_TO_PDF_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. The maximum image size is 50 MB.'),
    };
  }

  // 2. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!IMAGE_TO_PDF_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This file format is not supported. Please upload a JPG, PNG, or WebP image.'
      ),
    };
  }

  // 3. MIME type check if present
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
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This file format is not supported. Please upload a JPG, PNG, or WebP image.'
      ),
    };
  }

  // 4. Binary signature check
  try {
    const slice = file.slice(0, 4096);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (ext === 'jpg' || ext === 'jpeg') {
      if (!hasJpegMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', "We couldn't read this image. Please try another file."),
        };
      }
    } else if (ext === 'png') {
      if (!hasPngMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', "We couldn't read this image. Please try another file."),
        };
      }
    } else if (ext === 'webp') {
      if (!hasWebpMagicBytes(bytes)) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', "We couldn't read this image. Please try another file."),
        };
      }
      if (isAnimatedWebp(bytes)) {
        return {
          valid: false,
          error: new ToolError('UNSUPPORTED_FORMAT', 'Animated WebP files are not supported.'),
        };
      }
    }
  } catch {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', "We couldn't read this image. Please try another file."),
    };
  }

  return { valid: true };
}

export function validateImageToPdfBatch(files: File[]): { valid: boolean; error?: ToolError } {
  if (files.length === 0) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'Please select at least one image.'),
    };
  }
  if (files.length > IMAGE_TO_PDF_LIMITS.MAX_BATCH_FILES) {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        `You can convert up to ${IMAGE_TO_PDF_LIMITS.MAX_BATCH_FILES} images at a time.`
      ),
    };
  }
  return { valid: true };
}

export async function validatePdfToJpgFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  // 1. File size check (100 MB max)
  if (file.size > PDF_TO_JPG_LIMITS.MAX_FILE_SIZE) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. The maximum PDF size is 100 MB.'),
    };
  }

  // 2. Empty file check
  if (file.size === 0) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is empty. Please choose a valid PDF file.'),
    };
  }

  // 3. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!PDF_TO_JPG_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This file is not a valid PDF. Please choose a valid PDF file.'
      ),
    };
  }

  // 4. MIME type check if present
  const conflictingMimes = [
    'image/jpeg',
    'image/jpg',
    'image/pjpeg',
    'image/png',
    'image/webp',
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
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This file is not a valid PDF. Please choose a valid PDF file.'
      ),
    };
  }

  // 5. Binary signature check (PDF magic bytes %PDF-)
  try {
    const slice = file.slice(0, 4096);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (!hasPdfMagicBytes(bytes)) {
      return {
        valid: false,
        error: new ToolError(
          'INVALID_FILE',
          'This file is not a valid PDF. Please choose a valid PDF file.'
        ),
      };
    }
  } catch {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        "We couldn't read this PDF. Please try another file."
      ),
    };
  }

  return { valid: true };
}

export async function validatePdfToPngFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export async function validateMergePdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export function validateMergePdfBatch(
  files: File[]
): { valid: boolean; error?: ToolError } {
  if (!files || files.length === 0) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'Select at least 2 PDF files to merge.'),
    };
  }

  if (files.length < MERGE_PDF_LIMITS.MIN_FILES) {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        'Add at least one more PDF to merge.'
      ),
    };
  }

  if (files.length > MERGE_PDF_LIMITS.MAX_BATCH_FILES) {
    return {
      valid: false,
      error: new ToolError(
        'INVALID_FILE',
        `You can merge up to ${MERGE_PDF_LIMITS.MAX_BATCH_FILES} PDF files at a time.`
      ),
    };
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  if (totalSize > MERGE_PDF_LIMITS.MAX_AGGREGATE_SIZE) {
    return {
      valid: false,
      error: new ToolError(
        'FILE_TOO_LARGE',
        `Total batch size exceeds the limit of ${Math.round(
          MERGE_PDF_LIMITS.MAX_AGGREGATE_SIZE / (1024 * 1024)
        )} MB. Try merging fewer or smaller files.`
      ),
    };
  }

  return { valid: true };
}

/**
 * Validates and parses page range expressions like "1-3, 5, 8-10".
 * Returns strict error if any page token is out of bounds (1..totalPages) or malformed.
 */
export function validateAndParsePageRange(
  rangeStr: string,
  totalPages: number
): { valid: boolean; pages: number[]; error?: string } {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return { valid: false, pages: [], error: 'Select at least one page to convert.' };
  }

  const parts = trimmed.split(',').map((p) => p.trim());
  const pageSet = new Set<number>();

  for (const part of parts) {
    if (!part) {
      return {
        valid: false,
        pages: [],
        error: `Invalid page selection expression "${rangeStr}".`,
      };
    }

    if (part.includes('-')) {
      const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) {
        return {
          valid: false,
          pages: [],
          error: `Invalid page range "${part}". Use formats like "1-5".`,
        };
      }
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);

      if (start < 1 || start > totalPages) {
        return {
          valid: false,
          pages: [],
          error: `Page ${start} is out of range. This document has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }
      if (end < 1 || end > totalPages) {
        return {
          valid: false,
          pages: [],
          error: `Page ${end} is out of range. This document has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }
      if (start > end) {
        return {
          valid: false,
          pages: [],
          error: `Invalid range "${part}". Start page (${start}) cannot be greater than end page (${end}).`,
        };
      }

      for (let i = start; i <= end; i++) {
        pageSet.add(i);
      }
    } else {
      const match = part.match(/^(\d+)$/);
      if (!match) {
        return {
          valid: false,
          pages: [],
          error: `Invalid page number "${part}". Use formats like "1, 3, 5".`,
        };
      }
      const page = parseInt(match[1], 10);
      if (page < 1 || page > totalPages) {
        return {
          valid: false,
          pages: [],
          error: `Page ${page} is out of range. This document has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }
      pageSet.add(page);
    }
  }

  if (pageSet.size === 0) {
    return { valid: false, pages: [], error: 'Select at least one page to convert.' };
  }

  return {
    valid: true,
    pages: Array.from(pageSet).sort((a, b) => a - b),
  };
}

export async function validateSplitPdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export async function validateCompressPdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export async function validateRotatePdfFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export async function validateDeletePdfPagesFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export async function validateReorderPdfPagesFile(
  file: File
): Promise<{ valid: boolean; error?: ToolError }> {
  return validatePdfToJpgFile(file);
}

export interface ParsedSplitRange {
  start: number;
  end: number;
  pages: number[];
  label: string;
}

/**
 * Parses split page ranges like "1-3, 4-8, 9-12" or "1-5, 8" into discrete range segments.
 */
export function parseSplitRanges(
  rangeStr: string,
  totalPages: number
): { valid: boolean; ranges: ParsedSplitRange[]; error?: string } {
  const trimmed = rangeStr.trim();
  if (!trimmed) {
    return {
      valid: false,
      ranges: [],
      error: 'Please specify at least one page or page range (e.g. 1-3, 4-8).',
    };
  }

  // Support splitting by comma, semicolon, or newline
  const parts = trimmed
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      valid: false,
      ranges: [],
      error: 'Please specify at least one page or page range (e.g. 1-3, 4-8).',
    };
  }

  const ranges: ParsedSplitRange[] = [];

  for (const part of parts) {
    if (part.includes('-')) {
      const match = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) {
        return {
          valid: false,
          ranges: [],
          error: `Invalid page range "${part}". Use formats like "1-5" or "1, 3, 5".`,
        };
      }
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);

      if (start < 1 || start > totalPages) {
        return {
          valid: false,
          ranges: [],
          error: `Page ${start} in range "${part}" is out of range. Document has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }
      if (end < 1 || end > totalPages) {
        return {
          valid: false,
          ranges: [],
          error: `Page ${end} in range "${part}" is out of range. Document has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }
      if (start > end) {
        return {
          valid: false,
          ranges: [],
          error: `Invalid range "${part}". Start page (${start}) cannot be greater than end page (${end}).`,
        };
      }

      const pages: number[] = [];
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      ranges.push({
        start,
        end,
        pages,
        label: start === end ? `Page ${start}` : `Pages ${start}-${end}`,
      });
    } else {
      const match = part.match(/^(\d+)$/);
      if (!match) {
        return {
          valid: false,
          ranges: [],
          error: `Invalid page number "${part}". Use numbers like "1, 3, 5".`,
        };
      }
      const page = parseInt(match[1], 10);
      if (page < 1 || page > totalPages) {
        return {
          valid: false,
          ranges: [],
          error: `Page ${page} is out of range. Document has ${totalPages} ${
            totalPages === 1 ? 'page' : 'pages'
          }.`,
        };
      }

      ranges.push({
        start: page,
        end: page,
        pages: [page],
        label: `Page ${page}`,
      });
    }
  }

  if (ranges.length === 0) {
    return {
      valid: false,
      ranges: [],
      error: 'Please specify at least one valid page range.',
    };
  }

  return {
    valid: true,
    ranges,
  };
}

export function validatePdfFile(file: File): { valid: boolean; error?: ToolError } {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Please select a valid PDF document.'),
    };
  }
  if (file.size > VALIDATION_LIMITS.MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'PDF file exceeds the 100 MB limit.'),
    };
  }
  return { valid: true };
}
