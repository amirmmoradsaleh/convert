// Polyfill Promise.try if not supported in runtime
if (typeof (Promise as unknown as { try?: unknown }).try !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Promise as unknown as { try: (fn: (...args: any[]) => any, ...args: any[]) => Promise<any> }).try = function (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: (...args: any[]) => any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...args: any[]
  ) {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}

// Polyfill Uint8Array.prototype.toHex if not supported in runtime
if (typeof (Uint8Array.prototype as unknown as { toHex?: unknown }).toHex !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Uint8Array.prototype as any).toHex = function (): string {
    return Array.from(this as Uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { deflate } from 'pako';
import { PDFDocument, PDFName, PDFRawStream, rgb } from 'pdf-lib';
import {
  validateCompressPdfFile,
  COMPRESS_PDF_LIMITS,
} from '@/engines/pdf/validation';
import {
  compressPdf,
  optimizePdfBytes,
  ALLOWED_PDF_COMPRESSION_QUALITIES,
  DEFAULT_PDF_COMPRESSION_QUALITY,
  normalizePdfCompressionQuality,
} from '@/engines/pdf/compress';
import { sanitizePdfBaseName } from '@/engines/pdf/utils';
import jpeg from 'jpeg-js';

/**
 * Helper to generate a multi-image high-resolution PDF for quality tier testing.
 */
async function createMultiImagePdf(name = 'multi-image.pdf'): Promise<File> {
  const doc = await PDFDocument.create();

  // Image 1: 300x300 gradient photo-like JPEG at q=95
  const w1 = 300, h1 = 300;
  const raw1 = new Uint8Array(w1 * h1 * 4);
  for (let i = 0; i < w1 * h1; i++) {
    const x = i % w1;
    const y = Math.floor(i / w1);
    raw1[i * 4] = Math.floor((Math.sin(x / 20) + 1) * 127);
    raw1[i * 4 + 1] = Math.floor((Math.cos(y / 20) + 1) * 127);
    raw1[i * 4 + 2] = (x * 3 + y * 7) % 256;
    raw1[i * 4 + 3] = 255;
  }
  const jpg1 = jpeg.encode({ data: raw1, width: w1, height: h1 }, 95);
  const emb1 = await doc.embedJpg(jpg1.data);
  const p1 = doc.addPage([600, 800]);
  p1.drawImage(emb1, { x: 50, y: 350, width: 500, height: 400 });
  p1.drawText('Page 1: High Resolution Raster Image', { x: 50, y: 760, size: 16 });

  // Image 2: 200x200 JPEG
  const w2 = 200, h2 = 200;
  const raw2 = new Uint8Array(w2 * h2 * 4);
  for (let i = 0; i < w2 * h2; i++) {
    const x = i % w2;
    const y = Math.floor(i / w2);
    raw2[i * 4] = (x * 11) % 256;
    raw2[i * 4 + 1] = (y * 13) % 256;
    raw2[i * 4 + 2] = ((x + y) * 5) % 256;
    raw2[i * 4 + 3] = 255;
  }
  const jpg2 = jpeg.encode({ data: raw2, width: w2, height: h2 }, 90);
  const emb2 = await doc.embedJpg(jpg2.data);
  const p2 = doc.addPage([600, 800]);
  p2.drawImage(emb2, { x: 50, y: 350, width: 500, height: 400 });
  p2.drawText('Page 2: Second Graphic Page', { x: 50, y: 760, size: 16 });

  const bytes = await doc.save();
  return new File([new Uint8Array(bytes).buffer], name, { type: 'application/pdf' });
}

/**
 * Helper to generate a PDF containing a FlateDecode (PNG-style) uncompressed raster image stream.
 */
async function createFlateImagePdf(name = 'flate-image.pdf'): Promise<File> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 500]);
  const width = 150;
  const height = 150;
  const rgbData = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    rgbData[i * 3] = (x * 5 + y * 7) % 256;
    rgbData[i * 3 + 1] = (x * 11 + y * 13) % 256;
    rgbData[i * 3 + 2] = (x * 17 + y * 19) % 256;
  }
  const deflated = deflate(rgbData);

  const imgDict = doc.context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: width,
    Height: height,
    BitsPerComponent: 8,
    ColorSpace: 'DeviceRGB',
    Filter: 'FlateDecode',
    Length: deflated.length,
  });
  const imgStream = PDFRawStream.of(imgDict, deflated);
  const imgRef = doc.context.register(imgStream);
  page.node.set(
    PDFName.of('Resources'),
    doc.context.obj({
      XObject: { Im1: imgRef },
    })
  );

  const bytes = await doc.save();
  return new File([new Uint8Array(bytes).buffer], name, { type: 'application/pdf' });
}

