import { PDFDocument, PDFName, PDFRawStream, PDFStream, PDFArray, PDFNumber } from 'pdf-lib';
import jpeg from 'jpeg-js';
import { inflate } from 'pako';
import { ToolError } from '../shared/errors';
import { hasPdfMagicBytes } from '../shared/validation';
import { validateCompressPdfFile } from './validation';
import { sanitizePdfBaseName } from './utils';

export type PdfCompressionQuality = 40 | 50 | 60 | 70 | 80 | 90;

export const ALLOWED_PDF_COMPRESSION_QUALITIES: readonly PdfCompressionQuality[] = [
  40, 50, 60, 70, 80, 90,
] as const;

export const DEFAULT_PDF_COMPRESSION_QUALITY: PdfCompressionQuality = 70;

export function normalizePdfCompressionQuality(
  quality?: number | null
): PdfCompressionQuality {
  if (
    typeof quality === 'number' &&
    (ALLOWED_PDF_COMPRESSION_QUALITIES as readonly number[]).includes(quality)
  ) {
    return quality as PdfCompressionQuality;
  }
  return DEFAULT_PDF_COMPRESSION_QUALITY;
}

export function getMaxImageDimensionForQuality(quality: PdfCompressionQuality): number {
  switch (quality) {
    case 40:
      return 1000;
    case 50:
      return 1200;
    case 60:
      return 1500;
    case 70:
      return 1800;
    case 80:
      return 2400;
    case 90:
      return 3200;
    default:
      return 1800;
  }
}

export interface CompressPdfOptions {
  customBaseName?: string;
  quality?: PdfCompressionQuality | number;
}

export type CompressPdfStage =
  | 'reading'
  | 'analyzing'
  | 'optimizing'
  | 'generating'
  | 'validating'
  | 'comparing'
  | 'completed';

export interface CompressPdfProgress {
  stage: CompressPdfStage;
  progress: number;
  message: string;
}

export interface CompressPdfResult {
  originalFileName: string;
  originalSize: number;
  resultFileName: string;
  resultSize: number;
  resultBlob: Blob;
  pageCount: number;
  isReduced: boolean;
  reductionPercent: number; // e.g. 34.6 (0 if not reduced)
  isOriginalKept: boolean;
  quality: PdfCompressionQuality;
  recompressedImageCount: number;
  totalImageCount: number;
}

interface PageDimension {
  width: number;
  height: number;
}

interface DecodedImageData {
  data: Uint8Array;
  width: number;
  height: number;
}

/**
 * Resizes an RGBA pixel buffer to target dimensions using bilinear pixel sampling.
 */
function resizeRgba(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Uint8Array {
  if (srcW === dstW && srcH === dstH) {
    return src;
  }
  const dstBuf = new ArrayBuffer(dstW * dstH * 4);
  const dst = new Uint8Array(dstBuf);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(Math.floor((y + 0.5) * yRatio), srcH - 1);
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(Math.floor((x + 0.5) * xRatio), srcW - 1);
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * dstW + x) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return dst;
}

/**
 * Unfilters standard PNG predictor scanlines (predictors 10..15).
 */
function unfilterPngScanlines(
  raw: Uint8Array,
  width: number,
  height: number,
  bytesPerPixel: number
): Uint8Array | null {
  const stride = width * bytesPerPixel;
  const lineSize = stride + 1;
  if (raw.length < height * lineSize) {
    return null;
  }

  const output = new Uint8Array(width * height * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filterType = raw[y * lineSize];
    const srcOffset = y * lineSize + 1;
    const dstOffset = y * stride;
    const prevDstOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x++) {
      const rawByte = raw[srcOffset + x];
      const a = x >= bytesPerPixel ? output[dstOffset + x - bytesPerPixel] : 0;
      const b = y > 0 ? output[prevDstOffset + x] : 0;
      const c = y > 0 && x >= bytesPerPixel ? output[prevDstOffset + x - bytesPerPixel] : 0;

      let val: number;
      switch (filterType) {
        case 0: // None
          val = rawByte;
          break;
        case 1: // Sub
          val = (rawByte + a) & 0xff;
          break;
        case 2: // Up
          val = (rawByte + b) & 0xff;
          break;
        case 3: // Average
          val = (rawByte + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4: { // Paeth
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          val = (rawByte + pr) & 0xff;
          break;
        }
        default:
          val = rawByte;
      }
      output[dstOffset + x] = val;
    }
  }

  return output;
}

