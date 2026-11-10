import { loadPdfDocument } from './loader';
import { renderPdfPageToPng } from './renderer';
import { createZipBlob } from '../shared/file-utils';
import { ToolError } from '../shared/errors';
import { sanitizePdfBaseName } from './pdf-to-jpg';

export type PdfToPngScale = 1.0 | 1.5 | 2.0;

export interface PdfToPngOptions {
  selectedPages: number[];
  scale?: PdfToPngScale;
}

export interface PdfToPngPageResult {
  pageNumber: number;
  fileName: string;
  blob: Blob;
  size: number;
  width: number;
  height: number;
}

export interface PdfToPngResult {
  originalFileName: string;
  originalSize: number;
  totalPages: number;
  convertedCount: number;
  totalConvertedSize: number;
  pages: PdfToPngPageResult[];
  zipBlob?: Blob;
  zipFileName?: string;
}

export interface PdfToPngProgress {
  progress: number;
  message: string;
  currentPage?: number;
  totalPages?: number;
}

export { sanitizePdfBaseName };

/**
 * Converts selected pages of a PDF document into individual lossless PNG images.
 */
export async function convertPdfToPng(
  file: File,
  options: PdfToPngOptions,
  onProgress?: (p: PdfToPngProgress) => void
): Promise<PdfToPngResult> {
  const { selectedPages, scale = 1.5 } = options;

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
  const totalToRender = validPages.length;

  onProgress?.({
    progress: 10,
    message: `Preparing ${totalToRender} ${totalToRender === 1 ? 'page' : 'pages'}...`,
  });

  const pageResults: PdfToPngPageResult[] = [];
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

    const rendered = await renderPdfPageToPng(pdfDoc, {
      pageNumber: pageNum,
      scale,
    });

    const pageFileName = `${cleanBaseName}-page-${pageNum}.png`;
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
    zipFileName = `${cleanBaseName}-png-images.zip`;
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
