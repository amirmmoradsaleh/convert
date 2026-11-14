import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeCustomHtml,
  sanitizeRichTextHtml,
  isSafeUrl,
  isValidRasterDataUrl,
} from '../../lib/admin/validation';
import { hasPermission } from '../../lib/admin/permissions';
import { AdminUserSession } from '../../lib/admin/types';
import { handleAdminApiError } from '../../lib/admin/api-error';
import {
  deletePage,
  restorePageRevision,
  createDraftPage,
  updateDraftPage,
  publishPage,
  unpublishPage,
} from '../../lib/admin/services/page.service';
import {
  deletePost,
  restoreRevision,
  createDraft,
  updateDraft,
  publishPost,
  unpublishPost,
  schedulePost,
} from '../../lib/admin/services/blog.service';
import { POST as publishBlogRoute } from '../../app/api/admin/blog/[id]/publish/route';
import { POST as unpublishBlogRoute } from '../../app/api/admin/blog/[id]/unpublish/route';
import { POST as scheduleBlogRoute } from '../../app/api/admin/blog/[id]/schedule/route';
import { POST as createBlogRoute } from '../../app/api/admin/blog/route';
import { PUT as updateBlogRoute } from '../../app/api/admin/blog/[id]/route';
import { POST as createPageRoute } from '../../app/api/admin/pages/route';
import { PUT as updatePageRoute } from '../../app/api/admin/pages/[id]/route';
import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

const mockRequireAdminAuth = vi.fn();
vi.mock('@/lib/admin/guard', () => ({
  requireAdminAuth: (...args: any[]) => mockRequireAdminAuth(...args),
}));

// Mock database and cache dependencies for service unit tests
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
      create: vi.fn().mockResolvedValue({ id: 'rev-new-123' }),
    },
    blogPost: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    postRevision: {
      findUnique: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'blog-rev-new-123' }),
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
  createAuditLog: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

