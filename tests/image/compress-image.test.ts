import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateCompressibleImageFile,
  isAnimatedWebp,
  hasJpegMagicBytes,
  hasPngMagicBytes,
  hasWebpMagicBytes,
} from '../../engines/shared/validation';
import { compressImage, estimateCompressedSize } from '../../engines/image/compress';
import { createZipBlob } from '../../engines/shared/file-utils';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 100, h = 100) {
    this.width = w;
    this.height = h;
  }

  close() {
    this.isClosed = true;
    this.width = 0;
    this.height = 0;
  }
}

class MockOffscreenCanvas {
  width: number;
  height: number;
  static customBlobGenerator?: (options?: { type?: string; quality?: number }) => Promise<Blob> | Blob;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      return {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        drawImage: (_bitmap: unknown, _x: number, _y: number) => {},
        clearRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillStyle: '#000000',
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    if (MockOffscreenCanvas.customBlobGenerator) {
      return await MockOffscreenCanvas.customBlobGenerator(options);
    }

    const mime = options?.type || 'image/jpeg';
    const quality = options?.quality ?? 0.8;

    if (mime === 'image/jpeg') {
      // Standard JPEG SOI marker FF D8 FF
      const size = Math.max(20, Math.floor(1000 * quality));
      const bytes = new Uint8Array(size);
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      bytes[2] = 0xff;
      bytes[3] = 0xe0;
      return new Blob([bytes], { type: 'image/jpeg' });
    }

    if (mime === 'image/webp') {
      // Standard WebP RIFF header
      const size = Math.max(20, Math.floor(800 * quality));
      const bytes = new Uint8Array(size);
      // 'RIFF'
      bytes[0] = 0x52;
      bytes[1] = 0x49;
      bytes[2] = 0x46;
      bytes[3] = 0x46;
      // 'WEBP'
      bytes[8] = 0x57;
      bytes[9] = 0x45;
      bytes[10] = 0x42;
      bytes[11] = 0x50;
      return new Blob([bytes], { type: 'image/webp' });
    }

    // Standard PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, 0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    return new Blob([pngBytes], { type: 'image/png' });
  }
}

