import { PDFDocument } from 'pdf-lib';
import { ToolError } from '../shared/errors';
import { hasPdfMagicBytes } from '../shared/validation';
import {
  validateMergePdfFile,
  validateMergePdfBatch,
} from './validation';

export interface MergePdfOptions {
  outputFileName?: string;
}

export interface MergePdfProgress {
  stage: 'preparing' | 'processing' | 'finalizing' | 'completed';
  currentIndex?: number;
  totalCount?: number;
  fileName?: string;
  progress: number;
  message: string;
}

export interface MergePdfResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  mergedSize: number;
  pageCount: number;
  fileCount: number;
}

/**
 * Combines multiple PDF documents into a single PDF document in the exact specified order.
 * Pages from each PDF are copied directly without rasterization to preserve vector fonts and images.
 */
export async function mergePdfs(
  files: File[],
  options: MergePdfOptions = {},
  onProgress?: (progress: MergePdfProgress) => void
): Promise<MergePdfResult> {
  // 1. Batch Limit Validation
  const batchValidation = validateMergePdfBatch(files);
  if (!batchValidation.valid) {
    throw batchValidation.error || new ToolError('INVALID_FILE', 'Invalid file batch.');
  }

  const totalFiles = files.length;
  const originalSize = files.reduce((sum, f) => sum + f.size, 0);

  onProgress?.({
    stage: 'preparing',
    progress: 5,
    totalCount: totalFiles,
    message: 'Reading and validating PDF files...',
  });

  // 2. Validate individual files before processing
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const validation = await validateMergePdfFile(file);
    if (!validation.valid) {
      throw (
        validation.error ||
        new ToolError(
          'INVALID_FILE',
          `The file "${file.name}" is not a valid PDF. Please remove it or choose another PDF.`
        )
      );
    }
  }

  // 3. Sequential memory-safe PDF merging
  try {
    const mergedPdf = await PDFDocument.create();
    let totalMergedPages = 0;

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const progressVal = Math.round(10 + ((i + 0.5) / totalFiles) * 80);

      onProgress?.({
        stage: 'processing',
        currentIndex: i + 1,
        totalCount: totalFiles,
        fileName: file.name,
        progress: progressVal,
        message: `Merging "${file.name}" (${i + 1} of ${totalFiles})...`,
      });

      // Yield to browser event loop so progress updates paint
      await new Promise((resolve) => setTimeout(resolve, 0));

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (!hasPdfMagicBytes(bytes)) {
        throw new ToolError(
          'INVALID_FILE',
          `The file "${file.name}" is not a valid PDF. Please remove it or choose another PDF.`
        );
      }

      let sourcePdf: PDFDocument;
      try {
        sourcePdf = await PDFDocument.load(buffer, {
          ignoreEncryption: false,
        });
      } catch (loadErr: unknown) {
        const loadMsg = loadErr instanceof Error ? loadErr.message : '';
        if (/password|encrypt/i.test(loadMsg)) {
          throw new ToolError(
            'PASSWORD_PROTECTED',
            'This PDF is password-protected. Please provide an unlocked PDF.'
          );
        }
        if (/memory|allocation/i.test(loadMsg)) {
          throw new ToolError(
            'BROWSER_MEMORY_ERROR',
            'Your browser ran out of memory while merging these PDFs. Try merging fewer or smaller files.'
          );
        }
        throw new ToolError(
          'PDF_READ_ERROR',
          `We couldn't read "${file.name}". Please remove it or choose another PDF.`
        );
      }

      const pageIndices = sourcePdf.getPageIndices();
      if (pageIndices.length === 0) {
        throw new ToolError(
          'INVALID_FILE',
          `The file "${file.name}" does not contain any pages.`
        );
      }

      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
        totalMergedPages++;
      }
    }

    onProgress?.({
      stage: 'finalizing',
      progress: 95,
      totalCount: totalFiles,
      message: 'Finalizing merged PDF...',
    });

    const pdfBytes = await mergedPdf.save();
    const safeBuffer = new Uint8Array(pdfBytes).buffer;
    const blob = new Blob([safeBuffer], { type: 'application/pdf' });
    const outputFileName = options.outputFileName || 'merged.pdf';

    onProgress?.({
      stage: 'completed',
      progress: 100,
      totalCount: totalFiles,
      message: 'Merge complete',
    });

    return {
      blob,
      fileName: outputFileName,
      originalSize,
      mergedSize: blob.size,
      pageCount: totalMergedPages,
      fileCount: totalFiles,
    };
  } catch (err: unknown) {
    if (err instanceof ToolError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : '';
    if (
      message.includes('out of memory') ||
      message.includes('OutOfMemory') ||
      message.includes('allocation')
    ) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while merging these PDFs. Try merging fewer or smaller files.'
      );
    }
    if (/password|encrypt/i.test(message)) {
      throw new ToolError(
        'PASSWORD_PROTECTED',
        'This PDF is password-protected. Please provide an unlocked PDF.'
      );
    }
    throw new ToolError(
      'PDF_READ_ERROR',
      "We couldn't read one of your PDF files. Please remove it or choose another PDF."
    );
  }
}
