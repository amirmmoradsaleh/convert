import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
}));

import {
  bootstrapHomepage,
  createDraftPage,
  updateDraftPage,
  deletePage,
  publishPage,
  unpublishPage,
  getPageBySlug,
  getPageById,
  getPageRevisions,
} from '@/lib/admin/services/page.service';
import { getDb, resetMemoryDb, DatabasePersistenceError, DEFAULT_ADMIN } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';
import { PUT as updatePageHandler, DELETE as deletePageHandler } from '@/app/api/admin/pages/[id]/route';
import { POST as publishPageHandler } from '@/app/api/admin/pages/[id]/publish/route';
import { createSessionToken } from '@/lib/admin/session';

describe('Phase 10B — Homepage Record Bootstrap and Guardrails', () => {
  const superAdmin: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: 'SUPER_ADMIN',
  };

  const viewerUser: AdminUserSession = {
    id: 'viewer-test-user-01',
    email: 'viewer@convert24.local',
    name: 'Viewer Admin',
    role: 'VIEWER',
  };

  beforeEach(() => {
    resetMemoryDb();
    mockRevalidatePath.mockClear();
  });

  describe('1. Safely Initialize the Reserved Homepage Record', () => {
    it('initializes absent homepage with required related records (Page, PageContent, PageSeo, PageRevision)', async () => {
      const db = getDb();
      // Simulate absent homepage (as in fresh PostgreSQL database)
      const initialHome = await db.page.findUnique({ where: { slug: 'home' } });
      if (initialHome) {
        await db.page.delete({ where: { id: initialHome.id } });
      }

      // Verify home does not exist
      expect(await db.page.findUnique({ where: { slug: 'home' } })).toBeNull();

      const result = await bootstrapHomepage(superAdmin);

      expect(result.created).toBe(true);
      expect(result.page).toBeDefined();
      expect(result.page.slug).toBe('home');
      expect(result.page.status).toBe('PUBLISHED');
      expect(result.page.name).toBe('Homepage');

      // Verify content relation
      expect(result.page.content).toBeDefined();
      expect(result.page.content.isPublished).toBe(true);
      expect(Array.isArray(result.page.content.blocks)).toBe(true);
      expect(result.page.content.blocks.length).toBe(0); // Clean fallback

      // Verify SEO relation
      expect(result.page.seo).toBeDefined();
      expect(result.page.seo.canonicalUrl).toBe('/');
      expect(result.page.seo.robotsIndex).toBe(true);
      expect(result.page.seo.robotsFollow).toBe(true);
      expect(result.page.seo.seoTitle).toContain('Free Online File Tools');

      // Verify initial revision
      const revisions = await getPageRevisions(result.page.id);
      expect(revisions.length).toBeGreaterThanOrEqual(1);
      expect(revisions[0].reason).toBe('Initial homepage bootstrap');
    });

    it('preserves existing content, SEO settings, status, IDs, and revisions when already initialized', async () => {
      const db = getDb();
      // Ensure homepage exists
      await bootstrapHomepage(superAdmin);
      const home = await db.page.findUnique({
        where: { slug: 'home' },
        include: { content: true, seo: true },
      });
      expect(home).not.toBeNull();

      // Customise homepage content and SEO
      await updateDraftPage(
        home!.id,
        {
          name: 'Convert24 - Ultimate File Hub',
          blocks: [
            {
              id: 'custom-blk-1',
              type: 'heading',
              data: { text: 'Custom Home Title', level: 1 },
            },
          ],
          seo: {
            seoTitle: 'Custom Home SEO Title',
            metaDescription: 'Custom home meta description for testing.',
            canonicalUrl: '/',
          },
          reason: 'Customized homepage for test',
        },
        superAdmin
      );

      const beforeRebootstrap = await db.page.findUnique({
        where: { slug: 'home' },
        include: { content: true, seo: true },
      });
      const revisionsBefore = await getPageRevisions(home!.id);

      // Re-run bootstrap
      const rebootstrapResult = await bootstrapHomepage(superAdmin);

      expect(rebootstrapResult.created).toBe(false);
      expect(rebootstrapResult.message).toContain('already exists. Preserved existing content');

      // Verify custom values were NOT overwritten
      const afterRebootstrap = await db.page.findUnique({
        where: { slug: 'home' },
        include: { content: true, seo: true },
      });
      expect(afterRebootstrap!.name).toBe('Convert24 - Ultimate File Hub');
      expect(afterRebootstrap!.content!.blocks.length).toBe(1);
      expect(afterRebootstrap!.seo!.seoTitle).toBe('Custom Home SEO Title');
      expect(afterRebootstrap!.seo!.metaDescription).toBe('Custom home meta description for testing.');

      const revisionsAfter = await getPageRevisions(home!.id);
      expect(revisionsAfter.length).toBe(revisionsBefore.length);
    });

    it('repeated execution is idempotent', async () => {
      const run1 = await bootstrapHomepage(superAdmin);
      const run2 = await bootstrapHomepage(superAdmin);
      const run3 = await bootstrapHomepage(superAdmin);

      expect(run2.created).toBe(false);
      expect(run3.created).toBe(false);
      expect(run1.page.id).toBe(run2.page.id);
      expect(run2.page.id).toBe(run3.page.id);
    });

    it('database failure does not report successful persistence', async () => {
      const db = getDb();
      // Simulate home being absent
      const home = await db.page.findUnique({ where: { slug: 'home' } });
      if (home) await db.page.delete({ where: { id: home.id } });

      const originalCreate = db.page.create;
      try {
        // Mock db error
        (db.page as any).create = vi.fn().mockRejectedValue(
          new DatabasePersistenceError('Database persistence unavailable in production.')
        );

        await expect(bootstrapHomepage(superAdmin)).rejects.toThrow(
          /Database persistence unavailable/
        );
      } finally {
        (db.page as any).create = originalCreate;
      }
    });
  });

  describe('2. Protect the Reserved home Slug', () => {
    it('prevents renaming an existing homepage slug from home', async () => {
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      await expect(
        updateDraftPage(
          home!.id,
          {
            slug: 'homepage',
            name: 'Renamed Home',
          },
          superAdmin
        )
      ).rejects.toThrow(/Cannot rename the reserved 'home' page slug/i);
    });

    it('prevents renaming any other page slug to home', async () => {
      const otherPage = await createDraftPage(
        {
          slug: 'landing-test',
          name: 'Landing Test',
        },
        superAdmin
      );

      await expect(
        updateDraftPage(
          otherPage.id,
          {
            slug: 'home',
          },
          superAdmin
        )
      ).rejects.toThrow(/Cannot rename page to the reserved 'home' slug/i);
    });

    it('prevents deleting the reserved home page', async () => {
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      await expect(deletePage(home!.id, superAdmin)).rejects.toThrow(
        /Cannot delete the reserved 'home' page/i
      );

      // Verify homepage still exists in database
      const recheck = await getPageBySlug('home');
      expect(recheck).not.toBeNull();
    });

    it('prevents creating a duplicate home page', async () => {
      await expect(
        createDraftPage(
          {
            slug: 'home',
            name: 'Duplicate Home',
          },
          superAdmin
        )
      ).rejects.toThrow(/already exists/i);
    });

    it('allows normal pages to be created, updated, renamed, and deleted', async () => {
      const newPage = await createDraftPage(
        {
          slug: 'temporary-promo',
          name: 'Temporary Promo',
        },
        superAdmin
      );
      expect(newPage.slug).toBe('temporary-promo');

      // Update name and slug
      const updated = await updateDraftPage(
        newPage.id,
        {
          slug: 'active-promo',
          name: 'Active Promo',
        },
        superAdmin
      );
      expect(updated?.slug).toBe('active-promo');

      // Delete non-home page
      const deleteResult = await deletePage(newPage.id, superAdmin);
      expect(deleteResult.success).toBe(true);

      expect(await getPageById(newPage.id)).toBeNull();
    });
  });

  describe('3. Publishing Cache Invalidation', () => {
    it('invalidates root route / when publishing home', async () => {
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      mockRevalidatePath.mockClear();
      await publishPage(home!.id, superAdmin);

      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('invalidates root route / when unpublishing home', async () => {
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      mockRevalidatePath.mockClear();
      await unpublishPage(home!.id, superAdmin);

      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('invalidates /{slug} when publishing an ordinary page', async () => {
      const testPage = await createDraftPage(
        {
          slug: 'guide-sample',
          name: 'Guide Sample',
        },
        superAdmin
      );

      mockRevalidatePath.mockClear();
      await publishPage(testPage.id, superAdmin);

      expect(mockRevalidatePath).toHaveBeenCalledWith('/guide-sample');
    });

    it('publish API route invalidates / for home and /${slug} for ordinary pages', async () => {
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      const adminToken = await createSessionToken(superAdmin);

      // 1. Publish home via API route
      mockRevalidatePath.mockClear();
      const reqHome = new NextRequest(
        new URL(`http://localhost:3000/api/admin/pages/${home!.id}/publish`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `admin_session=${adminToken}`,
          },
          body: JSON.stringify({ action: 'publish' }),
        }
      );

      const resHome = await publishPageHandler(reqHome, {
        params: Promise.resolve({ id: home!.id }),
      });
      expect(resHome.status).toBe(200);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');

      // 2. Publish ordinary page via API route
      const docPage = await createDraftPage(
        { slug: 'api-docs', name: 'API Docs' },
        superAdmin
      );

      mockRevalidatePath.mockClear();
      const reqDoc = new NextRequest(
        new URL(`http://localhost:3000/api/admin/pages/${docPage.id}/publish`),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `admin_session=${adminToken}`,
          },
          body: JSON.stringify({ action: 'publish' }),
        }
      );

      const resDoc = await publishPageHandler(reqDoc, {
        params: Promise.resolve({ id: docPage.id }),
      });
      expect(resDoc.status).toBe(200);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/api-docs');
    });
  });

  describe('4. Authorization & RBAC Guardrails', () => {
    it('rejects unauthorized unauthenticated requests to delete a page', async () => {
      const otherPage = await createDraftPage(
        { slug: 'auth-test', name: 'Auth Test' },
        superAdmin
      );

      const unauthReq = new NextRequest(
        new URL(`http://localhost:3000/api/admin/pages/${otherPage.id}`),
        {
          method: 'DELETE',
        }
      );

      const res = await deletePageHandler(unauthReq, {
        params: Promise.resolve({ id: otherPage.id }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects insufficient-permission (VIEWER) requests to delete or update a page', async () => {
      const otherPage = await createDraftPage(
        { slug: 'viewer-test', name: 'Viewer Test' },
        superAdmin
      );

      const db = getDb();
      await db.adminUser.create({
        data: {
          id: viewerUser.id,
          email: viewerUser.email,
          name: viewerUser.name,
          passwordHash: 'dummy-hash',
          role: 'VIEWER',
          isActive: true,
        },
      });

      const viewerToken = await createSessionToken(viewerUser);

      // DELETE with VIEWER
      const deleteReq = new NextRequest(
        new URL(`http://localhost:3000/api/admin/pages/${otherPage.id}`),
        {
          method: 'DELETE',
          headers: {
            Cookie: `admin_session=${viewerToken}`,
          },
        }
      );

      const deleteRes = await deletePageHandler(deleteReq, {
        params: Promise.resolve({ id: otherPage.id }),
      });
      expect(deleteRes.status).toBe(403);

      // PUT with VIEWER
      const putReq = new NextRequest(
        new URL(`http://localhost:3000/api/admin/pages/${otherPage.id}`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `admin_session=${viewerToken}`,
          },
          body: JSON.stringify({ name: 'Tampered' }),
        }
      );

      const putRes = await updatePageHandler(putReq, {
        params: Promise.resolve({ id: otherPage.id }),
      });
      expect(putRes.status).toBe(403);
    });

    it('rejects DELETE request targeting the reserved home page via API even with super admin', async () => {
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      const adminToken = await createSessionToken(superAdmin);

      const req = new NextRequest(
        new URL(`http://localhost:3000/api/admin/pages/${home!.id}`),
        {
          method: 'DELETE',
          headers: {
            Cookie: `admin_session=${adminToken}`,
          },
        }
      );

      const res = await deletePageHandler(req, {
        params: Promise.resolve({ id: home!.id }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Cannot delete the reserved 'home' page/i);
    });
  });
});
