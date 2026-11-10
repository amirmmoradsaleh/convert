import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ToolError } from '../shared/errors';
import { PDF_TO_JPG_LIMITS } from './validation';

export interface RenderPageOptions {
  pageNumber: number;
  scale?: number;
  quality?: number; // 0.1 to 1.0 (e.g. 0.90)
  backgroundColor?: string;
}

export interface RenderedPageResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Renders a single PDF page to a canvas and returns the canvas and dimensions.
 */
export async function renderPdfPageToCanvas(
  pdfDoc: PDFDocumentProxy,
  options: RenderPageOptions,
  targetCanvas?: HTMLCanvasElement
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const { pageNumber, scale = 1.5, backgroundColor } = options;

  if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
    throw new ToolError(
      'INVALID_FILE',
      `Page ${pageNumber} is out of bounds for document with ${pdfDoc.numPages} pages.`
    );
  }

  const page = await pdfDoc.getPage(pageNumber);

  try {
    const viewport = page.getViewport({ scale });
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    // Large dimension and memory check
    if (
      width > PDF_TO_JPG_LIMITS.MAX_CANVAS_DIMENSION ||
      height > PDF_TO_JPG_LIMITS.MAX_CANVAS_DIMENSION ||
      width * height > PDF_TO_JPG_LIMITS.MAX_CANVAS_PIXELS
    ) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while converting this PDF. Try fewer pages or a lower output scale.'
      );
    }

    const canvas = targetCanvas || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ToolError(
        'BROWSER_MEMORY_ERROR',
        'Your browser ran out of memory while converting this PDF. Try fewer pages or a lower output scale.'
      );
    }

    // Set background if specified (e.g. #FFFFFF for JPG). For PNG with alpha, backgroundColor is omitted
    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page.render(renderContext as any) as any).promise;

    return { canvas, width, height };
  } finally {
    if (typeof page.cleanup === 'function') {
      page.cleanup();
    }
  }
}

/**
 * Renders a single PDF page directly to a JPG Blob.
 */
export async function renderPdfPageToJpg(
  pdfDoc: PDFDocumentProxy,
  options: RenderPageOptions
): Promise<RenderedPageResult> {
  const { quality = 0.9, backgroundColor = '#FFFFFF' } = options;
  const { canvas, width, height } = await renderPdfPageToCanvas(pdfDoc, {
    ...options,
    backgroundColor,
  });

  try {
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(
              new ToolError(
                'BROWSER_MEMORY_ERROR',
                'Your browser ran out of memory while converting this PDF. Try fewer pages or a lower output scale.'
              )
            );
          }
        },
        'image/jpeg',
        quality
      );
    });

    return { blob, width, height };
  } finally {
    // Explicitly release canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Renders a single PDF page directly to a PNG Blob.
 */
export async function renderPdfPageToPng(
  pdfDoc: PDFDocumentProxy,
  options: RenderPageOptions
): Promise<RenderedPageResult> {
  const { canvas, width, height } = await renderPdfPageToCanvas(pdfDoc, options);

  try {
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) {
            resolve(b);
          } else {
            reject(
              new ToolError(
                'BROWSER_MEMORY_ERROR',
                'Your browser ran out of memory while converting this PDF. Try fewer pages or a lower output scale.'
              )
            );
          }
        },
        'image/png'
      );
    });

    if (blob.type !== 'image/png') {
      throw new ToolError('PROCESSING_FAILED', 'Failed to generate PNG image from PDF page.');
    }

    return { blob, width, height };
  } finally {
    // Explicitly release canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Generates a fast, low-scale thumbnail data URL for UI page preview.
 */
export async function renderPdfPageThumbnail(
  pdfDoc: PDFDocumentProxy,
  pageNumber: number,
  targetWidth = 140
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);

  try {
    const baseViewport = page.getViewport({ scale: 1.0 });
    const scale = targetWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (page.render(renderContext as any) as any).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch {
    return '';
  } finally {
    if (typeof page.cleanup === 'function') {
      page.cleanup();
    }
  }
}
