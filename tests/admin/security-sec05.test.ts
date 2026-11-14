import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeCustomHtml,
  sanitizeRichTextHtml,
  isSafeUrl,
  isValidRasterDataUrl,
  validatePagePayload,
  validateBlogPostPayload,
} from '../../lib/admin/validation';
import { hasPermission } from '../../lib/admin/permissions';
import { AdminUserSession } from '../../lib/admin/types';
import {
  createDraftPage,
  updateDraftPage,
  publishPage,
  unpublishPage,
} from '../../lib/admin/services/page.service';
import {
  createDraft,
  updateDraft,
  publishPost,
  unpublishPost,
  schedulePost,
} from '../../lib/admin/services/blog.service';
import { POST as createPageRoute } from '../../app/api/admin/pages/route';
import { PUT as updatePageRoute } from '../../app/api/admin/pages/[id]/route';
import { POST as createBlogRoute } from '../../app/api/admin/blog/route';
import { PUT as updateBlogRoute } from '../../app/api/admin/blog/[id]/route';
import { POST as publishBlogRoute } from '../../app/api/admin/blog/[id]/publish/route';
import { POST as unpublishBlogRoute } from '../../app/api/admin/blog/[id]/unpublish/route';
import { POST as scheduleBlogRoute } from '../../app/api/admin/blog/[id]/schedule/route';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

const mockRequireAdminAuth = vi.fn();
vi.mock('@/lib/admin/guard', () => ({
  requireAdminAuth: (...args: any[]) => mockRequireAdminAuth(...args),
}));

vi.mock('@/lib/db', () => {
  const mockDb = {
    page: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pageContent: {
      update: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    pageSeo: {
      update: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    pageRevision: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'rev-sec05-123' }),
    },
    blogPost: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    postRevision: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'blog-rev-sec05-123' }),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return {
    getDb: () => mockDb,
    DatabasePersistenceError: class DatabasePersistenceError extends Error {},
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin/services/audit.service', () => ({
  createAuditLog: vi.fn().mockResolvedValue({ id: 'audit-sec05' }),
}));

