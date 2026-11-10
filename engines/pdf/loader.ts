import './polyfills';
import * as pdfjsLib from 'pdfjs-dist';
import { ToolError } from '../shared/errors';

export interface LoadedPdfDocument {
  pageCount: number;
  data: ArrayBuffer;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  fingerprint: string;
}

export const PDFJS_WORKER_LOCAL_PATH = '/vendor/pdfjs/pdf.worker.min.mjs';

/**
 * Configure worker source for client-side environments.
 * Uses locally hosted same-origin worker asset to eliminate external CDN dependencies (SEC-02).
 */
export function configurePdfJsWorker(): void {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_LOCAL_PATH;
  }
}

/**
 * Loads a PDF document using PDF.js and returns the document proxy and page count.
 */
export async function loadPdfDocument(
  fileOrData: File | ArrayBuffer | Uint8Array
): Promise<LoadedPdfDocument> {
  configurePdfJsWorker();
  let data: ArrayBuffer;
  if (fileOrData instanceof File) {
    data = await fileOrData.arrayBuffer();
  } else if (fileOrData instanceof Uint8Array) {
    data = fileOrData.buffer.slice(
      fileOrData.byteOffset,
      fileOrData.byteOffset + fileOrData.byteLength
    ) as ArrayBuffer;
  } else {
    data = fileOrData;
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      useWorkerFetch: false,
    });

    loadingTask.onPassword = () => {
      throw new ToolError(
        'PASSWORD_PROTECTED',
        'This PDF is password-protected. Please provide an unlocked PDF.'
      );
    };

    const pdfDoc = await loadingTask.promise;
    return {
      pageCount: pdfDoc.numPages,
      data,
      pdfDoc,
      fingerprint: pdfDoc.fingerprints?.[0] || 'pdf-doc',
    };
  } catch (err: unknown) {
    const errAny = err as { name?: string; message?: string };
    if (
      errAny?.name === 'PasswordException' ||
      (typeof errAny?.message === 'string' && /password/i.test(errAny.message))
    ) {
      throw new ToolError(
        'PASSWORD_PROTECTED',
        'This PDF is password-protected. Please provide an unlocked PDF.'
      );
    }
    if (
      errAny?.name === 'InvalidPDFException' ||
      (typeof errAny?.message === 'string' &&
        (/invalid/i.test(errAny.message) || /corrupt/i.test(errAny.message)))
    ) {
      throw new ToolError('INVALID_FILE', "We couldn't read this PDF. Please try another file.");
    }
    if (err instanceof ToolError) {
      throw err;
    }
    throw new ToolError('PDF_READ_ERROR', "We couldn't read this PDF. Please try another file.");
  }
}

/**
 * Extracts plain text content from a specified page of a loaded PDF document.
 */
export async function extractPdfText(
  loaded: LoadedPdfDocument,
  pageNumber: number = 1
): Promise<string> {
  const page = await loaded.pdfDoc.getPage(pageNumber);
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => ('str' in item ? (item as { str: string }).str : ''))
    .filter(Boolean)
    .join(' ');
}