/**
 * Decodes raw JPEG or compressed bytes to standard RGBA pixel buffer.
 */
async function decodeImageBytes(
  bytes: Uint8Array,
  mimeType = 'image/jpeg'
): Promise<DecodedImageData | null> {
  const safeBytes = new Uint8Array(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);

  // 1. Try jpeg-js decoder (pure JS, works on Uint8Array in both Node and Browser)
  try {
    const dec = jpeg.decode(safeBytes, { useTArray: true, formatAsRGBA: true });
    if (dec && dec.width > 0 && dec.height > 0 && dec.data) {
      const data = dec.data instanceof Uint8Array ? dec.data : new Uint8Array(dec.data);
      return { data, width: dec.width, height: dec.height };
    }
  } catch {
    // If jpeg-js throws (e.g. Progressive JPEG SOF2), fallback to browser native decoder
  }

  // 2. Browser native decoder fallback (works for Progressive JPEG, CMYK JPEG, etc.)
  if (typeof window !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const blob = new Blob([safeBytes as unknown as BlobPart], { type: mimeType });
      if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(blob);
        const canvas =
          typeof OffscreenCanvas !== 'undefined'
            ? new OffscreenCanvas(bmp.width, bmp.height)
            : document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d') as
          | CanvasRenderingContext2D
          | OffscreenCanvasRenderingContext2D
          | null;
        if (ctx) {
          ctx.drawImage(bmp, 0, 0);
          const imgData = ctx.getImageData(0, 0, bmp.width, bmp.height);
          bmp.close?.();
          return {
            data: new Uint8Array(imgData.data.buffer),
            width: bmp.width,
            height: bmp.height,
          };
        }
      }
    } catch {
      // Safe fallback
    }
  }

  return null;
}

/**
 * Optimizes raw PDF bytes client-side using structural optimization and quality profiling.
 * Does not rasterize pages to preserve vector fidelity, typography, and layout.
 */
