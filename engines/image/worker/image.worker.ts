import type { ImageWorkerRequest, ImageWorkerResponse } from './worker-types';

/**
 * Checks if buffer starts with JPEG SOI: FF D8 FF
 */
function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Checks if buffer starts with PNG signature: 89 50 4E 47 0D 0A 1A 0A
 */
function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

/**
 * Checks if buffer starts with RIFF (bytes 0-3) and WEBP (bytes 8-11)
 */
function isWebp(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46 && // 'F'
    bytes[8] === 0x57 && // 'W'
    bytes[9] === 0x45 && // 'E'
    bytes[10] === 0x42 && // 'B'
    bytes[11] === 0x50    // 'P'
  );
}

/**
 * Checks if buffer starts with GIF87a or GIF89a
 */
function isGif(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // 'G'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x38 && // '8'
    (bytes[4] === 0x37 || bytes[4] === 0x39) && // '7' or '9'
    bytes[5] === 0x61 // 'a'
  );
}

/**
 * Checks if buffer starts with BMP signature: BM (0x42 0x4D)
 */
function isBmp(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d;
}

/**
 * Checks if buffer is an animated WebP file (VP8X animation flag or ANIM/ANMF chunks)
 */
function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20) return false;
  if (!isWebp(bytes)) return false;

  if (
    bytes[12] === 0x56 && // 'V'
    bytes[13] === 0x50 && // 'P'
    bytes[14] === 0x38 && // '8'
    bytes[15] === 0x58    // 'X'
  ) {
    if (bytes.length >= 21) {
      const flags = bytes[20];
      if ((flags & 0x02) !== 0) {
        return true;
      }
    }
  }

  const maxScan = Math.min(bytes.length - 4, 4096);
  for (let i = 12; i < maxScan; i++) {
    if (
      bytes[i] === 0x41 && // 'A'
      bytes[i + 1] === 0x4e && // 'N'
      bytes[i + 2] === 0x49 && // 'I'
      bytes[i + 3] === 0x4d    // 'M'
    ) {
      return true;
    }
    if (
      bytes[i] === 0x41 && // 'A'
      bytes[i + 1] === 0x4e && // 'N'
      bytes[i + 2] === 0x4d && // 'M'
      bytes[i + 3] === 0x46    // 'F'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Replaces extension with .png
 */
function toPngFilename(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const stem = lastDot === -1 ? name : name.substring(0, lastDot);
  return `${stem}.png`;
}

/**
 * Replaces extension with .jpg
 */
function toJpgFilename(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const stem = lastDot === -1 ? name : name.substring(0, lastDot);
  return `${stem}.jpg`;
}

/**
 * Replaces extension with .webp
 */
function toWebpFilename(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const stem = lastDot === -1 ? name : name.substring(0, lastDot);
  return `${stem}.webp`;
}

/**
 * Core image processing logic.
 * Usable inside Web Worker and as direct fallback.
 */
export async function processImageJob(
  request: ImageWorkerRequest,
  postProgress?: (stage: 'validating' | 'reading' | 'decoding' | 'encoding' | 'finalizing', percent: number) => void
): Promise<ImageWorkerResponse> {
  const { id, fileData, fileName, operation, options } = request;

  const isCompress = operation === 'compress';
  const isResize = operation === 'resize';
  const isCrop = operation === 'crop';
  const isRotate = operation === 'rotate';

  if (
    (!isCompress && !isResize && !isCrop && !isRotate && operation !== 'convert') ||
    (!isCompress && !isResize && !isCrop && !isRotate && options.targetFormat !== 'png' && options.targetFormat !== 'jpg' && options.targetFormat !== 'webp')
  ) {
    return {
      id,
      success: false,
      type: 'error',
      error: 'Unsupported image operation.',
      errorCode: 'UNSUPPORTED_FORMAT',
    };
  }

  let isTargetJpg = false;
  let isTargetWebp = false;
  let isSourceBmp = false;
  let isSourceGif = false;
  let isSourceWebp = false;
  let isSourcePng = false;
  let isSourceJpg = false;

  if (isCompress || isResize || isCrop || isRotate) {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime = (request.mimeType || '').toLowerCase();
    const optSrc = options.sourceFormat;

    if (optSrc === 'png' || (!optSrc && (ext === 'png' || mime === 'image/png'))) {
      isSourcePng = true;
    } else if (optSrc === 'webp' || (!optSrc && (ext === 'webp' || mime === 'image/webp'))) {
      isSourceWebp = true;
      if (isCompress) isTargetWebp = true;
    } else if (
      optSrc === 'jpg' ||
      optSrc === 'jpeg' ||
      (!optSrc && (ext === 'jpg' || ext === 'jpeg' || mime === 'image/jpeg'))
    ) {
      isSourceJpg = true;
      if (isCompress) isTargetJpg = true;
    } else {
      return {
        id,
        success: false,
        type: 'error',
        error: isCrop
          ? 'Only JPG, JPEG, PNG, and WebP files are supported for cropping.'
          : isResize
          ? 'Only JPG, JPEG, PNG, and WebP files are supported for resizing.'
          : isRotate
          ? 'Only JPG, JPEG, PNG, and WebP files are supported for rotation.'
          : 'Only JPG, JPEG, PNG, and WebP files are supported for compression.',
        errorCode: 'UNSUPPORTED_FORMAT',
      };
    }

    if (isResize || isCrop || isRotate) {
      const targetFormatOption = options.targetFormat;
      if (targetFormatOption === 'jpg') {
        isTargetJpg = true;
      } else if (targetFormatOption === 'webp') {
        isTargetWebp = true;
      } else if (targetFormatOption === 'png') {
        // png target
      } else {
        // original format
        if (isSourceJpg) isTargetJpg = true;
        else if (isSourceWebp) isTargetWebp = true;
      }
    }
  } else {
    isTargetJpg = options.targetFormat === 'jpg';
    isTargetWebp = options.targetFormat === 'webp';

    isSourceBmp =
      options.sourceFormat === 'bmp' ||
      fileName.toLowerCase().endsWith('.bmp') ||
      request.mimeType === 'image/bmp';
    isSourceGif =
      !isSourceBmp &&
      (options.sourceFormat === 'gif' ||
        fileName.toLowerCase().endsWith('.gif') ||
        request.mimeType === 'image/gif');
    isSourceWebp =
      !isSourceBmp &&
      !isSourceGif &&
      (options.sourceFormat === 'webp' ||
        fileName.toLowerCase().endsWith('.webp') ||
        request.mimeType === 'image/webp');
    isSourcePng =
      !isSourceBmp &&
      !isSourceGif &&
      !isSourceWebp &&
      (options.sourceFormat === 'png' ||
        (!isSourceWebp &&
          (fileName.toLowerCase().endsWith('.png') ||
            request.mimeType === 'image/png' ||
            (isTargetJpg && !isSourceWebp))));
    isSourceJpg = !isSourceBmp && !isSourceGif && !isSourceWebp && !isSourcePng;
  }

  const expectedInputDesc = isSourceBmp
    ? 'BMP'
    : isSourceGif
    ? 'GIF'
    : isSourceWebp
    ? 'WebP'
    : isSourcePng
    ? 'PNG'
    : 'JPEG';

  // 1. Validating Stage (0 - 20%)
  postProgress?.('validating', 15);
  const bytes = new Uint8Array(fileData);

  if (isSourceBmp) {
    if (!isBmp(bytes)) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'This file is not a valid BMP image.',
        errorCode: 'INVALID_FILE',
      };
    }
    if (bytes.length >= 26) {
      try {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const dibSize = view.getUint32(14, true);
        let bWidth = 0;
        let bHeight = 0;
        if (dibSize === 12 && bytes.length >= 26) {
          bWidth = view.getUint16(18, true);
          bHeight = view.getUint16(20, true);
        } else if (dibSize >= 40 && bytes.length >= 26) {
          bWidth = Math.abs(view.getInt32(18, true));
          bHeight = Math.abs(view.getInt32(22, true));
        }
        if (bWidth > 8192 || bHeight > 8192) {
          return {
            id,
            success: false,
            type: 'error',
            error: isCompress
              ? 'This image is too large to compress in your browser.'
              : 'This BMP is too large to process in your browser.',
            errorCode: 'BROWSER_MEMORY_ERROR',
          };
        }
      } catch {
        // Fall through
      }
    }
  } else if (isSourceGif) {
    if (!isGif(bytes)) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'This file is not a valid GIF image.',
        errorCode: 'INVALID_FILE',
      };
    }
    if (bytes.length >= 10) {
      const gWidth = bytes[6] | (bytes[7] << 8);
      const gHeight = bytes[8] | (bytes[9] << 8);
      if (gWidth > 8192 || gHeight > 8192) {
        return {
          id,
          success: false,
          type: 'error',
          error: isCompress
            ? 'This image is too large to compress in your browser.'
            : 'This GIF is too large to process in your browser.',
          errorCode: 'BROWSER_MEMORY_ERROR',
        };
      }
    }
  } else if (isSourceWebp) {
    if (!isWebp(bytes)) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'This file is not a valid WebP image.',
        errorCode: 'INVALID_FILE',
      };
    }
    if (isCompress && isAnimatedWebp(bytes)) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'Animated WebP files are not supported by this compression tool.',
        errorCode: 'UNSUPPORTED_FORMAT',
      };
    }
  } else if (isSourcePng) {
    if (!isPng(bytes)) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'This file is not a valid PNG image.',
        errorCode: 'INVALID_FILE',
      };
    }
  } else {
    if (!isJpeg(bytes)) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'This file is not a valid JPEG image.',
        errorCode: 'INVALID_FILE',
      };
    }
  }

  // 2. Reading Stage (20 - 45%)
  postProgress?.('reading', 35);
  const originalSize = fileData.byteLength;
  const inputMime = isSourceBmp
    ? 'image/bmp'
    : isSourceGif
    ? 'image/gif'
    : isSourceWebp
    ? 'image/webp'
    : isSourcePng
    ? 'image/png'
    : 'image/jpeg';
  const blob = new Blob([fileData], { type: inputMime });

  // 3. Decoding Stage (45 - 70%)
  postProgress?.('decoding', 60);
  let bitmap: ImageBitmap | null = null;
  try {
    let decodedWithImageDecoder = false;
    if (isSourceGif && typeof ImageDecoder !== 'undefined') {
      let decoder: ImageDecoder | null = null;
      let videoFrame: VideoFrame | null = null;
      try {
        decoder = new ImageDecoder({ data: fileData, type: 'image/gif' });
        const decoded = await decoder.decode({ frameIndex: 0 });
        videoFrame = decoded.image;
        const vWidth = videoFrame.displayWidth || videoFrame.codedWidth;
        const vHeight = videoFrame.displayHeight || videoFrame.codedHeight;
        if (vWidth > 8192 || vHeight > 8192) {
          videoFrame.close();
          decoder.close();
          return {
            id,
            success: false,
            type: 'error',
            error: 'This GIF is too large to process in your browser.',
            errorCode: 'BROWSER_MEMORY_ERROR',
          };
        }
        if (typeof createImageBitmap === 'function') {
          bitmap = await createImageBitmap(videoFrame);
          decodedWithImageDecoder = true;
        }
      } catch {
        // Fallback to createImageBitmap(blob)
      } finally {
        if (videoFrame) {
          try {
            videoFrame.close();
          } catch {
            // Ignored close error
          }
        }
        if (decoder) {
          try {
            decoder.close();
          } catch {
            // Ignored close error
          }
        }
      }
    }

    if (!decodedWithImageDecoder) {
      if (typeof createImageBitmap === 'function') {
        if (isSourceJpg) {
          try {
            // Automatically handle EXIF orientation to preserve correct photograph orientation
            bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
          } catch {
            // Fallback if imageOrientation option is not supported
            bitmap = await createImageBitmap(blob);
          }
        } else {
          bitmap = await createImageBitmap(blob);
        }
      } else {
        throw new Error('createImageBitmap not supported in this context');
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('memory') || message.includes('quota') || message.includes('out of memory')) {
      return {
        id,
        success: false,
        type: 'error',
        error: 'This image is too large for your browser to process.',
        errorCode: 'BROWSER_MEMORY_ERROR',
      };
    }
    return {
      id,
      success: false,
      type: 'error',
      error: `This file is not a valid ${expectedInputDesc} image.`,
      errorCode: 'INVALID_FILE',
    };
  }

  if (!bitmap) {
    return {
      id,
      success: false,
      type: 'error',
      error: `This file is not a valid ${expectedInputDesc} image.`,
      errorCode: 'INVALID_FILE',
    };
  }

  const width = bitmap.width;
  const height = bitmap.height;

  if (!width || !height || width <= 0 || height <= 0) {
    bitmap.close();
    return {
      id,
      success: false,
      type: 'error',
      error: `This file is not a valid ${expectedInputDesc} image.`,
      errorCode: 'INVALID_FILE',
    };
  }

  let cropSx = 0;
  let cropSy = 0;
  let cropSw = width;
  let cropSh = height;

  if (isCrop) {
    cropSx = Math.max(0, Math.round(Number(options.x) || 0));
    cropSy = Math.max(0, Math.round(Number(options.y) || 0));
    cropSw = Math.round(Number(options.width) || (width - cropSx));
    cropSh = Math.round(Number(options.height) || (height - cropSy));

    if (cropSx >= width) cropSx = width - 1;
    if (cropSy >= height) cropSy = height - 1;
    if (cropSx + cropSw > width) cropSw = width - cropSx;
    if (cropSy + cropSh > height) cropSh = height - cropSy;
    if (cropSw <= 0) cropSw = 1;
    if (cropSh <= 0) cropSh = 1;
  }

  const rotateDeg = isRotate ? ((Number(options.degrees) || 0) % 360 + 360) % 360 : 0;
  const swapDimensions = isRotate && (rotateDeg === 90 || rotateDeg === 270);

  const targetWidth = isCrop
    ? cropSw
    : isResize && typeof options.width === 'number' && options.width > 0
    ? options.width
    : swapDimensions
    ? height
    : width;
  const targetHeight = isCrop
    ? cropSh
    : isResize && typeof options.height === 'number' && options.height > 0
    ? options.height
    : swapDimensions
    ? width
    : height;

  if (targetWidth > 8192 || targetHeight > 8192 || (targetWidth * targetHeight) > 67108864 || targetWidth <= 0 || targetHeight <= 0) {
    bitmap.close();
    return {
      id,
      success: false,
      type: 'error',
      error: isCrop
        ? 'This crop is too large to process in your browser.'
        : 'The selected dimensions are too large to process in your browser.',
      errorCode: 'BROWSER_MEMORY_ERROR',
    };
  }

  if (width > 8192 || height > 8192) {
    bitmap.close();
    return {
      id,
      success: false,
      type: 'error',
      error: isCompress
        ? 'This image is too large to compress in your browser.'
        : 'This image is too large for your browser to process.',
      errorCode: 'BROWSER_MEMORY_ERROR',
    };
  }

  // 4. Encoding Stage (70 - 90%)
  postProgress?.('encoding', 85);
  let encodedBlob: Blob;

  const targetMime = isTargetWebp ? 'image/webp' : isTargetJpg ? 'image/jpeg' : 'image/png';
  const quality =
    typeof options.quality === 'number'
      ? Math.max(0.1, Math.min(1.0, options.quality))
      : isCompress
      ? 0.8
      : 0.9;
  const rawBg = typeof options.backgroundColor === 'string' ? options.backgroundColor.trim() : '';
  const backgroundColor =
    rawBg.toUpperCase() === '#000000' || rawBg.toLowerCase() === 'black' ? '#000000' : '#FFFFFF';

  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(targetWidth, targetHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return {
          id,
          success: false,
          type: 'error',
          error: isCrop
            ? "We couldn't crop this image. Please try again."
            : isResize
            ? "We couldn't resize this image. Please try again."
            : isCompress
            ? "We couldn't compress this image. Please try again."
            : "We couldn't convert this image. Please try again.",
          errorCode: 'PROCESSING_FAILED',
        };
      }

      // If converting to JPG (from transparent format), fill solid background first
      if (isTargetJpg) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // Draw decoded image on top
      if (isCrop) {
        ctx.drawImage(bitmap, cropSx, cropSy, cropSw, cropSh, 0, 0, targetWidth, targetHeight);
      } else if (isRotate) {
        ctx.save();
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate((rotateDeg * Math.PI) / 180);
        ctx.drawImage(bitmap, -width / 2, -height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      }
      bitmap.close(); // Immediate memory cleanup

      if (isTargetJpg || isTargetWebp) {
        encodedBlob = await canvas.convertToBlob({ type: targetMime, quality });
      } else {
        encodedBlob = await canvas.convertToBlob({ type: targetMime });
      }

      // Validate WebP output to reject accidental PNG or JPEG fallback
      if (isTargetWebp && (encodedBlob.type !== 'image/webp' || encodedBlob.size <= 0)) {
        return {
          id,
          success: false,
          type: 'error',
          error: 'Your browser could not create a WebP image. Please try another browser.',
          errorCode: 'UNSUPPORTED_FORMAT',
        };
      }

      // Validate JPEG output to reject accidental PNG or WebP fallback
      if (isTargetJpg && (encodedBlob.type !== 'image/jpeg' || encodedBlob.size <= 0)) {
        return {
          id,
          success: false,
          type: 'error',
          error: 'Your browser could not create a JPG image. Please try another browser.',
          errorCode: 'UNSUPPORTED_FORMAT',
        };
      }

      // Validate PNG output to reject accidental JPEG or WebP fallback
      if (!isTargetJpg && !isTargetWebp && (encodedBlob.type !== 'image/png' || encodedBlob.size <= 0)) {
        return {
          id,
          success: false,
          type: 'error',
          error: 'Your browser could not create a PNG image. Please try another browser.',
          errorCode: 'UNSUPPORTED_FORMAT',
        };
      }
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        bitmap.close();
        return {
          id,
          success: false,
          type: 'error',
          error: isCrop
            ? "We couldn't crop this image. Please try again."
            : isResize
            ? "We couldn't resize this image. Please try again."
            : isCompress
            ? "We couldn't compress this image. Please try again."
            : "We couldn't convert this image. Please try again.",
          errorCode: 'PROCESSING_FAILED',
        };
      }

      // If converting to JPG (from transparent format), fill solid background first
      if (isTargetJpg) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);
      }

      // Draw decoded image on top
      if (isCrop) {
        ctx.drawImage(bitmap, cropSx, cropSy, cropSw, cropSh, 0, 0, targetWidth, targetHeight);
      } else if (isRotate) {
        ctx.save();
        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate((rotateDeg * Math.PI) / 180);
        ctx.drawImage(bitmap, -width / 2, -height / 2);
        ctx.restore();
      } else {
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      }
      bitmap.close(); // Immediate memory cleanup

      encodedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`Canvas encoding to ${targetMime} failed`));
          },
          targetMime,
          isTargetJpg || isTargetWebp ? quality : undefined
        );
      });

      // Validate WebP output to reject accidental PNG or JPEG fallback
      if (isTargetWebp && (encodedBlob.type !== 'image/webp' || encodedBlob.size <= 0)) {
        return {
          id,
          success: false,
          type: 'error',
          error: 'Your browser could not create a WebP image. Please try another browser.',
          errorCode: 'UNSUPPORTED_FORMAT',
        };
      }

      // Validate JPEG output to reject accidental PNG or WebP fallback
      if (isTargetJpg && (encodedBlob.type !== 'image/jpeg' || encodedBlob.size <= 0)) {
        return {
          id,
          success: false,
          type: 'error',
          error: 'Your browser could not create a JPG image. Please try another browser.',
          errorCode: 'UNSUPPORTED_FORMAT',
        };
      }

      // Validate PNG output to reject accidental JPEG or WebP fallback
      if (!isTargetJpg && !isTargetWebp && (encodedBlob.type !== 'image/png' || encodedBlob.size <= 0)) {
        return {
          id,
          success: false,
          type: 'error',
          error: 'Your browser could not create a PNG image. Please try another browser.',
          errorCode: 'UNSUPPORTED_FORMAT',
        };
      }
    } else {
      bitmap.close();
      return {
        id,
        success: false,
        type: 'error',
        error: 'Image canvas encoding is not supported in this runtime.',
        errorCode: 'PROCESSING_FAILED',
      };
    }
  } catch (err: unknown) {
    bitmap.close();
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('memory') || message.includes('quota') || message.includes('out of memory')) {
      return {
        id,
        success: false,
        type: 'error',
        error: isCrop
          ? 'This image is too large to crop in your browser.'
          : isResize
          ? 'This image is too large to resize in your browser.'
          : isCompress
          ? 'This image is too large to compress in your browser.'
          : 'This image is too large for your browser to process.',
        errorCode: 'BROWSER_MEMORY_ERROR',
      };
    }
    return {
      id,
      success: false,
      type: 'error',
      error: isCrop
        ? "We couldn't crop this image. Please try again."
        : isResize
        ? "We couldn't resize this image. Please try again."
        : isCompress
        ? "We couldn't compress this image. Please try again."
        : "We couldn't convert this image. Please try again.",
      errorCode: 'PROCESSING_FAILED',
    };
  }

  // 5. Finalizing Stage (90 - 100%)
  postProgress?.('finalizing', 95);
  let resultData: ArrayBuffer;
  const isOriginalRetained = isCompress && encodedBlob.size >= originalSize;
  if (isOriginalRetained) {
    // If compressed output is equal to or larger than original, retain original input bytes
    resultData = fileData;
  } else {
    resultData = await encodedBlob.arrayBuffer();
  }
  postProgress?.('finalizing', 100);

  const outputFileName = isCompress
    ? fileName
    : (isResize || isCrop || isRotate)
    ? (isTargetJpg
        ? toJpgFilename(fileName)
        : isTargetWebp
        ? toWebpFilename(fileName)
        : toPngFilename(fileName))
    : isTargetWebp
    ? toWebpFilename(fileName)
    : isTargetJpg
    ? toJpgFilename(fileName)
    : toPngFilename(fileName);

  const finalResultMime = isOriginalRetained ? (request.mimeType || inputMime) : targetMime;

  return {
    id,
    success: true,
    type: 'success',
    resultData,
    resultMime: finalResultMime,
    fileName: outputFileName,
    width: targetWidth,
    height: targetHeight,
    originalSize,
    convertedSize: resultData.byteLength,
  };
}