describe('Convert24 Security Remediation — SEC-02 Regression Protection', () => {
  const superAdminUser: AdminUserSession = {
    id: 'user-superadmin-1',
    email: 'superadmin@convert24.local',
    name: 'Super Admin',
    role: 'SUPER_ADMIN',
  };

  const adminUser: AdminUserSession = {
    id: 'user-admin-1',
    email: 'admin@convert24.local',
    name: 'Admin User',
    role: 'ADMIN',
  };

  const contentManagerUser: AdminUserSession = {
    id: 'user-cm-1',
    email: 'cm@convert24.local',
    name: 'Content Manager',
    role: 'CONTENT_MANAGER',
  };

  const editorUser: AdminUserSession = {
    id: 'user-editor-1',
    email: 'editor@convert24.local',
    name: 'Editor User',
    role: 'EDITOR',
  };

  const viewerUser: AdminUserSession = {
    id: 'user-viewer-1',
    email: 'viewer@convert24.local',
    name: 'Viewer User',
    role: 'VIEWER',
  };

  // =========================================================================
  // SEC-FINDING-01: HTML Sanitizer Scheme Injection (Unquoted, Entities, Data)
  // =========================================================================
  describe('SEC-FINDING-01: HTML & URL Scheme Hardening', () => {
    describe('sanitizeCustomHtml', () => {
      it('strips unquoted javascript: href attributes', () => {
        const input = '<a href=javascript:alert(1)>Click here</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).toContain('href="#"');
      });

      it('strips unquoted javascript: attributes with following attributes', () => {
        const input = '<a href=javascript:alert(document.cookie) class="btn-primary">Link</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).toContain('href="#"');
        expect(sanitized).toContain('class="btn-primary"');
      });

      it('strips hex entity-encoded javascript: schemes', () => {
        const input = '<a href="jav&#x61;script:alert(1)">Click</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('alert(1)');
        expect(sanitized).toContain('href="#"');
      });

      it('strips decimal entity-encoded javascript: schemes', () => {
        const input = '<a href="jav&#0000097;script:alert(1)">Click</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('alert(1)');
        expect(sanitized).toContain('href="#"');
      });

      it('strips named entity colon &colon; variations', () => {
        const input = '<a href="javascript&colon;alert(1)">Click</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('alert(1)');
        expect(sanitized).toContain('href="#"');
      });

      it('strips control character and tab obfuscated javascript: URLs', () => {
        const input = '<a href="java\0script:alert(1)">Click</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('alert(1)');
        expect(sanitized).toContain('href="#"');
      });

      it('strips unquoted and quoted vbscript: URLs', () => {
        const input1 = '<a href=vbscript:msgbox(1)>Click</a>';
        const input2 = '<a href="vbscript:msgbox(1)">Click</a>';
        expect(sanitizeCustomHtml(input1)).toContain('href="#"');
        expect(sanitizeCustomHtml(input2)).toContain('href="#"');
      });

      it('strips dangerous data:text/html URLs', () => {
        const input = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).toContain('href="#"');
      });

      it('strips dangerous SVG data URLs with potential embedded scripts', () => {
        const input = '<img src="data:image/svg+xml;utf8,<svg onload=alert(1)>">';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).toContain('src="#"');
      });

      it('preserves legitimate base64 raster image data URLs', () => {
        const input = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA" alt="pixel">';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA');
      });

      it('strips solidus-delimited unquoted javascript: href attributes (<a/href=javascript:...>)', () => {
        const input = '<a/href=javascript:alert(1)>Click here</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).toContain('href="#"');
      });

      it('strips solidus-delimited quoted javascript: href attributes (<a/href="javascript:...")', () => {
        const input = '<a/href="javascript:alert(1)">Click here</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).toContain('href="#"');
      });

      it('strips solidus-delimited event handlers (<img/onerror=...>)', () => {
        const input = '<img/onerror=alert(1) src="safe.jpg">';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('alert(1)');
      });

      it('strips solidus-delimited quoted event handlers (<img/onerror="alert(1)")', () => {
        const input = '<img/onerror="alert(1)" src="safe.jpg">';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('alert(1)');
      });

      it('preserves solidus-delimited safe relative URLs (<a/href=/safe-path>)', () => {
        const input = '<a/href=/safe-path>Safe</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).toContain('/safe-path');
      });

      it('preserves valid safe external and internal links', () => {
        const input = '<a href="https://convert24.net/tools" target="_blank">Convert Tools</a>';
        const sanitized = sanitizeCustomHtml(input);
        expect(sanitized).toContain('href="https://convert24.net/tools"');
        expect(sanitized).toContain('rel="noopener noreferrer"');
      });

      it('strips solidus-delimited payloads with mixed quotes and attributes', () => {
        const input1 = '<a/href="javascript:alert(1)"/target="_blank">Click</a>';
        const input2 = '<a/href=javascript:alert(1)/id="nav-link">Click</a>';
        const input3 = '<img/src="/valid.png"/onerror="alert(1)">';
        const input4 = '<img/src=/valid.png/onerror=alert(1)>';
        expect(sanitizeCustomHtml(input1)).toContain('href="#"');
        expect(sanitizeCustomHtml(input1)).not.toContain('javascript:');
        expect(sanitizeCustomHtml(input2)).toContain('href="#"');
        expect(sanitizeCustomHtml(input2)).not.toContain('javascript:');
        expect(sanitizeCustomHtml(input3)).not.toContain('onerror');
        expect(sanitizeCustomHtml(input3)).toContain('src="/valid.png"');
        expect(sanitizeCustomHtml(input4)).not.toContain('onerror');
        expect(sanitizeCustomHtml(input4)).toContain('src="/valid.png"');
      });

      it('strips dangerous SVG and MathML tags with event handlers completely', () => {
        const input1 = '<svg/onload=alert(1)>';
        const input2 = '<svg onload=alert(1)><g>content</g></svg>';
        const input3 = '<math/onload=alert(1)>';
        expect(sanitizeCustomHtml(input1)).toBe('');
        expect(sanitizeCustomHtml(input2)).toBe('');
        expect(sanitizeCustomHtml(input3)).toBe('');
      });

      it('sanitizes backslash-based and encoded backslash URL bypasses', () => {
        const input1 = '<a href="/\\evil.com">Bypass 1</a>';
        const input2 = '<a href="/%5cevil.com">Bypass 2</a>';
        const input3 = '<a href="/%5Cevil.com">Bypass 3</a>';
        const input4 = '<a href="//evil.com">Bypass 4</a>';
        expect(sanitizeCustomHtml(input1)).toContain('href="#"');
        expect(sanitizeCustomHtml(input2)).toContain('href="#"');
        expect(sanitizeCustomHtml(input3)).toContain('href="#"');
        expect(sanitizeCustomHtml(input4)).toContain('href="#"');
      });
    });

    describe('sanitizeRichTextHtml', () => {
      it('removes script tags and inline handlers', () => {
        const input = '<p>Normal text</p><script>alert(1)</script><div onmouseover="alert(2)">Hover</div>';
        const sanitized = sanitizeRichTextHtml(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('onmouseover');
        expect(sanitized).toContain('<p>Normal text</p>');
      });

      it('sanitizes unquoted javascript: href in rich text', () => {
        const input = '<a href=javascript:alert(1)>Click</a>';
        const sanitized = sanitizeRichTextHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).toContain('href="#"');
      });

      it('sanitizes entity-encoded javascript: href in rich text', () => {
        const input = '<a href="jav&#x61;script:alert(1)">Click</a>';
        const sanitized = sanitizeRichTextHtml(input);
        expect(sanitized).not.toContain('alert(1)');
        expect(sanitized).toContain('href="#"');
      });

      it('strips solidus-delimited javascript: href in rich text (<a/href=javascript:...>)', () => {
        const input = '<a/href=javascript:alert(1)>Click</a>';
        const sanitized = sanitizeRichTextHtml(input);
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).toContain('href="#"');
      });

      it('strips solidus-delimited event handlers in rich text (<img/onerror=...>)', () => {
        const input = '<img/onerror=alert(1) src="/image.jpg">';
        const sanitized = sanitizeRichTextHtml(input);
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('alert(1)');
      });

      it('strips svg and math elements with event handlers in rich text', () => {
        const input1 = '<svg/onload=alert(1)>';
        const input2 = '<svg onload=alert(1)><circle r="5"/></svg>';
        const input3 = '<math/onload=alert(1)>';
        expect(sanitizeRichTextHtml(input1)).toBe('');
        expect(sanitizeRichTextHtml(input2)).toBe('');
        expect(sanitizeRichTextHtml(input3)).toBe('');
      });

      it('sanitizes backslash-based authority bypasses in rich text links', () => {
        const input1 = '<a href="/\\evil.com">Evil</a>';
        const input2 = '<a href="/%5cevil.com">Evil Encoded</a>';
        const input3 = '[Markdown Link](//evil.com)';
        const input4 = '[Markdown Link](/%5cevil.com)';
        expect(sanitizeRichTextHtml(input1)).toContain('href="#"');
        expect(sanitizeRichTextHtml(input2)).toContain('href="#"');
        expect(sanitizeRichTextHtml(input3)).toContain('[Markdown Link](#)');
        expect(sanitizeRichTextHtml(input4)).toContain('[Markdown Link](#)');
      });
    });

    describe('isSafeUrl', () => {
      it('allows valid safe URLs', () => {
        expect(isSafeUrl('/pdf-to-word')).toBe(true);
        expect(isSafeUrl('#section')).toBe(true);
        expect(isSafeUrl('https://convert24.net')).toBe(true);
        expect(isSafeUrl('http://convert24.net')).toBe(true);
        expect(isSafeUrl('mailto:support@convert24.net')).toBe(true);
        expect(isSafeUrl('tel:+1234567890')).toBe(true);
      });

      it('rejects protocol-relative URLs (//evil.com)', () => {
        expect(isSafeUrl('//evil.com')).toBe(false);
        expect(isSafeUrl('//evil.com/phish')).toBe(false);
      });

      it('rejects solidus and backslash authority bypass tricks (/\\\\evil.com, /\\evil.com, \\\\\\\\evil.com)', () => {
        expect(isSafeUrl('/\\evil.com')).toBe(false);
        expect(isSafeUrl('/\\evil.com/path')).toBe(false);
        expect(isSafeUrl('\\\\evil.com')).toBe(false);
        expect(isSafeUrl('\\evil.com')).toBe(false);
      });

      it('rejects encoded backslashes and multi-encoded bypasses', () => {
        expect(isSafeUrl('/%5cevil.com')).toBe(false);
        expect(isSafeUrl('/%5Cevil.com')).toBe(false);
        expect(isSafeUrl('/%255cevil.com')).toBe(false);
        expect(isSafeUrl('/%255Cevil.com')).toBe(false);
        expect(isSafeUrl('/%252f%252fevil.com')).toBe(false);
        expect(isSafeUrl('/path%5cevil')).toBe(false);
        expect(isSafeUrl('/path/with\\backslash')).toBe(false);
      });

      it('rejects leading control characters and null byte obfuscation', () => {
        expect(isSafeUrl('\0/path')).toBe(false);
        expect(isSafeUrl('\x00javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('\x1f/path')).toBe(false);
        expect(isSafeUrl('/path\0evil')).toBe(false);
      });

      it('rejects obfuscated javascript and data schemes', () => {
        expect(isSafeUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('  javascript:alert(1)  ')).toBe(false);
        expect(isSafeUrl('jav&#x61;script:alert(1)')).toBe(false);
        expect(isSafeUrl('javascript&colon;alert(1)')).toBe(false);
        expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
        expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
        expect(isSafeUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false);
      });

      it('validates raster data URLs and rejects dangerous payloads', () => {
        expect(isSafeUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBe(true);
        expect(isSafeUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD')).toBe(true);
        expect(isSafeUrl('data:image/webp;base64,UklGRkAAAABXRUJQVlA4')).toBe(true);
        expect(isSafeUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);
        // Non-raster data URLs must be rejected
        expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
        expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
        expect(isSafeUrl('data:application/javascript;base64,YWxlcnQoMSk=')).toBe(false);
      });

      it('allows safe raster image data URLs', () => {
        expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo')).toBe(true);
        expect(isSafeUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg')).toBe(true);
      });

      it('validates raster Data URLs and rejects malformed base64', () => {
        expect(isValidRasterDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA')).toBe(true);
        expect(isValidRasterDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD')).toBe(true);
        expect(isValidRasterDataUrl('data:image/webp;base64,UklGRkAAAABXRUJQVlA4')).toBe(true);
        expect(isValidRasterDataUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBe(true);
        expect(isValidRasterDataUrl('data:image/png;base64,iVBORw0KGgo')).toBe(true);
        expect(isValidRasterDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg')).toBe(true);

        // Malformed base64
        expect(isSafeUrl('data:image/png;base64,invalid==')).toBe(false);
        expect(isSafeUrl('data:image/png;base64,abcd==')).toBe(false);
        expect(isSafeUrl('data:image/png;base64,a===')).toBe(false);
        expect(isSafeUrl('data:image/png;base64,abcde')).toBe(false);
        expect(isSafeUrl('data:image/png;base64,===')).toBe(false);
        expect(isSafeUrl('data:image/png;base64,')).toBe(false);
        expect(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
        expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
      });
    });
  });

  // =========================================================================
  // SEC-FINDING-02: Authorization Enforcement for Settings
  // =========================================================================
  describe('SEC-FINDING-02: Settings Authorization Enforcement', () => {
    it('SUPER_ADMIN and ADMIN have MANAGE_SETTINGS permission', () => {
      expect(hasPermission('SUPER_ADMIN', 'MANAGE_SETTINGS')).toBe(true);
      expect(hasPermission('ADMIN', 'MANAGE_SETTINGS')).toBe(true);
    });

    it('CONTENT_MANAGER, EDITOR, and VIEWER lack MANAGE_SETTINGS permission', () => {
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_SETTINGS')).toBe(false);
      expect(hasPermission('EDITOR', 'MANAGE_SETTINGS')).toBe(false);
      expect(hasPermission('VIEWER', 'MANAGE_SETTINGS')).toBe(false);
    });

    it('EDIT_CONTENT is insufficient for MANAGE_SETTINGS', () => {
      // EDITOR has EDIT_CONTENT, but must NOT have MANAGE_SETTINGS
      expect(hasPermission('EDITOR', 'EDIT_CONTENT')).toBe(true);
      expect(hasPermission('EDITOR', 'MANAGE_SETTINGS')).toBe(false);
    });
  });

  // =========================================================================
  // SEC-FINDING-03: Deletion of Published Pages and Blog Posts
  // =========================================================================
  describe('SEC-FINDING-03: Published Deletion Protection', () => {
    const mockDb = getDb() as any;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('prohibits EDITOR from deleting a PUBLISHED page', async () => {
      mockDb.page.findUnique.mockResolvedValue({
        id: 'page-pub-1',
        slug: 'about-us',
        name: 'About Us',
        status: 'PUBLISHED',
      });

      await expect(deletePage('page-pub-1', editorUser)).rejects.toThrow(
        /lacks 'PUBLISH_CONTENT' permission/
      );
      expect(mockDb.page.delete).not.toHaveBeenCalled();
    });

    it('allows EDITOR to delete a DRAFT page', async () => {
      mockDb.page.findUnique.mockResolvedValue({
        id: 'page-draft-1',
        slug: 'work-in-progress',
        name: 'Work In Progress',
        status: 'DRAFT',
      });
      mockDb.page.delete.mockResolvedValue({ id: 'page-draft-1' });

      const result = await deletePage('page-draft-1', editorUser);
      expect(result.success).toBe(true);
      expect(mockDb.page.delete).toHaveBeenCalledWith({ where: { id: 'page-draft-1' } });
    });

    it('allows ADMIN / SUPER_ADMIN / CONTENT_MANAGER to delete a PUBLISHED page', async () => {
      mockDb.page.findUnique.mockResolvedValue({
        id: 'page-pub-2',
        slug: 'old-landing',
        name: 'Old Landing',
        status: 'PUBLISHED',
      });
      mockDb.page.delete.mockResolvedValue({ id: 'page-pub-2' });

      const result = await deletePage('page-pub-2', contentManagerUser);
      expect(result.success).toBe(true);
      expect(mockDb.page.delete).toHaveBeenCalledWith({ where: { id: 'page-pub-2' } });
    });

    it('prohibits EDITOR from deleting a PUBLISHED blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-pub-1',
        slug: 'announcement',
        title: 'Important Announcement',
        status: 'PUBLISHED',
      });

      await expect(deletePost('post-pub-1', editorUser)).rejects.toThrow(
        /lacks 'PUBLISH_CONTENT' permission/
      );
      expect(mockDb.blogPost.delete).not.toHaveBeenCalled();
    });

    it('prohibits EDITOR from deleting a SCHEDULED blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-sched-1',
        slug: 'scheduled-post',
        title: 'Upcoming Features',
        status: 'SCHEDULED',
      });

      await expect(deletePost('post-sched-1', editorUser)).rejects.toThrow(
        /lacks 'PUBLISH_CONTENT' permission/
      );
      expect(mockDb.blogPost.delete).not.toHaveBeenCalled();
    });

    it('allows EDITOR to delete a DRAFT blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-draft-1',
        slug: 'draft-article',
        title: 'Draft Article',
        status: 'DRAFT',
      });
      mockDb.blogPost.delete.mockResolvedValue({ id: 'post-draft-1' });

      await expect(deletePost('post-draft-1', editorUser)).resolves.not.toThrow();
      expect(mockDb.blogPost.delete).toHaveBeenCalledWith({ where: { id: 'post-draft-1' } });
    });

    it('allows CONTENT_MANAGER to delete a PUBLISHED blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-pub-3',
        slug: 'retired-post',
        title: 'Retired Post',
        status: 'PUBLISHED',
      });
      mockDb.blogPost.delete.mockResolvedValue({ id: 'post-pub-3' });

      await expect(deletePost('post-pub-3', contentManagerUser)).resolves.not.toThrow();
      expect(mockDb.blogPost.delete).toHaveBeenCalledWith({ where: { id: 'post-pub-3' } });
    });
  });

  // =========================================================================
  // SEC-FINDING-04: Revision Restore on Published Content
  // =========================================================================
  describe('SEC-FINDING-04: Revision Restore Authorization', () => {
    const mockDb = getDb() as any;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('prohibits EDITOR from restoring revisions on a PUBLISHED page', async () => {
      mockDb.page.findUnique.mockResolvedValue({
        id: 'page-pub-rev',
        slug: 'live-page',
        status: 'PUBLISHED',
        content: { version: 2 },
      });

      await expect(
        restorePageRevision('page-pub-rev', 'rev-1', editorUser)
      ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);
      expect(mockDb.pageContent.update).not.toHaveBeenCalled();
    });

    it('allows EDITOR to restore revisions on a DRAFT page', async () => {
      mockDb.page.findUnique.mockResolvedValue({
        id: 'page-draft-rev',
        slug: 'draft-page',
        status: 'DRAFT',
        content: { version: 1, blocks: [] },
      });
      mockDb.pageRevision.findUnique.mockResolvedValue({
        id: 'rev-1',
        pageId: 'page-draft-rev',
        contentSnapshot: { blocks: [{ id: 'b1', type: 'paragraph', content: { text: 'Draft text' } }] },
        seoSnapshot: null,
      });
      mockDb.pageContent.update.mockResolvedValue({});

      await expect(
        restorePageRevision('page-draft-rev', 'rev-1', editorUser)
      ).resolves.not.toThrow();
      expect(mockDb.pageContent.update).toHaveBeenCalled();
    });

    it('allows CONTENT_MANAGER and ADMIN to restore revisions on a PUBLISHED page', async () => {
      mockDb.page.findUnique.mockResolvedValue({
        id: 'page-pub-rev-2',
        slug: 'live-page-2',
        status: 'PUBLISHED',
        content: { version: 3, blocks: [] },
      });
      mockDb.pageRevision.findUnique.mockResolvedValue({
        id: 'rev-2',
        pageId: 'page-pub-rev-2',
        contentSnapshot: { blocks: [{ id: 'b2', type: 'heading', content: { text: 'Restored Header' } }] },
        seoSnapshot: null,
      });
      mockDb.pageContent.update.mockResolvedValue({});

      await expect(
        restorePageRevision('page-pub-rev-2', 'rev-2', contentManagerUser)
      ).resolves.not.toThrow();
      expect(mockDb.pageContent.update).toHaveBeenCalled();
    });

    it('prohibits EDITOR from restoring revisions on a PUBLISHED blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-pub-rev-1',
        slug: 'live-post',
        status: 'PUBLISHED',
      });

      await expect(
        restoreRevision('post-pub-rev-1', 'rev-blog-1', editorUser)
      ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);
      expect(mockDb.blogPost.update).not.toHaveBeenCalled();
    });

    it('prohibits EDITOR from restoring revisions on a SCHEDULED blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-sched-rev-1',
        slug: 'scheduled-post',
        status: 'SCHEDULED',
      });

      await expect(
        restoreRevision('post-sched-rev-1', 'rev-blog-1', editorUser)
      ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);
      expect(mockDb.blogPost.update).not.toHaveBeenCalled();
    });

    it('allows EDITOR to restore revisions on a DRAFT blog post', async () => {
      mockDb.blogPost.findUnique.mockResolvedValue({
        id: 'post-draft-rev-1',
        slug: 'draft-post',
        status: 'DRAFT',
      });
      mockDb.postRevision.findUnique.mockResolvedValue({
        id: 'rev-blog-draft',
        postId: 'post-draft-rev-1',
        contentSnapshot: { title: 'Draft Post Restored', content: 'Some draft body' },
        seoSnapshot: null,
      });
      mockDb.blogPost.update.mockResolvedValue({
        id: 'post-draft-rev-1',
        title: 'Draft Post Restored',
        content: 'Some draft body',
        status: 'DRAFT',
      });

      const restored = await restoreRevision('post-draft-rev-1', 'rev-blog-draft', editorUser);
      expect(restored.title).toBe('Draft Post Restored');
      expect(mockDb.blogPost.update).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SEC-FINDING-05 & Error Handling: API 403 Responses
  // =========================================================================
  describe('SEC-FINDING-05 & API Error Translation', () => {
    it('handleAdminApiError maps Forbidden and permission error messages to HTTP 403', () => {
      const err1 = new Error("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to delete published pages.");
      const res1 = handleAdminApiError(err1);
      expect(res1.status).toBe(403);

      const err2 = new Error("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to restore revisions.");
      const res2 = handleAdminApiError(err2);
      expect(res2.status).toBe(403);
    });

    it('ToolPage intro and rich_text HTML sanitize input before rendering', () => {
      const maliciousHtml = '<p>Intro text</p><script>alert(1)</script><a href=javascript:alert(2)>Click</a>';
      const clean = sanitizeRichTextHtml(maliciousHtml);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('javascript:');
      expect(clean).toContain('href="#"');
      expect(clean).toContain('<p>Intro text</p>');
    });
  });

  // =========================================================================
  // SEC-04: Publication Creation and Mutation Protection (Pages & Blog)
  // =========================================================================
  describe('SEC-04: Publication Authorization Enforcement (Pages & Blog)', () => {
    const mockDb = getDb() as any;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe('Page Publication Enforcement', () => {
      it('prohibits EDITOR from creating a page with PUBLISHED status', async () => {
        mockDb.page.findUnique.mockResolvedValue(null);

        await expect(
          createDraftPage(
            {
              name: 'New Page',
              slug: 'new-page',
              status: 'PUBLISHED',
              blocks: [],
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.page.create).not.toHaveBeenCalled();
      });

      it('allows EDITOR to create a page with DRAFT status', async () => {
        mockDb.page.findUnique.mockResolvedValue(null);
        mockDb.page.create.mockResolvedValue({
          id: 'page-new-draft',
          slug: 'new-draft',
          name: 'New Draft',
          status: 'DRAFT',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          content: { blocks: [], version: 1, customCss: null },
          seo: null,
        });

        const created = await createDraftPage(
          {
            name: 'New Draft',
            slug: 'new-draft',
            status: 'DRAFT',
            blocks: [],
          },
          editorUser
        );

        expect(created.id).toBe('page-new-draft');
        expect(mockDb.page.create).toHaveBeenCalled();
      });

      it('allows ADMIN / CONTENT_MANAGER to create a page with PUBLISHED status', async () => {
        mockDb.page.findUnique.mockResolvedValue(null);
        mockDb.page.create.mockResolvedValue({
          id: 'page-new-pub',
          slug: 'new-pub',
          name: 'New Published',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          content: { blocks: [], version: 1, customCss: null },
          seo: null,
        });

        const created = await createDraftPage(
          {
            name: 'New Published',
            slug: 'new-pub',
            status: 'PUBLISHED',
            blocks: [],
          },
          contentManagerUser
        );

        expect(created.id).toBe('page-new-pub');
        expect(mockDb.page.create).toHaveBeenCalled();
      });

      it('prohibits EDITOR from mutating an already PUBLISHED page', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-pub-1',
          slug: 'live-page',
          name: 'Live Page',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          content: { version: 1, blocks: [] },
          seo: null,
        });

        await expect(
          updateDraftPage(
            'page-pub-1',
            {
              name: 'Attempted Change to Live Page',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.page.update).not.toHaveBeenCalled();
        expect(mockDb.pageContent.upsert).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from transitioning a DRAFT page to PUBLISHED', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-draft-1',
          slug: 'draft-page',
          name: 'Draft Page',
          status: 'DRAFT',
          publishedAt: null,
          content: { version: 1, blocks: [] },
          seo: null,
        });

        await expect(
          updateDraftPage(
            'page-draft-1',
            {
              status: 'PUBLISHED',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.page.update).not.toHaveBeenCalled();
        expect(mockDb.pageContent.upsert).not.toHaveBeenCalled();
      });

      it('allows EDITOR to mutate a DRAFT page', async () => {
        mockDb.page.findUnique
          .mockResolvedValueOnce({
            id: 'page-draft-2',
            slug: 'draft-page-2',
            name: 'Draft Page 2',
            status: 'DRAFT',
            publishedAt: null,
            content: { version: 1, blocks: [] },
            seo: null,
          })
          .mockResolvedValueOnce({
            id: 'page-draft-2',
            slug: 'draft-page-2',
            name: 'Updated Draft Page',
            status: 'DRAFT',
            publishedAt: null,
            content: { version: 1, blocks: [] },
            seo: null,
          });
        mockDb.page.update.mockResolvedValue({
          id: 'page-draft-2',
          slug: 'draft-page-2',
          name: 'Updated Draft Page',
          status: 'DRAFT',
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const updated = await updateDraftPage(
          'page-draft-2',
          {
            name: 'Updated Draft Page',
          },
          editorUser
        );

        expect(updated.name).toBe('Updated Draft Page');
        expect(mockDb.page.update).toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER to mutate a PUBLISHED page', async () => {
        mockDb.page.findUnique
          .mockResolvedValueOnce({
            id: 'page-pub-3',
            slug: 'live-page-3',
            name: 'Live Page 3',
            status: 'PUBLISHED',
            publishedAt: new Date(),
            content: { version: 1, blocks: [] },
            seo: null,
          })
          .mockResolvedValueOnce({
            id: 'page-pub-3',
            slug: 'live-page-3',
            name: 'Updated Live Page 3',
            status: 'PUBLISHED',
            publishedAt: new Date(),
            content: { version: 1, blocks: [] },
            seo: null,
          });
        mockDb.page.update.mockResolvedValue({
          id: 'page-pub-3',
          slug: 'live-page-3',
          name: 'Updated Live Page 3',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const updated = await updateDraftPage(
          'page-pub-3',
          {
            name: 'Updated Live Page 3',
          },
          contentManagerUser
        );

        expect(updated.name).toBe('Updated Live Page 3');
        expect(mockDb.page.update).toHaveBeenCalled();
      });
    });

    describe('Blog Post Publication Enforcement', () => {
      it('prohibits EDITOR from creating a blog post with PUBLISHED or SCHEDULED status', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue(null);

        await expect(
          createDraft(
            {
              title: 'New Post',
              slug: 'new-post',
              content: '<p>Content</p>',
              status: 'PUBLISHED',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        await expect(
          createDraft(
            {
              title: 'Scheduled Post',
              slug: 'scheduled-post',
              content: '<p>Content</p>',
              status: 'SCHEDULED',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.blogPost.create).not.toHaveBeenCalled();
      });

      it('allows EDITOR to create a blog post with DRAFT status', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue(null);
        mockDb.blogPost.create.mockResolvedValue({
          id: 'post-new-draft',
          slug: 'new-draft',
          title: 'New Draft',
          excerpt: '',
          content: '<p>Content</p>',
          featuredImage: null,
          featuredImageAlt: null,
          readingTime: '1 min read',
          status: 'DRAFT',
          publishedAt: null,
          scheduledFor: null,
          authorId: editorUser.id,
          categoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: editorUser.id, name: editorUser.name, email: editorUser.email, role: editorUser.role },
          category: null,
          tags: [],
          seo: null,
        });

        const created = await createDraft(
          {
            title: 'New Draft',
            slug: 'new-draft',
            content: '<p>Content</p>',
            status: 'DRAFT',
          },
          editorUser
        );

        expect(created.id).toBe('post-new-draft');
        expect(mockDb.blogPost.create).toHaveBeenCalled();
      });

      it('prohibits EDITOR from mutating an already PUBLISHED or SCHEDULED blog post', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-pub-1',
          slug: 'published-post',
          title: 'Published Post',
          status: 'PUBLISHED',
          content: '<p>Body</p>',
          seo: null,
          tags: [],
        });

        await expect(
          updateDraft(
            'post-pub-1',
            {
              title: 'Modified Title',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-sched-1',
          slug: 'scheduled-post',
          title: 'Scheduled Post',
          status: 'SCHEDULED',
          content: '<p>Body</p>',
          seo: null,
          tags: [],
        });

        await expect(
          updateDraft(
            'post-sched-1',
            {
              title: 'Modified Sched Title',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('prohibits EDITOR from transitioning a DRAFT blog post to PUBLISHED or SCHEDULED', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-draft-1',
          slug: 'draft-post',
          title: 'Draft Post',
          status: 'DRAFT',
          content: '<p>Body</p>',
          seo: null,
          tags: [],
        });

        await expect(
          updateDraft(
            'post-draft-1',
            {
              status: 'PUBLISHED',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        await expect(
          updateDraft(
            'post-draft-1',
            {
              status: 'SCHEDULED',
            },
            editorUser
          )
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER to mutate a PUBLISHED blog post', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-pub-cm',
          slug: 'live-post-cm',
          title: 'Live Post',
          status: 'PUBLISHED',
          content: '<p>Live body</p>',
          seo: null,
          tags: [],
        });
        mockDb.blogPost.update.mockResolvedValue({
          id: 'post-pub-cm',
          slug: 'live-post-cm',
          title: 'Updated Live Post',
          excerpt: '',
          content: '<p>Live body</p>',
          featuredImage: null,
          featuredImageAlt: null,
          readingTime: '1 min read',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          scheduledFor: null,
          authorId: contentManagerUser.id,
          categoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: contentManagerUser.id, name: contentManagerUser.name, email: contentManagerUser.email, role: contentManagerUser.role },
          category: null,
          tags: [],
          seo: null,
        });

        const updated = await updateDraft(
          'post-pub-cm',
          {
            title: 'Updated Live Post',
          },
          contentManagerUser
        );

        expect(updated.title).toBe('Updated Live Post');
        expect(mockDb.blogPost.update).toHaveBeenCalled();
      });
    });

    describe('publishPage & unpublishPage Authorization Enforcement', () => {
      it('prohibits EDITOR from publishing a page via publishPage', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-draft-publish',
          slug: 'draft-page-publish',
          status: 'DRAFT',
          content: { blocks: [] },
          seo: null,
        });

        await expect(publishPage('page-draft-publish', editorUser)).rejects.toThrow(
          /lacks 'PUBLISH_CONTENT' permission/
        );

        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER and ADMIN to publish a page via publishPage', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-draft-publish-2',
          slug: 'draft-page-publish-2',
          status: 'DRAFT',
          content: { blocks: [] },
          seo: null,
        });
        mockDb.page.update.mockResolvedValue({
          id: 'page-draft-publish-2',
          slug: 'draft-page-publish-2',
          status: 'PUBLISHED',
          content: { blocks: [] },
          seo: null,
        });

        const res = await publishPage('page-draft-publish-2', contentManagerUser);
        expect(res.status).toBe('PUBLISHED');
        expect(mockDb.page.update).toHaveBeenCalled();
      });

      it('prohibits EDITOR from unpublishing a page via unpublishPage', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-pub-unpublish',
          slug: 'pub-page-unpublish',
          status: 'PUBLISHED',
        });

        await expect(unpublishPage('page-pub-unpublish', editorUser)).rejects.toThrow(
          /lacks 'PUBLISH_CONTENT' permission/
        );

        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER and ADMIN to unpublish a page via unpublishPage', async () => {
        mockDb.page.findUnique.mockResolvedValue({
          id: 'page-pub-unpublish-2',
          slug: 'pub-page-unpublish-2',
          status: 'PUBLISHED',
        });
        mockDb.page.update.mockResolvedValue({
          id: 'page-pub-unpublish-2',
          slug: 'pub-page-unpublish-2',
          status: 'DRAFT',
          content: null,
          seo: null,
        });

        const res = await unpublishPage('page-pub-unpublish-2', adminUser);
        expect(res.status).toBe('DRAFT');
        expect(mockDb.page.update).toHaveBeenCalled();
      });
    });

    describe('publishPost, unpublishPost & schedulePost Authorization Enforcement', () => {
      it('prohibits EDITOR from publishing a blog post via publishPost', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-draft-pub',
          slug: 'draft-post-pub',
          status: 'DRAFT',
        });

        await expect(publishPost('post-draft-pub', editorUser)).rejects.toThrow(
          /lacks 'PUBLISH_CONTENT' permission/
        );

        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER and ADMIN to publish a blog post via publishPost', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-draft-pub-2',
          slug: 'draft-post-pub-2',
          title: 'Post Title',
          status: 'DRAFT',
        });
        mockDb.blogPost.update.mockResolvedValue({
          id: 'post-draft-pub-2',
          slug: 'draft-post-pub-2',
          title: 'Post Title',
          excerpt: '',
          content: '<p>Content</p>',
          featuredImage: null,
          featuredImageAlt: null,
          readingTime: '1 min read',
          status: 'PUBLISHED',
          publishedAt: new Date(),
          scheduledFor: null,
          authorId: contentManagerUser.id,
          categoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: contentManagerUser.id, name: contentManagerUser.name, email: contentManagerUser.email, role: contentManagerUser.role },
          category: null,
          tags: [],
          seo: null,
        });

        const res = await publishPost('post-draft-pub-2', contentManagerUser);
        expect(res.status).toBe('PUBLISHED');
        expect(mockDb.blogPost.update).toHaveBeenCalled();
      });

      it('prohibits EDITOR from unpublishing a blog post via unpublishPost', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-pub-unpub',
          slug: 'pub-post-unpub',
          status: 'PUBLISHED',
        });

        await expect(unpublishPost('post-pub-unpub', editorUser)).rejects.toThrow(
          /lacks 'PUBLISH_CONTENT' permission/
        );

        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER and ADMIN to unpublish a blog post via unpublishPost', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-pub-unpub-2',
          slug: 'pub-post-unpub-2',
          title: 'Post Title',
          status: 'PUBLISHED',
        });
        mockDb.blogPost.update.mockResolvedValue({
          id: 'post-pub-unpub-2',
          slug: 'pub-post-unpub-2',
          title: 'Post Title',
          excerpt: '',
          content: '<p>Content</p>',
          featuredImage: null,
          featuredImageAlt: null,
          readingTime: '1 min read',
          status: 'DRAFT',
          publishedAt: null,
          scheduledFor: null,
          authorId: adminUser.id,
          categoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: adminUser.id, name: adminUser.name, email: adminUser.email, role: adminUser.role },
          category: null,
          tags: [],
          seo: null,
        });

        const res = await unpublishPost('post-pub-unpub-2', adminUser);
        expect(res.status).toBe('DRAFT');
        expect(mockDb.blogPost.update).toHaveBeenCalled();
      });

      it('prohibits EDITOR from scheduling a blog post via schedulePost', async () => {
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-draft-sched',
          slug: 'draft-post-sched',
          status: 'DRAFT',
        });

        await expect(
          schedulePost('post-draft-sched', new Date(Date.now() + 86400000), editorUser)
        ).rejects.toThrow(/lacks 'PUBLISH_CONTENT' permission/);

        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('allows CONTENT_MANAGER and ADMIN to schedule a blog post via schedulePost', async () => {
        const futureDate = new Date(Date.now() + 86400000);
        mockDb.blogPost.findUnique.mockResolvedValue({
          id: 'post-draft-sched-2',
          slug: 'draft-post-sched-2',
          title: 'Sched Title',
          status: 'DRAFT',
        });
        mockDb.blogPost.update.mockResolvedValue({
          id: 'post-draft-sched-2',
          slug: 'draft-post-sched-2',
          title: 'Sched Title',
          excerpt: '',
          content: '<p>Content</p>',
          featuredImage: null,
          featuredImageAlt: null,
          readingTime: '1 min read',
          status: 'SCHEDULED',
          publishedAt: futureDate,
          scheduledFor: futureDate,
          authorId: contentManagerUser.id,
          categoryId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: contentManagerUser.id, name: contentManagerUser.name, email: contentManagerUser.email, role: contentManagerUser.role },
          category: null,
          tags: [],
          seo: null,
        });

        const res = await schedulePost('post-draft-sched-2', futureDate, contentManagerUser);
        expect(res.status).toBe('SCHEDULED');
        expect(mockDb.blogPost.update).toHaveBeenCalled();
      });
    });

    describe('Blog API Route Authorization (HTTP Integration)', () => {
      it('POST /api/admin/blog/[id]/publish returns HTTP 403 when user lacks PUBLISH_CONTENT', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({
          errorResponse: new Response(
            JSON.stringify({ error: "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission." }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          ),
        });

        const req = new NextRequest('http://localhost:3000/api/admin/blog/post-1/publish', { method: 'POST' });
        const res = await publishBlogRoute(req, { params: Promise.resolve({ id: 'post-1' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission");
      });

      it('POST /api/admin/blog/[id]/publish returns HTTP 403 via handleAdminApiError if service throws forbidden', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        const req = new NextRequest('http://localhost:3000/api/admin/blog/post-1/publish', { method: 'POST' });
        const res = await publishBlogRoute(req, { params: Promise.resolve({ id: 'post-1' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission");
        expect(data.failureType).toBe('forbidden');
      });

      it('POST /api/admin/blog/[id]/unpublish returns HTTP 403 when user lacks PUBLISH_CONTENT', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({
          errorResponse: new Response(
            JSON.stringify({ error: "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission." }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          ),
        });

        const req = new NextRequest('http://localhost:3000/api/admin/blog/post-1/unpublish', { method: 'POST' });
        const res = await unpublishBlogRoute(req, { params: Promise.resolve({ id: 'post-1' }) });
        expect(res.status).toBe(403);
      });

      it('POST /api/admin/blog/[id]/schedule returns HTTP 403 when user lacks PUBLISH_CONTENT', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({
          errorResponse: new Response(
            JSON.stringify({ error: "Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission." }),
            { status: 403, headers: { 'content-type': 'application/json' } }
          ),
        });

        const req = new NextRequest('http://localhost:3000/api/admin/blog/post-1/schedule', {
          method: 'POST',
          body: JSON.stringify({ scheduledFor: new Date().toISOString() }),
        });
        const res = await scheduleBlogRoute(req, { params: Promise.resolve({ id: 'post-1' }) });
        expect(res.status).toBe(403);
      });

      it('POST /api/admin/blog rejects EDITOR submitting status: PUBLISHED with HTTP 403', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });

        const req = new NextRequest('http://localhost:3000/api/admin/blog', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Unauthorized Live Post',
            slug: 'unauthorized-live-post',
            content: '<p>Content</p>',
            status: 'PUBLISHED',
          }),
        });

        const res = await createBlogRoute(req);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission");
        expect(mockDb.blogPost.create).not.toHaveBeenCalled();
      });

      it('PUT /api/admin/blog/[id] rejects EDITOR mutating an already PUBLISHED post with HTTP 403', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'post-pub-route',
          slug: 'live-post-route',
          title: 'Live Post',
          status: 'PUBLISHED',
        });

        const req = new NextRequest('http://localhost:3000/api/admin/blog/post-pub-route', {
          method: 'PUT',
          body: JSON.stringify({ title: 'Attempted Modification' }),
        });

        const res = await updateBlogRoute(req, { params: Promise.resolve({ id: 'post-pub-route' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to modify published or scheduled blog posts");
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('PUT /api/admin/blog/[id] rejects EDITOR attempting to publish a DRAFT post with HTTP 403', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        mockDb.blogPost.findUnique.mockResolvedValueOnce({
          id: 'post-draft-route',
          slug: 'draft-post-route',
          title: 'Draft Post',
          status: 'DRAFT',
        });

        const req = new NextRequest('http://localhost:3000/api/admin/blog/post-draft-route', {
          method: 'PUT',
          body: JSON.stringify({ status: 'PUBLISHED' }),
        });

        const res = await updateBlogRoute(req, { params: Promise.resolve({ id: 'post-draft-route' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to publish or schedule blog posts");
        expect(mockDb.blogPost.update).not.toHaveBeenCalled();
      });

      it('POST /api/admin/pages rejects EDITOR submitting status: PUBLISHED with HTTP 403', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });

        const req = new NextRequest('http://localhost:3000/api/admin/pages', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Unauthorized Live Page',
            slug: 'unauthorized-live-page',
            status: 'PUBLISHED',
            blocks: [],
          }),
        });

        const res = await createPageRoute(req);
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to create published pages");
        expect(mockDb.page.create).not.toHaveBeenCalled();
      });

      it('PUT /api/admin/pages/[id] rejects EDITOR mutating an already PUBLISHED page with HTTP 403', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        mockDb.page.findUnique.mockResolvedValueOnce({
          id: 'page-pub-route',
          slug: 'live-page-route',
          name: 'Live Page',
          status: 'PUBLISHED',
          content: { blocks: [] },
          seo: null,
        });

        const req = new NextRequest('http://localhost:3000/api/admin/pages/page-pub-route', {
          method: 'PUT',
          body: JSON.stringify({ name: 'Attempted Modification' }),
        });

        const res = await updatePageRoute(req, { params: Promise.resolve({ id: 'page-pub-route' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to modify published pages");
        expect(mockDb.page.update).not.toHaveBeenCalled();
      });

      it('PUT /api/admin/pages/[id] rejects EDITOR attempting to publish a DRAFT page with HTTP 403', async () => {
        mockRequireAdminAuth.mockResolvedValueOnce({ user: editorUser });
        mockDb.page.findUnique.mockResolvedValueOnce({
          id: 'page-draft-route',
          slug: 'draft-page-route',
          name: 'Draft Page',
          status: 'DRAFT',
          content: { blocks: [] },
          seo: null,
        });

        const req = new NextRequest('http://localhost:3000/api/admin/pages/page-draft-route', {
          method: 'PUT',
          body: JSON.stringify({ status: 'PUBLISHED' }),
        });

        const res = await updatePageRoute(req, { params: Promise.resolve({ id: 'page-draft-route' }) });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error).toContain("Forbidden: Role 'EDITOR' lacks 'PUBLISH_CONTENT' permission to publish pages");
        expect(mockDb.page.update).not.toHaveBeenCalled();
      });
    });
  });
});