export async function optimizePdfBytes(
  inputData: ArrayBuffer | Uint8Array,
  fileName: string,
  onProgress?: (progress: CompressPdfProgress) => void,
  options?: CompressPdfOptions
): Promise<{
  candidateBytes: Uint8Array;
  originalSize: number;
  pageCount: number;
  originalDimensions: PageDimension[];
  quality: PdfCompressionQuality;
  recompressedImageCount: number;
  totalImageCount: number;
}> {
  const quality = normalizePdfCompressionQuality(options?.quality);
  const maxDim = getMaxImageDimensionForQuality(quality);
  const originalBytes =
    inputData instanceof Uint8Array
      ? new Uint8Array(inputData.buffer as ArrayBuffer, inputData.byteOffset, inputData.byteLength)
      : new Uint8Array(inputData);
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

  // 2. Analyzing document stage
  onProgress?.({
    stage: 'analyzing',
    progress: 25,
    message: 'Analyzing document structure and objects...',
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
        'Your browser ran out of memory while compressing this PDF. Try a smaller PDF.'
      );
    }
    throw new ToolError('PDF_READ_ERROR', "We couldn't read this PDF. Please choose a valid PDF file.");
  }

  const pageCount = sourceDoc.getPageCount();
  if (pageCount === 0) {
    throw new ToolError('INVALID_FILE', 'This PDF document contains no readable pages.');
  }

  // Record original page dimensions for fidelity validation
  const originalDimensions: PageDimension[] = [];
  const pageIndices = sourceDoc.getPageIndices();
  for (const idx of pageIndices) {
    const page = sourceDoc.getPage(idx);
    originalDimensions.push({
      width: Math.round(page.getWidth() * 10) / 10,
      height: Math.round(page.getHeight() * 10) / 10,
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 0));

  // 3. Optimizing PDF structure stage
  onProgress?.({
    stage: 'optimizing',
    progress: 50,
    message: `Optimizing PDF streams (${quality}% quality profile)...`,
  });

  let totalImageCount = 0;
  let recompressedImageCount = 0;

  // Optimize embedded raster images if present according to selected quality level
  try {
    const context = sourceDoc.context;
    for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
        const dict = obj.dict;
        const subtypeObj = dict?.lookup(PDFName.of('Subtype'));
        const subtype = subtypeObj?.toString();

        if (subtype !== '/Image') {
          continue;
        }

        totalImageCount++;

        const filterObj = dict.lookup(PDFName.of('Filter'));
        const filterStr = filterObj?.toString() || '';
        const rawBytes = obj.getContents();

        if (!rawBytes || rawBytes.length < 64) {
          continue;
        }

        const isDct =
          filterStr.includes('DCT') ||
          (filterObj instanceof PDFArray &&
            filterObj.asArray().some((f) => f.toString().includes('DCT')));

        const isFlate =
          filterStr.includes('Flate') ||
          filterStr.includes('/Fl') ||
          (filterObj instanceof PDFArray &&
            filterObj.asArray().some((f) => f.toString().includes('Flate') || f.toString().includes('/Fl')));

        const isUncompressed = !filterObj || filterStr === '' || filterStr === 'null';

        // Case A: DCTDecode (JPEG) image streams
        if (isDct) {
          try {
            const decoded = await decodeImageBytes(rawBytes, 'image/jpeg');
            if (decoded && decoded.width > 0 && decoded.height > 0 && decoded.data) {
              let targetW = decoded.width;
              let targetH = decoded.height;
              let targetRgba: Uint8Array = decoded.data;

              const maxCurrent = Math.max(decoded.width, decoded.height);
              if (maxCurrent > maxDim) {
                const scale = maxDim / maxCurrent;
                targetW = Math.max(1, Math.round(decoded.width * scale));
                targetH = Math.max(1, Math.round(decoded.height * scale));
                targetRgba = resizeRgba(decoded.data, decoded.width, decoded.height, targetW, targetH);
              }

              const recompressed = jpeg.encode(
                { data: targetRgba, width: targetW, height: targetH },
                quality
              );

              // Replace stream if recompressed JPEG is smaller OR if image was downscaled
              if (
                recompressed.data &&
                (recompressed.data.length < rawBytes.length || targetW < decoded.width)
              ) {
                const newDict = dict.clone();
                newDict.set(PDFName.of('Width'), context.obj(targetW));
                newDict.set(PDFName.of('Height'), context.obj(targetH));
                newDict.set(PDFName.of('Length'), context.obj(recompressed.data.length));
                newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                newDict.delete(PDFName.of('DecodeParms'));
                const newRawStream = PDFRawStream.of(newDict, recompressed.data);
                context.assign(ref, newRawStream);
                recompressedImageCount++;
              }
            }
          } catch {
            // Keep original stream safely if re-encoding fails
          }
        }
        // Case B: FlateDecode (PNG / Lossless raster) or uncompressed raw raster image streams
        else if (isFlate || isUncompressed) {
          try {
            const getNum = (key: string) => {
              const o = dict.lookup(PDFName.of(key));
              if (!o) return 0;
              if (typeof o === 'number') return o;
              if (o instanceof PDFNumber) return (o as PDFNumber).value();
              const parsed = parseFloat(o.toString());
              return isNaN(parsed) ? 0 : parsed;
            };

            const width = getNum('Width');
            const height = getNum('Height');
            const bpc = getNum('BitsPerComponent') || 8;
            const colorSpaceObj = dict.lookup(PDFName.of('ColorSpace'));
            const csStr = colorSpaceObj?.toString() || '';

            if (width > 0 && height > 0 && bpc === 8) {
              const inflated = isFlate ? inflate(rawBytes) : rawBytes;
              let channels = 3;
              let isCmyk = false;

              if (csStr.includes('DeviceGray') || csStr.includes('CalGray')) {
                channels = 1;
              } else if (csStr.includes('DeviceCMYK') || csStr.includes('CalCMYK')) {
                channels = 4;
                isCmyk = true;
              } else if (inflated.length >= width * height * 4) {
                channels = 4;
                isCmyk = csStr.includes('CMYK');
              } else if (inflated.length >= width * height * 3) {
                channels = 3;
              } else if (inflated.length >= width * height) {
                channels = 1;
              }

              // Check for PNG predictor
              const decodeParms = dict.lookup(PDFName.of('DecodeParms'));
              const predictorObj = typeof decodeParms === 'object' && decodeParms && 'lookup' in decodeParms
                ? (decodeParms as { lookup(k: PDFName): unknown }).lookup(PDFName.of('Predictor'))
                : null;
              const predictor = predictorObj ? Number(predictorObj) : 1;

              let pixelData: Uint8Array | null = null;
              if (predictor >= 10) {
                pixelData = unfilterPngScanlines(inflated, width, height, channels);
              } else if (inflated.length >= width * height * channels) {
                pixelData = inflated;
              }

              if (pixelData) {
                const rgba = new Uint8Array(width * height * 4);
                if (channels === 3) {
                  for (let i = 0; i < width * height; i++) {
                    rgba[i * 4] = pixelData[i * 3];
                    rgba[i * 4 + 1] = pixelData[i * 3 + 1];
                    rgba[i * 4 + 2] = pixelData[i * 3 + 2];
                    rgba[i * 4 + 3] = 255;
                  }
                } else if (channels === 1) {
                  for (let i = 0; i < width * height; i++) {
                    const g = pixelData[i];
                    rgba[i * 4] = g;
                    rgba[i * 4 + 1] = g;
                    rgba[i * 4 + 2] = g;
                    rgba[i * 4 + 3] = 255;
                  }
                } else if (channels === 4) {
                  if (isCmyk) {
                    for (let i = 0; i < width * height; i++) {
                      const c = pixelData[i * 4] / 255;
                      const m = pixelData[i * 4 + 1] / 255;
                      const y = pixelData[i * 4 + 2] / 255;
                      const k = pixelData[i * 4 + 3] / 255;
                      rgba[i * 4] = Math.round(255 * (1 - c) * (1 - k));
                      rgba[i * 4 + 1] = Math.round(255 * (1 - m) * (1 - k));
                      rgba[i * 4 + 2] = Math.round(255 * (1 - y) * (1 - k));
                      rgba[i * 4 + 3] = 255;
                    }
                  } else {
                    for (let i = 0; i < width * height; i++) {
                      rgba[i * 4] = pixelData[i * 4];
                      rgba[i * 4 + 1] = pixelData[i * 4 + 1];
                      rgba[i * 4 + 2] = pixelData[i * 4 + 2];
                      rgba[i * 4 + 3] = 255;
                    }
                  }
                }

                let targetW = width;
                let targetH = height;
                let targetRgba: Uint8Array = rgba;

                const maxCurrent = Math.max(width, height);
                if (maxCurrent > maxDim) {
                  const scale = maxDim / maxCurrent;
                  targetW = Math.max(1, Math.round(width * scale));
                  targetH = Math.max(1, Math.round(height * scale));
                  targetRgba = resizeRgba(rgba, width, height, targetW, targetH);
                }

                const recompressed = jpeg.encode({ data: targetRgba, width: targetW, height: targetH }, quality);
                if (
                  recompressed.data &&
                  (recompressed.data.length < rawBytes.length || targetW < width)
                ) {
                  const newDict = dict.clone();
                  newDict.set(PDFName.of('Width'), context.obj(targetW));
                  newDict.set(PDFName.of('Height'), context.obj(targetH));
                  newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
                  newDict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
                  newDict.set(PDFName.of('BitsPerComponent'), context.obj(8));
                  newDict.set(PDFName.of('Length'), context.obj(recompressed.data.length));
                  newDict.delete(PDFName.of('DecodeParms'));
                  const newRawStream = PDFRawStream.of(newDict, recompressed.data);
                  context.assign(ref, newRawStream);
                  recompressedImageCount++;
                }
              }
            }
          } catch {
            // Keep original stream safely
          }
        }
      }
    }
  } catch {
    // If object enumeration fails, proceed with standard stream saving
  }

  // Save the optimized document with compressed cross-reference and object streams
  let candidateBytes: Uint8Array;
  try {
    candidateBytes = await sourceDoc.save({ useObjectStreams: true });
  } catch {
    // Fallback save if useObjectStreams throws
    candidateBytes = await sourceDoc.save();
  }

  // 4. Generating compressed PDF stage
  onProgress?.({
    stage: 'generating',
    progress: 75,
    message: 'Generating optimized document output...',
  });

  if (!candidateBytes || candidateBytes.byteLength === 0) {
    throw new ToolError('PROCESSING_FAILED', "We couldn't compress this PDF. Please try again.");
  }

  return {
    candidateBytes,
    originalSize,
    pageCount,
    originalDimensions,
    quality,
    recompressedImageCount,
    totalImageCount,
  };
}

