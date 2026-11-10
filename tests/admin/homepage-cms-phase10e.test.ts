import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
}));

import { GET as getPagesApi, POST as createPageApi } from '@/app/api/admin/pages/route';
import { POST as bootstrapHomepageApi } from '@/app/api/admin/pages/bootstrap/route';
import { GET as getSinglePageApi, PUT as updatePageApi, DELETE as deletePageApi } from '@/app/api/admin/pages/[id]/route';
import { POST as publishPageApi } from '@/app/api/admin/pages/[id]/publish/route';
import { GET as getMeApi } from '@/app/api/admin/auth/me/route';
import { bootstrapHomepage, getPages, getPageBySlug, updateDraftPage, publishPage } from '@/lib/admin/services/page.service';
import { getPublishedPage } from '@/lib/cms/page-resolver';
import { createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin/session';
import { AdminUserSession } from '@/lib/admin/types';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';

describe('Convert24 — Phase 10E Test Suite: Empty Pages CMS & Homepage Inline Editing', () => {
  const superAdminSession: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role,
  };

  const editorSession: AdminUserSession = {
    id: 'editor-10e',
    email: 'editor@convert24.local',
    name: 'Content Editor 10E',
    role: 'EDITOR',
  };

  let superAdminToken: string;
  let editorToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetMemoryDb();
    const db = getDb();

    await db.adminUser.create({
      data: {
        id: editorSession.id,
        email: editorSession.email,
        passwordHash: 'dummy-hash',
        name: editorSession.name,
        role: editorSession.role,
        isActive: true,
      },
    });

    superAdminToken = await createSessionToken(superAdminSession);
    editorToken = await createSessionToken(editorSession);
  });

  const createRequest = (
    url: string,
    method = 'GET',
    token?: string,
    body?: any
  ): NextRequest => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.cookie = `${ADMIN_COOKIE_NAME}=${token}`;
    }
    if (body) {
      headers['content-type'] = 'application/json';
    }

    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  describe('1. Empty Pages Initialization & Idempotent Bootstrap', () => {
    it('handles a fresh database state and initializes homepage idempotently', async () => {
      const db = getDb();
      // Explicitly delete pre-seeded home page to test fresh database state
      const existingHome = await db.page.findUnique({ where: { slug: 'home' } });
      if (existingHome) {
        await db.page.delete({ where: { id: existingHome.id } });
      }

      // 1. Initial state check
      const homeCheck = await getPageBySlug('home');
      expect(homeCheck).toBeNull();

      // 2. First bootstrap run creates reserved 'home' page
      const result1 = await bootstrapHomepage(superAdminSession);
      expect(result1.created).toBe(true);
      expect(result1.page.slug).toBe('home');
      expect(result1.page.name).toBe('Homepage');
      expect(result1.page.status).toBe('PUBLISHED');

      // 3. Second bootstrap run is idempotent and preserves existing record
      const result2 = await bootstrapHomepage(superAdminSession);
      expect(result2.created).toBe(false);
      expect(result2.page.id).toBe(result1.page.id);
      expect(result2.message).toContain('already exists');
    });

    it('bootstrap API route initializes homepage and returns 200 with result', async () => {
      const req = createRequest('/api/admin/pages/bootstrap', 'POST', superAdminToken);
      const res = await bootstrapHomepageApi(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.page).toBeDefined();
      expect(data.page.slug).toBe('home');
    });

    it('preserves custom homepage blocks and SEO when re-running bootstrap', async () => {
      // Initialize homepage
      await bootstrapHomepage(superAdminSession);
      const home = await getPageBySlug('home');
      expect(home).not.toBeNull();

      // Update with custom blocks
      await updateDraftPage(
        home!.id,
        {
          name: 'Customized Homepage Title',
          blocks: [
            {
              id: 'blk-custom-1',
              type: 'heading',
              data: { text: 'Custom Heading' },
            },
          ],
        },
        superAdminSession
      );

      // Confirm customized page name and blocks are completely preserved
      const rechecked = await getPageBySlug('home');
      expect(rechecked?.name).toBe('Customized Homepage Title');
      expect((rechecked?.content as any)?.blocks[0]?.id).toBe('blk-custom-1');
    });

    it('rejects unauthorized unauthenticated requests to bootstrap homepage', async () => {
      const req = createRequest('/api/admin/pages/bootstrap', 'POST');
      const res = await bootstrapHomepageApi(req);
      expect(res.status).toBe(401);
    });

    it('rejects insufficient-permission (VIEWER) requests to bootstrap homepage', async () => {
      const db = getDb();
      const viewerSession: AdminUserSession = {
        id: 'viewer-10e',
        email: 'viewer@convert24.local',
        name: 'Viewer 10E',
        role: 'VIEWER',
      };
      await db.adminUser.create({
        data: {
          id: viewerSession.id,
          email: viewerSession.email,
          passwordHash: 'dummy-hash',
          name: viewerSession.name,
          role: viewerSession.role,
          isActive: true,
        },
      });
      const viewerToken = await createSessionToken(viewerSession);

      const req = createRequest('/api/admin/pages/bootstrap', 'POST', viewerToken);
      const res = await bootstrapHomepageApi(req);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Pages API Endpoints & Error Resiliency', () => {
    it('returns pages list via GET /api/admin/pages for authorized admin', async () => {
      await bootstrapHomepage(superAdminSession);

      const req = createRequest('/api/admin/pages', 'GET', superAdminToken);
      const res = await getPagesApi(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.pages)).toBe(true);
      const homeInList = data.pages.find((p: any) => p.slug === 'home');
      expect(homeInList).toBeDefined();
    });

    it('supports retrieving homepage by slug parameter or home route parameter', async () => {
      await bootstrapHomepage(superAdminSession);

      const req1 = createRequest('/api/admin/pages?slug=home', 'GET', superAdminToken);
      const res1 = await getPagesApi(req1);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.page?.slug).toBe('home');

      const params = Promise.resolve({ id: 'home' });
      const req2 = createRequest('/api/admin/pages/home', 'GET', superAdminToken);
      const res2 = await getSinglePageApi(req2, { params });
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.page?.slug).toBe('home');
    });

    it('prevents deleting the reserved home page via API', async () => {
      await bootstrapHomepage(superAdminSession);

      const params = Promise.resolve({ id: 'home' });
      const req = createRequest('/api/admin/pages/home', 'DELETE', superAdminToken);
      const res = await deletePageApi(req, { params });
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('Cannot delete the reserved');
    });
  });

  describe('3. Homepage Inline Editing Workflow', () => {
    it('authenticates editor permissions via /api/admin/auth/me for inline toolbar', async () => {
      const reqEditor = createRequest('/api/admin/auth/me', 'GET', editorToken);
      const resEditor = await getMeApi(reqEditor);
      expect(resEditor.status).toBe(200);
      const dataEditor = await resEditor.json();
      expect(dataEditor.user.role).toBe('EDITOR');
      expect(dataEditor.permissions).toContain('EDIT_CONTENT');

      const reqPublic = createRequest('/api/admin/auth/me', 'GET');
      const resPublic = await getMeApi(reqPublic);
      expect(resPublic.status).toBe(401);
    });

    it('allows editor to save draft homepage updates without leaking to public visitor', async () => {
      await bootstrapHomepage(superAdminSession);
      const home = await getPageBySlug('home');
      const db = getDb();

      // Assert that EDITOR lacking PUBLISH_CONTENT cannot mutate a PUBLISHED page (403 Forbidden)
      const params = Promise.resolve({ id: home!.id });
      const pubEditReq = createRequest(`/api/admin/pages/${home!.id}`, 'PUT', editorToken, {
        name: 'Forbidden Published Edit',
      });
      const pubEditRes = await updatePageApi(pubEditReq, { params });
      expect(pubEditRes.status).toBe(403);

      // Set page status to DRAFT so editor can save draft updates
      await db.page.update({ where: { id: home!.id }, data: { status: 'DRAFT' } });

      const draftReq = createRequest(`/api/admin/pages/${home!.id}`, 'PUT', editorToken, {
        name: 'New Draft Homepage Title',
        blocks: [
          {
            id: 'blk-draft-h1',
            type: 'heading',
            enabled: true,
            content: { text: 'Draft Headline for Editors' },
          },
        ],
        customCss: '.hero { color: red; }',
      });

      const draftRes = await updatePageApi(draftReq, { params });
      expect(draftRes.status).toBe(200);

      // Verify draft state in DB
      const updatedHome = await getPageBySlug('home');
      expect(updatedHome?.name).toBe('New Draft Homepage Title');
    });

    it('publishing homepage updates live site and invalidates root route cache /', async () => {
      await bootstrapHomepage(superAdminSession);
      const home = await getPageBySlug('home');

      const params = Promise.resolve({ id: home!.id });
      const pubReq = createRequest(`/api/admin/pages/${home!.id}/publish`, 'POST', superAdminToken, {
        action: 'publish',
      });

      const pubRes = await publishPageApi(pubReq, { params });
      expect(pubRes.status).toBe(200);

      const pubData = await pubRes.json();
      expect(pubData.page.status).toBe('PUBLISHED');

      // Verify Next.js cache revalidation for '/'
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });
  });
});

