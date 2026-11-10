import { PDFDocument } from 'pdf-lib';
import { ToolError } from '../shared/errors';
import { hasPdfMagicBytes } from '../shared/validation';
import { createZipBlob } from '../shared/file-utils';
import { validateSplitPdfFile, ParsedSplitRange } from './validation';

export type SplitPdfMode = 'extract-pages' | 'split-all' | 'split-ranges';

export interface SplitPdfOptions {
  mode: SplitPdfMode;
  selectedPages?: number[]; // 1-based page numbers for 'extract-pages'
  ranges?: ParsedSplitRange[]; // for 'split-ranges'
  customBaseName?: string;
}

export interface SplitPdfOutputItem {
  fileName: string;
  blob: Blob;
  size: number;
  pageCount: number;
  pageNumbers: number[];
}

export interface SplitPdfResult {
  originalFileName: string;
  originalSize: number;
  totalPages: number;
  mode: SplitPdfMode;
  items: SplitPdfOutputItem[];
  zipBlob?: Blob;
  zipFileName?: string;
}

export interface SplitPdfProgress {
  stage: 'loading' | 'processing' | 'zipping' | 'completed';
  currentIndex?: number;
  totalCount?: number;
  fileName?: string;
  progress: number;
  message: string;
}

/**
 * Sanitizes base filename to prevent invalid characters in output files.
 */
export function sanitizePdfBaseName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  const printableChars = Array.from(withoutExt)
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (code >= 32 && code < 127) || code > 159;
    })
    .join('');

  const sanitized = printableChars
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');

  return sanitized || 'document';
}

interface SplitTargetChunk {
  fileName: string;
  pages: number[]; // 1-based page numbers
}

/**
 * Splits a PDF document client-side using pdf-lib copyPages into one or multiple lossless PDF documents.
 */
