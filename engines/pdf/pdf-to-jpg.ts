import { loadPdfDocument } from './loader';
import { renderPdfPageToJpg } from './renderer';
import { createZipBlob } from '../shared/file-utils';
import { ToolError } from '../shared/errors';

export type PdfToJpgQuality = 'high' | 'medium' | 'low';
export type PdfToJpgScale = 1.0 | 1.5 | 2.0;

export interface PdfToJpgOptions {
  selectedPages: number[];
  scale?: PdfToJpgScale;
  quality?: PdfToJpgQuality;
}

export interface PdfToJpgPageResult {
  pageNumber: number;
  fileName: string;
  blob: Blob;
  size: number;
  width: number;
  height: number;
}

export interface PdfToJpgResult {
  originalFileName: string;
  originalSize: number;
  totalPages: number;
  convertedCount: number;
  totalConvertedSize: number;
  pages: PdfToJpgPageResult[];
  zipBlob?: Blob;
  zipFileName?: string;
}

export interface PdfToJpgProgress {
  progress: number;
  message: string;
  currentPage?: number;
  totalPages?: number;
}

/**
 * Sanitizes base filename to avoid unsafe characters, path traversal, or null bytes.
 */
export function sanitizePdfBaseName(fileName: string): string {
  // Strip extension
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  // Remove control characters (ASCII 0-31 and 127-159)
  const printableChars = Array.from(withoutExt)
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (code >= 32 && code < 127) || code > 159;
    })
    .join('');

  // Sanitize characters: allow alphanumeric, dash, underscore
  const sanitized = printableChars
    .replace(/[\\/:*?"<>|]/g, '-') // remove path/filesystem reserved chars
    .replace(/\.{2,}/g, '-') // remove directory traversal sequences like ..
    .replace(/-+/g, '-') // collapse multiple dashes
    .replace(/^-+|-+$/g, '') // trim leading and trailing dashes
    .trim();

  return sanitized || 'document';
}

/**
 * Maps quality name to JPEG quality float (0.0 to 1.0).
 */
export function mapJpgQualityToNumber(quality: PdfToJpgQuality): number {
  switch (quality) {
    case 'low':
      return 0.7;
    case 'medium':
      return 0.8;
    case 'high':
    default:
      return 0.9;
  }
}

/**
 * Converts selected pages of a PDF document into individual JPG images.
 */
export async function convertPdfToJpg(
  file: File,
  options: PdfToJpgOptions,
  onProgress?: (p: PdfToJpgProgress) => void
): Promise<PdfToJpgResult> {
  const { selectedPages, scale = 1.5, quality = 'high' } = options;

  if (!selectedPages || selectedPages.length === 0) {
    throw new ToolError('INVALID_FILE', 'Select at least one page to convert.');
  }

  onProgress?.({
    progress: 5,
    message: 'Loading PDF document...',
  });

  const { pdfDoc, pageCount } = await loadPdfDocument(file);

  // Validate that all selected pages are within document bounds
  const validPages = selectedPages.filter((p) => p >= 1 && p <= pageCount);
  if (validPages.length === 0) {
    throw new ToolError('INVALID_FILE', 'Select at least one page to convert.');
  }

  const cleanBaseName = sanitizePdfBaseName(file.name);
  const qualityVal = mapJpgQualityToNumber(quality);
  const totalToRender = validPages.length;

  onProgress?.({
    progress: 10,
    message: `Preparing ${totalToRender} ${totalToRender === 1 ? 'page' : 'pages'}...`,
  });

  const pageResults: PdfToJpgPageResult[] = [];
  let totalConvertedSize = 0;

  // Process selected pages strictly sequentially to prevent browser memory exhaustion
  for (let i = 0; i < totalToRender; i++) {
    const pageNum = validPages[i];
    const pageProgress = Math.round(15 + ((i + 0.1) / totalToRender) * 75);

    onProgress?.({
      progress: pageProgress,
      message: `Rendering page ${pageNum} of ${pageCount} (${i + 1}/${totalToRender})...`,
      currentPage: i + 1,
      totalPages: totalToRender,
    });

    const rendered = await renderPdfPageToJpg(pdfDoc, {
      pageNumber: pageNum,
      scale,
      quality: qualityVal,
      backgroundColor: '#FFFFFF',
    });

    const pageFileName = `${cleanBaseName}-page-${pageNum}.jpg`;
    totalConvertedSize += rendered.blob.size;

    pageResults.push({
      pageNumber: pageNum,
      fileName: pageFileName,
      blob: rendered.blob,
      size: rendered.blob.size,
      width: rendered.width,
      height: rendered.height,
    });
  }

  let zipBlob: Blob | undefined;
  let zipFileName: string | undefined;

  if (pageResults.length > 1) {
    onProgress?.({
      progress: 95,
      message: 'Creating ZIP package...',
    });

    const zipFiles = pageResults.map((p) => ({
      name: p.fileName,
      blob: p.blob,
    }));

    zipBlob = await createZipBlob(zipFiles);
    zipFileName = `${cleanBaseName}-jpg-images.zip`;
  }

  onProgress?.({
    progress: 100,
    message: 'PDF converted successfully',
  });

  return {
    originalFileName: file.name,
    originalSize: file.size,
    totalPages: pageCount,
    convertedCount: pageResults.length,
    totalConvertedSize,
    pages: pageResults,
    zipBlob,
    zipFileName,
  };
}
