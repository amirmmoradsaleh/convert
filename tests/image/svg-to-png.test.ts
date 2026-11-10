import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateSvgFile,
  validateSvgContent,
  parseViewBox,
  parseLengthToPixels,
  scanSvgSecurity,
} from '../../engines/image/svg/svg-validator';
import { convertSvgToPng } from '../../engines/image/convert';
import { validateFileCount, hasPngMagicBytes, VALIDATION_LIMITS } from '../../engines/shared/validation';
import { createZipBlob, generateUniqueFilename } from '../../engines/shared/file-utils';

describe('Tool #8: SVG → PNG Engine & Security Validation', () => {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');
  const sampleSvgPath = path.join(fixturesDir, 'sample.svg');
  const withDimensionsSvgPath = path.join(fixturesDir, 'with-dimensions.svg');
  const unsafeScriptSvgPath = path.join(fixturesDir, 'unsafe-script.svg');
  const unsafeEventSvgPath = path.join(fixturesDir, 'unsafe-event.svg');
  const unsafeExternalSvgPath = path.join(fixturesDir, 'unsafe-external.svg');
  const corruptedSvgPath = path.join(fixturesDir, 'corrupted.svg');

  let sampleSvgText: string;
  let withDimensionsSvgText: string;
  let unsafeScriptSvgText: string;
  let unsafeEventSvgText: string;
  let unsafeExternalSvgText: string;
  let corruptedSvgText: string;

  beforeAll(() => {
    sampleSvgText = fs.readFileSync(sampleSvgPath, 'utf8');
    withDimensionsSvgText = fs.readFileSync(withDimensionsSvgPath, 'utf8');
    unsafeScriptSvgText = fs.readFileSync(unsafeScriptSvgPath, 'utf8');
    unsafeEventSvgText = fs.readFileSync(unsafeEventSvgPath, 'utf8');
    unsafeExternalSvgText = fs.readFileSync(unsafeExternalSvgPath, 'utf8');
    corruptedSvgText = fs.readFileSync(corruptedSvgPath, 'utf8');
  });

  describe('Dimension & ViewBox Parsing', () => {
    it('should parse length units into pixels accurately', () => {
      expect(parseLengthToPixels('100px')).toBe(100);
      expect(parseLengthToPixels('200')).toBe(200);
      expect(parseLengthToPixels('72pt')).toBeCloseTo(96, 1);
      expect(parseLengthToPixels('1in')).toBe(96);
      expect(parseLengthToPixels('100%')).toBeNull();
      expect(parseLengthToPixels('invalid')).toBeNull();
      expect(parseLengthToPixels('-50')).toBeNull();
    });

    it('should parse valid viewBox components', () => {
      const vb = parseViewBox('0 0 100 200');
      expect(vb).toEqual({ minX: 0, minY: 0, width: 100, height: 200 });

      const commaVb = parseViewBox('10, 20, 300, 400');
      expect(commaVb).toEqual({ minX: 10, minY: 20, width: 300, height: 400 });
    });

    it('should reject invalid viewBox components', () => {
      expect(parseViewBox('0 0 -100 200')).toBeNull();
      expect(parseViewBox('0 0 100 0')).toBeNull();
      expect(parseViewBox('0 0 100')).toBeNull();
      expect(parseViewBox('abc def 100 200')).toBeNull();
    });

    it('should derive dimensions from viewBox when width/height are omitted', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><circle cx="10" cy="10" r="5"/></svg>';
      const result = validateSvgContent(svg);
      expect(result.valid).toBe(true);
      expect(result.dimensions?.width).toBe(640);
      expect(result.dimensions?.height).toBe(480);
    });

    it('should preserve aspect ratio when one dimension is missing with viewBox', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" viewBox="0 0 100 50"><circle cx="10" cy="10" r="5"/></svg>';
      const result = validateSvgContent(svg);
      expect(result.valid).toBe(true);
      expect(result.dimensions?.width).toBe(300);
      expect(result.dimensions?.height).toBe(150);
    });

    it('should fallback to 800x800 when no width, height, or viewBox is given', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>';
      const result = validateSvgContent(svg);
      expect(result.valid).toBe(true);
      expect(result.dimensions?.width).toBe(800);
      expect(result.dimensions?.height).toBe(800);
    });

    it('should reject SVGs with raster dimensions exceeding 8192px', () => {
      const hugeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"><circle cx="10" cy="10" r="5"/></svg>';
      const result = validateSvgContent(hugeSvg);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('too large to rasterize');
    });
  });

  describe('SVG Security Validation (Strict Anti-Execution & Anti-Injection)', () => {
    it('should reject SVGs with <script> tags', () => {
      const scan = scanSvgSecurity(unsafeScriptSvgText);
      expect(scan.safe).toBe(false);

      const val = validateSvgContent(unsafeScriptSvgText);
      expect(val.valid).toBe(false);
      expect(val.error?.message).toContain('unsupported or unsafe');
    });

    it('should reject namespaced <svg:script> tags', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><svg:script>alert(1)</svg:script></svg>';
      const scan = scanSvgSecurity(svg);
      expect(scan.safe).toBe(false);
    });

    it('should reject <foreignObject> tags', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><div>evil</div></body></foreignObject></svg>';
      const scan = scanSvgSecurity(svg);
      expect(scan.safe).toBe(false);

      const val = validateSvgContent(svg);
      expect(val.valid).toBe(false);
    });

    it('should reject inline event handlers (onload, onclick, onerror, etc.)', () => {
      const scan = scanSvgSecurity(unsafeEventSvgText);
      expect(scan.safe).toBe(false);

      const val = validateSvgContent(unsafeEventSvgText);
      expect(val.valid).toBe(false);
      expect(val.error?.message).toContain('unsupported or unsafe');
    });

    it('should reject javascript: pseudo-protocol URIs', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle cx="5" cy="5" r="5"/></a></svg>';
      const scan = scanSvgSecurity(svg);
      expect(scan.safe).toBe(false);

      const val = validateSvgContent(svg);
      expect(val.valid).toBe(false);
    });

    it('should reject external network resource references in href/src', () => {
      const scan = scanSvgSecurity(unsafeExternalSvgText);
      expect(scan.safe).toBe(false);

      const val = validateSvgContent(unsafeExternalSvgText);
      expect(val.valid).toBe(false);
    });

    it('should reject external CSS imports in <style>', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("http://evil.com/font.css");</style></svg>';
      const scan = scanSvgSecurity(svg);
      expect(scan.safe).toBe(false);
    });

    it('should reject external SYSTEM entities in DOCTYPE', () => {
      const svg = '<!DOCTYPE svg [ <!ENTITY xxe SYSTEM "http://evil.com/leak"> ]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>';
      const scan = scanSvgSecurity(svg);
      expect(scan.safe).toBe(false);
    });
  });

  describe('File Level Validation & Limits', () => {
    it('should validate a clean SVG file successfully', async () => {
      const file = new File([sampleSvgText], 'icon.svg', { type: 'image/svg+xml' });
      const result = await validateSvgFile(file);
      expect(result.valid).toBe(true);
      expect(result.dimensions?.width).toBe(100);
      expect(result.dimensions?.height).toBe(100);
    });

    it('should reject wrong extension (.png, .jpg, .heic)', async () => {
      const file = new File([sampleSvgText], 'icon.png', { type: 'image/png' });
      const result = await validateSvgFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Only SVG files are supported');
    });

    it('should reject SVG files exceeding 50 MB limit', async () => {
      const file = new File([''], 'huge.svg', { type: 'image/svg+xml' });
      Object.defineProperty(file, 'size', {
        value: VALIDATION_LIMITS.MAX_IMAGE_SIZE_BYTES + 1024,
      });

      const result = await validateSvgFile(file);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('50 MB');
    });

    it('should reject non-SVG XML documents (e.g. HTML/RSS)', () => {
      const htmlDoc = '<html><head><title>Page</title></head><body><h1>Hello</h1></body></html>';
      const result = validateSvgContent(htmlDoc);
      expect(result.valid).toBe(false);
    });

    it('should reject malformed/corrupted SVG XML', () => {
      const result = validateSvgContent(corruptedSvgText);
      expect(result.valid).toBe(false);
    });

    it('should enforce batch limit of 20 files', () => {
      const validFiles = Array.from({ length: 20 }, (_, i) => new File(['<svg></svg>'], `icon${i}.svg`));
      expect(validateFileCount(validFiles).valid).toBe(true);

      const excessFiles = Array.from({ length: 21 }, (_, i) => new File(['<svg></svg>'], `icon${i}.svg`));
      expect(validateFileCount(excessFiles).valid).toBe(false);
    });
  });

  describe('SVG to PNG Rasterization & ZIP Creation', () => {
    it('should rasterize sample SVG to PNG and produce valid PNG signature', async () => {
      const file = new File([sampleSvgText], 'logo.svg', { type: 'image/svg+xml' });
      const result = await convertSvgToPng(file);

      expect(result.blob).toBeDefined();
      expect(result.blob.type).toBe('image/png');
      expect(result.fileName).toBe('logo.png');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);

      const buffer = await result.blob.arrayBuffer();
      expect(hasPngMagicBytes(buffer)).toBe(true);
    });

    it('should create valid ZIP archive with unique filenames for SVG batch', async () => {
      const file1 = new File([sampleSvgText], 'logo.svg', { type: 'image/svg+xml' });
      const file2 = new File([withDimensionsSvgText], 'logo.svg', { type: 'image/svg+xml' });

      const res1 = await convertSvgToPng(file1);
      const res2 = await convertSvgToPng(file2);

      const usedNames = new Set<string>();
      const entries = [
        { name: generateUniqueFilename(res1.fileName, usedNames), blob: res1.blob },
        { name: generateUniqueFilename(res2.fileName, usedNames), blob: res2.blob },
      ];

      expect(entries[0].name).toBe('logo.png');
      expect(entries[1].name).toBe('logo (1).png');

      const zipBlob = await createZipBlob(entries);
      expect(zipBlob.size).toBeGreaterThan(0);
      expect(zipBlob.type).toBe('application/zip');
    });
  });
});