/**
 * Helper to generate a valid PDF with deterministic text and page count.
 */
async function createTestPdfFile(name: string, pageCount = 1, uncompressed = false): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`${name} - Page ${i + 1}`, {
      x: 30,
      y: 550,
      size: 16,
      color: rgb(0, 0, 0),
    });
    for (let j = 0; j < 15; j++) {
      page.drawText(`Body paragraph line ${j + 1} with repeated text to allow structural compression testing.`, {
        x: 30,
        y: 500 - j * 20,
        size: 10,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
  }
  const bytes = await doc.save({ useObjectStreams: !uncompressed });
  const safeBuffer = new Uint8Array(bytes).buffer;
  return new File([safeBuffer], name, { type: 'application/pdf' });
}

describe('Tool #22: Compress PDF Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Low-Level JPEG Quality Verification', () => {
    it('proves that quality 40, 70, 90 produces different and strictly increasing byte sizes for the same image', () => {
      const width = 100;
      const height = 100;
      const raw = new Uint8Array(width * height * 4);
      for (let i = 0; i < width * height; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        raw[i * 4] = (x * 3 + y * 5) % 256;
        raw[i * 4 + 1] = (x * 7 + y * 11) % 256;
        raw[i * 4 + 2] = (x * 13 + y * 17) % 256;
        raw[i * 4 + 3] = 255;
      }

      const enc40 = jpeg.encode({ data: raw, width, height }, 40);
      const enc70 = jpeg.encode({ data: raw, width, height }, 70);
      const enc90 = jpeg.encode({ data: raw, width, height }, 90);

      expect(enc40.data.length).toBeLessThan(enc70.data.length);
      expect(enc70.data.length).toBeLessThan(enc90.data.length);

      // Verify all 3 JPEGs decode cleanly and are valid
      const dec40 = jpeg.decode(enc40.data);
      const dec70 = jpeg.decode(enc70.data);
      const dec90 = jpeg.decode(enc90.data);

      expect(dec40.width).toBe(width);
      expect(dec70.width).toBe(width);
      expect(dec90.width).toBe(width);
    });
  });

  describe('2. PDF Validation & Limits', () => {
    it('accepts a valid PDF file with %PDF- header', async () => {
      const file = await createTestPdfFile('document.pdf', 2);
      const res = await validateCompressPdfFile(file);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('rejects a non-PDF file based on extension and MIME', async () => {
      const textFile = new File(['plain text data'], 'doc.txt', { type: 'text/plain' });
      const res = await validateCompressPdfFile(textFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects a fake PDF file with .pdf extension but invalid magic bytes', async () => {
      const fakePdf = new File(['Not a real PDF structure'], 'fake.pdf', {
        type: 'application/pdf',
      });
      const res = await validateCompressPdfFile(fakePdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects empty 0-byte PDF files', async () => {
      const emptyPdf = new File([], 'empty.pdf', { type: 'application/pdf' });
      const res = await validateCompressPdfFile(emptyPdf);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('INVALID_FILE');
    });

    it('rejects oversized PDF files exceeding 100 MB', async () => {
      const hugeFile = {
        name: 'huge.pdf',
        type: 'application/pdf',
        size: COMPRESS_PDF_LIMITS.MAX_FILE_SIZE + 1024,
        slice: () => new Blob(),
      } as unknown as File;

      const res = await validateCompressPdfFile(hugeFile);
      expect(res.valid).toBe(false);
      expect(res.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('3. Filename Sanitization', () => {
    it('sanitizes base filenames cleanly removing unsafe path traversal', () => {
      expect(sanitizePdfBaseName('annual-report.pdf')).toBe('annual-report');
      expect(sanitizePdfBaseName('../../../etc/passwd.pdf')).toBe('etc-passwd');
      expect(sanitizePdfBaseName('my:document*name.pdf')).toBe('my-document-name');
      expect(sanitizePdfBaseName('...pdf')).toBe('document');
    });
  });

  describe('4. Testing All 6 Quality Levels with Real Image-Heavy PDF', () => {
    it('compresses an image-heavy PDF across all 6 quality levels (40, 50, 60, 70, 80, 90) producing distinct, monotonic results', async () => {
      const sourcePdf = await createMultiImagePdf('photo-document.pdf');
      const inputSize = sourcePdf.size;

      const results: { quality: number; input: number; output: number; reduction: number; valid: boolean }[] = [];

      for (const q of ALLOWED_PDF_COMPRESSION_QUALITIES) {
        const res = await compressPdf(sourcePdf, { quality: q });
        expect(res.quality).toBe(q);
        expect(res.isReduced).toBe(true);
        expect(res.pageCount).toBe(2);

        // Verify valid PDF output
        const outBytes = await res.resultBlob.arrayBuffer();
        const verifiedDoc = await PDFDocument.load(outBytes);
        expect(verifiedDoc.getPageCount()).toBe(2);

        results.push({
          quality: q,
          input: inputSize,
          output: res.resultSize,
          reduction: res.reductionPercent,
          valid: verifiedDoc.getPageCount() === 2,
        });
      }

      // Assert monotonic ordering: lower quality = smaller file size
      expect(results[0].output).toBeLessThan(results[1].output); // 40 < 50
      expect(results[1].output).toBeLessThan(results[2].output); // 50 < 60
      expect(results[2].output).toBeLessThan(results[3].output); // 60 < 70
      expect(results[3].output).toBeLessThan(results[4].output); // 70 < 80
      expect(results[4].output).toBeLessThan(results[5].output); // 80 < 90
      expect(results[5].output).toBeLessThan(inputSize); // 90 < input

      // 40% must be significantly smaller than 90%
      expect(results[0].output).toBeLessThan(results[5].output * 0.7);
    });
  });

  describe('5. Handling FlateDecode (PNG / Lossless Raster) Embedded Images', () => {
    it('successfully compresses FlateDecode raster images conditioned on quality tiers', async () => {
      const flatePdf = await createFlateImagePdf('raster-doc.pdf');
      const origSize = flatePdf.size;

      const res40 = await compressPdf(flatePdf, { quality: 40 });
      const res90 = await compressPdf(flatePdf, { quality: 90 });

      expect(res40.isReduced).toBe(true);
      expect(res90.isReduced).toBe(true);
      expect(res40.resultSize).toBeLessThan(res90.resultSize);
      expect(res90.resultSize).toBeLessThan(origSize);
      expect(res40.pageCount).toBe(1);
    });
  });

  describe('6. Structural Compression & Text/Vector PDFs', () => {
    it('compresses a compressible multi-page PDF and reports accurate positive reduction', async () => {
      const fixturePath = path.join(process.cwd(), 'tests/fixtures/compressible.pdf');
      const buffer = fs.readFileSync(fixturePath);
      const safeBuffer = new Uint8Array(buffer).buffer;
      const file = new File([safeBuffer], 'report.pdf', { type: 'application/pdf' });

      const progressSteps: number[] = [];
      const result = await compressPdf(file, {}, (p) => {
        progressSteps.push(p.progress);
      });

      expect(result.originalSize).toBe(buffer.length);
      expect(result.isReduced).toBe(true);
      expect(result.isOriginalKept).toBe(false);
      expect(result.resultSize).toBeLessThan(result.originalSize);
      expect(result.reductionPercent).toBeGreaterThan(10);
      expect(result.resultFileName).toBe('report-compressed.pdf');
      expect(progressSteps).toContain(100);

      // Verify the generated PDF is valid and preserves page count
      const resultBytes = await result.resultBlob.arrayBuffer();
      const outputDoc = await PDFDocument.load(resultBytes);
      expect(outputDoc.getPageCount()).toBe(5);
    });

    it('preserves exact page dimensions and layout during compression', async () => {
      const doc = await PDFDocument.create();
      const p1 = doc.addPage([500, 700]);
      p1.drawText('Page 1 test text', { x: 50, y: 650, size: 12 });
      const p2 = doc.addPage([600, 800]);
      p2.drawText('Page 2 test text', { x: 50, y: 750, size: 12 });
      const bytes = await doc.save({ useObjectStreams: false });

      const file = new File([new Uint8Array(bytes).buffer], 'dimensions.pdf', {
        type: 'application/pdf',
      });
      const result = await compressPdf(file);

      const loadedOutput = await PDFDocument.load(await result.resultBlob.arrayBuffer());
      expect(loadedOutput.getPageCount()).toBe(2);
      expect(loadedOutput.getPage(0).getWidth()).toBe(500);
      expect(loadedOutput.getPage(0).getHeight()).toBe(700);
      expect(loadedOutput.getPage(1).getWidth()).toBe(600);
      expect(loadedOutput.getPage(1).getHeight()).toBe(800);
    });
  });

  describe('7. No-Reduction Handling (Never Falsely Claim Compression)', () => {
    it('returns the exact original file when PDF cannot be further reduced', async () => {
      const fixturePath = path.join(process.cwd(), 'tests/fixtures/already-optimized.pdf');
      const buffer = fs.readFileSync(fixturePath);
      const safeBuffer = new Uint8Array(buffer).buffer;
      const file = new File([safeBuffer], 'minimal.pdf', { type: 'application/pdf' });

      const result = await compressPdf(file);

      expect(result.isReduced).toBe(false);
      expect(result.isOriginalKept).toBe(true);
      expect(result.reductionPercent).toBe(0);
      expect(result.resultSize).toBe(file.size);
      expect(result.resultFileName).toBe('minimal.pdf');
      expect(result.resultBlob).toBe(file);
    });
  });

  describe('8. Error Handling & Edge Cases', () => {
    it('throws ToolError with PASSWORD_PROTECTED for password-protected PDFs', async () => {
      vi.spyOn(PDFDocument, 'load').mockImplementationOnce(() => {
        throw new Error('Input document is password-protected or encrypted');
      });

      const file = await createTestPdfFile('encrypted.pdf', 1);
      await expect(compressPdf(file)).rejects.toThrow(
        'This PDF is password-protected. Please provide an unlocked PDF.'
      );
    });

    it('throws ToolError with BROWSER_MEMORY_ERROR when browser memory is exhausted', async () => {
      vi.spyOn(PDFDocument, 'load').mockImplementationOnce(() => {
        throw new Error('Array buffer allocation failed (memory error)');
      });

      const file = await createTestPdfFile('memory-test.pdf', 1);
      await expect(compressPdf(file)).rejects.toThrow(/memory/i);
    });

    it('throws ToolError when PDF has 0 pages', async () => {
      const doc = await PDFDocument.create();
      const bytes = await doc.save({ addDefaultPage: false });
      const file = new File([new Uint8Array(bytes).buffer], 'zero-pages.pdf', {
        type: 'application/pdf',
      });

      await expect(compressPdf(file)).rejects.toThrow(/no readable pages|contains no pages/i);
    });

    it('handles optimizePdfBytes directly with raw Uint8Array input', async () => {
      const file = await createTestPdfFile('direct.pdf', 2, true);
      const arrayBuffer = await file.arrayBuffer();
      const res = await optimizePdfBytes(arrayBuffer, 'direct.pdf');

      expect(res.pageCount).toBe(2);
      expect(res.candidateBytes.byteLength).toBeGreaterThan(0);
      expect(res.originalDimensions.length).toBe(2);
      expect(res.quality).toBe(70);
    });
  });

  describe('9. Compression Quality Options & Parameterization', () => {
    it('defaults to 70% quality when no quality option is provided', async () => {
      expect(DEFAULT_PDF_COMPRESSION_QUALITY).toBe(70);
      expect(normalizePdfCompressionQuality()).toBe(70);
      expect(normalizePdfCompressionQuality(undefined)).toBe(70);
      expect(normalizePdfCompressionQuality(null)).toBe(70);

      const file = await createTestPdfFile('default-quality.pdf', 2);
      const res = await compressPdf(file);
      expect(res.quality).toBe(70);
    });

    it('validates exactly the six supported quality levels', () => {
      expect(ALLOWED_PDF_COMPRESSION_QUALITIES).toEqual([40, 50, 60, 70, 80, 90]);
      for (const q of ALLOWED_PDF_COMPRESSION_QUALITIES) {
        expect(normalizePdfCompressionQuality(q)).toBe(q);
      }
    });

    it('safely normalizes unsupported/out-of-range quality values to 70', () => {
      expect(normalizePdfCompressionQuality(0)).toBe(70);
      expect(normalizePdfCompressionQuality(10)).toBe(70);
      expect(normalizePdfCompressionQuality(30)).toBe(70);
      expect(normalizePdfCompressionQuality(75)).toBe(70);
      expect(normalizePdfCompressionQuality(100)).toBe(70);
      expect(normalizePdfCompressionQuality(-50)).toBe(70);
      expect(normalizePdfCompressionQuality(NaN)).toBe(70);
    });
  });
});
