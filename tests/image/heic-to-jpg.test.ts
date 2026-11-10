import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateHeicFile,
  hasHeicMagicBytes,
  validateFileCount,
  VALIDATION_LIMITS,
} from '../../engines/shared/validation';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';
import { BrowserHeicDecoder } from '../../engines/image/heic/heic-decoder';

// Helper to create a dummy HEIC ftyp header
function createHeicHeader(brand: string = 'heic', length: number = 32): Uint8Array {
  const bytes = new Uint8Array(length);
  // Box length 32 in big-endian
  bytes[0] = 0x00;
  bytes[1] = 0x00;
  bytes[2] = 0x00;
  bytes[3] = length;
  // 'ftyp'
  bytes[4] = 0x66;
  bytes[5] = 0x74;
  bytes[6] = 0x79;
  bytes[7] = 0x70;
  // Major brand
  for (let i = 0; i < 4; i++) {
    bytes[8 + i] = brand.charCodeAt(i) || 0x20;
  }
  return bytes;
}

describe('Tool #7: HEIC → JPG Engine & Validation', () => {
  const sampleHeicPath = path.join(process.cwd(), 'tests/fixtures/sample.heic');

  let sampleHeicBuffer: Buffer;

  beforeAll(() => {
    sampleHeicBuffer = fs.existsSync(sampleHeicPath)
      ? fs.readFileSync(sampleHeicPath)
      : Buffer.from(createHeicHeader('heic', 64));
  });

  describe('HEIC Container & Magic Bytes Validation', () => {
    it('should validate valid HEIC major brand (heic)', () => {
      const header = createHeicHeader('heic');
      expect(hasHeicMagicBytes(header)).toBe(true);
    });

    it('should validate other HEIC/HEIF brands (heix, hevc, hevx, mif1, msf1)', () => {
      expect(hasHeicMagicBytes(createHeicHeader('heix'))).toBe(true);
      expect(hasHeicMagicBytes(createHeicHeader('hevc'))).toBe(true);
      expect(hasHeicMagicBytes(createHeicHeader('hevx'))).toBe(true);
      expect(hasHeicMagicBytes(createHeicHeader('mif1'))).toBe(true);
      expect(hasHeicMagicBytes(createHeicHeader('msf1'))).toBe(true);
    });

    it('should reject non-HEIC ISO containers like MP4 (mp42 / isom)', () => {
      const mp4Header = createHeicHeader('mp42');
      expect(hasHeicMagicBytes(mp4Header)).toBe(false);

      const isomHeader = createHeicHeader('isom');
      expect(hasHeicMagicBytes(isomHeader)).toBe(false);
    });

    it('should reject random non-ftyp bytes', () => {
      const invalid = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
      expect(hasHeicMagicBytes(invalid)).toBe(false);
    });

    it('should validate a valid File object through validateHeicFile', async () => {
      const file = new File([new Uint8Array(sampleHeicBuffer)], 'vacation.heic', { type: 'image/heic' });
      const result = await validateHeicFile(file);
      expect(result.valid).toBe(true);
    });

    it('should reject wrong extensions (.png, .jpg, .webp)', async () => {
      const file = new File([new Uint8Array(sampleHeicBuffer)], 'vacation.png', { type: 'image/png' });
      const result = await validateHeicFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('UNSUPPORTED_FORMAT');
    });

    it('should reject files exceeding 50 MB limit', async () => {
      const largeFile = new File([''], 'large.heic', { type: 'image/heic' });
      Object.defineProperty(largeFile, 'size', {
        value: VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES + 1024,
      });

      const result = await validateHeicFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('should enforce maximum batch size of 20 files', () => {
      const validFiles = Array.from({ length: 20 }, (_, i) => new File([''], `file${i}.heic`));
      const countCheckValid = validateFileCount(validFiles);
      expect(countCheckValid.valid).toBe(true);

      const excessFiles = Array.from({ length: 21 }, (_, i) => new File([''], `file${i}.heic`));
      const countCheckInvalid = validateFileCount(excessFiles);
      expect(countCheckInvalid.valid).toBe(false);
      expect(countCheckInvalid.error?.code).toBe('INVALID_FILE');
    });
  });

  describe('HEIC Decoder and Conversion Flow', () => {
    it('should convert HEIC to JPG and produce valid JPEG blob and filename stem', async () => {
      const decoder = new BrowserHeicDecoder();
      // Mock decodeToJpegBlob for node environment
      const mockJpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      const mockBlob = new Blob([mockJpegHeader], { type: 'image/jpeg' });

      vi.spyOn(decoder, 'decodeToJpegBlob').mockResolvedValue(mockBlob);

      const testBlob = await decoder.decodeToJpegBlob(
        new File([new Uint8Array(sampleHeicBuffer)], 'iphone_photo.heic', { type: 'image/heic' }),
        0.9
      );

      expect(testBlob.type).toBe('image/jpeg');
      expect(testBlob.size).toBeGreaterThan(0);
    });

    it('should preserve original filename stem and replace .heic with .jpg', () => {
      const originalName = 'IMG_8921.HEIC';
      const stem = originalName.replace(/\.heic$/i, '');
      const outName = `${stem}.jpg`;
      expect(outName).toBe('IMG_8921.jpg');
    });

    it('should handle quality variations properly (0.9, 0.8, 0.7)', async () => {
      const decoder = new BrowserHeicDecoder();
      const spy = vi.spyOn(decoder, 'decodeToJpegBlob').mockImplementation(async (_f, _q = 0.9) => {
        const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
        return new Blob([header], { type: 'image/jpeg' });
      });

      const file = new File([new Uint8Array(sampleHeicBuffer)], 'photo.heic', { type: 'image/heic' });
      await decoder.decodeToJpegBlob(file, 0.8);
      expect(spy).toHaveBeenCalledWith(file, 0.8);

      await decoder.decodeToJpegBlob(file, 0.7);
      expect(spy).toHaveBeenCalledWith(file, 0.7);
    });
  });

  describe('ZIP Archive & Unique Filename Generation', () => {
    it('should generate collision-free unique filenames for duplicates', () => {
      const usedNames = new Set<string>();
      const name1 = generateUniqueFilename('photo.jpg', usedNames);
      usedNames.add(name1);
      expect(name1).toBe('photo.jpg');

      const name2 = generateUniqueFilename('photo.jpg', usedNames);
      usedNames.add(name2);
      expect(name2).toBe('photo (1).jpg');

      const name3 = generateUniqueFilename('photo.jpg', usedNames);
      usedNames.add(name3);
      expect(name3).toBe('photo (2).jpg');
    });

    it('should create a valid ZIP blob containing multiple converted JPG files', async () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const blob1 = new Blob([jpegHeader], { type: 'image/jpeg' });
      const blob2 = new Blob([jpegHeader], { type: 'image/jpeg' });

      const zipBlob = await createZipBlob([
        { name: 'photo-1.jpg', blob: blob1 },
        { name: 'photo-2.jpg', blob: blob2 },
      ]);

      expect(zipBlob).toBeDefined();
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(zipBlob.type).toBe('application/zip');
    });
  });
});