// Worker execution context helper for typed postMessage & listener
const workerScope = (typeof self !== 'undefined' ? self : null) as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  addEventListener: (type: string, listener: (event: unknown) => void) => void;
  importScripts?: (...urls: string[]) => void;
} | null;

/**
 * Worker message event listener.
 */
export async function handleWorkerMessage(event: MessageEvent<ImageWorkerRequest>): Promise<void> {
  const request = event.data;
  if (!request || !request.id) return;

  try {
    const result = await processImageJob(request, (stage, percent) => {
      const progressMessage: ImageWorkerResponse = {
        id: request.id,
        success: true,
        type: 'progress',
        stage,
        progress: percent,
      };
      workerScope?.postMessage(progressMessage);
    });

    if (result.resultData) {
      workerScope?.postMessage(result, [result.resultData]);
    } else {
      workerScope?.postMessage(result);
    }
  } catch {
    const errorMessage: ImageWorkerResponse = {
      id: request.id,
      success: false,
      type: 'error',
      error: "We couldn't convert this image. Please try again.",
      errorCode: 'PROCESSING_FAILED',
    };
    workerScope?.postMessage(errorMessage);
  }
}

// Attach listener in Web Worker environment
if (workerScope && typeof workerScope.importScripts === 'function') {
  workerScope.addEventListener('message', (event: unknown) => {
    handleWorkerMessage(event as MessageEvent<ImageWorkerRequest>);
  });
}