/**
 * Compresses a PDF document client-side with structural optimization and strict size validation.
 * Never claims compression unless the output is strictly smaller than the input.
 */
export async function compressPdf(
  file: File,
  options: CompressPdfOptions = {},
  onProgress?: (progress: CompressPdfProgress) => void
): Promise<CompressPdfResult> {
  // Validate input file format and limits
  const validation = await validateCompressPdfFile(file);
  if (!validation.valid) {
    throw validation.error || new ToolError('INVALID_FILE', "We couldn't read this PDF. Please choose a valid PDF file.");
  }

  const quality = normalizePdfCompressionQuality(options.quality);
  const baseName = options.customBaseName?.trim() || sanitizePdfBaseName(file.name);

  // Read array buffer
  let fileBuffer: ArrayBuffer;
  try {
    fileBuffer = await file.arrayBuffer();
  } catch {
    throw new ToolError('PDF_READ_ERROR', "We couldn't read this PDF file. Please try another file.");
  }

  // Run structural optimization with quality parameter
  const {
    candidateBytes,
    originalSize,
    pageCount,
    originalDimensions,
    recompressedImageCount,
    totalImageCount,
  } = await optimizePdfBytes(fileBuffer, file.name, onProgress, { ...options, quality });

  // 5. Validating result stage
  onProgress?.({
    stage: 'validating',
    progress: 90,
    message: 'Validating output PDF integrity...',
  });

  // Verify candidate magic bytes
  if (!hasPdfMagicBytes(candidateBytes)) {
    throw new ToolError('PROCESSING_FAILED', "We couldn't compress this PDF. Please try again.");
  }

  // Verify candidate readability and page count
  let validatedDoc: PDFDocument;
  try {
    validatedDoc = await PDFDocument.load(candidateBytes);
  } catch {
    throw new ToolError('PROCESSING_FAILED', "We couldn't compress this PDF. Please try again.");
  }

  if (validatedDoc.getPageCount() !== pageCount) {
    throw new ToolError('PROCESSING_FAILED', 'Output page count did not match source PDF document.');
  }

  // Verify page dimensions match original (1 pt tolerance)
  for (let i = 0; i < pageCount; i++) {
    const page = validatedDoc.getPage(i);
    const orig = originalDimensions[i];
    if (orig) {
      const wDiff = Math.abs(page.getWidth() - orig.width);
      const hDiff = Math.abs(page.getHeight() - orig.height);
      if (wDiff > 1.0 || hDiff > 1.0) {
        throw new ToolError('PROCESSING_FAILED', 'Page dimensions changed during compression.');
      }
    }
  }

  // 6. Comparing file sizes stage
  onProgress?.({
    stage: 'comparing',
    progress: 95,
    message: 'Comparing file sizes...',
  });

  const candidateSize = candidateBytes.byteLength;
  const isReduced = candidateSize < originalSize;

  let resultBlob: Blob;
  let resultFileName: string;
  let resultSize: number;
  let reductionPercent: number;
  let isOriginalKept: boolean;

  if (isReduced) {
    // Genuine reduction achieved
    const rawReduction = ((originalSize - candidateSize) / originalSize) * 100;
    reductionPercent = Math.round(rawReduction * 10) / 10;
    // Safeguard: must be strictly positive
    if (reductionPercent <= 0) {
      reductionPercent = 0.1;
    }
    const safeBytes = new Uint8Array(candidateBytes.length);
    safeBytes.set(candidateBytes);
    resultBlob = new Blob([safeBytes], { type: 'application/pdf' });
    resultFileName = `${baseName}-compressed.pdf`;
    resultSize = candidateSize;
    isOriginalKept = false;
  } else {
    // No size reduction possible: keep original PDF intact
    reductionPercent = 0;
    resultBlob = file;
    resultFileName = file.name;
    resultSize = originalSize;
    isOriginalKept = true;
  }

  // 7. Complete stage
  onProgress?.({
    stage: 'completed',
    progress: 100,
    message: isReduced
      ? `Compressed successfully! Reduced by ${reductionPercent}%.`
      : 'Original PDF is already optimized for this compression method.',
  });

  return {
    originalFileName: file.name,
    originalSize,
    resultFileName,
    resultSize,
    resultBlob,
    pageCount,
    isReduced,
    reductionPercent,
    isOriginalKept,
    quality,
    recompressedImageCount,
    totalImageCount,
  };
}