export async function splitPdf(
  file: File,
  options: SplitPdfOptions,
  onProgress?: (progress: SplitPdfProgress) => void
): Promise<SplitPdfResult> {
  // 1. Validate file
  const validation = await validateSplitPdfFile(file);
  if (!validation.valid) {
    throw (
      validation.error ||
      new ToolError('INVALID_FILE', 'The uploaded file is not a valid PDF document.')
    );
  }

  const baseName = options.customBaseName?.trim() || sanitizePdfBaseName(file.name);

  onProgress?.({
    stage: 'loading',
    progress: 5,
    message: 'Reading and validating PDF document...',
  });

  // 2. Load source PDF
  let sourcePdf: PDFDocument;
  let totalPages = 0;

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (!hasPdfMagicBytes(bytes)) {
      throw new ToolError(
        'INVALID_FILE',
        'This file is not a valid PDF. Please choose a valid PDF file.'
      );
    }

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
          'Your browser ran out of memory while reading this PDF.'
        );
      }
      throw new ToolError(
        'PDF_READ_ERROR',
        "We couldn't read this PDF file. Please try another file."
      );
    }

    totalPages = sourcePdf.getPageCount();
    if (totalPages === 0) {
      throw new ToolError('INVALID_FILE', 'The uploaded PDF document contains no pages.');
    }
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const msg = err instanceof Error ? err.message : '';
    if (/password|encrypt/i.test(msg)) {
      throw new ToolError(
        'PASSWORD_PROTECTED',
        'This PDF is password-protected. Please provide an unlocked PDF.'
      );
    }
    throw new ToolError(
      'PDF_READ_ERROR',
      "We couldn't read this PDF file. Please try another file."
    );
  }

  // 3. Build target chunks based on mode
  const chunks: SplitTargetChunk[] = [];

  if (options.mode === 'extract-pages') {
    const selected = options.selectedPages || [];
    if (selected.length === 0) {
      throw new ToolError('INVALID_FILE', 'Please select at least one page to extract.');
    }

    // Deduplicate and preserve original page sequence
    const uniquePages = Array.from(new Set(selected))
      .filter((p) => p >= 1 && p <= totalPages)
      .sort((a, b) => a - b);

    if (uniquePages.length === 0) {
      throw new ToolError('INVALID_FILE', 'No valid pages selected for extraction.');
    }

    for (const pageNum of uniquePages) {
      chunks.push({
        fileName: `${baseName}-page-${pageNum}.pdf`,
        pages: [pageNum],
      });
    }
  } else if (options.mode === 'split-all') {
    for (let p = 1; p <= totalPages; p++) {
      chunks.push({
        fileName: `${baseName}-page-${p}.pdf`,
        pages: [p],
      });
    }
  } else if (options.mode === 'split-ranges') {
    const ranges = options.ranges || [];
    if (ranges.length === 0) {
      throw new ToolError(
        'INVALID_FILE',
        'Please specify at least one valid page range (e.g. 1-3, 4-8).'
      );
    }

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const validPages = r.pages.filter((p) => p >= 1 && p <= totalPages);
      if (validPages.length === 0) continue;

      const fileName =
        r.start === r.end
          ? `${baseName}-page-${r.start}.pdf`
          : `${baseName}-pages-${r.start}-${r.end}.pdf`;

      chunks.push({
        fileName,
        pages: validPages,
      });
    }

    if (chunks.length === 0) {
      throw new ToolError('INVALID_FILE', 'No valid page ranges specified.');
    }
  }

  // 4. Generate output PDFs sequentially
  const outputItems: SplitPdfOutputItem[] = [];
  const totalChunks = chunks.length;

  try {
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks[i];
      const progressVal = Math.round(10 + ((i + 0.5) / totalChunks) * 75);

      onProgress?.({
        stage: 'processing',
        currentIndex: i + 1,
        totalCount: totalChunks,
        fileName: chunk.fileName,
        progress: progressVal,
        message: `Creating "${chunk.fileName}" (${i + 1} of ${totalChunks})...`,
      });

      // Yield briefly to event loop so browser UI updates
      await new Promise((resolve) => setTimeout(resolve, 0));

      const newPdf = await PDFDocument.create();
      // Map 1-based page numbers to 0-based page indices
      const pageIndices = chunk.pages.map((p) => p - 1);
      const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);

      for (const page of copiedPages) {
        newPdf.addPage(page);
      }

      const pdfBytes = await newPdf.save();
      const safeBuffer = new Uint8Array(pdfBytes).buffer;
      const blob = new Blob([safeBuffer], { type: 'application/pdf' });

      outputItems.push({
        fileName: chunk.fileName,
        blob,
        size: blob.size,
        pageCount: chunk.pages.length,
        pageNumbers: chunk.pages,
      });
    }

    // 5. Generate ZIP archive if multiple files produced
    let zipBlob: Blob | undefined;
    let zipFileName: string | undefined;

    if (outputItems.length > 1) {
      onProgress?.({
        stage: 'zipping',
        progress: 92,
        totalCount: totalChunks,
        message: 'Packaging files into ZIP archive...',
      });

      zipBlob = await createZipBlob(
        outputItems.map((item) => ({
          name: item.fileName,
          blob: item.blob,
        }))
      );
      zipFileName = `${baseName}-split.zip`;
    }

    onProgress?.({
      stage: 'completed',
      progress: 100,
      totalCount: totalChunks,
      message: 'PDF split completed successfully!',
    });

    return {
      originalFileName: file.name,
      originalSize: file.size,
      totalPages,
      mode: options.mode,
      items: outputItems,
      zipBlob,
      zipFileName,
    };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const msg = err instanceof Error ? err.message : '';
    if (/memory|allocation/i.test(msg)) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while generating the split PDF files.'
      );
    }
    throw new ToolError(
      'PROCESSING_FAILED',
      'An unexpected error occurred while splitting the PDF document.'
    );
  }
}
