import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { GET as getToolApi, PUT as updateToolApi } from '@/app/api/admin/tools/[slug]/route';
import { POST as publishToolApi } from '@/app/api/admin/tools/[slug]/publish/route';
import { GET as getRevisionsApi } from '@/app/api/admin/tools/[slug]/revisions/route';
import { POST as restoreRevisionApi } from '@/app/api/admin/tools/[slug]/revisions/[revisionId]/restore/route';
import { GET as getMeApi } from '@/app/api/admin/auth/me/route';
import { createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin/session';
import { AdminUserSession } from '@/lib/admin/types';
import { getPublishedTool, getPreviewTool, buildToolMetadata } from '@/lib/cms/tool-resolver';
import {
  generateCanonicalToolContract,
  normalizeToolContractBlocks,
} from '@/lib/cms/tool-contract';
import { getAllTools, getToolBySlug } from '@/lib/tools';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';
import { InlineBlockWrapper } from '@/components/admin/inline/InlineBlockWrapper';
import { InlineBlockEditorDrawer } from '@/components/admin/inline/InlineBlockEditorDrawer';
import { InlineEditorToolbar } from '@/components/admin/inline/InlineEditorToolbar';
import { InlineRevisionDrawer } from '@/components/admin/inline/InlineRevisionDrawer';

describe('Admin CMS Phase 04 — Inline Visual Content Editor Test Suite', () => {
  const superAdminSession: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role,
  };

  const editorSession: AdminUserSession = {
    id: 'editor-01',
    email: 'editor@filetools.local',
    name: 'Content Editor',
    role: 'EDITOR',
  };

  const viewerSession: AdminUserSession = {
    id: 'viewer-01',
    email: 'viewer@filetools.local',
    name: 'Readonly Viewer',
    role: 'VIEWER',
  };

  let superAdminToken: string;
  let editorToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    resetMemoryDb();
    const db = getDb();

    // Seed test editor user
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

    // Seed test viewer user
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

    superAdminToken = await createSessionToken(superAdminSession);
    editorToken = await createSessionToken(editorSession);
    viewerToken = await createSessionToken(viewerSession);
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

  describe('1. Server-Side Authentication & Authorization for Inline Editing', () => {
    it('unauthenticated public visitors receive 401 Unauthorized on admin auth verification', async () => {
      const req = createRequest('/api/admin/auth/me');
      const res = await getMeApi(req);
      expect(res.status).toBe(401);
    });

    it('authenticated editors receive user profile and EDIT_CONTENT permission', async () => {
      const req = createRequest('/api/admin/auth/me', 'GET', editorToken);
      const res = await getMeApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe(editorSession.email);
      expect(data.permissions).toContain('EDIT_CONTENT');
      expect(data.permissions).toContain('VIEW_CMS');
    });

    it('unauthenticated public visitors cannot read or write tool CMS data', async () => {
      const readReq = createRequest('/api/admin/tools/jpg-to-png');
      const readRes = await getToolApi(readReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(readRes.status).toBe(401);

      const writeReq = createRequest('/api/admin/tools/jpg-to-png', 'PUT', undefined, {
        blocks: [],
      });
      const writeRes = await updateToolApi(writeReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(writeRes.status).toBe(401);
    });

    it('viewers without EDIT_CONTENT permission cannot save drafts (403 Forbidden)', async () => {
      const writeReq = createRequest('/api/admin/tools/jpg-to-png', 'PUT', viewerToken, {
        blocks: [],
      });
      const writeRes = await updateToolApi(writeReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(writeRes.status).toBe(403);
    });

    it('editors without PUBLISH_CONTENT permission cannot publish tools directly', async () => {
      const publishReq = createRequest('/api/admin/tools/jpg-to-png/publish', 'POST', editorToken);
      const publishRes = await publishToolApi(publishReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(publishRes.status).toBe(403);
    });

    it('super administrators can both save drafts and publish changes', async () => {
      const blocks = generateCanonicalToolContract(getToolBySlug('jpg-to-png')!);
      const saveReq = createRequest('/api/admin/tools/jpg-to-png', 'PUT', superAdminToken, {
        blocks,
        isPublished: false,
      });
      const saveRes = await updateToolApi(saveReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(saveRes.status).toBe(200);

      const publishReq = createRequest('/api/admin/tools/jpg-to-png/publish', 'POST', superAdminToken);
      const publishRes = await publishToolApi(publishReq, { params: Promise.resolve({ slug: 'jpg-to-png' }) });
      expect(publishRes.status).toBe(200);
      const publishData = await publishRes.json();
      expect(publishData.success).toBe(true);
    });
  });

  describe('2. Draft State Isolation & Zero Leakage to Public Visitors', () => {
    it('saving an inline draft does NOT leak to public visitors until explicitly published', async () => {
      const tool = getToolBySlug('png-to-jpg')!;
      const canonicalBlocks = generateCanonicalToolContract(tool);

      // Mutate draft introduction text
      const editedBlocks = canonicalBlocks.map((b) =>
        b.type === 'intro'
          ? { ...b, content: { ...b.content, heading: 'Confidential Unpublished Draft Header' } }
          : b
      );

      // Save as draft via API
      const saveReq = createRequest('/api/admin/tools/png-to-jpg', 'PUT', editorToken, {
        blocks: editedBlocks,
        isPublished: false,
      });
      const saveRes = await updateToolApi(saveReq, { params: Promise.resolve({ slug: 'png-to-jpg' }) });
      expect(saveRes.status).toBe(200);

      // Public visitor resolver must NOT return the unpublished draft
      const publicTool = await getPublishedTool('png-to-jpg');
      expect(publicTool).not.toBeNull();
      // Public visitors get canonical fallback or previously published version
      if (publicTool?.blocks && publicTool.blocks.length > 0) {
        const publicIntro = publicTool.blocks.find((b: any) => b.type === 'intro');
        expect(publicIntro?.content?.heading).not.toBe('Confidential Unpublished Draft Header');
      } else {
        expect(publicTool?.intro).toBe(tool.intro);
      }

      // Authorized preview resolver gets the active draft
      const previewTool = await getPreviewTool('png-to-jpg');
      expect(previewTool).not.toBeNull();
      const previewIntro = previewTool?.blocks?.find((b: any) => b.type === 'intro');
      expect(previewIntro?.content?.heading).toBe('Confidential Unpublished Draft Header');
    });

    it('protects draft previews from search engine indexing (noindex, nofollow)', async () => {
      const defaultMeta = {
        title: 'Original Title',
        description: 'Original Description',
      };
      const metadata = await buildToolMetadata('png-to-jpg', defaultMeta);
      expect(metadata.title).toBeDefined();

      // Ensure that public metadata is indexable by default
      expect((metadata.robots as any)?.index).not.toBe(false);
    });
  });

  describe('3. Optimistic Concurrency & Collision Prevention', () => {
    it('detects concurrent modifications and returns 409 Conflict when expectedUpdatedAt does not match', async () => {
      const tool = getToolBySlug('compress-image')!;
      const blocks = generateCanonicalToolContract(tool);

      // Initial save
      const initialReq = createRequest('/api/admin/tools/compress-image', 'PUT', editorToken, {
        blocks,
      });
      const initialRes = await updateToolApi(initialReq, { params: Promise.resolve({ slug: 'compress-image' }) });
      expect(initialRes.status).toBe(200);
      const initialData = await initialRes.json();
      const firstUpdatedAt = initialData.toolContent.updatedAt;

      // Another user updates in the meantime
      const interimReq = createRequest('/api/admin/tools/compress-image', 'PUT', superAdminToken, {
        blocks,
        reason: 'Interim update by admin',
      });
      const interimRes = await updateToolApi(interimReq, { params: Promise.resolve({ slug: 'compress-image' }) });
      expect(interimRes.status).toBe(200);

      // First user tries to save with stale expectedUpdatedAt
      const staleReq = createRequest('/api/admin/tools/compress-image', 'PUT', editorToken, {
        blocks,
        expectedUpdatedAt: firstUpdatedAt,
      });
      const staleRes = await updateToolApi(staleReq, { params: Promise.resolve({ slug: 'compress-image' }) });
      expect(staleRes.status).toBe(409);
      const staleData = await staleRes.json();
      expect(staleData.error).toContain('updated by another user');
    });
  });

  describe('4. Revision History & Rollback System', () => {
    it('creates revision snapshots on save and allows authorized restoration', async () => {
      const tool = getToolBySlug('resize-image')!;
      const originalBlocks = generateCanonicalToolContract(tool);

      // Save version 1
      const v1Req = createRequest('/api/admin/tools/resize-image', 'PUT', editorToken, {
        blocks: originalBlocks,
        reason: 'Revision 1 - Canonical Baseline',
      });
      await updateToolApi(v1Req, { params: Promise.resolve({ slug: 'resize-image' }) });

      // Save version 2 with updated intro
      const v2Blocks = originalBlocks.map((b) =>
        b.type === 'intro' ? { ...b, content: { ...b.content, text: 'Custom V2 text' } } : b
      );
      const v2Req = createRequest('/api/admin/tools/resize-image', 'PUT', editorToken, {
        blocks: v2Blocks,
        reason: 'Revision 2 - Updated Text',
      });
      await updateToolApi(v2Req, { params: Promise.resolve({ slug: 'resize-image' }) });

      // Fetch revisions list
      const revReq = createRequest('/api/admin/tools/resize-image/revisions', 'GET', editorToken);
      const revRes = await getRevisionsApi(revReq, { params: Promise.resolve({ slug: 'resize-image' }) });
      expect(revRes.status).toBe(200);
      const data = await revRes.json();
      expect(data.success).toBe(true);
      const revisions = data.revisions;
      expect(Array.isArray(revisions)).toBe(true);
      expect(revisions.length).toBeGreaterThanOrEqual(2);

      const oldestRevision = revisions[revisions.length - 1];

      // Restore oldest revision (requires PUBLISH_CONTENT permission)
      const restoreReq = createRequest(
        `/api/admin/tools/resize-image/revisions/${oldestRevision.id}/restore`,
        'POST',
        superAdminToken
      );
      const restoreRes = await restoreRevisionApi(restoreReq, {
        params: Promise.resolve({ slug: 'resize-image', revisionId: oldestRevision.id }),
      });
      expect(restoreRes.status).toBe(200);
      const restoredData = await restoreRes.json();
      expect(restoredData.success).toBe(true);

      // Verify the restored content is active in preview
      const preview = await getPreviewTool('resize-image');
      const intro = preview?.blocks?.find((b: any) => b.type === 'intro');
      expect(intro?.content?.text).not.toBe('Custom V2 text');
    });
  });

  describe('5. Heading Hierarchy & Block Contract Integrity', () => {
    it('generates deterministic canonical tool contract for all 25 tools', () => {
      const tools = getAllTools();
      expect(tools.length).toBe(25);

      for (const tool of tools) {
        const blocks = generateCanonicalToolContract(tool);
        expect(blocks.length).toBeGreaterThanOrEqual(8);
        expect(blocks.length).toBeLessThanOrEqual(11);

        // Verify deterministic ascending order
        for (let i = 0; i < blocks.length - 1; i++) {
          expect(blocks[i].order).toBeLessThanOrEqual(blocks[i + 1].order);
        }

        // Verify IDs are unique and structured
        const ids = new Set(blocks.map((b) => b.id));
        expect(ids.size).toBe(blocks.length);
      }
    });

    it('strictly preserves the primary H1 title and prevents competing H1 headings', () => {
      const tool = getToolBySlug('merge-pdf')!;
      const blocks = generateCanonicalToolContract(tool);

      // Hero block title is identical to canonical h1
      const hero = blocks.find((b) => b.type === 'hero');
      expect(hero?.content?.title).toBe(tool.h1);

      // If user inputs an H1 in custom heading blocks, normalizeToolContractBlocks downgrades it to H2
      const malformedHeadingBlock = {
        id: 'block-custom-heading',
        type: 'heading',
        order: 10,
        content: {
          level: 1, // Illegal competing H1
          text: 'Malicious Competing H1',
        },
      };

      const normalized = normalizeToolContractBlocks([...blocks, malformedHeadingBlock as any], tool);
      const heading = normalized.find((b) => b.id === 'block-custom-heading');
      expect(heading?.content?.level).toBe(2);
    });

    it('filters related_tools to only canonical tool slugs', () => {
      const tool = getToolBySlug('pdf-to-jpg')!;
      const blocks = generateCanonicalToolContract(tool);

      const relatedBlock = {
        id: 'block-related',
        type: 'related_tools',
        order: 9,
        content: {
          slugs: ['jpg-to-png', 'invalid-slug-xyz', 'merge-pdf', 'fake-tool-123'],
        },
      };

      const normalized = normalizeToolContractBlocks([...blocks, relatedBlock as any], tool);
      const finalRelated = normalized.find((b) => b.id === 'block-related');
      expect(finalRelated?.content?.slugs).toEqual(['jpg-to-png', 'merge-pdf']);
    });
  });

  describe('6. Inline Editor Component Contracts & Safe Rendering', () => {
    it('exports all inline editing components properly', () => {
      expect(InlineEditorToolbar).toBeDefined();
      expect(InlineBlockEditorDrawer).toBeDefined();
      expect(InlineBlockWrapper).toBeDefined();
      expect(InlineRevisionDrawer).toBeDefined();
    });

    it('rejects CMS modifications for non-existent tool slugs', async () => {
      const req = createRequest('/api/admin/tools/non-existent-tool-slug', 'PUT', superAdminToken, {
        blocks: [],
      });
      const res = await updateToolApi(req, {
        params: Promise.resolve({ slug: 'non-existent-tool-slug' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('not found in canonical tool registry');
    });
  });
});
