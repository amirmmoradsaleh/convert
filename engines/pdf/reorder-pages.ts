import { PDFDocument } from 'pdf-lib';
import { ToolError } from '../shared/errors';
import { hasPdfMagicBytes } from '../shared/validation';
import { validateReorderPdfPagesFile } from './validation';
import { sanitizePdfBaseName } from './utils';
import type { PdfProcessingResult } from './convert';

export interface ReorderPdfPagesOptions {
  newPageOrder: number[]; // Array of 1-indexed original page numbers in desired sequence
  customBaseName?: string;
  outputFileName?: string;
}

// Backwards compatibility alias
export type PdfReorderPagesOptions = ReorderPdfPagesOptions;

export interface ReorderPdfPagesProgress {
  stage:
    | 'reading'
    | 'loading'
    | 'preparing'
    | 'reordering'
    | 'generating'
    | 'validating'
    | 'completed';
  progress: number;
  message: string;
}

export interface ReorderPdfPagesResult extends PdfProcessingResult {
  blob: Blob;
  fileName: string;
  resultBlob: Blob;
  resultFileName: string;
  originalFileName: string;
  originalSize: number;
  convertedSize: number;
  resultSize: number;
  pageCount: number;
  originalPageOrder: number[];
  newPageOrder: number[];
  isOrderChanged: boolean;
}

/**
 * Validates that an array of 1-indexed page numbers represents a valid permutation of [1..pageCount].
 * Ensures every page index appears exactly once without duplicates, omissions, or out-of-range values.
 */
export function validatePageOrder(
  order: number[],
  pageCount: number
): { valid: boolean; error?: string } {
  if (!Array.isArray(order)) {
    return { valid: false, error: 'Page order must be an array of page numbers.' };
  }

  if (order.length !== pageCount) {
    return {
      valid: false,
      error: `Page order length (${order.length}) must match document page count (${pageCount}).`,
    };
  }

  const seen = new Set<number>();
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    if (typeof p !== 'number' || !Number.isInteger(p)) {
      return { valid: false, error: `Invalid page number at position ${i + 1}: ${p}` };
    }
    if (p < 1 || p > pageCount) {
      return {
        valid: false,
        error: `Page number ${p} is out of bounds (document has ${pageCount} pages).`,
      };
    }
    if (seen.has(p)) {
      return { valid: false, error: `Duplicate page number detected: ${p}.` };
    }
    seen.add(p);
  }

  if (seen.size !== pageCount) {
    return { valid: false, error: 'Page order does not contain all pages.' };
  }

  return { valid: true };
}

/**
 * Reorders PDF pages from raw PDF bytes client-side using pdf-lib copyPages.
 * Preserves text searchability, vector graphics, dimensions, and image fidelity with zero rasterization.
 */
export async function reorderPdfPagesBytes(
  inputData: ArrayBuffer | Uint8Array,
  fileName: string,
  options: ReorderPdfPagesOptions,
  onProgress?: (progress: ReorderPdfPagesProgress) => void
): Promise<{
  resultBytes: Uint8Array;
  originalSize: number;
  resultSize: number;
  pageCount: number;
  originalPageOrder: number[];
  newPageOrder: number[];
  isOrderChanged: boolean;
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
        'Your browser ran out of memory while loading this PDF. Try a smaller file.'
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

  const originalPageOrder = Array.from({ length: pageCount }, (_, i) => i + 1);
  const newPageOrder = options.newPageOrder || originalPageOrder;

  // 3. Validate target order
  const orderValidation = validatePageOrder(newPageOrder, pageCount);
  if (!orderValidation.valid) {
    throw new ToolError(
      'INVALID_FILE',
      orderValidation.error || 'Invalid page reordering. Every page must appear exactly once.'
    );
  }

  const isOrderChanged = !newPageOrder.every((p, i) => p === i + 1);

  // 4. Preparing stage
  onProgress?.({
    stage: 'preparing',
    progress: 40,
    message: `Preparing new page sequence (${newPageOrder.join(', ')})...`,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  // 5. Reordering pages using copyPages with desired indices
  onProgress?.({
    stage: 'reordering',
    progress: 60,
    message: 'Copying pages into requested order without rasterization...',
  });

  let newDoc: PDFDocument;
  try {
    newDoc = await PDFDocument.create();
    const targetIndices = newPageOrder.map((p) => p - 1);
    const copiedPages = await newDoc.copyPages(sourceDoc, targetIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/memory|allocation/i.test(msg)) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while rearranging PDF pages.'
      );
    }
    throw new ToolError('PROCESSING_FAILED', 'Failed to reorder pages in the PDF.');
  }

  // 6. Generating output PDF
  onProgress?.({
    stage: 'generating',
    progress: 85,
    message: 'Generating output PDF document...',
  });

  let resultBytes: Uint8Array;
  try {
    resultBytes = await newDoc.save();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/memory|allocation/i.test(msg)) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while saving the PDF document.'
      );
    }
    throw new ToolError('PROCESSING_FAILED', 'Failed to generate reordered PDF file.');
  }

  // 7. Validating output integrity
  onProgress?.({
    stage: 'validating',
    progress: 95,
    message: 'Verifying output document integrity...',
  });

  if (!hasPdfMagicBytes(resultBytes)) {
    throw new ToolError('PROCESSING_FAILED', 'Generated output is not a valid PDF.');
  }

  const baseName = options.customBaseName?.trim() || sanitizePdfBaseName(fileName);
  const resultFileName = options.outputFileName || `${baseName}-reordered.pdf`;

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'PDF pages reordered successfully!',
  });

  return {
    resultBytes,
    originalSize,
    resultSize: resultBytes.byteLength,
    pageCount,
    originalPageOrder,
    newPageOrder,
    isOrderChanged,
    resultFileName,
  };
}

/**
 * Reorders pages of an uploaded PDF file client-side.
 */
export async function reorderPdfPages(
  file: File,
  options: ReorderPdfPagesOptions,
  onProgress?: (progress: ReorderPdfPagesProgress) => void
): Promise<ReorderPdfPagesResult> {
  // Validate file
  const validation = await validateReorderPdfPagesFile(file);
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
    resultBytes,
    originalSize,
    resultSize,
    pageCount,
    originalPageOrder,
    newPageOrder,
    isOrderChanged,
    resultFileName,
  } = await reorderPdfPagesBytes(buffer, file.name, options, onProgress);

  const safeBuffer = new Uint8Array(resultBytes).buffer;
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
    originalPageOrder,
    newPageOrder,
    isOrderChanged,
  };
}
