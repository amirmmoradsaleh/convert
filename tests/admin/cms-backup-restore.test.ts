import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
}));

import {
  exportCmsBackup,
  validateAndPreviewBackup,
  restoreCmsBackup,
} from '@/lib/admin/services/backup.service';
import { GET as exportBackupApi } from '@/app/api/admin/backup/export/route';
import { POST as previewBackupApi } from '@/app/api/admin/backup/preview/route';
import { POST as restoreBackupApi } from '@/app/api/admin/backup/restore/route';
import {
  AdminUserSession,
  CMS_BACKUP_FORMAT_IDENTIFIER,
  CMS_BACKUP_CURRENT_VERSION,
  CmsBackupFile,
} from '@/lib/admin/types';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';
import { createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin/session';
import { readBoundedRequestBody } from '@/lib/admin/body-reader';

describe('Convert24 — Phase 12.2-A: CMS JSON Backup & Restore Test Suite', () => {
  const superAdminSession: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role,
  };

  const adminSession: AdminUserSession = {
    id: 'admin-02',
    email: 'ops-admin@convert24.local',
    name: 'Ops Admin',
    role: 'ADMIN',
  };

  const editorSession: AdminUserSession = {
    id: 'editor-01',
    email: 'editor@convert24.local',
    name: 'Content Editor',
    role: 'EDITOR',
  };

  const viewerSession: AdminUserSession = {
    id: 'viewer-01',
    email: 'viewer@convert24.local',
    name: 'Readonly Viewer',
    role: 'VIEWER',
  };

  let superAdminToken: string;
  let adminToken: string;
  let editorToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetMemoryDb();
    const db = getDb();

    // Seed test users in memory DB
    await db.adminUser.create({
      data: {
        id: adminSession.id,
        email: adminSession.email,
        passwordHash: 'dummy-hash-admin',
        name: adminSession.name,
        role: adminSession.role,
        isActive: true,
      },
    });

    await db.adminUser.create({
      data: {
        id: editorSession.id,
        email: editorSession.email,
        passwordHash: 'dummy-hash-editor',
        name: editorSession.name,
        role: editorSession.role,
        isActive: true,
      },
    });

    await db.adminUser.create({
      data: {
        id: viewerSession.id,
        email: viewerSession.email,
        passwordHash: 'dummy-hash-viewer',
        name: viewerSession.name,
        role: viewerSession.role,
        isActive: true,
      },
    });

    // Seed sample tool content
    await db.toolContent.upsert({
      where: { toolSlug: 'jpg-to-png' },
      create: {
        toolSlug: 'jpg-to-png',
        customTitle: 'JPG to PNG High Quality Converter',
        customH1: 'Convert JPG to Transparent PNG Online',
        isPublished: true,
      },
      update: {},
    });

    // Create session tokens
    superAdminToken = await createSessionToken(superAdminSession);
    adminToken = await createSessionToken(adminSession);
    editorToken = await createSessionToken(editorSession);
    viewerToken = await createSessionToken(viewerSession);
  });

  // -------------------------------------------------------------------------
  // 1. Export Structure & Versioning
  // -------------------------------------------------------------------------
  describe('1. Export Payload Structure & Versioning', () => {
    it('exports standardized version 1 backup format with metadata and timestamp', async () => {
      const backup = await exportCmsBackup(superAdminSession);

      expect(backup.exportFormat).toBe(CMS_BACKUP_FORMAT_IDENTIFIER);
      expect(backup.formatVersion).toBe(CMS_BACKUP_CURRENT_VERSION);
      expect(backup.exportedBy.id).toBe(superAdminSession.id);
      expect(backup.exportedBy.email).toBe(superAdminSession.email);
      expect(backup.site.name).toBeDefined();
      expect(backup.site.url).toBeDefined();
      expect(new Date(backup.exportedAt).getTime()).not.toBeNaN();

      // Ensure data sections exist
      expect(backup.data).toBeDefined();
      expect(Array.isArray(backup.data.pages)).toBe(true);
      expect(Array.isArray(backup.data.toolContent)).toBe(true);
      expect(Array.isArray(backup.data.blogPosts)).toBe(true);
      expect(Array.isArray(backup.data.blogTaxonomy.categories)).toBe(true);
      expect(Array.isArray(backup.data.blogTaxonomy.tags)).toBe(true);
      expect(backup.data.siteSettings).toBeDefined();
      expect(Array.isArray(backup.data.siteSettings.navigation)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Strict Allowlist & Security Redaction
  // -------------------------------------------------------------------------
  describe('2. Strict Allowlist & Redaction', () => {
    it('strictly excludes AdminUsers, passwords, password hashes, reset tokens, and sessions', async () => {
      const backup = await exportCmsBackup(superAdminSession);
      const jsonStr = JSON.stringify(backup);

      // Must not leak passwords or hashes
      expect(jsonStr).not.toContain('passwordHash');
      expect(jsonStr).not.toContain('$2b$12$EcWOLShVkkA4lZAFbx1LCeBdIZKb4cDOjK/cw6w0TWs9uh9SB70YC');
      expect(jsonStr).not.toContain('passwordResetTokenHash');
      expect(jsonStr).not.toContain('failedLoginAttempts');

      // Must not leak user database records
      expect(backup.data).not.toHaveProperty('adminUsers');
      expect(backup.data).not.toHaveProperty('sessions');
      expect(backup.data).not.toHaveProperty('auditLogs');
    });

    it('media references export metadata only without local storage paths or binaries', async () => {
      const db = getDb();
      await db.mediaAsset.create({
        data: {
          filename: 'banner-hero.png',
          originalFilename: 'hero_image.png',
          mimeType: 'image/png',
          size: 1048576,
          url: '/uploads/banner-hero.png',
          storagePath: 'C:\\secret\\storage\\path\\banner-hero.png',
          alt: 'Hero Banner',
        },
      });

      const backup = await exportCmsBackup(superAdminSession);
      const heroRef = backup.data.mediaReferences.find((m) => m.filename === 'banner-hero.png');

      expect(heroRef).toBeDefined();
      expect(heroRef?.filename).toBe('banner-hero.png');
      expect(heroRef?.url).toBe('/uploads/banner-hero.png');
      expect(heroRef).not.toHaveProperty('storagePath');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Validation & Format Verification
  // -------------------------------------------------------------------------
  describe('3. Validation & Format Verification', () => {
    it('rejects payloads with invalid exportFormat identifier', async () => {
      const invalid = {
        exportFormat: 'malicious-backup-format',
        formatVersion: 1,
        data: { pages: [] },
      };

      const preview = await validateAndPreviewBackup(invalid);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => e.includes('Unsupported backup format'))).toBe(true);
    });

    it('rejects payloads with unsupported formatVersion', async () => {
      const invalid = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 99,
        data: { pages: [] },
      };

      const preview = await validateAndPreviewBackup(invalid);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => e.includes('Unsupported backup version'))).toBe(true);
    });

    it('rejects payloads with unknown tool slugs not in canonical registry', async () => {
      const invalid = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        data: {
          toolContent: [
            {
              toolSlug: 'unregistered-fake-tool',
              customTitle: 'Fake Tool',
            },
          ],
        },
      };

      const preview = await validateAndPreviewBackup(invalid);
      expect(preview.isValid).toBe(false);
      expect(preview.summary.toolContent.errors.some((e) => e.includes('not recognized in the canonical registry'))).toBe(true);
    });

    it('rejects container blocks that exceed MAX_CONTAINER_DEPTH (depth > 2)', async () => {
      const payloadWithDeepContainer = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        data: {
          pages: [
            {
              slug: 'deep-nested-test',
              name: 'Deep Nested Page',
              content: {
                version: 1,
                isPublished: true,
                blocks: [
                  {
                    id: 'c-root',
                    type: 'container',
                    blocks: [
                      {
                        id: 'c-level-1',
                        type: 'container',
                        blocks: [
                          {
                            id: 'c-level-2',
                            type: 'container',
                            blocks: [
                              {
                                id: 'c-level-3-excessive',
                                type: 'container',
                                blocks: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      };

      const preview = await validateAndPreviewBackup(payloadWithDeepContainer);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => /depth/i.test(e))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Content Block & CSS Sanitization during Restore
  // -------------------------------------------------------------------------
  describe('4. Sanitization & Safe CSS Preservation', () => {
    it('sanitizes malicious script tags and inline event handlers from custom HTML blocks', async () => {
      const backupPayload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [
            {
              slug: 'xss-sanitization-page',
              name: 'XSS Test Page',
              status: 'PUBLISHED',
              content: {
                version: 1,
                isPublished: true,
                blocks: [
                  {
                    id: 'blk-html-xss',
                    type: 'custom_html',
                    html: '<div onclick="alert(1)"><h3>Legit Heading</h3><script>stealSecrets()</script><img src="x" onerror="alert(2)" /></div>',
                    css: 'h3 { color: red; }',
                  },
                ],
              },
            },
          ],
          toolContent: [],
          blogPosts: [],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: {
            global: {},
            navigation: [],
            footer: {},
          },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const restoreResult = await restoreCmsBackup(backupPayload, superAdminSession);
      expect(restoreResult.success).toBe(true);

      const db = getDb();
      const page = await db.page.findUnique({
        where: { slug: 'xss-sanitization-page' },
        include: { content: true },
      });

      const block = page.content.blocks[0];
      expect(block.html).toContain('<h3>Legit Heading</h3>');
      expect(block.html).not.toContain('<script>');
      expect(block.html).not.toContain('stealSecrets()');
      expect(block.html).not.toContain('onerror=');
      expect(block.html).not.toContain('onclick=');
    });

    it('neutralizes unsafe javascript: links in navigation and CTA blocks', async () => {
      const backupPayload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [
            {
              slug: 'cta-url-test',
              name: 'CTA URL Page',
              status: 'DRAFT',
              content: {
                version: 1,
                isPublished: false,
                blocks: [
                  {
                    id: 'cta-malicious',
                    type: 'cta',
                    label: 'Click Me',
                    href: 'javascript:alert(document.cookie)',
                  },
                ],
              },
            },
          ],
          toolContent: [],
          blogPosts: [],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: {
            global: {},
            navigation: [],
            footer: {},
          },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const preview = await validateAndPreviewBackup(backupPayload);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => e.includes('Unsafe URL detected in cta'))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Preview Calculation (Create vs Update Counts)
  // -------------------------------------------------------------------------
  describe('5. Preview Calculation Accuracy', () => {
    it('accurately identifies toCreate (new) and toUpdate (existing) records', async () => {
      const backupPayload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [
            {
              slug: 'home', // Already exists in DEFAULT_PAGES
              name: 'Home Updated',
              status: 'PUBLISHED',
              content: { version: 1, isPublished: true, blocks: [] },
            },
            {
              slug: 'brand-new-landing', // Does not exist
              name: 'Brand New Landing',
              status: 'DRAFT',
              content: { version: 1, isPublished: false, blocks: [] },
            },
          ],
          toolContent: [
            {
              toolSlug: 'jpg-to-png', // Already exists in seeded tools
              customTitle: 'Updated JPG title',
            },
          ],
          blogPosts: [],
          blogTaxonomy: {
            categories: [
              { slug: 'image-optimization', name: 'Image Optimization' }, // Exists
              { slug: 'new-ai-converters', name: 'AI Converters' }, // New
            ],
            tags: [],
          },
          siteSettings: {
            global: { siteName: 'Updated Site Name' },
            navigation: [],
            footer: {},
          },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const preview = await validateAndPreviewBackup(backupPayload);
      expect(preview.isValid).toBe(true);

      // Pages: 1 update (home), 1 create (brand-new-landing)
      expect(preview.summary.pages.toUpdate).toBe(1);
      expect(preview.summary.pages.toCreate).toBe(1);

      // Tools: 1 update (jpg-to-png)
      expect(preview.summary.toolContent.toUpdate).toBe(1);
      expect(preview.summary.toolContent.toCreate).toBe(0);

      // Categories: 1 update, 1 create
      expect(preview.summary.blogTaxonomy.toUpdate).toBe(1);
      expect(preview.summary.blogTaxonomy.toCreate).toBe(1);

      // Global settings: 1 update
      expect(preview.summary.siteSettings.toUpdate).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Pre-validation Abort (0 writes on error)
  // -------------------------------------------------------------------------
  describe('6. Pre-validation Abort (Zero-write guarantee)', () => {
    it('aborts restore immediately without touching DB if any validation error exists', async () => {
      const db = getDb();
      const initialPageCount = await db.page.count();

      const invalidPayload = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        data: {
          pages: [
            {
              slug: 'valid-page-in-corrupt-file',
              name: 'Valid Page',
              content: { version: 1, isPublished: true, blocks: [] },
            },
            {
              slug: 'invalid-tool-page',
              name: 'Page with Bad CTA',
              content: {
                version: 1,
                isPublished: true,
                blocks: [{ id: 'bad-cta', type: 'cta', href: 'javascript:evil()' }],
              },
            },
          ],
        },
      };

      const result = await restoreCmsBackup(invalidPayload, superAdminSession);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Restore aborted');

      // Zero writes: valid page must NOT have been inserted
      const pageAfter = await db.page.findUnique({ where: { slug: 'valid-page-in-corrupt-file' } });
      expect(pageAfter).toBeNull();
      expect(await db.page.count()).toBe(initialPageCount);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Transactional Safety & Rollback
  // -------------------------------------------------------------------------
  describe('7. Transactional Atomic Rollback', () => {
    it('rolls back all changes if a failure occurs during execution inside transaction', async () => {
      const db = getDb();
      const initialHome = await db.page.findUnique({ where: { slug: 'home' } });

      const testPayload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [
            {
              slug: 'home',
              name: 'Temporarily Changed Home Name',
              status: 'PUBLISHED',
              content: { version: 1, isPublished: true, blocks: [] },
            },
          ],
          toolContent: [],
          blogPosts: [
            {
              slug: 'crash-post',
              title: 'Crash Post',
              content: 'Content',
              status: 'PUBLISHED',
            },
          ],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      // Mock tx.blogPost.upsert to throw an error mid-transaction
      const originalBlogPostUpsert = db.blogPost.upsert;
      (db.blogPost as any).upsert = vi.fn().mockRejectedValueOnce(new Error('Simulated DB Crash'));

      const result = await restoreCmsBackup(testPayload, superAdminSession);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Simulated DB Crash');

      // Restore original method
      db.blogPost.upsert = originalBlogPostUpsert;

      // Home name must be unchanged (rolled back)
      const rolledBackHome = await db.page.findUnique({ where: { slug: 'home' } });
      expect(rolledBackHome.name).toBe(initialHome.name);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Dependency Ordering & Relationships
  // -------------------------------------------------------------------------
  describe('8. Dependency-Ordered Restore', () => {
    it('restores blog categories and tags before blog posts and establishes relationships', async () => {
      const backupPayload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [],
          toolContent: [],
          blogTaxonomy: {
            categories: [
              { slug: 'new-cat-tech', name: 'Technology Guides', description: 'Deep tech tutorials' },
            ],
            tags: [
              { slug: 'tag-webp', name: 'WebP Format' },
              { slug: 'tag-compression', name: 'Compression' },
            ],
          },
          blogPosts: [
            {
              slug: 'ultimate-webp-guide',
              title: 'The Ultimate Guide to WebP Image Compression',
              content: '<p>Learn why WebP is revolutionary.</p>',
              status: 'PUBLISHED',
              categorySlug: 'new-cat-tech',
              tagSlugs: ['tag-webp', 'tag-compression'],
            },
          ],
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const result = await restoreCmsBackup(backupPayload, superAdminSession);
      expect(result.success).toBe(true);

      const db = getDb();
      const post = await db.blogPost.findUnique({
        where: { slug: 'ultimate-webp-guide' },
        include: { category: true, tags: { include: { tag: true } } },
      });

      expect(post).toBeDefined();
      expect(post.category?.slug).toBe('new-cat-tech');
      expect(post.tags.map((t: any) => t.tag?.slug)).toContain('tag-webp');
      expect(post.tags.map((t: any) => t.tag?.slug)).toContain('tag-compression');
    });
  });

  // -------------------------------------------------------------------------
  // 9. Non-Destructive Merge
  // -------------------------------------------------------------------------
  describe('9. Non-Destructive Merge Semantics', () => {
    it('preserves existing CMS pages and tools that are not in the backup', async () => {
      const db = getDb();
      const existingAbout = await db.page.findUnique({ where: { slug: 'about' } });
      expect(existingAbout).toBeDefined();

      const backupWithoutAbout: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [
            {
              slug: 'home',
              name: 'Updated Home Title Only',
              status: 'PUBLISHED',
              content: { version: 1, isPublished: true, blocks: [] },
            },
          ],
          toolContent: [],
          blogPosts: [],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const result = await restoreCmsBackup(backupWithoutAbout, superAdminSession);
      expect(result.success).toBe(true);

      // About page must still exist
      const preservedAbout = await db.page.findUnique({ where: { slug: 'about' } });
      expect(preservedAbout).toBeDefined();
      expect(preservedAbout.name).toBe('About Us');
    });
  });

  // -------------------------------------------------------------------------
  // 10. Audit Logging
  // -------------------------------------------------------------------------
  describe('10. Audit Logging', () => {
    it('records CMS_BACKUP_EXPORT and CMS_BACKUP_RESTORE in audit logs', async () => {
      const db = getDb();

      // Export audit log
      await exportCmsBackup(superAdminSession);
      const exportLogs = await db.auditLog.findMany({ where: { action: 'CMS_BACKUP_EXPORT' } });
      expect(exportLogs.length).toBeGreaterThan(0);
      expect(exportLogs[0].entityType).toBe('BACKUP');
      expect(exportLogs[0].userId).toBe(superAdminSession.id);

      // Restore audit log
      const backup = await exportCmsBackup(superAdminSession);
      await restoreCmsBackup(backup, superAdminSession);
      const restoreLogs = await db.auditLog.findMany({ where: { action: 'CMS_BACKUP_RESTORE' } });
      expect(restoreLogs.length).toBeGreaterThan(0);
      expect(restoreLogs[0].entityType).toBe('BACKUP');
      expect(restoreLogs[0].metadata.restoredPages).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 11. API Routes & RBAC Permissions
  // -------------------------------------------------------------------------
  describe('11. RBAC Permissions (MANAGE_SETTINGS)', () => {
    it('allows SUPER_ADMIN and ADMIN to access export, preview, and restore APIs', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/backup/export', {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${superAdminToken}`,
        },
      });

      const res = await exportBackupApi(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-disposition')).toContain('convert24-cms-backup');
    });

    it('allows ADMIN role with MANAGE_SETTINGS to export backup', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/backup/export', {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${adminToken}`,
        },
      });

      const res = await exportBackupApi(req);
      expect(res.status).toBe(200);
    });

    it('denies EDITOR and VIEWER roles with 403 Forbidden', async () => {
      // Editor request
      const editorReq = new NextRequest('http://localhost:3000/api/admin/backup/export', {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${editorToken}`,
        },
      });
      const editorRes = await exportBackupApi(editorReq);
      expect(editorRes.status).toBe(403);

      // Viewer request
      const viewerReq = new NextRequest('http://localhost:3000/api/admin/backup/export', {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${viewerToken}`,
        },
      });
      const viewerRes = await exportBackupApi(viewerReq);
      expect(viewerRes.status).toBe(403);
    });

    it('denies unauthenticated requests with 401 Unauthorized', async () => {
      const unauthReq = new NextRequest('http://localhost:3000/api/admin/backup/export');
      const res = await exportBackupApi(unauthReq);
      expect(res.status).toBe(401);
    });

    it('requires explicit confirmation { confirm: true } on restore API', async () => {
      const backup = await exportCmsBackup(superAdminSession);

      const reqWithoutConfirm = new NextRequest('http://localhost:3000/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backup,
          confirm: false,
        }),
      });

      const res = await restoreBackupApi(reqWithoutConfirm);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Confirmation required');
    });
  });

  // -------------------------------------------------------------------------
  // 12. Deep Content Comparison & Skipped Counts
  // -------------------------------------------------------------------------
  describe('12. Deep Content Comparison & Skipped Counts', () => {
    it('accurately identifies unchanged records as toSkip in preview and skips them during restore', async () => {
      // 1. Export current state
      const backup = await exportCmsBackup(superAdminSession);

      // 2. Validate and preview without any changes
      const preview = await validateAndPreviewBackup(backup);
      expect(preview.isValid).toBe(true);

      // In the clean DB, all exported items should be identified in preview
      expect(preview.summary.pages.toSkip + preview.summary.pages.toUpdate).toBeGreaterThan(0);
      expect(preview.summary.pages.toCreate).toBe(0);

      expect(preview.summary.toolContent.toSkip).toBeGreaterThan(0);
      expect(preview.summary.toolContent.toUpdate).toBe(0);
      expect(preview.summary.toolContent.toCreate).toBe(0);

      expect(preview.summary.siteSettings.toSkip).toBe(1);
      expect(preview.summary.siteSettings.toUpdate).toBe(0);

      // 3. Restore the unchanged backup
      const restoreRes = await restoreCmsBackup(backup, superAdminSession);
      expect(restoreRes.success).toBe(true);
      expect(restoreRes.restored.pages.skipped).toBe(preview.summary.pages.toSkip);
      expect(restoreRes.restored.pages.updated).toBe(preview.summary.pages.toUpdate);
      expect(restoreRes.restored.pages.created).toBe(0);
      expect(restoreRes.restored.siteSettings.skipped).toBe(true);
      expect(restoreRes.restored.siteSettings.updated).toBe(false);

      // 4. Modify one field in a page, now it should show as toUpdate
      const pageToModify = backup.data.pages.find((p) => p.slug === 'home');
      if (pageToModify) {
        pageToModify.name = 'Brand New Home Page Name';
        const modifiedPreview = await validateAndPreviewBackup(backup);
        expect(modifiedPreview.summary.pages.toUpdate).toBeGreaterThan(0);
        expect(modifiedPreview.summary.pages.toSkip + modifiedPreview.summary.pages.toUpdate).toBe(preview.summary.pages.toSkip + preview.summary.pages.toUpdate);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 13. Duplicate Natural Key Rejection
  // -------------------------------------------------------------------------
  describe('13. Duplicate Natural Key Rejection', () => {
    it('blocks preview and restore when backup payload contains duplicate page slugs', async () => {
      const payload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [
            { slug: 'dup-page', name: 'Page 1', status: 'PUBLISHED', content: { version: 1, isPublished: true, blocks: [] } },
            { slug: 'dup-page', name: 'Page 2', status: 'PUBLISHED', content: { version: 1, isPublished: true, blocks: [] } },
          ],
          toolContent: [],
          blogPosts: [],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const preview = await validateAndPreviewBackup(payload);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => e.includes("Duplicate page slug 'dup-page'"))).toBe(true);
      expect(preview.summary.pages.errors.some((e) => e.includes("Duplicate page slug 'dup-page'"))).toBe(true);
    });

    it('blocks preview and restore when backup payload contains duplicate tool slugs', async () => {
      const payload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [],
          toolContent: [
            { toolSlug: 'jpg-to-png', customTitle: 'JPG to PNG 1' },
            { toolSlug: 'jpg-to-png', customTitle: 'JPG to PNG 2' },
          ],
          blogPosts: [],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const preview = await validateAndPreviewBackup(payload);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => e.includes("Duplicate tool slug 'jpg-to-png'"))).toBe(true);
    });

    it('blocks preview when taxonomy contains duplicate category or tag slugs', async () => {
      const payload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [],
          toolContent: [],
          blogPosts: [],
          blogTaxonomy: {
            categories: [
              { slug: 'duplicate-cat', name: 'Cat 1' },
              { slug: 'duplicate-cat', name: 'Cat 2' },
            ],
            tags: [],
          },
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const preview = await validateAndPreviewBackup(payload);
      expect(preview.isValid).toBe(false);
      expect(preview.blockingErrors.some((e) => e.includes("Duplicate category slug 'duplicate-cat'"))).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 14. Missing Relation Warnings in Preview
  // -------------------------------------------------------------------------
  describe('14. Missing Relation Warnings in Preview', () => {
    it('warns when blog post references non-existent category or tags', async () => {
      const payload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [],
          toolContent: [],
          blogPosts: [
            {
              slug: 'standalone-post',
              title: 'Standalone Post',
              content: '<p>Content</p>',
              status: 'PUBLISHED',
              categorySlug: 'non-existent-cat',
              tagSlugs: ['ghost-tag-1', 'ghost-tag-2'],
            },
          ],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: { global: {}, navigation: [], footer: {} },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const preview = await validateAndPreviewBackup(payload);
      expect(preview.isValid).toBe(true);
      expect(
        preview.summary.blogPosts.warnings.some((w) =>
          w.includes("references category 'non-existent-cat'") && w.includes('unlinked')
        )
      ).toBe(true);
      expect(
        preview.summary.blogPosts.warnings.some((w) =>
          w.includes("references tag 'ghost-tag-1'") && w.includes('omitted')
        )
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 15. Prisma Schema Compliance & Parameter Safety
  // -------------------------------------------------------------------------
  describe('15. Prisma Schema Compliance & Parameter Safety', () => {
    it('safely stores header/footer metadata in socialLinks JSONB without invalid schema columns', async () => {
      const db = getDb();
      const globalUpsertSpy = vi.spyOn(db.globalSettings, 'upsert');
      const toolSeoUpsertSpy = vi.spyOn(db.toolSeo, 'upsert');

      const payload: CmsBackupFile = {
        exportFormat: CMS_BACKUP_FORMAT_IDENTIFIER,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: superAdminSession,
        site: { name: 'Convert24', url: 'https://convert24.net' },
        data: {
          pages: [],
          toolContent: [
            {
              toolSlug: 'jpg-to-png',
              customTitle: 'Schema Compliant Tool',
              seo: {
                seoTitle: 'Schema SEO Title',
                metaDescription: 'Schema Meta Description',
                twitterTitle: 'Non-schema Twitter Title',
                twitterDescription: 'Non-schema Twitter Desc',
                twitterImage: 'https://example.com/tw.jpg',
              },
            },
          ],
          blogPosts: [],
          blogTaxonomy: { categories: [], tags: [] },
          siteSettings: {
            global: {
              siteName: 'Convert24 Safe',
              siteUrl: 'https://convert24.net',
              headerTagline: 'Free File Converter Online',
              headerCtaLabel: 'All Tools',
              headerCtaLink: '/#tools',
              headerCtaVisible: true,
            },
            navigation: [],
            footer: {
              brandDescription: 'Safe footer text',
              copyrightText: 'Copyright Convert24',
              trustText: 'Safe & Secure',
            },
          },
          formatContents: [],
          mediaReferences: [],
        },
      };

      const restoreRes = await restoreCmsBackup(payload, superAdminSession);
      expect(restoreRes.success).toBe(true);

      // Verify db.globalSettings.upsert call parameters
      expect(globalUpsertSpy).toHaveBeenCalled();
      const globalCall = globalUpsertSpy.mock.calls[0][0];
      const updateData = globalCall.update as any;

      // Must NOT include headerTagline, headerCtaLabel directly as columns
      expect(updateData).not.toHaveProperty('headerTagline');
      expect(updateData).not.toHaveProperty('headerCtaLabel');
      expect(updateData).not.toHaveProperty('headerCtaLink');
      expect(updateData).not.toHaveProperty('headerCtaVisible');

      // Header/footer metadata must be encoded inside socialLinks
      expect(updateData.socialLinks).toBeDefined();

      // Verify db.toolSeo.upsert call parameters
      expect(toolSeoUpsertSpy).toHaveBeenCalled();
      const toolSeoCall = toolSeoUpsertSpy.mock.calls[0][0];
      const toolSeoData = toolSeoCall.update as any;
      expect(toolSeoData).not.toHaveProperty('twitterTitle');
      expect(toolSeoData).not.toHaveProperty('twitterDescription');
      expect(toolSeoData).not.toHaveProperty('twitterImage');

      globalUpsertSpy.mockRestore();
      toolSeoUpsertSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // 16. Stream-Bounded Request Reader & Size Guards
  // -------------------------------------------------------------------------
  describe('16. Stream-Safe Request Body Bounds (DoS Protection)', () => {
    it('readBoundedRequestBody rejects payloads exceeding byte size limit with 413', async () => {
      const fakeLargeString = 'x'.repeat(1024);
      const req = new NextRequest('http://localhost:3000/api/admin/backup/preview', {
        method: 'POST',
        headers: {
          'Content-Length': '1024',
        },
        body: fakeLargeString,
      });

      // Bound to 500 bytes
      const result = await readBoundedRequestBody(req, 500);
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse?.status).toBe(413);
    });

    it('preview API returns 413 when Content-Length exceeds CMS_BACKUP_MAX_PAYLOAD_SIZE', async () => {
      const oversizedBytes = (11 * 1024 * 1024).toString();
      const req = new NextRequest('http://localhost:3000/api/admin/backup/preview', {
        method: 'POST',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${superAdminToken}`,
          'Content-Length': oversizedBytes,
        },
        body: '{"foo":"bar"}',
      });

      const res = await previewBackupApi(req);
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain('Payload exceeds maximum allowed size');
    });

    it('restore API returns 413 when Content-Length exceeds CMS_BACKUP_MAX_PAYLOAD_SIZE', async () => {
      const oversizedBytes = (11 * 1024 * 1024).toString();
      const req = new NextRequest('http://localhost:3000/api/admin/backup/restore', {
        method: 'POST',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${superAdminToken}`,
          'Content-Length': oversizedBytes,
        },
        body: '{"confirm":true}',
      });

      const res = await restoreBackupApi(req);
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain('Payload exceeds maximum allowed size');
    });

    it('preview API returns 400 when body is invalid JSON syntax', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/backup/preview', {
        method: 'POST',
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${superAdminToken}`,
          'Content-Type': 'application/json',
        },
        body: '{not-json}',
      });

      const res = await previewBackupApi(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid JSON');
    });
  });
});

