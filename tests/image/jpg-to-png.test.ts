import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { convertJpgToPng } from '../../engines/image/convert';
import { processImageJob } from '../../engines/image/worker/image.worker';
import { ImageWorkerRequest } from '../../engines/image/worker/worker-types';
import { validateJpegFile, hasJpegMagicBytes } from '../../engines/shared/validation';
import { ToolError, getHumanErrorMessage } from '../../engines/shared/errors';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';

// Polyfill ImageBitmap and OffscreenCanvas for Node test environment
class MockImageBitmap {
  width: number;
  height: number;
  isClosed = false;

  constructor(w = 1920, h = 1080) {
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
        drawImage: (_bitmap: unknown, _x: number, _y: number) => {},
      };
    }
    return null;
  }

  async convertToBlob(options?: { type?: string; quality?: number }) {
    if (options?.type === 'image/jpeg') {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      return new Blob([jpegHeader], { type: 'image/jpeg' });
    }
    // Standard PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);
    return new Blob([pngHeader], { type: options?.type || 'image/png' });
  }
}

beforeAll(() => {
  if (typeof globalThis.OffscreenCanvas === 'undefined') {
    // @ts-expect-error polyfill for testing
    globalThis.OffscreenCanvas = MockOffscreenCanvas;
  }

  if (typeof globalThis.createImageBitmap === 'undefined') {
    // @ts-expect-error polyfill for testing
    globalThis.createImageBitmap = async (source: Blob) => {
      const buffer = await source.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isJpg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      const isPng = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
      if (!isJpg && !isPng) {
        throw new Error('Invalid image data');
      }
      if (bytes.length < 20) {
        throw new Error('Corrupted image stream');
      }
      return new MockImageBitmap(1920, 1080) as unknown as ImageBitmap;
    };
  }
});

