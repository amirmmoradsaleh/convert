import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  uploadMedia,
  listMedia,
  getMediaById,
  updateMedia,
  deleteMedia,
  checkMediaDependencies,
} from '@/lib/admin/services/media.service';
import {
  validateMediaUpload,
  sanitizeFilename,
  extractImageDimensions,
  inspectSvgSecurity,
} from '@/lib/media/validation';
import { LocalStorageProvider, setStorageProvider } from '@/lib/media/storage';
import { resetMemoryDb, getDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';

describe('Admin CMS Phase 05 — Media Library / Asset Management Test Suite', () => {
  const author: AdminUserSession = {
    id: 'admin-media-01',
    email: 'asset-mgr@filetools.local',
    name: 'Asset Manager',
    role: 'ADMIN',
  };

  const testUploadsDir = path.join(process.cwd(), 'tests', 'temp-uploads');

  beforeEach(() => {
    resetMemoryDb();
    if (!fs.existsSync(testUploadsDir)) {
      fs.mkdirSync(testUploadsDir, { recursive: true });
    }
    setStorageProvider(new LocalStorageProvider(testUploadsDir, '/test-uploads'));
  });

  afterEach(async () => {
    if (fs.existsSync(testUploadsDir)) {
      await fs.promises.rm(testUploadsDir, { recursive: true, force: true });
    }
  });

  describe('1. File Validation, Sanitization & SVG Security', () => {
    it('sanitizes unsafe filenames and removes path traversal sequences', () => {
      expect(sanitizeFilename('My Summer Vacation (2026)!.PNG')).toBe('my-summer-vacation-2026.png');
      expect(sanitizeFilename('../../../etc/passwd.jpg')).toBe('passwd.jpg');
      expect(sanitizeFilename('folder/subfolder/test image.webp')).toBe('test-image.webp');
      expect(sanitizeFilename('___---...png')).toBe('asset.png');
    });

    it('rejects uploads with direct path traversal in filename', () => {
      const buffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const result = validateMediaUpload(buffer, '../../malicious.png', 'image/png');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Path traversal');
    });

    it('rejects empty payloads and files exceeding 10 MB limit', () => {
      const emptyBuffer = Buffer.alloc(0);
      expect(validateMediaUpload(emptyBuffer, 'test.png', 'image/png').isValid).toBe(false);

      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
      const result = validateMediaUpload(oversizedBuffer, 'huge.jpg', 'image/jpeg');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('10 MB');
    });

    it('rejects unsupported MIME types', () => {
      const buffer = Buffer.from('hello world');
      const result = validateMediaUpload(buffer, 'test.txt', 'text/plain');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('rejects files where extension does not match MIME type', () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const result = validateMediaUpload(pngBuffer, 'sample.jpg', 'image/png');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('does not match MIME type');
    });

    it('rejects files with invalid or forged magic bytes', () => {
      const fakeBuffer = Buffer.from('NOT A REAL PNG FILE AT ALL');
      const result = validateMediaUpload(fakeBuffer, 'sample.png', 'image/png');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('PNG magic bytes');
    });

    it('strictly inspects SVG content for scripts, event handlers, and javascript schemes', () => {
      const safeSvg = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.svg'), 'utf8');
      expect(inspectSvgSecurity(safeSvg).isSafe).toBe(true);

      const unsafeScript = fs.readFileSync(
        path.join(process.cwd(), 'tests', 'fixtures', 'unsafe-script.svg'),
        'utf8'
      );
      expect(inspectSvgSecurity(unsafeScript).isSafe).toBe(false);

      const unsafeEvent = fs.readFileSync(
        path.join(process.cwd(), 'tests', 'fixtures', 'unsafe-event.svg'),
        'utf8'
      );
      expect(inspectSvgSecurity(unsafeEvent).isSafe).toBe(false);

      const jsSchemeSvg = `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><circle r="10"/></a></svg>`;
      expect(inspectSvgSecurity(jsSchemeSvg).isSafe).toBe(false);
    });
  });

  describe('2. Lightweight Dimension Extraction', () => {
    it('extracts dimensions for PNG images without external heavy libraries', () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const dims = extractImageDimensions(pngBuffer, 'image/png');
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('extracts dimensions for GIF images', () => {
      const gifBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample-89a.gif'));
      const dims = extractImageDimensions(gifBuffer, 'image/gif');
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('gracefully handles images with unknown or corrupt dimensions', () => {
      const dummyBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // Short PNG
      const dims = extractImageDimensions(dummyBuffer, 'image/png');
      expect(dims.width).toBeNull();
      expect(dims.height).toBeNull();
    });
  });

  describe('3. Media Service Upload & Storage', () => {
    it('successfully uploads valid image, saves file, creates DB record and audit log', async () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const asset = await uploadMedia(
        {
          buffer: pngBuffer,
          filename: 'Company Logo Final.png',
          mimeType: 'image/png',
          size: pngBuffer.length,
        },
        author,
        {
          alt: 'Company Main Logo',
          title: 'Official Logo',
          caption: 'Vector PNG Format',
        }
      );

      expect(asset.id).toBeDefined();
      expect(asset.originalFilename).toBe('Company Logo Final.png');
      expect(asset.mimeType).toBe('image/png');
      expect(asset.size).toBe(pngBuffer.length);
      expect(asset.alt).toBe('Company Main Logo');
      expect(asset.title).toBe('Official Logo');
      expect(asset.caption).toBe('Vector PNG Format');
      expect(asset.url).toContain('/test-uploads/');
      expect(asset.storagePath).toContain('tests/temp-uploads');

      // Verify file exists on disk
      expect(fs.existsSync(asset.storagePath)).toBe(true);

      // Verify audit log
      const db = getDb();
      const audit = await db.auditLog.findMany({ where: { entityId: asset.id } });
      expect(audit.length).toBe(1);
      expect(audit[0].action).toBe('MEDIA_UPLOADED');
    });

    it('generates unique collision-safe filenames when uploading files with identical names', async () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const asset1 = await uploadMedia(
        {
          buffer: pngBuffer,
          filename: 'banner.png',
          mimeType: 'image/png',
          size: pngBuffer.length,
        },
        author
      );

      const asset2 = await uploadMedia(
        {
          buffer: pngBuffer,
          filename: 'banner.png',
          mimeType: 'image/png',
          size: pngBuffer.length,
        },
        author
      );

      expect(asset1.filename).not.toBe(asset2.filename);
      expect(asset1.url).not.toBe(asset2.url);
      expect(fs.existsSync(asset1.storagePath)).toBe(true);
      expect(fs.existsSync(asset2.storagePath)).toBe(true);
    });
  });

  describe('4. Listing, Searching, Filtering & Metadata Updates', () => {
    beforeEach(async () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const jpgBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.jpg'));
      const gifBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample-89a.gif'));

      await uploadMedia(
        { buffer: pngBuffer, filename: 'diagram-schema.png', mimeType: 'image/png', size: pngBuffer.length },
        author,
        { title: 'Database Schema Diagram', alt: 'Schema Diagram' }
      );

      await uploadMedia(
        { buffer: jpgBuffer, filename: 'profile-photo.jpg', mimeType: 'image/jpeg', size: jpgBuffer.length },
        author,
        { title: 'Author Profile', alt: 'Author avatar photo' }
      );

      await uploadMedia(
        { buffer: gifBuffer, filename: 'loading-animation.gif', mimeType: 'image/gif', size: gifBuffer.length },
        author,
        { title: 'Spinner GIF', alt: 'Animated loader' }
      );
    });

    it('lists all media assets with correct pagination metadata', async () => {
      const res = await listMedia({ page: 1, limit: 10 });
      expect(res.total).toBe(3);
      expect(res.assets.length).toBe(3);
      expect(res.totalPages).toBe(1);
    });

    it('filters media assets by MIME type', async () => {
      const pngRes = await listMedia({ mimeType: 'image/png' });
      expect(pngRes.assets.length).toBe(1);
      expect(pngRes.assets[0].mimeType).toBe('image/png');

      const gifRes = await listMedia({ mimeType: 'image/gif' });
      expect(gifRes.assets.length).toBe(1);
      expect(gifRes.assets[0].mimeType).toBe('image/gif');
    });

    it('searches media assets by keyword across title, filename, and alt', async () => {
      const searchRes = await listMedia({ search: 'avatar' });
      expect(searchRes.assets.length).toBe(1);
      expect(searchRes.assets[0].title).toBe('Author Profile');
    });

    it('updates asset metadata and logs audit event', async () => {
      const list = await listMedia();
      const target = list.assets[0];

      const updated = await updateMedia(
        target.id,
        {
          title: 'Updated Diagram Title',
          alt: 'Updated Alt Description',
          caption: 'New Caption Here',
        },
        author
      );

      expect(updated.title).toBe('Updated Diagram Title');
      expect(updated.alt).toBe('Updated Alt Description');
      expect(updated.caption).toBe('New Caption Here');

      const db = getDb();
      const audit = await db.auditLog.findMany({ where: { entityId: target.id, action: 'MEDIA_UPDATED' } });
      expect(audit.length).toBe(1);
    });
  });

  describe('5. Dependency Safety & Deletion Protections', () => {
    it('blocks deletion when asset is referenced in a Blog Post featured image or content', async () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const asset = await uploadMedia(
        { buffer: pngBuffer, filename: 'hero-banner.png', mimeType: 'image/png', size: pngBuffer.length },
        author
      );

      // Create a blog post referencing this asset
      const db = getDb();
      await db.blogPost.create({
        data: {
          title: 'How to Optimize Images',
          slug: 'how-to-optimize-images',
          featuredImage: asset.url,
          status: 'PUBLISHED',
        },
      });

      const dependencies = await checkMediaDependencies(asset.url, asset.filename);
      expect(dependencies.length).toBeGreaterThan(0);
      expect(dependencies[0]).toContain('Blog Post: "How to Optimize Images"');

      // Attempting to delete must throw
      await expect(deleteMedia(asset.id, author)).rejects.toThrow('Cannot delete media asset because it is currently referenced');

      // Asset must still exist in DB and filesystem
      const stillInDb = await getMediaById(asset.id);
      expect(stillInDb).not.toBeNull();
      expect(fs.existsSync(asset.storagePath)).toBe(true);
    });

    it('blocks deletion when asset is referenced in Global Settings OG/Twitter image', async () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const asset = await uploadMedia(
        { buffer: pngBuffer, filename: 'social-share.png', mimeType: 'image/png', size: pngBuffer.length },
        author
      );

      const db = getDb();
      await db.globalSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default', defaultOgImage: asset.url },
        update: { defaultOgImage: asset.url },
      });

      const deps = await checkMediaDependencies(asset.url, asset.filename);
      expect(deps.some((d) => d.includes('Global Settings'))).toBe(true);

      await expect(deleteMedia(asset.id, author)).rejects.toThrow('Cannot delete media asset');
    });

    it('allows deletion when asset has zero references and cleanly cleans up physical file', async () => {
      const pngBuffer = fs.readFileSync(path.join(process.cwd(), 'tests', 'fixtures', 'sample.png'));
      const asset = await uploadMedia(
        { buffer: pngBuffer, filename: 'unreferenced-temp.png', mimeType: 'image/png', size: pngBuffer.length },
        author
      );

      expect(fs.existsSync(asset.storagePath)).toBe(true);

      const result = await deleteMedia(asset.id, author);
      expect(result.success).toBe(true);

      // Verify DB record is deleted
      const inDb = await getMediaById(asset.id);
      expect(inDb).toBeNull();

      // Verify physical file was unlinked
      expect(fs.existsSync(asset.storagePath)).toBe(false);

      // Verify audit log
      const db = getDb();
      const audit = await db.auditLog.findMany({ where: { entityId: asset.id, action: 'MEDIA_DELETED' } });
      expect(audit.length).toBe(1);
    });
  });
});
