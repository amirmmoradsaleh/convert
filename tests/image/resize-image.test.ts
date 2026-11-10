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
import { resizeImage } from '../../engines/image/resize';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 800, h = 600) {
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
        drawImage: (_bitmap: unknown, _x: number, _y: number, _w?: number, _h?: number) => {},
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

describe('Tool #12: Resize Image Engine & Validation Pipeline', () => {
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
        return new MockImageBitmap(800, 600);
      };
    }
    if (typeof globalThis.OffscreenCanvas === 'undefined') {
      (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = MockOffscreenCanvas;
    }
  });

  describe('1. Input Validation', () => {
    it('accepts valid JPG file', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      const check = await validateCompressibleImageFile(file);
      expect(check.valid).toBe(true);
    });

    it('accepts valid PNG file', async () => {
      const buffer = fs.readFileSync(samplePngPath);
      const file = new File([buffer], 'graphic.png', { type: 'image/png' });
      const check = await validateCompressibleImageFile(file);
      expect(check.valid).toBe(true);
    });

    it('accepts valid static WebP file', async () => {
      const buffer = fs.readFileSync(sampleWebpPath);
      const file = new File([buffer], 'illustration.webp', { type: 'image/webp' });
      const check = await validateCompressibleImageFile(file);
      expect(check.valid).toBe(true);
    });

    it('rejects animated WebP files', async () => {
      const buffer = fs.readFileSync(sampleAnimatedWebpPath);
      const file = new File([buffer], 'anim.webp', { type: 'image/webp' });
      await expect(resizeImage(file, { width: 400, height: 300 })).rejects.toThrow(
        /Animated WebP files are not supported/i
      );
    });

    it('rejects corrupted image file', async () => {
      const buffer = fs.readFileSync(corruptedJpgPath);
      const file = new File([buffer], 'corrupted.jpg', { type: 'image/jpeg' });
      await expect(resizeImage(file, { width: 400, height: 300 })).rejects.toThrow();
    });
  });

  describe('2. Dimension & Boundary Validation', () => {
    it('rejects zero or negative width/height', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      await expect(resizeImage(file, { width: 0, height: 400 })).rejects.toThrow(
        /Please enter valid image dimensions/i
      );
      await expect(resizeImage(file, { width: 400, height: -10 })).rejects.toThrow(
        /Please enter valid image dimensions/i
      );
    });

    it('rejects NaN width or height', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      await expect(resizeImage(file, { width: NaN, height: 400 })).rejects.toThrow(
        /Please enter valid image dimensions/i
      );
    });

    it('rejects dimensions exceeding MAX_DIMENSION (8192px)', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      await expect(resizeImage(file, { width: 8193, height: 600 })).rejects.toThrow(
        /too large/i
      );
    });

    it('rejects pixel count exceeding MAX_PIXELS (67,108,864)', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      await expect(resizeImage(file, { width: 8192, height: 8193 })).rejects.toThrow(
        /too large/i
      );
    });
  });

  describe('3. Resize Execution & Output Formats', () => {
    it('resizes image to exact requested dimensions', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await resizeImage(file, { width: 400, height: 300 });

      expect(result.width).toBe(400);
      expect(result.height).toBe(300);
      expect(result.fileName).toBe('photo.jpg');
      expect(result.format).toBe('jpg');
      expect(result.blob.type).toBe('image/jpeg');
      expect(result.blob.size).toBeGreaterThan(0);
    });

    it('resizes with explicit output format conversion to PNG', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      const result = await resizeImage(file, { width: 500, height: 250, outputFormat: 'png' });

      expect(result.width).toBe(500);
      expect(result.height).toBe(250);
      expect(result.fileName).toBe('photo.png');
      expect(result.format).toBe('png');
      expect(result.blob.type).toBe('image/png');
    });

    it('resizes with explicit output format conversion to WebP', async () => {
      const buffer = fs.readFileSync(samplePngPath);
      const file = new File([buffer], 'badge.png', { type: 'image/png' });
      const result = await resizeImage(file, { width: 200, height: 200, outputFormat: 'webp' });

      expect(result.width).toBe(200);
      expect(result.height).toBe(200);
      expect(result.fileName).toBe('badge.webp');
      expect(result.format).toBe('webp');
      expect(result.blob.type).toBe('image/webp');
    });

    it('reports progress callback stages', async () => {
      const buffer = fs.readFileSync(sampleJpgPath);
      const file = new File([buffer], 'photo.jpg', { type: 'image/jpeg' });
      const stages: string[] = [];

      await resizeImage(file, { width: 300, height: 200 }, (progress, stage) => {
        if (stage && !stages.includes(stage)) stages.push(stage);
      });

      expect(stages).toContain('validating');
      expect(stages).toContain('reading');
    });
  });
});
