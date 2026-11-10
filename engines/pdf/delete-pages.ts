import { PDFDocument } from 'pdf-lib';
import { ToolError } from '../shared/errors';
import { hasPdfMagicBytes } from '../shared/validation';
import { validateDeletePdfPagesFile } from './validation';
import { sanitizePdfBaseName } from './utils';
import type { PdfProcessingResult } from './convert';

export interface DeletePdfPagesOptions {
  pagesToDelete: number[]; // 1-indexed page numbers
  customBaseName?: string;
  outputFileName?: string;
}

// Backwards compatibility alias
export type PdfDeletePagesOptions = DeletePdfPagesOptions;

export interface DeletePdfPagesProgress {
  stage:
    | 'reading'
    | 'loading'
    | 'preparing'
    | 'deleting'
    | 'generating'
    | 'validating'
    | 'completed';
  progress: number;
  message: string;
}

export interface DeletePdfPagesResult extends PdfProcessingResult {
  blob: Blob;
  fileName: string;
  resultBlob: Blob;
  resultFileName: string;
  originalFileName: string;
  originalSize: number;
  convertedSize: number;
  resultSize: number;
  pageCount: number; // remaining page count
  originalPageCount: number;
  deletedPageCount: number;
  deletedPages: number[];
  remainingPages: number[];
}

/**
 * Removes selected pages from raw PDF bytes client-side using pdf-lib copyPages.
 * Preserves text searchability, vector graphics, dimensions, and image fidelity with zero rasterization.
 */
export async function deletePdfPagesBytes(
  inputData: ArrayBuffer | Uint8Array,
  fileName: string,
  options: DeletePdfPagesOptions,
  onProgress?: (progress: DeletePdfPagesProgress) => void
): Promise<{
  resultBytes: Uint8Array;
  originalSize: number;
  resultSize: number;
  originalPageCount: number;
  pageCount: number;
  deletedPageCount: number;
  deletedPages: number[];
  remainingPages: number[];
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

  const originalPageCount = sourceDoc.getPageCount();
  if (originalPageCount === 0) {
    throw new ToolError('INVALID_FILE', 'The PDF document contains no readable pages.');
  }

  // 3. Safety check: Single page document cannot have its only page deleted
  if (originalPageCount === 1) {
    throw new ToolError(
      'INVALID_FILE',
      'A single-page PDF cannot have its only page deleted. At least one page must remain in the PDF.'
    );
  }

  // 4. Validate pages to delete
  const pagesToDeleteInput = options.pagesToDelete || [];
  const deleteSet = new Set<number>();
  for (const p of pagesToDeleteInput) {
    if (typeof p === 'number' && p >= 1 && p <= originalPageCount) {
      deleteSet.add(p);
    }
  }

  if (deleteSet.size === 0) {
    throw new ToolError('INVALID_FILE', 'Please select at least one page to delete.');
  }

  // Safety rule: Never allow an empty output PDF
  if (deleteSet.size >= originalPageCount) {
    throw new ToolError(
      'INVALID_FILE',
      'At least one page must remain in the PDF. You cannot delete all pages.'
    );
  }

  const sortedDeletedPages = Array.from(deleteSet).sort((a, b) => a - b);
  const remainingPages: number[] = [];
  for (let i = 1; i <= originalPageCount; i++) {
    if (!deleteSet.has(i)) {
      remainingPages.push(i);
    }
  }

  onProgress?.({
    stage: 'preparing',
    progress: 40,
    message: `Preparing to remove ${sortedDeletedPages.length} ${sortedDeletedPages.length === 1 ? 'page' : 'pages'} (${remainingPages.length} remaining)...`,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  // 5. Deleting pages: Create clean PDF with only remaining pages
  onProgress?.({
    stage: 'deleting',
    progress: 60,
    message: 'Copying remaining pages without rasterization...',
  });

  let newDoc: PDFDocument;
  try {
    newDoc = await PDFDocument.create();
    const remainingIndices = remainingPages.map((p) => p - 1);
    const copiedPages = await newDoc.copyPages(sourceDoc, remainingIndices);
    for (const page of copiedPages) {
      newDoc.addPage(page);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (/memory|allocation/i.test(msg)) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while constructing the new PDF.'
      );
    }
    throw new ToolError('PROCESSING_FAILED', 'Failed to remove selected pages from the PDF.');
  }

  // 6. Generating output PDF
  onProgress?.({
    stage: 'generating',
    progress: 85,
    message: 'Saving output PDF document...',
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
    throw new ToolError('PROCESSING_FAILED', 'Failed to generate output PDF file.');
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
  const resultFileName = options.outputFileName || `${baseName}-pages-deleted.pdf`;

  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: 'Pages removed successfully!',
  });

  return {
    resultBytes,
    originalSize,
    resultSize: resultBytes.byteLength,
    originalPageCount,
    pageCount: remainingPages.length,
    deletedPageCount: sortedDeletedPages.length,
    deletedPages: sortedDeletedPages,
    remainingPages,
    resultFileName,
  };
}

/**
 * Removes selected pages from an uploaded PDF file client-side.
 */
export async function deletePdfPages(
  file: File,
  options: DeletePdfPagesOptions,
  onProgress?: (progress: DeletePdfPagesProgress) => void
): Promise<DeletePdfPagesResult> {
  // Validate file
  const validation = await validateDeletePdfPagesFile(file);
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
    originalPageCount,
    pageCount,
    deletedPageCount,
    deletedPages,
    remainingPages,
    resultFileName,
  } = await deletePdfPagesBytes(buffer, file.name, options, onProgress);

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
    originalPageCount,
    pageCount,
    deletedPageCount,
    deletedPages,
    remainingPages,
  };
}
