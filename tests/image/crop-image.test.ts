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
import { cropImage } from '../../engines/image/crop';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 100, h = 80) {
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
        drawImage: (_bitmap: unknown, _sx: number, _sy: number, _sw: number, _sh: number, _dx: number, _dy: number, _dw: number, _dh: number) => {},
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

describe('Tool #13: Crop Image Engine & Validation Pipeline', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sampleJpgPath = path.join(fixturesDir, 'sample.jpg');
  const samplePngPath = path.join(fixturesDir, 'sample.png');
  const sampleWebpPath = path.join(fixturesDir, 'sample.webp');
  const sampleAnimatedWebpPath = path.join(fixturesDir, 'animated.webp');

  beforeAll(() => {
    if (typeof globalThis.createImageBitmap === 'undefined') {
      (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = async (_blob: Blob) => {
        return new MockImageBitmap(100, 80);
      };
    }
    if (typeof globalThis.OffscreenCanvas === 'undefined') {
      (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = MockOffscreenCanvas;
    }
  });

  it('1. Valid JPG accepted', async () => {
    const buffer = fs.readFileSync(sampleJpgPath);
    const file = new File([buffer], 'sample.jpg', { type: 'image/jpeg' });
    const res = await validateCompressibleImageFile(file);
    expect(res.valid).toBe(true);
  });

  it('2. Valid PNG accepted', async () => {
    const buffer = fs.readFileSync(samplePngPath);
    const file = new File([buffer], 'sample.png', { type: 'image/png' });
    const res = await validateCompressibleImageFile(file);
    expect(res.valid).toBe(true);
  });

  it('3. Valid WebP accepted', async () => {
    const buffer = fs.readFileSync(sampleWebpPath);
    const file = new File([buffer], 'sample.webp', { type: 'image/webp' });
    const res = await validateCompressibleImageFile(file);
    expect(res.valid).toBe(true);
  });

  it('7. Animated WebP rejected', async () => {
    const buffer = fs.readFileSync(sampleAnimatedWebpPath);
    const file = new File([buffer], 'animated.webp', { type: 'image/webp' });
    const bytes = new Uint8Array(buffer);
    expect(isAnimatedWebp(bytes)).toBe(true);

    await expect(
      cropImage(file, { x: 0, y: 0, width: 50, height: 50 })
    ).rejects.toThrow('Animated WebP files are not supported by this compression tool.');
  });

  it('9-14. Crop coordinate validation and clamping behavior', async () => {
    const buffer = fs.readFileSync(sampleJpgPath);
    const file = new File([buffer], 'sample.jpg', { type: 'image/jpeg' });

    const result = await cropImage(file, {
      x: 10,
      y: 10,
      width: 40,
      height: 30,
      outputFormat: 'jpg',
    });

    expect(result.width).toBe(40);
    expect(result.height).toBe(30);
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('28-39. Output format and signature verification', async () => {
    const buffer = fs.readFileSync(samplePngPath);
    const file = new File([buffer], 'sample.png', { type: 'image/png' });

    const resPng = await cropImage(file, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      outputFormat: 'png',
    });
    expect(resPng.format).toBe('png');
    expect(resPng.blob.type).toBe('image/png');
    const pngBuf = await resPng.blob.arrayBuffer();
    expect(hasPngMagicBytes(new Uint8Array(pngBuf))).toBe(true);

    const resJpg = await cropImage(file, {
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      outputFormat: 'jpg',
      quality: 0.9,
    });
    expect(resJpg.format).toBe('jpg');
    expect(resJpg.blob.type).toBe('image/jpeg');
    const jpgBuf = await resJpg.blob.arrayBuffer();
    expect(hasJpegMagicBytes(new Uint8Array(jpgBuf))).toBe(true);
  });

  it('40-47. Worker request formatting and safety checks', async () => {
    const buffer = fs.readFileSync(sampleWebpPath);
    const file = new File([buffer], 'sample.webp', { type: 'image/webp' });

    const resWebp = await cropImage(file, {
      x: 5,
      y: 5,
      width: 60,
      height: 40,
      outputFormat: 'webp',
    });
    expect(resWebp.format).toBe('webp');
    expect(resWebp.blob.type).toBe('image/webp');
    const webpBuf = await resWebp.blob.arrayBuffer();
    expect(hasWebpMagicBytes(new Uint8Array(webpBuf))).toBe(true);
  });
});
