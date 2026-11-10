import { PDFDocument } from 'pdf-lib';
import type { PdfWorkerRequest, PdfWorkerResponse } from './worker-types';
import { calculatePageLayout } from '../image-to-pdf';
import { hasJpegMagicBytes, hasPngMagicBytes } from '../../shared/validation';
import { rotatePdfBytes, RotatePdfOptions } from '../rotate';
import { deletePdfPagesBytes, DeletePdfPagesOptions } from '../delete-pages';
import { reorderPdfPagesBytes, ReorderPdfPagesOptions } from '../reorder-pages';

/**
 * Handles PDF worker message events.
 */
export async function processPdfWorkerJob(
  request: PdfWorkerRequest,
  postMessageFn: (response: PdfWorkerResponse) => void
): Promise<void> {
  const { id, operation, files, options } = request;

  if (operation === 'image-to-pdf') {
    try {
      const totalFiles = files.length;
      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'preparing',
        progress: 10,
        totalCount: totalFiles,
      });

      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < totalFiles; i++) {
        const fileItem = files[i];
        const bytes = new Uint8Array(fileItem.data);
        const progressVal = Math.round(10 + ((i + 0.5) / totalFiles) * 80);

        postMessageFn({
          id,
          type: 'progress',
          success: true,
          stage: 'processing',
          currentIndex: i + 1,
          totalCount: totalFiles,
          fileName: fileItem.name,
          progress: progressVal,
        });

        let embeddedImage;
        const ext = fileItem.name.split('.').pop()?.toLowerCase() || '';

        if (ext === 'jpg' || ext === 'jpeg' || hasJpegMagicBytes(bytes)) {
          embeddedImage = await pdfDoc.embedJpg(bytes);
        } else if (ext === 'png' || hasPngMagicBytes(bytes)) {
          embeddedImage = await pdfDoc.embedPng(bytes);
        } else {
          // If already converted to PNG or needs PNG embedding
          embeddedImage = await pdfDoc.embedPng(bytes);
        }

        const imgWidth = fileItem.width || embeddedImage.width || 800;
        const imgHeight = fileItem.height || embeddedImage.height || 600;

        const layout = calculatePageLayout(imgWidth, imgHeight, options);

        const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);
        page.drawImage(embeddedImage, {
          x: layout.x,
          y: layout.y,
          width: layout.renderedWidth,
          height: layout.renderedHeight,
        });
      }

      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'finalizing',
        progress: 95,
        totalCount: totalFiles,
      });

      const pdfBytes = await pdfDoc.save();
      const safeBuffer = new Uint8Array(pdfBytes).buffer;

      postMessageFn({
        id,
        type: 'result',
        success: true,
        stage: 'completed',
        progress: 100,
        totalCount: totalFiles,
        pageCount: totalFiles,
        resultData: safeBuffer,
        resultFileName:
          options.outputFileName ||
          (totalFiles === 1 ? fileItemNameToPdf(files[0].name) : 'images-to-pdf.pdf'),
      });
    } catch (err: unknown) {
      postMessageFn({
        id,
        type: 'error',
        success: false,
        error: err instanceof Error ? err.message : 'PDF generation failed.',
      });
    }
    return;
  }

  if (operation === 'merge') {
    try {
      const totalFiles = files.length;
      if (totalFiles < 2) {
        postMessageFn({
          id,
          type: 'error',
          success: false,
          error: 'Add at least one more PDF to merge.',
        });
        return;
      }

      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'preparing',
        progress: 5,
        totalCount: totalFiles,
      });

      const mergedPdf = await PDFDocument.create();
      let totalMergedPages = 0;

      for (let i = 0; i < totalFiles; i++) {
        const fileItem = files[i];
        const progressVal = Math.round(10 + ((i + 0.5) / totalFiles) * 80);

        postMessageFn({
          id,
          type: 'progress',
          success: true,
          stage: 'processing',
          currentIndex: i + 1,
          totalCount: totalFiles,
          fileName: fileItem.name,
          progress: progressVal,
        });

        let sourcePdf: PDFDocument;
        try {
          sourcePdf = await PDFDocument.load(fileItem.data, {
            ignoreEncryption: false,
          });
        } catch (loadErr: unknown) {
          const loadMsg = loadErr instanceof Error ? loadErr.message : '';
          if (/password|encrypt/i.test(loadMsg)) {
            throw new Error('This PDF is password-protected. Please provide an unlocked PDF.', {
              cause: loadErr,
            });
          }
          if (/memory|allocation/i.test(loadMsg)) {
            throw new Error(
              'Your browser ran out of memory while merging these PDFs. Try merging fewer or smaller files.',
              { cause: loadErr }
            );
          }
          throw new Error(
            "We couldn't read one of your PDF files. Please remove it or choose another PDF.",
            { cause: loadErr }
          );
        }

        const pageIndices = sourcePdf.getPageIndices();
        if (pageIndices.length === 0) {
          throw new Error(`The file "${fileItem.name}" does not contain any pages.`);
        }

        const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
        for (const page of copiedPages) {
          mergedPdf.addPage(page);
          totalMergedPages++;
        }
      }

      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'finalizing',
        progress: 95,
        totalCount: totalFiles,
      });

      const pdfBytes = await mergedPdf.save();
      const safeBuffer = new Uint8Array(pdfBytes).buffer;

      postMessageFn({
        id,
        type: 'result',
        success: true,
        stage: 'completed',
        progress: 100,
        totalCount: totalFiles,
        pageCount: totalMergedPages,
        resultData: safeBuffer,
        resultFileName: options.outputFileName || 'merged.pdf',
      });
    } catch (err: unknown) {
      let errorMsg = err instanceof Error ? err.message : 'PDF merge failed.';
      if (/memory|allocation/i.test(errorMsg)) {
        errorMsg = 'Your browser ran out of memory while merging these PDFs. Try merging fewer or smaller files.';
      }
      postMessageFn({
        id,
        type: 'error',
        success: false,
        error: errorMsg,
      });
    }
    return;
  }

  if (operation === 'compress') {
    try {
      const fileItem = files[0];
      if (!fileItem) {
        postMessageFn({
          id,
          type: 'error',
          success: false,
          error: 'No PDF file provided for compression.',
        });
        return;
      }

      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'preparing',
        progress: 10,
        fileName: fileItem.name,
      });

      const originalBytes = new Uint8Array(fileItem.data);
      let sourceDoc: PDFDocument;
      try {
        sourceDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: false });
      } catch (loadErr: unknown) {
        const loadMsg = loadErr instanceof Error ? loadErr.message : '';
        if (/password|encrypt/i.test(loadMsg)) {
          throw new Error('This PDF is password-protected. Please provide an unlocked PDF.', {
            cause: loadErr,
          });
        }
        if (/memory|allocation/i.test(loadMsg)) {
          throw new Error('Your browser ran out of memory while compressing this PDF. Try a smaller PDF.', {
            cause: loadErr,
          });
        }
        throw new Error("We couldn't read this PDF file. Please try another file.", {
          cause: loadErr,
        });
      }

      const pageCount = sourceDoc.getPageCount();
      if (pageCount === 0) {
        throw new Error('The PDF document does not contain any pages.');
      }

      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'processing',
        progress: 50,
        fileName: fileItem.name,
      });

      // Attempt structural stream compression
      let compressedBytes: Uint8Array | null = null;
      try {
        compressedBytes = await sourceDoc.save({ useObjectStreams: true });
      } catch {
        // Fallback
      }

      if (!compressedBytes || compressedBytes.byteLength === 0) {
        compressedBytes = originalBytes;
      }

      postMessageFn({
        id,
        type: 'progress',
        success: true,
        stage: 'finalizing',
        progress: 95,
        fileName: fileItem.name,
      });

      const isSmaller = compressedBytes.byteLength < originalBytes.byteLength;
      const finalBytes = isSmaller ? compressedBytes : originalBytes;
      const safeBuffer = new Uint8Array(finalBytes).buffer;

      postMessageFn({
        id,
        type: 'result',
        success: true,
        stage: 'completed',
        progress: 100,
        pageCount,
        resultData: safeBuffer,
        resultFileName: options.outputFileName || fileItem.name,
      });
    } catch (err: unknown) {
      let errorMsg = err instanceof Error ? err.message : 'PDF compression failed.';
      if (/memory|allocation/i.test(errorMsg)) {
        errorMsg = 'Your browser ran out of memory while compressing this PDF. Try a smaller PDF.';
      }
      postMessageFn({
        id,
        type: 'error',
        success: false,
        error: errorMsg,
      });
    }
    return;
  }

  if (operation === 'rotate') {
    try {
      const fileItem = files[0];
      if (!fileItem) {
        throw new Error('No PDF file provided for rotation.');
      }

      const rotateOptions = options as RotatePdfOptions;
      const { rotatedBytes, pageCount, resultFileName } = await rotatePdfBytes(
        fileItem.data,
        fileItem.name,
        rotateOptions,
        (progress) => {
          postMessageFn({
            id,
            type: 'progress',
            success: true,
            stage: 'processing',
            progress: progress.progress,
            fileName: fileItem.name,
          });
        }
      );

      const safeBuffer = new Uint8Array(rotatedBytes).buffer;
      postMessageFn({
        id,
        type: 'result',
        success: true,
        stage: 'completed',
        progress: 100,
        pageCount,
        resultData: safeBuffer,
        resultFileName,
      });
      return;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'PDF rotation failed.';
      postMessageFn({
        id,
        type: 'error',
        success: false,
        error: errorMsg,
      });
      return;
    }
  }

  if (operation === 'delete-pages') {
    try {
      const fileItem = files[0];
      if (!fileItem) {
        throw new Error('No PDF file provided for page deletion.');
      }

      const deleteOptions = options as unknown as DeletePdfPagesOptions;
      const { resultBytes, pageCount, resultFileName } = await deletePdfPagesBytes(
        fileItem.data,
        fileItem.name,
        deleteOptions,
        (progress) => {
          postMessageFn({
            id,
            type: 'progress',
            success: true,
            stage: 'processing',
            progress: progress.progress,
            fileName: fileItem.name,
          });
        }
      );

      const safeBuffer = new Uint8Array(resultBytes).buffer;
      postMessageFn({
        id,
        type: 'result',
        success: true,
        stage: 'completed',
        progress: 100,
        pageCount,
        resultData: safeBuffer,
        resultFileName,
      });
      return;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Deleting PDF pages failed.';
      postMessageFn({
        id,
        type: 'error',
        success: false,
        error: errorMsg,
      });
      return;
    }
  }

  if (operation === 'reorder-pages') {
    try {
      const fileItem = files[0];
      if (!fileItem) {
        throw new Error('No PDF file provided for page reordering.');
      }

      const reorderOptions = options as unknown as ReorderPdfPagesOptions;
      const { resultBytes, pageCount, resultFileName } = await reorderPdfPagesBytes(
        fileItem.data,
        fileItem.name,
        reorderOptions,
        (progress) => {
          postMessageFn({
            id,
            type: 'progress',
            success: true,
            stage: 'processing',
            progress: progress.progress,
            fileName: fileItem.name,
          });
        }
      );

      const safeBuffer = new Uint8Array(resultBytes).buffer;
      postMessageFn({
        id,
        type: 'result',
        success: true,
        stage: 'completed',
        progress: 100,
        pageCount,
        resultData: safeBuffer,
        resultFileName,
      });
      return;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Reordering PDF pages failed.';
      postMessageFn({
        id,
        type: 'error',
        success: false,
        error: errorMsg,
      });
      return;
    }
  }

  postMessageFn({
    id,
    type: 'error',
    success: false,
    error: `Unsupported PDF operation: ${operation}`,
  });
}

function fileItemNameToPdf(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return `${name}.pdf`;
  return `${name.substring(0, lastDot)}.pdf`;
}

// Global worker scope listener when running inside actual Web Worker
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (event: MessageEvent<PdfWorkerRequest>) => {
    processPdfWorkerJob(event.data, (res) => self.postMessage(res));
  };
}
