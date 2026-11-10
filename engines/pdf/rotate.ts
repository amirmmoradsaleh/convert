import { PDFDocument, degrees } from 'pdf-lib';
import { ToolError } from '../shared/errors';
import { hasPdfMagicBytes } from '../shared/validation';
import { validateRotatePdfFile } from './validation';
import { sanitizePdfBaseName } from './utils';
import type { PdfProcessingResult } from './convert';

export type RotateDegrees = 90 | 180 | 270;
export type RotateScope = 'all' | 'selected';

export interface RotatePdfOptions {
  degrees?: RotateDegrees;
  angle?: RotateDegrees; // alias for degrees
  scope?: RotateScope;
  pages?: number[]; // 1-based page numbers
  selectedPages?: number[]; // alias for pages
  customBaseName?: string;
  outputFileName?: string;
}

// Backwards compatibility alias with existing stub
export type PdfRotateOptions = RotatePdfOptions;

export interface RotatePdfProgress {
  stage:
    | 'reading'
    | 'loading'
    | 'preparing'
    | 'rotating'
    | 'generating'
    | 'validating'
    | 'completed';
  progress: number;
  message: string;
  currentPage?: number;
  totalPages?: number;
}

export interface RotatePdfResult extends PdfProcessingResult {
  blob: Blob;
  fileName: string;
  resultBlob: Blob;
  resultFileName: string;
  originalFileName: string;
  originalSize: number;
  convertedSize: number;
  resultSize: number;
  pageCount: number;
  rotatedPageCount: number;
  degrees: RotateDegrees;
  angle: RotateDegrees;
}

/**
 * Rotates pages in raw PDF bytes using pdf-lib client-side.
 * Does not rasterize pages, preserving vector graphics, fonts, searchability, and text layout.
 */