describe('Tool #11: Compress Image Engine, Validation & Compression Pipeline', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sampleJpgPath = path.join(fixturesDir, 'sample.jpg');
  const sampleJpegPath = path.join(fixturesDir, 'sample.jpeg');
  const samplePngPath = path.join(fixturesDir, 'sample.png');
  const sampleWebpPath = path.join(fixturesDir, 'sample.webp');
  const animatedWebpPath = path.join(fixturesDir, 'animated.webp');

  let sampleJpgBytes: Uint8Array;
  let sampleJpegBytes: Uint8Array;
  let samplePngBytes: Uint8Array;
  let sampleWebpBytes: Uint8Array;
  let animatedWebpBytes: Uint8Array;

  beforeAll(() => {
    if (typeof globalThis.OffscreenCanvas === 'undefined') {
      // @ts-expect-error polyfill for testing
      globalThis.OffscreenCanvas = MockOffscreenCanvas;
    }

    if (typeof globalThis.createImageBitmap === 'undefined') {
      globalThis.createImageBitmap = async (source: Blob | unknown) => {
        if (source instanceof Blob) {
          const buffer = await source.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          const isJpg = hasJpegMagicBytes(bytes);
          const isPng = hasPngMagicBytes(bytes);
          const isWeb = hasWebpMagicBytes(bytes);

          if (!isJpg && !isPng && !isWeb) {
            throw new Error('Invalid image data');
          }

          return new MockImageBitmap(100, 100) as unknown as ImageBitmap;
        }
        return new MockImageBitmap(100, 100) as unknown as ImageBitmap;
      };
    }

    sampleJpgBytes = new Uint8Array(fs.readFileSync(sampleJpgPath));
    sampleJpegBytes = new Uint8Array(fs.readFileSync(sampleJpegPath));
    samplePngBytes = new Uint8Array(fs.readFileSync(samplePngPath));
    sampleWebpBytes = new Uint8Array(fs.readFileSync(sampleWebpPath));
    animatedWebpBytes = new Uint8Array(fs.readFileSync(animatedWebpPath));
  });

  describe('1. Format & Input Validation', () => {
    it('accepts valid JPG files', async () => {
      const file = new File([sampleJpgBytes.buffer as ArrayBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await validateCompressibleImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts valid JPEG files', async () => {
      const file = new File([sampleJpegBytes.buffer as ArrayBuffer], 'photo.jpeg', { type: 'image/jpeg' });
      const result = await validateCompressibleImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts valid PNG files', async () => {
      const file = new File([samplePngBytes.buffer as ArrayBuffer], 'graphic.png', { type: 'image/png' });
      const result = await validateCompressibleImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('accepts valid static WebP files', async () => {
      const file = new File([sampleWebpBytes.buffer as ArrayBuffer], 'image.webp', { type: 'image/webp' });
      const result = await validateCompressibleImageFile(file);
      expect(result.valid).toBe(true);
    });

    it('rejects animated WebP files with clear error message', async () => {
      const file = new File([animatedWebpBytes.buffer as ArrayBuffer], 'animation.webp', { type: 'image/webp' });
      const result = await validateCompressibleImageFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toBe('Animated WebP files are not supported by this compression tool.');
    });

    it('correctly detects animated WebP via isAnimatedWebp helper', () => {
      expect(isAnimatedWebp(animatedWebpBytes)).toBe(true);
      expect(isAnimatedWebp(sampleWebpBytes)).toBe(false);
      expect(isAnimatedWebp(sampleJpgBytes)).toBe(false);
    });

    it('rejects unsupported file formats like GIF, BMP, SVG, and PDF', async () => {
      const gifFile = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])], 'test.gif', {
        type: 'image/gif',
      });
      const result = await validateCompressibleImageFile(gifFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('rejects corrupted image files with mismatched magic bytes', async () => {
      const fakeJpg = new File([new TextEncoder().encode('not an image')], 'fake.jpg', {
        type: 'image/jpeg',
      });
      const result = await validateCompressibleImageFile(fakeJpg);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE');
    });

    it('rejects files exceeding 50 MB limit', async () => {
      const largeFile = new File([new Uint8Array(100)], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: 55 * 1024 * 1024 });
      const result = await validateCompressibleImageFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Compression Execution & Format Preservation', () => {
    it('compresses JPG and keeps JPG format and dimensions', async () => {
      const file = new File([sampleJpgBytes.buffer as ArrayBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await compressImage(file, { quality: 0.8 });

      expect(result.fileName).toBe('photo.jpg');
      expect(result.format).toBe('jpg');
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.originalSize).toBe(sampleJpgBytes.byteLength);
      expect(result.convertedSize).toBeGreaterThan(0);

      const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
      expect(hasJpegMagicBytes(outputBytes)).toBe(true);
    });

    it('compresses WebP and keeps WebP format and dimensions', async () => {
      const file = new File([sampleWebpBytes.buffer as ArrayBuffer], 'illustration.webp', { type: 'image/webp' });
      const result = await compressImage(file, { quality: 0.7 });

      expect(result.fileName).toBe('illustration.webp');
      expect(result.format).toBe('webp');
      expect(result.blob.type).toBe('image/webp');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);

      const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
      expect(hasWebpMagicBytes(outputBytes)).toBe(true);
    });

    it('compresses PNG and preserves PNG format and original if no savings', async () => {
      const file = new File([samplePngBytes.buffer as ArrayBuffer], 'diagram.png', { type: 'image/png' });
      const result = await compressImage(file);

      expect(result.fileName).toBe('diagram.png');
      expect(result.format).toBe('png');
      expect(result.blob.type).toBe('image/png');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);

      const outputBytes = new Uint8Array(await result.blob.arrayBuffer());
      expect(hasPngMagicBytes(outputBytes)).toBe(true);
    });

    it('tracks progress callbacks through all stages', async () => {
      const file = new File([sampleJpgBytes.buffer as ArrayBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const stages: string[] = [];

      await compressImage(file, { quality: 0.8 }, (progress, stage) => {
        if (stage && !stages.includes(stage)) {
          stages.push(stage);
        }
      });

      expect(stages.length).toBeGreaterThan(0);
      expect(stages).toContain('finalizing');
    });
  });

  describe('3. Estimation & Utility', () => {
    it('estimates compressed size for lossy JPG images', async () => {
      const file = new File([sampleJpgBytes.buffer as ArrayBuffer], 'photo.jpg', { type: 'image/jpeg' });
      const est80 = await estimateCompressedSize(file, 80);
      const est40 = await estimateCompressedSize(file, 40);

      expect(est80.estimatedSize).toBeGreaterThan(0);
      expect(est40.estimatedSize).toBeGreaterThan(0);
      expect(est40.estimatedSize).toBeLessThanOrEqual(est80.estimatedSize);
    });

    it('returns file.size for PNG estimation since PNG is lossless', async () => {
      const file = new File([samplePngBytes.buffer as ArrayBuffer], 'diagram.png', { type: 'image/png' });
      const est = await estimateCompressedSize(file, 50);
      expect(est.estimatedSize).toBe(file.size);
      expect(est.isEstimate).toBe(false);
    });
  });

  describe('4. Batch Processing & ZIP Export', () => {
    it('creates valid ZIP archive containing multiple compressed files', async () => {
      const file1 = new File([sampleJpgBytes.buffer as ArrayBuffer], 'image1.jpg', { type: 'image/jpeg' });
      const file2 = new File([samplePngBytes.buffer as ArrayBuffer], 'image2.png', { type: 'image/png' });

      const res1 = await compressImage(file1, { quality: 0.8 });
      const res2 = await compressImage(file2);

      const zipBlob = await createZipBlob([
        { name: res1.fileName, blob: res1.blob },
        { name: res2.fileName, blob: res2.blob },
      ]);

      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(zipBlob.type).toBe('application/zip');
    });
  });

  describe('5. Original Retention Matrix (Smaller, Equal, Larger)', () => {
    afterEach(() => {
      delete MockOffscreenCanvas.customBlobGenerator;
    });

    const createDummyJpegBlob = (size: number) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      bytes[2] = 0xff;
      bytes[3] = 0xe0;
      for (let i = 4; i < size; i++) bytes[i] = 0x42;
      return new Blob([bytes], { type: 'image/jpeg' });
    };

    const createDummyWebpBlob = (size: number) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 0x52; // R
      bytes[1] = 0x49; // I
      bytes[2] = 0x46; // F
      bytes[3] = 0x46; // F
      bytes[8] = 0x57; // W
      bytes[9] = 0x45; // E
      bytes[10] = 0x42; // B
      bytes[11] = 0x50; // P
      for (let i = 12; i < size; i++) bytes[i] = 0x43;
      return new Blob([bytes], { type: 'image/webp' });
    };

    const createDummyPngBlob = (size: number) => {
      const bytes = new Uint8Array(size);
      bytes[0] = 0x89;
      bytes[1] = 0x50;
      bytes[2] = 0x4e;
      bytes[3] = 0x47;
      bytes[4] = 0x0d;
      bytes[5] = 0x0a;
      bytes[6] = 0x1a;
      bytes[7] = 0x0a;
      for (let i = 8; i < size; i++) bytes[i] = 0x44;
      return new Blob([bytes], { type: 'image/png' });
    };

    // JPEG tests
    describe('JPEG', () => {
      it('returns newly encoded blob when encoded result is smaller than original', async () => {
        const originalBytes = new Uint8Array(500);
        originalBytes[0] = 0xff; originalBytes[1] = 0xd8; originalBytes[2] = 0xff; originalBytes[3] = 0xe0;
        const file = new File([originalBytes], 'test.jpg', { type: 'image/jpeg' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyJpegBlob(250);

        const result = await compressImage(file, { quality: 0.5 });
        expect(result.convertedSize).toBe(250);
        expect(result.originalSize).toBe(500);
        expect(result.savedBytes).toBe(250);
        expect(result.savedPercentage).toBe(50);
        expect(result.noSizeReduction).toBe(false);
        expect(result.blob.size).toBe(250);
        expect(result.blob.type).toBe('image/jpeg');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes.byteLength).toBe(250);
        expect(resBytes[4]).toBe(0x42); // Encoded payload, not original
      });

      it('retains original bytes when encoded result is equal in size to original', async () => {
        const originalBytes = new Uint8Array(500);
        originalBytes[0] = 0xff; originalBytes[1] = 0xd8; originalBytes[2] = 0xff; originalBytes[3] = 0xe0;
        originalBytes[4] = 0x99; // distinct byte
        const file = new File([originalBytes], 'test.jpg', { type: 'image/jpeg' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyJpegBlob(500);

        const result = await compressImage(file, { quality: 0.8 });
        expect(result.convertedSize).toBe(500);
        expect(result.originalSize).toBe(500);
        expect(result.savedBytes).toBe(0);
        expect(result.savedPercentage).toBe(0);
        expect(result.noSizeReduction).toBe(true);
        expect(result.blob.size).toBe(500);
        expect(result.blob.type).toBe('image/jpeg');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[4]).toBe(0x99); // Exactly original bytes!
      });

      it('retains original bytes when encoded result is larger than original', async () => {
        const originalBytes = new Uint8Array(500);
        originalBytes[0] = 0xff; originalBytes[1] = 0xd8; originalBytes[2] = 0xff; originalBytes[3] = 0xe0;
        originalBytes[4] = 0x77; // distinct byte
        const file = new File([originalBytes], 'test.jpg', { type: 'image/jpeg' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyJpegBlob(800);

        const result = await compressImage(file, { quality: 0.9 });
        expect(result.convertedSize).toBe(500); // Equal to originalSize, not 800!
        expect(result.originalSize).toBe(500);
        expect(result.savedBytes).toBe(0);
        expect(result.savedPercentage).toBe(0);
        expect(result.noSizeReduction).toBe(true);
        expect(result.blob.size).toBe(500);
        expect(result.blob.type).toBe('image/jpeg');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[4]).toBe(0x77); // Exactly original bytes!
      });
    });

    // WebP tests
    describe('WebP', () => {
      it('returns newly encoded blob when encoded result is smaller than original', async () => {
        const originalBytes = new Uint8Array(400);
        originalBytes[0] = 0x52; originalBytes[1] = 0x49; originalBytes[2] = 0x46; originalBytes[3] = 0x46;
        originalBytes[8] = 0x57; originalBytes[9] = 0x45; originalBytes[10] = 0x42; originalBytes[11] = 0x50;
        const file = new File([originalBytes], 'test.webp', { type: 'image/webp' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyWebpBlob(200);

        const result = await compressImage(file, { quality: 0.5 });
        expect(result.convertedSize).toBe(200);
        expect(result.originalSize).toBe(400);
        expect(result.savedBytes).toBe(200);
        expect(result.savedPercentage).toBe(50);
        expect(result.noSizeReduction).toBe(false);
        expect(result.blob.size).toBe(200);
        expect(result.blob.type).toBe('image/webp');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[12]).toBe(0x43);
      });

      it('retains original bytes when encoded result is equal in size to original', async () => {
        const originalBytes = new Uint8Array(400);
        originalBytes[0] = 0x52; originalBytes[1] = 0x49; originalBytes[2] = 0x46; originalBytes[3] = 0x46;
        originalBytes[8] = 0x57; originalBytes[9] = 0x45; originalBytes[10] = 0x42; originalBytes[11] = 0x50;
        originalBytes[12] = 0x88;
        const file = new File([originalBytes], 'test.webp', { type: 'image/webp' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyWebpBlob(400);

        const result = await compressImage(file, { quality: 0.8 });
        expect(result.convertedSize).toBe(400);
        expect(result.originalSize).toBe(400);
        expect(result.savedBytes).toBe(0);
        expect(result.savedPercentage).toBe(0);
        expect(result.noSizeReduction).toBe(true);
        expect(result.blob.size).toBe(400);
        expect(result.blob.type).toBe('image/webp');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[12]).toBe(0x88);
      });

      it('retains original bytes when encoded result is larger than original', async () => {
        const originalBytes = new Uint8Array(400);
        originalBytes[0] = 0x52; originalBytes[1] = 0x49; originalBytes[2] = 0x46; originalBytes[3] = 0x46;
        originalBytes[8] = 0x57; originalBytes[9] = 0x45; originalBytes[10] = 0x42; originalBytes[11] = 0x50;
        originalBytes[12] = 0x66;
        const file = new File([originalBytes], 'test.webp', { type: 'image/webp' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyWebpBlob(600);

        const result = await compressImage(file, { quality: 0.9 });
        expect(result.convertedSize).toBe(400);
        expect(result.originalSize).toBe(400);
        expect(result.savedBytes).toBe(0);
        expect(result.savedPercentage).toBe(0);
        expect(result.noSizeReduction).toBe(true);
        expect(result.blob.size).toBe(400);
        expect(result.blob.type).toBe('image/webp');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[12]).toBe(0x66);
      });
    });

    // PNG tests
    describe('PNG', () => {
      it('returns newly encoded blob when encoded result is smaller than original', async () => {
        const originalBytes = new Uint8Array(300);
        originalBytes[0] = 0x89; originalBytes[1] = 0x50; originalBytes[2] = 0x4e; originalBytes[3] = 0x47;
        originalBytes[4] = 0x0d; originalBytes[5] = 0x0a; originalBytes[6] = 0x1a; originalBytes[7] = 0x0a;
        const file = new File([originalBytes], 'test.png', { type: 'image/png' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyPngBlob(150);

        const result = await compressImage(file);
        expect(result.convertedSize).toBe(150);
        expect(result.originalSize).toBe(300);
        expect(result.savedBytes).toBe(150);
        expect(result.savedPercentage).toBe(50);
        expect(result.noSizeReduction).toBe(false);
        expect(result.blob.size).toBe(150);
        expect(result.blob.type).toBe('image/png');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[8]).toBe(0x44);
      });

      it('retains original bytes when encoded result is equal in size to original', async () => {
        const originalBytes = new Uint8Array(300);
        originalBytes[0] = 0x89; originalBytes[1] = 0x50; originalBytes[2] = 0x4e; originalBytes[3] = 0x47;
        originalBytes[4] = 0x0d; originalBytes[5] = 0x0a; originalBytes[6] = 0x1a; originalBytes[7] = 0x0a;
        originalBytes[8] = 0x33;
        const file = new File([originalBytes], 'test.png', { type: 'image/png' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyPngBlob(300);

        const result = await compressImage(file);
        expect(result.convertedSize).toBe(300);
        expect(result.originalSize).toBe(300);
        expect(result.savedBytes).toBe(0);
        expect(result.savedPercentage).toBe(0);
        expect(result.noSizeReduction).toBe(true);
        expect(result.blob.size).toBe(300);
        expect(result.blob.type).toBe('image/png');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[8]).toBe(0x33);
      });

      it('retains original bytes when encoded result is larger than original', async () => {
        const originalBytes = new Uint8Array(300);
        originalBytes[0] = 0x89; originalBytes[1] = 0x50; originalBytes[2] = 0x4e; originalBytes[3] = 0x47;
        originalBytes[4] = 0x0d; originalBytes[5] = 0x0a; originalBytes[6] = 0x1a; originalBytes[7] = 0x0a;
        originalBytes[8] = 0x55;
        const file = new File([originalBytes], 'test.png', { type: 'image/png' });

        MockOffscreenCanvas.customBlobGenerator = () => createDummyPngBlob(500);

        const result = await compressImage(file);
        expect(result.convertedSize).toBe(300);
        expect(result.originalSize).toBe(300);
        expect(result.savedBytes).toBe(0);
        expect(result.savedPercentage).toBe(0);
        expect(result.noSizeReduction).toBe(true);
        expect(result.blob.size).toBe(300);
        expect(result.blob.type).toBe('image/png');

        const resBytes = new Uint8Array(await result.blob.arrayBuffer());
        expect(resBytes[8]).toBe(0x55);
      });
    });
  });
});