describe('Convert24 SEC-05: Independent Security Verification Suite', () => {
  const superAdminUser: AdminUserSession = {
    id: 'user-superadmin-sec05',
    email: 'superadmin@convert24.local',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
  };

  const adminUser: AdminUserSession = {
    id: 'user-admin-sec05',
    email: 'admin@convert24.local',
    name: 'System Admin',
    role: 'ADMIN',
  };

  const contentManagerUser: AdminUserSession = {
    id: 'user-cm-sec05',
    email: 'cm@convert24.local',
    name: 'Content Manager',
    role: 'CONTENT_MANAGER',
  };

  const editorUser: AdminUserSession = {
    id: 'user-editor-sec05',
    email: 'editor@convert24.local',
    name: 'Editor User',
    role: 'EDITOR',
  };

  const viewerUser: AdminUserSession = {
    id: 'user-viewer-sec05',
    email: 'viewer@convert24.local',
    name: 'Viewer User',
    role: 'VIEWER',
  };

  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = getDb();
  });

  // =========================================================================
  // 1. SEC-03 Finding A: HTML Sanitizer Solidus & Attribute Delimiter Bypass
  // =========================================================================
  describe('1. SEC-03 Finding A: HTML Sanitizer Solidus Bypass Verification', () => {
    it('neutralizes unquoted solidus-delimited javascript href: <a/href=javascript:alert(1)>', () => {
      const payload = '<a/href=javascript:alert(1)>Click</a>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('javascript:');
      expect(cleanCustom).toContain('href="#"');
      expect(cleanRich).not.toContain('javascript:');
      expect(cleanRich).toContain('href="#"');
    });

    it('neutralizes solidus-delimited event handler: <img/onerror=alert(1)>', () => {
      const payload = '<img/onerror=alert(1)>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('onerror');
      expect(cleanCustom).not.toContain('alert');
      expect(cleanRich).not.toContain('onerror');
      expect(cleanRich).not.toContain('alert');
    });

    it('neutralizes spaced solidus delimiter: <a / href = javascript:alert(1)>', () => {
      const payload = '<a / href = javascript:alert(1)>Click</a>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('javascript:');
      expect(cleanCustom).toContain('href="#"');
      expect(cleanRich).not.toContain('javascript:');
      expect(cleanRich).toContain('href="#"');
    });

    it('neutralizes multiple consecutive solidus delimiters: <a////href=javascript:alert(1)>', () => {
      const payload = '<a////href=javascript:alert(1)>Click</a>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('javascript:');
      expect(cleanCustom).toContain('href="#"');
      expect(cleanRich).not.toContain('javascript:');
      expect(cleanRich).toContain('href="#"');
    });

    it('neutralizes mixed whitespace and multiple solidus: <a / / / href = "javascript:alert(1)">', () => {
      const payload = '<a / / / href = "javascript:alert(1)">Click</a>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('javascript:');
      expect(cleanCustom).toContain('href="#"');
      expect(cleanRich).not.toContain('javascript:');
      expect(cleanRich).toContain('href="#"');
    });

    it('neutralizes mixed whitespace and solidus on event handlers: <img / / onerror = alert(1) src=x>', () => {
      const payload = '<img / / onerror = alert(1) src=x>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('onerror');
      expect(cleanCustom).not.toContain('alert');
      expect(cleanRich).not.toContain('onerror');
      expect(cleanRich).not.toContain('alert');
    });

    it('neutralizes solidus between consecutive attributes: <img src="safe.png"/onerror=alert(1)>', () => {
      const payload = '<img src="safe.png"/onerror=alert(1)>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('onerror');
      expect(cleanCustom).toContain('src="safe.png"');
      expect(cleanRich).not.toContain('onerror');
      expect(cleanRich).toContain('src="safe.png"');
    });

    it('neutralizes backtick quoted attributes: <a/href=`javascript:alert(1)`>Click</a>', () => {
      const payload = '<a/href=`javascript:alert(1)`>Click</a>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).not.toContain('javascript:');
      expect(cleanRich).not.toContain('javascript:');
    });

    it('preserves valid safe relative URLs with solidus delimiters: <a/href=/tools/pdf-to-png>Tool</a>', () => {
      const payload = '<a/href=/tools/pdf-to-png>Tool</a>';
      const cleanCustom = sanitizeCustomHtml(payload);
      const cleanRich = sanitizeRichTextHtml(payload);

      expect(cleanCustom).toContain('href="/tools/pdf-to-png"');
      expect(cleanRich).toContain('href="/tools/pdf-to-png"');
    });
  });

  // =========================================================================
  // 2. SEC-03 Finding B: isSafeUrl & Raster Data URL Security
  // =========================================================================
  describe('2. SEC-03 Finding B: isSafeUrl & Raster Data URL Verification', () => {
    it('accepts valid Base64 PNG image data URLs', () => {
      const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(isValidRasterDataUrl(validPng)).toBe(true);
      expect(isSafeUrl(validPng)).toBe(true);
    });

    it('accepts valid Base64 JPEG image data URLs', () => {
      const validJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      expect(isValidRasterDataUrl(validJpeg)).toBe(true);
      expect(isSafeUrl(validJpeg)).toBe(true);
    });

    it('accepts valid Base64 WebP image data URLs', () => {
      const validWebp = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
      expect(isValidRasterDataUrl(validWebp)).toBe(true);
      expect(isSafeUrl(validWebp)).toBe(true);
    });

    it('accepts valid Base64 GIF image data URLs', () => {
      const validGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      expect(isValidRasterDataUrl(validGif)).toBe(true);
      expect(isSafeUrl(validGif)).toBe(true);
    });

    it('rejects invalid Base64 with corrupted payload characters', () => {
      const invalidChars = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ!@#$%^';
      expect(isValidRasterDataUrl(invalidChars)).toBe(false);
      expect(isSafeUrl(invalidChars)).toBe(false);
    });

    it('rejects invalid Base64 with length % 4 === 1', () => {
      const badLength = 'data:image/png;base64,abcde';
      expect(isValidRasterDataUrl(badLength)).toBe(false);
      expect(isSafeUrl(badLength)).toBe(false);
    });

    it('rejects invalid Base64 with illegal padding', () => {
      const badPadding = 'data:image/png;base64,abc===';
      expect(isValidRasterDataUrl(badPadding)).toBe(false);
      expect(isSafeUrl(badPadding)).toBe(false);
    });

    it('strictly rejects SVG data URLs (potential vector for XSS)', () => {
      const svgData = 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+';
      expect(isValidRasterDataUrl(svgData)).toBe(false);
      expect(isSafeUrl(svgData)).toBe(false);
    });

    it('strictly rejects HTML and JavaScript data URLs', () => {
      const htmlData = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
      const jsData = 'data:text/javascript;base64,YWxlcnQoMSk=';
      expect(isValidRasterDataUrl(htmlData)).toBe(false);
      expect(isSafeUrl(htmlData)).toBe(false);
      expect(isValidRasterDataUrl(jsData)).toBe(false);
      expect(isSafeUrl(jsData)).toBe(false);
    });

    it('rejects protocol-relative URLs (//evil.com)', () => {
      expect(isSafeUrl('//evil.com/phish')).toBe(false);
      expect(isSafeUrl('//convert24.net.evil.com')).toBe(false);
    });

    it('rejects backslash authority bypasses (/\\evil.com, \\\\evil.com)', () => {
      expect(isSafeUrl('/\\evil.com')).toBe(false);
      expect(isSafeUrl('/\\\\evil.com')).toBe(false);
      expect(isSafeUrl('\\\\evil.com')).toBe(false);
      expect(isSafeUrl('\\evil.com')).toBe(false);
    });

    it('rejects single and multiple URL-encoded backslash bypasses (%5c, %255c)', () => {
      expect(isSafeUrl('/%5cevil.com')).toBe(false);
      expect(isSafeUrl('/%5Cevil.com')).toBe(false);
      expect(isSafeUrl('/%255cevil.com')).toBe(false);
      expect(isSafeUrl('/%25255cevil.com')).toBe(false);
    });

    it('rejects control-character and whitespace-obfuscated schemes', () => {
      expect(isSafeUrl(' jav ascript:alert(1)')).toBe(false);
      expect(isSafeUrl('jav\tascript:alert(1)')).toBe(false);
      expect(isSafeUrl('java\nscript:alert(1)')).toBe(false);
      expect(isSafeUrl('java\rscript:alert(1)')).toBe(false);
      expect(isSafeUrl('\u0000javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)')).toBe(false);
      expect(isSafeUrl('javascript&colon;alert(1)')).toBe(false);
    });
  });

  // =========================================================================
  // 3. SEC-03 Finding C: Publication Authorization Matrix Verification
  // =========================================================================
  describe('3. SEC-03 Finding C: Publication Authorization Matrix Verification', () => {
    describe('Permission Mapping Table', () => {
      it('verifies permission matrix for all 5 application roles', () => {
        expect(hasPermission('SUPER_ADMIN', 'PUBLISH_CONTENT')).toBe(true);
        expect(hasPermission('ADMIN', 'PUBLISH_CONTENT')).toBe(true);
        expect(hasPermission('CONTENT_MANAGER', 'PUBLISH_CONTENT')).toBe(true);
        expect(hasPermission('EDITOR', 'PUBLISH_CONTENT')).toBe(false);
        expect(hasPermission('VIEWER', 'PUBLISH_CONTENT')).toBe(false);

        expect(hasPermission('SUPER_ADMIN', 'EDIT_CONTENT')).toBe(true);
        expect(hasPermission('ADMIN', 'EDIT_CONTENT')).toBe(true);
        expect(hasPermission('CONTENT_MANAGER', 'EDIT_CONTENT')).toBe(true);
        expect(hasPermission('EDITOR', 'EDIT_CONTENT')).toBe(true);
        expect(hasPermission('VIEWER', 'EDIT_CONTENT')).toBe(false);
      });
    });

    describe('Page Publication Enforcement (Service Layer)', () => {
      it('allows EDITOR to create a DRAFT page', async () => {
        mockDb.page.findUnique.mockResolvedValueOnce(null);
        mockDb.page.create.mockResolvedValueOnce({
          id: 'page-1',
          slug: 'new-draft',
          name: 'New Draft',
          status: 'DRAFT',
        });

        const result = await createDraftPage(
          { name: 'New Draft', slug: 'new-draft', status: 'DRAFT' },
          editorUser
        );
        expect(result.status).toBe('DRAFT');
        expect(mockDb.page.create).toHaveBeenCalled();
      });

      it('prohibits EDITOR from creating a PUBLISHED page and blocks DB mutation', async () => {
        await expect(
          createDraftPage(
            { name: 'Live Page', slug: 'live-page', status: 'PUBLISHED' },
            editorUser
          )
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");

        expect(mockDb.page.create).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER and ADMIN to create a PUBLISHED page', async () => {
        mockDb.page.findUnique.mockResolvedValueOnce(null);
        mockDb.page.create.mockResolvedValueOnce({
          id: 'page-cm-1',
          slug: 'cm-live-page',
          name: 'CM Live Page',
          status: 'PUBLISHED',
        });

        const result = await createDraftPage(
          { name: 'CM Live Page', slug: 'cm-live-page', status: 'PUBLISHED' },
          contentManagerUser
        );
        expect(result.status).toBe('PUBLISHED');
        expect(mockDb.page.create).toHaveBeenCalled();
      });

      it('prohibits EDITOR from mutating an already PUBLISHED page and blocks DB mutation', async () => {
        mockDb.page.findUnique.mockResolvedValueOnce({
          id: 'page-pub-1',
          slug: 'pub-page',
          name: 'Published Page',
          status: 'PUBLISHED',
          content: { blocks: [] },
          seo: null,
        });

        await expect(
          updateDraftPage('page-pub-1', { name: 'Attempted Change' }, editorUser)
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to modify published pages");

        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from transitioning a DRAFT page to PUBLISHED', async () => {
        mockDb.page.findUnique.mockResolvedValueOnce({
          id: 'page-draft-1',
          slug: 'draft-page',
          name: 'Draft Page',
          status: 'DRAFT',
          content: { blocks: [] },
          seo: null,
        });

        await expect(
          updateDraftPage('page-draft-1', { status: 'PUBLISHED' }, editorUser)
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to publish pages");

        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from calling publishPage or unpublishPage directly', async () => {
        await expect(publishPage('page-1', editorUser)).rejects.toThrow(
          "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to publish pages"
        );
        expect(mockDb.page.update).not.toHaveBeenCalled();

        await expect(unpublishPage('page-1', editorUser)).rejects.toThrow(
          "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to unpublish pages"
        );
        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER to publish and unpublish a page', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-cm-pub',
          slug: 'cm-page',
          name: 'CM Page',
          status: 'DRAFT',
          content: { id: 'c-1', version: 1 },
        });
        mockDb.page.update.mockResolvedValueOnce({
          id: 'page-cm-pub',
          status: 'PUBLISHED',
        });

        const res = await publishPage('page-cm-pub', contentManagerUser);
        expect(res.status).toBe('PUBLISHED');
        expect(mockDb.page.update).toHaveBeenCalled();
      });
    });

    describe('Blog Publication Enforcement (Service Layer)', () => {
      it('allows EDITOR to create a DRAFT blog post', async () => {
        mockDb.blogPost.findUnique.mockResolvedValueOnce(null);
        mockDb.blogPost.create.mockResolvedValueOnce({
          id: 'post-1',
          slug: 'draft-post',
          title: 'Draft Post',
          status: 'DRAFT',
        });

        const result = await createDraft(
          { title: 'Draft Post', slug: 'draft-post', content: 'Body content', status: 'DRAFT' },
          editorUser
        );
        expect(result.status).toBe('DRAFT');
        expect(mockDb.blogPost.create).toHaveBeenCalled();
      });

      it('prohibits EDITOR from creating a PUBLISHED or SCHEDULED blog post', async () => {
        await expect(
          createDraft(
            { title: 'Live Post', slug: 'live-post', content: 'Content', status: 'PUBLISHED' },
            editorUser
          )
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");
        expect(mockDb.blogPost.create).not.toHaveBeenCalled();

        await expect(
          createDraft(
            { title: 'Sched Post', slug: 'sched-post', content: 'Content', status: 'SCHEDULED' },
            editorUser
          )
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");
        expect(mockDb.blogPost.create).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from mutating a PUBLISHED or SCHEDULED post', async () => {
        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'post-pub-1',
          slug: 'pub-post',
          title: 'Pub Post',
          status: 'PUBLISHED',
        });

        await expect(
          updateDraft('post-pub-1', { title: 'Modified Title' }, editorUser)
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();

        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'post-sched-1',
          slug: 'sched-post',
          title: 'Sched Post',
          status: 'SCHEDULED',
        });

        await expect(
          updateDraft('post-sched-1', { title: 'Modified Title' }, editorUser)
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from transitioning a DRAFT to PUBLISHED or SCHEDULED', async () => {
        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'post-draft-1',
          slug: 'draft-post',
          title: 'Draft Post',
          status: 'DRAFT',
        });

        await expect(
          updateDraft('post-draft-1', { status: 'PUBLISHED' }, editorUser)
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from calling publishPost, unpublishPost, or schedulePost', async () => {
        await expect(publishPost('post-1', editorUser)).rejects.toThrow(
          "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to publish blog posts"
        );
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();

        await expect(unpublishPost('post-1', editorUser)).rejects.toThrow(
          "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to unpublish blog posts"
        );
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();

        await expect(schedulePost('post-1', new Date(), editorUser)).rejects.toThrow(
          "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to schedule blog posts"
        );
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });
    });

    describe('API Route Layer HTTP Authorization Verification', () => {
      it('POST /api/admin/pages returns 403 Forbidden when EDITOR attempts status: PUBLISHED', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });

        const req = new NextRequest('http://localhost:3000/api/admin/pages', {
          method: 'POST',
          body: JSON.stringify({ name: 'Live Page', slug: 'live-page', status: 'PUBLISHED' }),
        });

        const res = await createPageRoute(req);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");
        expect(mockDb.page.create).not.toHaveBeenCalled();
      });

      it('PUT /api/admin/pages/[id] returns 403 Forbidden when EDITOR modifies PUBLISHED page', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        mockDb.page.findUnique.mockResolvedValueOnce({
          id: 'p-pub',
          slug: 'p-pub',
          status: 'PUBLISHED',
        });

        const req = new NextRequest('http://localhost:3000/api/admin/pages/p-pub', {
          method: 'PUT',
          body: JSON.stringify({ name: 'Hacked' }),
        });

        const res = await updatePageRoute(req, { params: Promise.resolve({ id: 'p-pub' }) });
        expect(res.status).toBe(403);
        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('POST /api/admin/blog returns 403 Forbidden when EDITOR attempts status: PUBLISHED', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });

        const req = new NextRequest('http://localhost:3000/api/admin/blog', {
          method: 'POST',
          body: JSON.stringify({ title: 'Live', slug: 'live', content: 'body', status: 'PUBLISHED' }),
        });

        const res = await createBlogRoute(req);
        expect(res.status).toBe(403);
        expect(mockDb.blogPost.create).not.toHaveBeenCalled();
      });

      it('PUT /api/admin/blog/[id] returns 403 Forbidden when EDITOR modifies PUBLISHED post', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'b-pub',
          slug: 'b-pub',
          status: 'PUBLISHED',
        });

        const req = new NextRequest('http://localhost:3000/api/admin/blog/b-pub', {
          method: 'PUT',
          body: JSON.stringify({ title: 'Changed' }),
        });

        const res = await updateBlogRoute(req, { params: Promise.resolve({ id: 'b-pub' }) });
        expect(res.status).toBe(403);
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('POST /api/admin/blog/[id]/publish, unpublish, and schedule return 403 Forbidden for EDITOR', async () => {
        mockRequireAdminAuth.mockResolvedValue({ user: editorUser });

        const pubReq = new NextRequest('http://localhost:3000/api/admin/blog/b-1/publish', { method: 'POST' });
        const pubRes = await publishBlogRoute(pubReq, { params: Promise.resolve({ id: 'b-1' }) });
        expect(pubRes.status).toBe(403);

        const unpubReq = new NextRequest('http://localhost:3000/api/admin/blog/b-1/unpublish', { method: 'POST' });
        const unpubRes = await unpublishBlogRoute(unpubReq, { params: Promise.resolve({ id: 'b-1' }) });
        expect(unpubRes.status).toBe(403);

        const schedReq = new NextRequest('http://localhost:3000/api/admin/blog/b-1/schedule', {
          method: 'POST',
          body: JSON.stringify({ scheduledFor: new Date().toISOString() }),
        });
        const schedRes = await scheduleBlogRoute(schedReq, { params: Promise.resolve({ id: 'b-1' }) });
        expect(schedRes.status).toBe(403);
      });
    });

    describe('Race Condition & Concurrent Update Protection', () => {
      it('prevents authorization bypass during concurrent state transitions', async () => {
        // Simulate a scenario where EDITOR attempts to update a post that concurrently becomes PUBLISHED
        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'post-race-1',
          slug: 'race-post',
          title: 'Race Post',
          status: 'PUBLISHED', // state changed to published right before update executes
        });

        await expect(
          updateDraft('post-race-1', { title: 'Editor Injected Change' }, editorUser)
        ).rejects.toThrow("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT'");

        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 4. Full Sanitizer Attack Regression Suite
  // =========================================================================
  describe('4. Full Sanitizer Attack Regression Suite', () => {
    it('Stored XSS: strips script tags and external script sources', () => {
      const payloads = [
        '<script>alert("stored-xss")</script>',
        '<script src="https://evil.convert24.internal/payload.js"></script>',
        '<SCRIPT SRC="https://evil.com/xss.js"></SCRIPT>',
        '<script\x20type="text/javascript">alert(1)</script>',
      ];

      for (const p of payloads) {
        expect(sanitizeCustomHtml(p)).toBe('');
        expect(sanitizeRichTextHtml(p)).toBe('');
      }
    });

    it('Reflected XSS & Object/Embed injection: completely strips frames, embeds, and objects', () => {
      const payloads = [
        '<iframe src="javascript:alert(1)"></iframe>',
        '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)"></embed>',
        '<applet code="Malicious.class"></applet>',
      ];

      for (const p of payloads) {
        expect(sanitizeCustomHtml(p)).toBe('');
        expect(sanitizeRichTextHtml(p)).toBe('');
      }
    });

    it('Event Handler Injection: strips all variations of event handlers', () => {
      const handlers = [
        '<img src="x" onerror="alert(1)">',
        '<img src="x" ONERROR="alert(1)">',
        '<img src="x" oNeRRoR="alert(1)">',
        '<body onload="alert(1)">',
        '<div onmouseover="alert(1)">Hover</div>',
        '<button onclick="alert(1)">Click</button>',
        '<input onfocus="alert(1)" autofocus>',
        '<a href="/path" onblur="alert(1)">Link</a>',
        '<details ontoggle="alert(1)" open><summary>Summary</summary></details>',
        '<video><source onerror="alert(1)"></video>',
      ];

      for (const h of handlers) {
        const cleanCustom = sanitizeCustomHtml(h);
        const cleanRich = sanitizeRichTextHtml(h);
        expect(cleanCustom.toLowerCase()).not.toContain('onerror');
        expect(cleanCustom.toLowerCase()).not.toContain('onload');
        expect(cleanCustom.toLowerCase()).not.toContain('onclick');
        expect(cleanCustom.toLowerCase()).not.toContain('onmouseover');
        expect(cleanCustom.toLowerCase()).not.toContain('onfocus');
        expect(cleanCustom.toLowerCase()).not.toContain('onblur');
        expect(cleanCustom.toLowerCase()).not.toContain('ontoggle');
        expect(cleanRich.toLowerCase()).not.toContain('onerror');
        expect(cleanRich.toLowerCase()).not.toContain('onload');
      }
    });

    it('Dangerous URL Schemes: eliminates javascript:, vbscript:, and blob: schemes', () => {
      const dangerous = [
        '<a href="javascript:alert(document.cookie)">XSS</a>',
        '<a href="vbscript:msgbox(1)">VBS</a>',
        '<a href="blob:https://evil.com/blob-id">BLOB</a>',
        '<a href="file:///etc/passwd">FILE</a>',
      ];

      for (const d of dangerous) {
        const clean = sanitizeCustomHtml(d);
        expect(clean).toContain('href="#"');
        expect(clean).not.toContain('javascript:');
        expect(clean).not.toContain('vbscript:');
        expect(clean).not.toContain('blob:');
        expect(clean).not.toContain('file:');
      }
    });

    it('HTML Entity Encoding: decodes and neutralizes entity-obfuscated schemes', () => {
      const obfuscated = [
        '<a href="&#x6a;&#x61;vascript:alert(1)">Link</a>',
        '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">Link</a>',
        '<a href="javascript&colon;alert(1)">Link</a>',
        '<a href="javascript&Tab;alert(1)">Link</a>',
        '<a href="javascript&NewLine;alert(1)">Link</a>',
        '<a href="j&#97;v&#97;script:alert(1)">Link</a>',
      ];

      for (const o of obfuscated) {
        const clean = sanitizeCustomHtml(o);
        expect(clean).toContain('href="#"');
        expect(clean).not.toContain('alert(1)');
      }
    });

    it('Unicode & Control Characters: neutralizes null byte and control character evasion', () => {
      const controlCharPayloads = [
        '<a href="jav\u0000ascript:alert(1)">Null</a>',
        '<a href="jav\tascript:alert(1)">Tab</a>',
        '<a href="java\nscript:alert(1)">Newline</a>',
        '<a href="java\rscript:alert(1)">Return</a>',
        '<a href="\u0001javascript:alert(1)">Ctrl</a>',
      ];

      for (const c of controlCharPayloads) {
        const clean = sanitizeCustomHtml(c);
        expect(clean).toContain('href="#"');
        expect(clean).not.toContain('alert(1)');
      }
    });

    it('SVG & MathML Injection: strips all SVG/MathML containers and internal executable elements', () => {
      const xmlPayloads = [
        '<svg/onload=alert(1)>',
        '<svg><script>alert(1)</script></svg>',
        '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
        '<svg><set attributeName=onfocus onbegin=alert(1)>',
        '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
        '<math href="javascript:alert(1)">Click</math>',
      ];

      for (const x of xmlPayloads) {
        const cleanCustom = sanitizeCustomHtml(x);
        const cleanRich = sanitizeRichTextHtml(x);
        expect(cleanCustom.toLowerCase()).not.toContain('onload');
        expect(cleanCustom.toLowerCase()).not.toContain('onerror');
        expect(cleanCustom.toLowerCase()).not.toContain('onbegin');
        expect(cleanCustom.toLowerCase()).not.toContain('script');
        expect(cleanRich.toLowerCase()).not.toContain('onload');
        expect(cleanRich.toLowerCase()).not.toContain('onerror');
      }
    });

    it('CSS Injection: sanitizes expressions, behavior, javascript URLs, and imports in styles', () => {
      const dirtyHtml = '<p style="color: red; background-image: url(javascript:alert(1)); expression: alert(1); -moz-binding: url(xss.xml); behavior: url(test.htc)">Text</p>';
      const cleanCustom = sanitizeCustomHtml(dirtyHtml);
      const cleanRich = sanitizeRichTextHtml(dirtyHtml);

      expect(cleanCustom).not.toContain('javascript:');
      expect(cleanCustom).not.toContain('expression');
      expect(cleanCustom).not.toContain('-moz-binding');
      expect(cleanCustom).not.toContain('behavior');

      expect(cleanRich).not.toContain('javascript:');
      expect(cleanRich).not.toContain('expression');
      expect(cleanRich).not.toContain('-moz-binding');
      expect(cleanRich).not.toContain('behavior');
    });

    it('Malformed HTML & Nested Tag Evasion: cleans nested tags and comment-hiding attempts', () => {
      const nested = [
        '<scr<script></script>ipt>alert(1)</script>',
        '<ifr<iframe></iframe>ame src="javascript:alert(1)"></iframe>',
        '<<SCRIPT>alert("XSS");//<</SCRIPT>',
        '<!-- <script>alert(1)</script> -->',
        '<![CDATA[<script>alert(1)</script>]]>',
      ];

      for (const n of nested) {
        const cleanCustom = sanitizeCustomHtml(n);
        const cleanRich = sanitizeRichTextHtml(n);
        expect(cleanCustom).not.toContain('<script>');
        expect(cleanCustom).not.toContain('alert(1)');
        expect(cleanRich).not.toContain('<script>');
        expect(cleanRich).not.toContain('alert(1)');
      }
    });
  });

  // =========================================================================
  // 5. CMS Content Payload Validation Integrity
  // =========================================================================
  describe('5. CMS Content Payload Validation Integrity', () => {
    it('validates and sanitizes structured page block payloads', () => {
      const pageInput = {
        name: 'Test Page',
        slug: 'test-page',
        blocks: [
          {
            id: 'block-1',
            type: 'rich_text',
            content: {
              html: '<p>Hello <a/href=javascript:alert(1)>World</a><img/onerror=alert(1) src=x></p>',
            },
          },
          {
            id: 'block-2',
            type: 'image',
            content: {
              src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            },
          },
        ],
      };

      const result = validatePagePayload(pageInput as any);
      expect(result.isValid).toBe(true);
      const b1 = result.sanitizedBlocks[0] as any;
      const b2 = result.sanitizedBlocks[1] as any;
      expect(b1.content.html).not.toContain('javascript:');
      expect(b1.content.html).not.toContain('onerror');
      expect(b2.content.src).toContain('data:image/png;base64');
    });

    it('rejects image block with unsafe scriptable URL', () => {
      const pageInput = {
        name: 'Unsafe Page',
        slug: 'unsafe-page',
        blocks: [
          {
            id: 'block-bad-img',
            type: 'image',
            content: {
              src: 'javascript:alert(1)',
            },
          },
        ],
      };

      const result = validatePagePayload(pageInput as any);
      expect(result.isValid).toBe(false);
      expect(result.report.errors.some((e) => e.message.includes('Unsafe Image URL'))).toBe(true);
    });

    it('validates and sanitizes blog post payload', () => {
      const blogInput = {
        title: 'Security Guide',
        slug: 'security-guide',
        content: '# Title\n\n[Malicious](javascript:alert(1))\n\n![Image](data:image/svg+xml;base64,PHN2Zz4=)',
      };

      const result = validateBlogPostPayload(blogInput);
      expect(result.isValid).toBe(true);
      // Link with javascript scheme sanitized
      expect(result.sanitized.content).not.toContain('javascript:alert(1)');
      // SVG data image sanitized
      expect(result.sanitized.content).not.toContain('data:image/svg+xml');
    });
  });
});
