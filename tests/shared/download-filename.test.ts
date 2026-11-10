import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import JSZip from 'jszip';
import {
  formatDownloadFilename,
  triggerBlobDownload,
  createZipBlob,
} from '@/engines/shared/file-utils';
import { DownloadButton } from '@/components/tool/DownloadButton';

describe('Convert24 — Download Filename Normalization Test Suite', () => {
  // =========================================================================
  // 1. Core formatDownloadFilename Unit Tests
  // =========================================================================
  describe('1. formatDownloadFilename Helper', () => {
    it('prefixes standard image and document filenames with "Convert24 - "', () => {
      expect(formatDownloadFilename('test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('photo.jpg')).toBe('Convert24 - photo.jpg');
      expect(formatDownloadFilename('diagram.webp')).toBe('Convert24 - diagram.webp');
      expect(formatDownloadFilename('vector.svg')).toBe('Convert24 - vector.svg');
      expect(formatDownloadFilename('report.pdf')).toBe('Convert24 - report.pdf');
      expect(formatDownloadFilename('contract.pdf')).toBe('Convert24 - contract.pdf');
    });

    it('prefixes batch ZIP archive filenames with "Convert24 - "', () => {
      expect(formatDownloadFilename('jpg-to-png-files.zip')).toBe('Convert24 - jpg-to-png-files.zip');
      expect(formatDownloadFilename('compressed-images-1730000000.zip')).toBe('Convert24 - compressed-images-1730000000.zip');
      expect(formatDownloadFilename('split-documents.zip')).toBe('Convert24 - split-documents.zip');
      expect(formatDownloadFilename('invoice-jpg-images.zip')).toBe('Convert24 - invoice-jpg-images.zip');
    });

    it('prevents duplicate prefixes idempotently', () => {
      // Exactly prefixed once
      expect(formatDownloadFilename('Convert24 - test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('Convert24 - report.pdf')).toBe('Convert24 - report.pdf');
      expect(formatDownloadFilename('Convert24 - files.zip')).toBe('Convert24 - files.zip');

      // Accidental nested / multiple duplicate prefixes stripped down to single prefix
      expect(formatDownloadFilename('Convert24 - Convert24 - test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('Convert24 - Convert24 - Convert24 - report.pdf')).toBe('Convert24 - report.pdf');

      // Case-insensitive prefix recognition and normalization
      expect(formatDownloadFilename('convert24 - test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('CONVERT24 - report.pdf')).toBe('Convert24 - report.pdf');
      expect(formatDownloadFilename('convert24-test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('CONVERT24 - convert24 - test.png')).toBe('Convert24 - test.png');
    });

    it('handles leading and trailing whitespace and extra spacing around hyphen', () => {
      expect(formatDownloadFilename('   test.png   ')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('   Convert24 - test.png   ')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('Convert24 -    test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('Convert24   -   test.png')).toBe('Convert24 - test.png');
      expect(formatDownloadFilename('Convert24 -  ')).toBe('Convert24 - download');
    });

    it('handles empty, null, and undefined input with safe fallback', () => {
      expect(formatDownloadFilename('')).toBe('Convert24 - download');
      expect(formatDownloadFilename('   ')).toBe('Convert24 - download');
      expect(formatDownloadFilename(null)).toBe('Convert24 - download');
      expect(formatDownloadFilename(undefined)).toBe('Convert24 - download');
    });

    it('preserves Unicode, Asian, accented, and RTL filenames without mangling', () => {
      expect(formatDownloadFilename('résumé.pdf')).toBe('Convert24 - résumé.pdf');
      expect(formatDownloadFilename('café_menu.png')).toBe('Convert24 - café_menu.png');
      expect(formatDownloadFilename('über_uns.jpg')).toBe('Convert24 - über_uns.jpg');
      expect(formatDownloadFilename('照片.png')).toBe('Convert24 - 照片.png');
      expect(formatDownloadFilename('日本語の資料.pdf')).toBe('Convert24 - 日本語の資料.pdf');
      expect(formatDownloadFilename('ملف_مستند.pdf')).toBe('Convert24 - ملف_مستند.pdf');
      expect(formatDownloadFilename('מסמך.pdf')).toBe('Convert24 - מסמך.pdf');
    });

    it('preserves multiple dots, internal spaces, collision indices, and complex punctuation', () => {
      expect(formatDownloadFilename('my.vacation.photo.2026.png')).toBe('Convert24 - my.vacation.photo.2026.png');
      expect(formatDownloadFilename('archive.tar.gz')).toBe('Convert24 - archive.tar.gz');
      expect(formatDownloadFilename('photo (1).png')).toBe('Convert24 - photo (1).png');
      expect(formatDownloadFilename('photo (2).jpg')).toBe('Convert24 - photo (2).jpg');
      expect(formatDownloadFilename('report [final] #1 & summary $100.pdf')).toBe('Convert24 - report [final] #1 & summary $100.pdf');
    });

    it('correctly prefixes filenames that contain "Convert24" as a word without hyphen', () => {
      expect(formatDownloadFilename('Convert24.png')).toBe('Convert24 - Convert24.png');
      expect(formatDownloadFilename('Convert24_logo.svg')).toBe('Convert24 - Convert24_logo.svg');
    });
  });

  // =========================================================================
  // 2. DOM triggerBlobDownload Integration
  // =========================================================================
  describe('2. triggerBlobDownload Function', () => {
    let createdAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };
    let appendedChild: unknown;
    let removedChild: unknown;
    let urlCreateObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let urlRevokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      urlCreateObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost:3000/mock-blob-uuid');
      urlRevokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      createdAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };

      (globalThis as unknown as Record<string, unknown>).window = {
        URL: {
          createObjectURL: urlCreateObjectURLSpy,
          revokeObjectURL: urlRevokeObjectURLSpy,
        },
      };

      (globalThis as unknown as Record<string, unknown>).document = {
        createElement: vi.fn().mockImplementation((tagName: string) => {
          if (tagName === 'a') {
            return createdAnchor;
          }
          return {};
        }),
        body: {
          appendChild: vi.fn().mockImplementation((node: unknown) => {
            appendedChild = node;
            return node;
          }),
          removeChild: vi.fn().mockImplementation((node: unknown) => {
            removedChild = node;
            return node;
          }),
        },
      };
    });

    afterEach(() => {
      delete (globalThis as unknown as Record<string, unknown>).window;
      delete (globalThis as unknown as Record<string, unknown>).document;
      vi.restoreAllMocks();
    });

    it('assigns formatted branded filename to anchor.download on single file download', () => {
      const mockBlob = new Blob(['sample-data'], { type: 'image/png' });
      triggerBlobDownload(mockBlob, 'screenshot.png');

      expect(createdAnchor.download).toBe('Convert24 - screenshot.png');
      expect(createdAnchor.href).toBe('blob:http://localhost:3000/mock-blob-uuid');
      expect(createdAnchor.click).toHaveBeenCalledTimes(1);
      expect(appendedChild).toBe(createdAnchor);
      expect(removedChild).toBe(createdAnchor);
    });

    it('assigns formatted branded filename to anchor.download on ZIP archive download', () => {
      const mockBlob = new Blob(['zip-binary-data'], { type: 'application/zip' });
      triggerBlobDownload(mockBlob, 'png-to-jpg-files.zip');

      expect(createdAnchor.download).toBe('Convert24 - png-to-jpg-files.zip');
      expect(createdAnchor.click).toHaveBeenCalledTimes(1);
    });

    it('does not duplicate prefix if filename already starts with "Convert24 - "', () => {
      const mockBlob = new Blob(['pdf-data'], { type: 'application/pdf' });
      triggerBlobDownload(mockBlob, 'Convert24 - invoice.pdf');

      expect(createdAnchor.download).toBe('Convert24 - invoice.pdf');
      expect(createdAnchor.click).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. Direct Anchor Download Components (DownloadButton & RotateImageController)
  // =========================================================================
  describe('3. Direct Anchor Components (DownloadButton & RotateImageController)', () => {
    it('applies formatDownloadFilename to rendered anchor download attribute', () => {
      const html = renderToString(
        React.createElement(DownloadButton, {
          href: 'blob:http://localhost:3000/test-uuid',
          downloadFilename: 'annual-report.pdf',
        })
      );

      expect(html).toContain('download="Convert24 - annual-report.pdf"');
    });

    it('does not duplicate prefix in DownloadButton if already prefixed', () => {
      const html = renderToString(
        React.createElement(DownloadButton, {
          href: 'blob:http://localhost:3000/test-uuid',
          downloadFilename: 'Convert24 - annual-report.pdf',
        })
      );

      expect(html).toContain('download="Convert24 - annual-report.pdf"');
      expect(html).not.toContain('Convert24 - Convert24 -');
    });

    it('falls back to "Convert24 - download" in DownloadButton when downloadFilename is absent or empty', () => {
      const htmlWithoutFilename = renderToString(
        React.createElement(DownloadButton, {
          href: 'blob:http://localhost:3000/test-uuid',
        })
      );
      expect(htmlWithoutFilename).toContain('download="Convert24 - download"');

      const htmlWithEmptyFilename = renderToString(
        React.createElement(DownloadButton, {
          href: 'blob:http://localhost:3000/test-uuid',
          downloadFilename: '',
        })
      );
      expect(htmlWithEmptyFilename).toContain('download="Convert24 - download"');
    });

    it('formats RotateImageController single download attribute with brand prefix', () => {
      // Simulates line 589 and 660 in RotateImageController.tsx
      const rawResultFileName = 'landscape.jpg';
      const anchorDownload = formatDownloadFilename(rawResultFileName || 'rotated.jpg');
      expect(anchorDownload).toBe('Convert24 - landscape.jpg');

      // Fallback filename if resultFileName is empty
      const emptyName: string = '';
      const fallbackDownload = formatDownloadFilename(emptyName || 'rotated.jpg');
      expect(fallbackDownload).toBe('Convert24 - rotated.jpg');
    });
  });

  // =========================================================================
  // 4. Archive Contents Integrity (ZIP entries remain untouched)
  // =========================================================================
  describe('4. Archive Contents Integrity', () => {
    it('preserves clean un-prefixed entry names inside created ZIP archives', async () => {
      const file1 = { name: 'photo1.jpg', blob: new Blob(['bytes1'], { type: 'image/jpeg' }) };
      const file2 = { name: 'photo2.jpg', blob: new Blob(['bytes2'], { type: 'image/jpeg' }) };

      const zipBlob = await createZipBlob([file1, file2]);
      const zip = await JSZip.loadAsync(zipBlob);

      // Verify entries inside the ZIP archive do NOT receive the prefix
      const entryNames = Object.keys(zip.files);
      expect(entryNames).toContain('photo1.jpg');
      expect(entryNames).toContain('photo2.jpg');
      expect(entryNames.some((n) => n.startsWith('Convert24 - '))).toBe(false);

      // Verify the downloaded ZIP itself will receive the prefix when triggered
      const formattedZipDownloadName = formatDownloadFilename('photos.zip');
      expect(formattedZipDownloadName).toBe('Convert24 - photos.zip');
    });
  });
});