describe('JPG to PNG Conversion Engine', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const validJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpg'));
  const validJpegBuffer = fs.readFileSync(path.join(fixturesDir, 'sample.jpeg'));
  const corruptJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'corrupted.jpg'));
  const fakeJpgBuffer = fs.readFileSync(path.join(fixturesDir, 'fake.jpg'));

  it('1. should convert valid JPG file successfully', async () => {
    const file = new File([validJpgBuffer], 'vacation-photo.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToPng(file);

    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toBe('vacation-photo.png');
  });

  it('2. should convert valid JPEG file successfully', async () => {
    const file = new File([validJpegBuffer], 'landscape.jpeg', { type: 'image/jpeg' });
    const result = await convertJpgToPng(file);

    expect(result).toBeDefined();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.fileName).toBe('landscape.png');
  });

  it('3. should produce output with MIME type image/png', async () => {
    const file = new File([validJpgBuffer], 'document.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToPng(file);

    expect(result.blob.type).toBe('image/png');
  });

  it('4. should produce valid PNG starting with PNG magic signature (89 50 4E 47)', async () => {
    const file = new File([validJpgBuffer], 'test.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToPng(file);

    const buffer = await result.blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it('5. should preserve width dimension', async () => {
    const file = new File([validJpgBuffer], 'dimensions.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToPng(file);

    expect(result.width).toBe(1920);
  });

  it('6. should preserve height dimension', async () => {
    const file = new File([validJpgBuffer], 'dimensions.jpg', { type: 'image/jpeg' });
    const result = await convertJpgToPng(file);

    expect(result.height).toBe(1080);
  });

  it('7. should reject invalid/fake file via magic bytes check', async () => {
    const fakeFile = new File([fakeJpgBuffer], 'not-a-jpeg.jpg', { type: 'image/jpeg' });
    await expect(convertJpgToPng(fakeFile)).rejects.toThrow('This file is not a valid JPEG image.');

    const bytes = new Uint8Array(fakeJpgBuffer);
    expect(hasJpegMagicBytes(bytes)).toBe(false);
  });

  it('8. should reject wrong extension when format is unsupported', async () => {
    const wrongExtFile = new File(['mock content'], 'test.png', { type: 'image/png' });
    const validation = await validateJpegFile(wrongExtFile);

    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe('UNSUPPORTED_FORMAT');
    expect(validation.error?.message).toBe('Only JPG and JPEG files are supported.');
  });

  it('9. should reject oversized file (> 50 MB)', async () => {
    const largeFile = new File([''], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 55 * 1024 * 1024 });

    const validation = await validateJpegFile(largeFile);
    expect(validation.valid).toBe(false);
    expect(validation.error?.code).toBe('FILE_TOO_LARGE');
    expect(validation.error?.message).toBe('This file is too large. Maximum size is 50 MB.');
  });

  it('10. should process multiple files and handle unique filenames', async () => {
    const file1 = new File([validJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });
    const file2 = new File([validJpgBuffer], 'photo.jpg', { type: 'image/jpeg' });

    const [res1, res2] = await Promise.all([convertJpgToPng(file1), convertJpgToPng(file2)]);

    expect(res1.blob).toBeDefined();
    expect(res2.blob).toBeDefined();

    // Verify filename deduplication helper
    const usedNames = new Set<string>();
    const name1 = generateUniqueFilename(res1.fileName, usedNames);
    const name2 = generateUniqueFilename(res2.fileName, usedNames);

    expect(name1).toBe('photo.png');
    expect(name2).toBe('photo (1).png');
  });

  it('11. should change filename extension from .jpg/.jpeg to .png', async () => {
    const fileJpg = new File([validJpgBuffer], 'image.jpg', { type: 'image/jpeg' });
    const fileJpeg = new File([validJpegBuffer], 'image.jpeg', { type: 'image/jpeg' });

    const resJpg = await convertJpgToPng(fileJpg);
    const resJpeg = await convertJpgToPng(fileJpeg);

    expect(resJpg.fileName).toBe('image.png');
    expect(resJpeg.fileName).toBe('image.png');
  });

  it('12. should normalize errors with friendly messages', () => {
    const err = new ToolError('INVALID_FILE');
    expect(err.message).toBe('This file is not a valid JPEG image.');
    expect(getHumanErrorMessage('BROWSER_MEMORY_ERROR')).toBe('This image is too large for your browser to process.');
    expect(getHumanErrorMessage('PROCESSING_FAILED')).toBe("We couldn't convert this image. Please try again.");
  });

  it('13. should handle worker message protocol with actual progress stages', async () => {
    const stagesRecorded: string[] = [];

    const request: ImageWorkerRequest = {
      id: 'test-job-1',
      operation: 'convert',
      fileData: validJpgBuffer.buffer.slice(
        validJpgBuffer.byteOffset,
        validJpgBuffer.byteOffset + validJpgBuffer.byteLength
      ),
      fileName: 'test.jpg',
      mimeType: 'image/jpeg',
      options: { targetFormat: 'png' },
    };

    const response = await processImageJob(request, (stage, percent) => {
      stagesRecorded.push(`${stage}:${percent}`);
    });

    expect(response.success).toBe(true);
    expect(response.type).toBe('success');
    expect(response.resultMime).toBe('image/png');
    expect(response.width).toBe(1920);
    expect(response.height).toBe(1080);
    expect(stagesRecorded).toContain('validating:15');
    expect(stagesRecorded).toContain('reading:35');
    expect(stagesRecorded).toContain('decoding:60');
    expect(stagesRecorded).toContain('encoding:85');
    expect(stagesRecorded).toContain('finalizing:100');
  });

  it('14. should surface worker errors correctly when corrupted', async () => {
    const request: ImageWorkerRequest = {
      id: 'test-job-corrupted',
      operation: 'convert',
      fileData: corruptJpgBuffer.buffer.slice(
        corruptJpgBuffer.byteOffset,
        corruptJpgBuffer.byteOffset + corruptJpgBuffer.byteLength
      ),
      fileName: 'corrupted.jpg',
      mimeType: 'image/jpeg',
      options: { targetFormat: 'png' },
    };

    const response = await processImageJob(request);
    expect(response.success).toBe(false);
    expect(response.errorCode).toBe('INVALID_FILE');
    expect(response.error).toBe('This file is not a valid JPEG image.');
  });

  it('15. should create in-browser ZIP archive from converted PNG files', async () => {
    const file1 = new File([validJpgBuffer], 'pic1.jpg', { type: 'image/jpeg' });
    const file2 = new File([validJpgBuffer], 'pic2.jpg', { type: 'image/jpeg' });

    const [res1, res2] = await Promise.all([convertJpgToPng(file1), convertJpgToPng(file2)]);

    const zipBlob = await createZipBlob([
      { name: res1.fileName, blob: res1.blob },
      { name: res2.fileName, blob: res2.blob },
    ]);

    expect(zipBlob).toBeInstanceOf(Blob);
    expect(zipBlob.type).toBe('application/zip');

    const zipBuffer = await zipBlob.arrayBuffer();
    const zipBytes = new Uint8Array(zipBuffer);

    // Standard ZIP magic number: PK (0x50, 0x4B, 0x03, 0x04)
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
  });
});
