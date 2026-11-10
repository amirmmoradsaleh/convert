import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateCompressibleImageFile,
  isAnimatedWebp,
  hasJpegMagicBytes,
  hasPngMagicBytes,
  hasWebpMagicBytes,
} from '../../engines/shared/validation';
import { rotateImage } from '../../engines/image/rotate';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 800, h = 400) {
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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type === '2d') {
      return {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
        save: () => {},
        restore: () => {},
        translate: (_x: number, _y: number) => {},
        rotate: (_angle: number) => {},
        drawImage: (_bitmap: unknown, _x: number, _y: number) => {},
        clearRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillRect: (_x: number, _y: number, _w: number, _h: number) => {},
        fillStyle: '#000000',
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    const mime = options?.type || 'image/jpeg';
    const quality = options?.quality ?? 0.9;

    if (mime === 'image/jpeg') {
      const size = Math.max(20, Math.floor(1000 * quality));
      const bytes = new Uint8Array(size);
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      bytes[2] = 0xff;
      bytes[3] = 0xe0;
      return new Blob([bytes], { type: 'image/jpeg' });
    }

    if (mime === 'image/webp') {
      const size = Math.max(20, Math.floor(800 * quality));
      const bytes = new Uint8Array(size);
      bytes[0] = 0x52;
      bytes[1] = 0x49;
      bytes[2] = 0x46;
      bytes[3] = 0x46;
      bytes[8] = 0x57;
      bytes[9] = 0x45;
      bytes[10] = 0x42;
      bytes[11] = 0x50;
      return new Blob([bytes], { type: 'image/webp' });
    }

    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x00, 0x64, 0x08, 0x06, 0x00, 0x00, 0x00,
    ]);
    return new Blob([pngBytes], { type: 'image/png' });
  }
}

describe('Tool #14: Rotate Image Engine & Validation Pipeline', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sampleJpgPath = path.join(fixturesDir, 'sample.jpg');
  const samplePngPath = path.join(fixturesDir, 'sample.png');
  const sampleWebpPath = path.join(fixturesDir, 'sample.webp');
  const sampleAnimatedWebpPath = path.join(fixturesDir, 'animated.webp');
  const corruptedJpgPath = path.join(fixturesDir, 'corrupted.jpg');

  beforeAll(() => {
    if (typeof globalThis.createImageBitmap === 'undefined') {
      (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = async (source: Blob | unknown) => {
        if (source instanceof Blob) {
          const buf = await source.arrayBuffer();
          const bytes = new Uint8Array(buf);
          if (bytes.length < 20) {
            throw new Error('Failed to decode corrupted image');
          }
        }
        return new MockImageBitmap(800, 400);
      };
    }
    if (typeof globalThis.OffscreenCanvas === 'undefined') {
      (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = MockOffscreenCanvas;
    }
  });

  describe('1. Input & Angle Validation', () => {
    it('accepts valid rotation angles: 90, 180, 270, 0', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });

      const res90 = await rotateImage(file, { degrees: 90 });
      expect(res90.fileName).toBe('photo-rotated.jpg');

      const res180 = await rotateImage(file, { degrees: 180 });
      expect(res180.fileName).toBe('photo-rotated.jpg');

      const res270 = await rotateImage(file, { degrees: 270 });
      expect(res270.fileName).toBe('photo-rotated.jpg');

      const res0 = await rotateImage(file, { degrees: 0 });
      expect(res0.fileName).toBe('photo-rotated.jpg');
    });

    it('rejects invalid rotation angle (e.g. 45 degrees)', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      // @ts-expect-error testing invalid degrees
      await expect(rotateImage(file, { degrees: 45 })).rejects.toThrow(
        /Please select a valid rotation angle/i
      );
    });

    it('rejects animated WebP files', async () => {
      const buffer = fs.readFileSync(sampleAnimatedWebpPath);
      const file = new File([buffer], 'anim.webp', { type: 'image/webp' });
      await expect(rotateImage(file, { degrees: 90 })).rejects.toThrow(
        /Animated WebP files are not supported/i
      );
    });

    it('rejects corrupted image file', async () => {
      const buffer = fs.readFileSync(corruptedJpgPath);
      const file = new File([buffer], 'corrupted.jpg', { type: 'image/jpeg' });
      await expect(rotateImage(file, { degrees: 90 })).rejects.toThrow();
    });
  });

  describe('2. Dimension Swapping Behavior', () => {
    it('swaps width and height for 90° rotation (800x400 -> 400x800)', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'landscape.jpg', { type: 'image/jpeg' });
      const result = await rotateImage(file, { degrees: 90 });

      expect(result.width).toBe(400);
      expect(result.height).toBe(800);
    });

    it('preserves width and height for 180° rotation (800x400 -> 800x400)', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'landscape.jpg', { type: 'image/jpeg' });
      const result = await rotateImage(file, { degrees: 180 });

      expect(result.width).toBe(800);
      expect(result.height).toBe(400);
    });

    it('swaps width and height for 270° rotation (800x400 -> 400x800)', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'landscape.jpg', { type: 'image/jpeg' });
      const result = await rotateImage(file, { degrees: 270 });

      expect(result.width).toBe(400);
      expect(result.height).toBe(800);
    });
  });

  describe('3. Output Formats & Filename Convention', () => {
    it('names output with -rotated suffix and keeps original format', async () => {
      const buffer = fs.readFileSync(samplePngPath);
      const file = new File([buffer], 'banner.png', { type: 'image/png' });
      const result = await rotateImage(file, { degrees: 90 });

      expect(result.fileName).toBe('banner-rotated.png');
      expect(result.format).toBe('png');
      expect(result.blob.type).toBe('image/png');
    });

    it('converts to JPG output format when requested', async () => {
      const buffer = fs.readFileSync(samplePngPath);
      const file = new File([buffer], 'banner.png', { type: 'image/png' });
      const result = await rotateImage(file, { degrees: 90, outputFormat: 'jpg' });

      expect(result.fileName).toBe('banner-rotated.jpg');
      expect(result.format).toBe('jpg');
      expect(result.blob.type).toBe('image/jpeg');
    });

    it('converts to WebP output format when requested', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await rotateImage(file, { degrees: 90, outputFormat: 'webp' });

      expect(result.fileName).toBe('photo-rotated.webp');
      expect(result.format).toBe('webp');
      expect(result.blob.type).toBe('image/webp');
    });
  });
});