export async function rotatePdfBytes(
  inputData: ArrayBuffer | Uint8Array,
  fileName: string,
  options: RotatePdfOptions = {},
  onProgress?: (progress: RotatePdfProgress) => void
): Promise<{
  rotatedBytes: Uint8Array;
  originalSize: number;
  resultSize: number;
  pageCount: number;
  rotatedPageCount: number;
  angle: RotateDegrees;
  resultFileName: string;
}> {
  const originalBytes = inputData instanceof Uint8Array ? inputData : new Uint8Array(inputData);
  const originalSize = originalBytes.byteLength;

  if (originalSize === 0) {
    throw new ToolError('INVALID_FILE', "We couldn't read this PDF. Please choose a valid PDF file.");
  }

  if (!hasPdfMagicBytes(originalBytes)) {
    throw new ToolError('INVALID_FILE', 'This file is not a valid PDF. Please choose a valid PDF file.');
  }

  const angle: RotateDegrees = options.angle ?? options.degrees ?? 90;
  if (![90, 180, 270].includes(angle)) {
    throw new ToolError('INVALID_FILE', 'Invalid rotation angle. Must be 90, 180, or 270 degrees.');
  }

  // 1. Reading stage
  onProgress?.({
    stage: 'reading',
    progress: 10,
    message: 'Reading PDF document...',
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  // 2. Loading document stage
  onProgress?.({
    stage: 'loading',
    progress: 25,
    message: 'Loading PDF document structure...',
  });

  let sourceDoc: PDFDocument;
  try {
    sourceDoc = await PDFDocument.load(originalBytes, {
      ignoreEncryption: false,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/password|encrypt/i.test(msg)) {
      throw new ToolError(
        'PASSWORD_PROTECTED',
        'This PDF is password-protected. Please provide an unlocked PDF.'
      );
    }
    if (/memory|allocation/i.test(msg)) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while rotating this PDF. Try a smaller file.'
      );
    }
    throw new ToolError(
      'INVALID_FILE',
      "We couldn't read this PDF. The file may be damaged or not a supported PDF."
    );
  }

  const pageCount = sourceDoc.getPageCount();
  if (pageCount === 0) {
    throw new ToolError('INVALID_FILE', 'The PDF document contains no readable pages.');
  }

  // 3. Preparing target pages
  const scope: RotateScope = options.scope ?? (options.pages || options.selectedPages ? 'selected' : 'all');
  const targetPagesInput = options.selectedPages ?? options.pages ?? [];

  const targetPagesSet = new Set<number>();
  if (scope === 'all') {
    for (let i = 1; i <= pageCount; i++) {
      targetPagesSet.add(i);
    }
  } else {
    for (const p of targetPagesInput) {
      if (typeof p === 'number' && p >= 1 && p <= pageCount) {
        targetPagesSet.add(p);
      }
    }
    if (targetPagesSet.size === 0) {
      throw new ToolError('INVALID_FILE', 'Please select at least one page to rotate.');
    }
  }

  onProgress?.({
    stage: 'preparing',
    progress: 35,
    message: `Preparing to rotate ${targetPagesSet.size} ${targetPagesSet.size === 1 ? 'page' : 'pages'} by ${angle}°...`,
  });

  // 4. Rotating pages stage
  let rotatedCount = 0;
  for (let i = 1; i <= pageCount; i++) {
    if (targetPagesSet.has(i)) {
      const page = sourceDoc.getPage(i - 1);
      const currentAngle = page.getRotation().angle;
      const newAngle = ((currentAngle + angle) % 360 + 360) % 360;
      page.setRotation(degrees(newAngle));
      rotatedCount++;
    }

    if (i % 5 === 0 || i === pageCount) {
      const progressVal = Math.round(35 + (i / pageCount) * 45);
      onProgress?.({
        stage: 'rotating',
        progress: progressVal,
        message: `Rotating page ${i} of ${pageCount}...`,
        currentPage: i,
        totalPages: pageCount,
      });
      // Yield to browser event loop
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // 5. Generating rotated PDF stage
  onProgress?.({
    stage: 'generating',
    progress: 85,
    message: 'Saving updated PDF document...',
  });

  let rotatedBytes: Uint8Array;
  try {
    rotatedBytes = await sourceDoc.save();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/memory|allocation/i.test(msg)) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while saving the rotated PDF.'
      );
    }
    throw new ToolError('PROCESSING_FAILED', 'Failed to generate the rotated PDF.');
  }

  // 6. Validating stage
  onProgress?.({
    stage: 'validating',
    progress: 95,
    message: 'Verifying rotated PDF integrity...',
  });

  if (!hasPdfMagicBytes(rotatedBytes)) {
    throw new ToolError('PROCESSING_FAILED', 'Generated output is not a valid PDF.');
  }

  const baseName = options.customBaseName?.trim() || sanitizePdfBaseName(fileName);
  const resultFileName = options.outputFileName || `${baseName}-rotated.pdf`;

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'PDF rotation complete!',
  });

  return {
    rotatedBytes,
    originalSize,
    resultSize: rotatedBytes.byteLength,
    pageCount,
    rotatedPageCount: rotatedCount,
    angle,
    resultFileName,
  };
}

/**
 * Rotates a PDF file client-side using pdf-lib.
 * Preserves all vector content, fonts, searchability, and text layout.
 */
export async function rotatePdf(
  file: File,
  options: RotatePdfOptions = {},
  onProgress?: (progress: RotatePdfProgress) => void
): Promise<RotatePdfResult> {
  // Validate file
  const validation = await validateRotatePdfFile(file);
  if (!validation.valid) {
    throw (
      validation.error ||
      new ToolError('INVALID_FILE', 'The uploaded file is not a valid PDF document.')
    );
  }

  onProgress?.({
    stage: 'reading',
    progress: 5,
    message: 'Reading PDF file...',
  });

  const buffer = await file.arrayBuffer();
  const {
    rotatedBytes,
    originalSize,
    resultSize,
    pageCount,
    rotatedPageCount,
    angle,
    resultFileName,
  } = await rotatePdfBytes(buffer, file.name, options, onProgress);

  const safeBuffer = new Uint8Array(rotatedBytes).buffer;
  const resultBlob = new Blob([safeBuffer], { type: 'application/pdf' });

  return {
    blob: resultBlob,
    fileName: resultFileName,
    resultBlob,
    resultFileName,
    originalFileName: file.name,
    originalSize,
    convertedSize: resultSize,
    resultSize,
    pageCount,
    rotatedPageCount,
    degrees: angle,
    angle,
  };
}
