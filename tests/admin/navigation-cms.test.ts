import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { NextRequest } from 'next/server';

const mockRevalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: any[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
}));

import {
  GET as getNavigationApi,
  POST as createNavigationApi,
  PUT as putNavigationApi,
} from '@/app/api/admin/navigation/route';
import {
  PUT as updateItemApi,
  DELETE as deleteItemApi,
} from '@/app/api/admin/navigation/[id]/route';
import {
  getNavigationItems,
  createNavigationItem,
  updateNavigationItem,
  deleteNavigationItem,
  reorderNavigationItems,
  DEFAULT_HEADER_NAV,
} from '@/lib/admin/services/navigation.service';
import {
  validateNavigationDestination,
  validateNavigationLabel,
  validateNavigationItem,
} from '@/lib/admin/validation';
import { createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/admin/session';
import { AdminUserSession, HeaderNavItem } from '@/lib/admin/types';
import { resetMemoryDb, getDb, DEFAULT_ADMIN } from '@/lib/db';
import Header from '@/components/layout/Header';
import { renderToString } from 'react-dom/server';

describe('Convert24 — CMS Header Navigation Management Test Suite', () => {
  const superAdminSession: AdminUserSession = {
    id: DEFAULT_ADMIN.id,
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role, // SUPER_ADMIN -> has MANAGE_SETTINGS
  };

  const adminSession: AdminUserSession = {
    id: 'admin-nav-user',
    email: 'admin@convert24.local',
    name: 'Admin User',
    role: 'ADMIN', // ADMIN -> has MANAGE_SETTINGS
  };

  const contentManagerSession: AdminUserSession = {
    id: 'cm-nav-user',
    email: 'cm@convert24.local',
    name: 'Content Manager',
    role: 'CONTENT_MANAGER', // lacks MANAGE_SETTINGS
  };

  const editorSession: AdminUserSession = {
    id: 'editor-nav-user',
    email: 'editor@convert24.local',
    name: 'Content Editor',
    role: 'EDITOR', // lacks MANAGE_SETTINGS
  };

  const viewerSession: AdminUserSession = {
    id: 'viewer-nav-user',
    email: 'viewer@convert24.local',
    name: 'Viewer User',
    role: 'VIEWER', // lacks MANAGE_SETTINGS
  };

  let superAdminToken: string;
  let adminToken: string;
  let contentManagerToken: string;
  let editorToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetMemoryDb();
    const db = getDb();

    // Seed test users in memory store
    for (const u of [adminSession, contentManagerSession, editorSession, viewerSession]) {
      await db.adminUser.create({
        data: {
          id: u.id,
          email: u.email,
          passwordHash: 'dummy-hash',
          name: u.name,
          role: u.role,
          isActive: true,
        },
      });
    }

    superAdminToken = await createSessionToken(superAdminSession);
    adminToken = await createSessionToken(adminSession);
    contentManagerToken = await createSessionToken(contentManagerSession);
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

  // =========================================================================
  // 1. URL Safety & Destination Validation
  // =========================================================================
  describe('1. Input Validation & URL Safety', () => {
    it('accepts safe relative paths, anchor fragments, and external HTTPS URLs', () => {
      expect(validateNavigationDestination('/blog').isValid).toBe(true);
      expect(validateNavigationDestination('/tools/jpg-to-png').isValid).toBe(true);
      expect(validateNavigationDestination('/image-tools?sort=name#top').isValid).toBe(true);
      expect(validateNavigationDestination('/#pricing').isValid).toBe(true);
      expect(validateNavigationDestination('#faq').isValid).toBe(true);
      expect(validateNavigationDestination('https://github.com/convert24').isValid).toBe(true);
      expect(validateNavigationDestination('http://localhost:3000').isValid).toBe(true);
      expect(validateNavigationDestination('mailto:support@convert24.local').isValid).toBe(true);
      expect(validateNavigationDestination('tel:+1234567890').isValid).toBe(true);
    });

    it('rejects unsafe javascript:, vbscript:, and data: schemes', () => {
      expect(validateNavigationDestination('javascript:alert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('JAVASCRIPT:alert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('javascript:void(0)').isValid).toBe(false);
      expect(validateNavigationDestination('jav&#x09;ascript:alert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('vbscript:msgbox(1)').isValid).toBe(false);
      expect(validateNavigationDestination('data:text/html,<script>alert(1)</script>').isValid).toBe(false);
      expect(validateNavigationDestination('file:///etc/passwd').isValid).toBe(false);
      expect(validateNavigationDestination('blob:https://example.com/uuid').isValid).toBe(false);
    });

    it('rejects protocol-relative URLs to prevent open redirects', () => {
      const res = validateNavigationDestination('//evil.com/phish');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/protocol-relative/i);
    });

    it('rejects backslash authority bypasses (/\\evil.com, /\\evil)', () => {
      const res1 = validateNavigationDestination('/\\evil.com');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toMatch(/backslash/i);

      const res2 = validateNavigationDestination('/path\\evil');
      expect(res2.isValid).toBe(false);
    });

    it('rejects control characters and null bytes in destinations', () => {
      const res = validateNavigationDestination('/path\u0000evil');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/control characters/i);
    });

    it('rejects percent-encoded backslashes, slashes, and control characters', () => {
      // Encoded backslash (%5C / %5c)
      const res1 = validateNavigationDestination('/%5Cevil.com');
      expect(res1.isValid).toBe(false);
      expect(res1.error).toMatch(/backslash/i);

      const res2 = validateNavigationDestination('/%5cevil.com');
      expect(res2.isValid).toBe(false);
      expect(res2.error).toMatch(/backslash/i);

      // Encoded protocol-relative (%2f%2f)
      const res3 = validateNavigationDestination('/%2fevil.com');
      expect(res3.isValid).toBe(false);

      // Encoded null byte (%00)
      const res4 = validateNavigationDestination('/path%00evil');
      expect(res4.isValid).toBe(false);
      expect(res4.error).toMatch(/control characters/i);

      // Malformed URI sequence
      const res5 = validateNavigationDestination('/path%FFinvalid');
      expect(res5.isValid).toBe(false);
      expect(res5.error).toMatch(/malformed/i);
    });

    it('rejects double-encoded and multiply encoded path separators and backslashes', () => {
      // Double-encoded protocol relative
      expect(validateNavigationDestination('%252F%252Fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%252Fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%25252Fevil.com').isValid).toBe(false);

      // Double-encoded backslash
      expect(validateNavigationDestination('%255C').isValid).toBe(false);
      expect(validateNavigationDestination('%255c').isValid).toBe(false);
      expect(validateNavigationDestination('/%255Cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%255cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%25255Cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%2525255cevil.com').isValid).toBe(false);

      // Mixed slash/backslash combinations
      expect(validateNavigationDestination('/%2F%5Cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%5C%2Fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%252F%255Cevil.com').isValid).toBe(false);
    });

    it('rejects encoded control characters and null bytes including multiply encoded variants', () => {
      // Single-encoded null byte & control characters
      expect(validateNavigationDestination('/path%00evil').isValid).toBe(false);
      expect(validateNavigationDestination('/path%09evil').isValid).toBe(false); // Tab
      expect(validateNavigationDestination('/path%0D%0Aevil').isValid).toBe(false); // CRLF
      expect(validateNavigationDestination('/path%1fevil').isValid).toBe(false);

      // Double-encoded null byte & control characters
      expect(validateNavigationDestination('/path%2500evil').isValid).toBe(false);
      expect(validateNavigationDestination('/path%2509evil').isValid).toBe(false);
      expect(validateNavigationDestination('/path%250d%250aevil').isValid).toBe(false);

      // Multiply-encoded null byte
      expect(validateNavigationDestination('/path%252500evil').isValid).toBe(false);
    });

    it('rejects malformed percent-encoding properly', () => {
      expect(validateNavigationDestination('/path%').isValid).toBe(false);
      expect(validateNavigationDestination('/path%2').isValid).toBe(false);
      expect(validateNavigationDestination('/path%ZZ').isValid).toBe(false);
      expect(validateNavigationDestination('/%').isValid).toBe(false);
      expect(validateNavigationDestination('/path%FFinvalid').isValid).toBe(false);
      expect(validateNavigationDestination('https://example.com/%ZZ').isValid).toBe(false);
    });

    it('handles mixed-case percent-encoding and mixed-case schemes securely', () => {
      // Mixed case hex encoding
      expect(validateNavigationDestination('/%2fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%2Fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%5cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%5Cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%252fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%252Fevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%255cevil.com').isValid).toBe(false);
      expect(validateNavigationDestination('/%255Cevil.com').isValid).toBe(false);

      // Mixed-case encoded javascript
      expect(validateNavigationDestination('%6A%61%76%61%73%63%72%69%70%74:alert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('%6a%61%76%61%53%63%72%69%70%74:alert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('JaVaScRiPt:alert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('VbScRiPt:msgbox(1)').isValid).toBe(false);
    });

    it('rejects encoded dangerous schemes and protocol-relative destinations', () => {
      // Encoded javascript:, vbscript:, data:, file:, blob:
      expect(validateNavigationDestination('%6a%61%76%61%73%63%72%69%70%74%3aalert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('%256a%2561%2576%2561%2573%2563%2572%2569%2570%2574%253aalert(1)').isValid).toBe(false);
      expect(validateNavigationDestination('%76%62%73%63%72%69%70%74%3amsgbox(1)').isValid).toBe(false);
      expect(validateNavigationDestination('%64%61%74%61%3atext/html,<script>alert(1)</script>').isValid).toBe(false);
      expect(validateNavigationDestination('%66%69%6c%65%3a///etc/passwd').isValid).toBe(false);
      expect(validateNavigationDestination('%62%6c%6f%62%3ahttps://example.com/blob-id').isValid).toBe(false);

      // Protocol-relative variations
      expect(validateNavigationDestination('//evil.com').isValid).toBe(false);
      expect(validateNavigationDestination('///evil.com').isValid).toBe(false);
      expect(validateNavigationDestination('//').isValid).toBe(false);
      expect(validateNavigationDestination('/%2F').isValid).toBe(false);
      expect(validateNavigationDestination('/%252F').isValid).toBe(false);
    });

    it('accepts and preserves valid internal paths containing legitimate percent-encoded characters', () => {
      // Percent-encoded spaces and query parameters
      const qRes = validateNavigationDestination('/search?q=hello%20world');
      expect(qRes.isValid).toBe(true);
      expect(qRes.normalized).toBe('/search?q=hello%20world');

      // Legitimate encoded hash/plus symbols in paths and query strings
      const hashRes = validateNavigationDestination('/formats/c%23');
      expect(hashRes.isValid).toBe(true);
      expect(hashRes.normalized).toBe('/formats/c%23');

      const plusRes = validateNavigationDestination('/tools/image-to-pdf?tag=c%2B%2B');
      expect(plusRes.isValid).toBe(true);
      expect(plusRes.normalized).toBe('/tools/image-to-pdf?tag=c%2B%2B');

      // Valid URL with encoded fragment
      const fragRes = validateNavigationDestination('/blog/react%20tips#section%201');
      expect(fragRes.isValid).toBe(true);
      expect(fragRes.normalized).toBe('/blog/react%20tips#section%201');

      // UTF-8 multibyte percent-encoding (e.g. café)
      const utf8Res = validateNavigationDestination('/category/caf%C3%A9');
      expect(utf8Res.isValid).toBe(true);
      expect(utf8Res.normalized).toBe('/category/caf%C3%A9');

      // Encoded ampersands in query parameters
      const ampRes = validateNavigationDestination('/tools?filter=a%26b');
      expect(ampRes.isValid).toBe(true);
      expect(ampRes.normalized).toBe('/tools?filter=a%26b');
    });

    it('rejects unadorned domains without protocol', () => {
      const res = validateNavigationDestination('evil.com');
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/relative path.*or full URL/i);
    });

    it('validates navigation labels correctly and strips HTML tags', () => {
      expect(validateNavigationLabel('Blog').isValid).toBe(true);
      expect(validateNavigationLabel('').isValid).toBe(false);
      expect(validateNavigationLabel('   ').isValid).toBe(false);

      // Label > 60 chars rejected
      const longLabel = 'A'.repeat(61);
      expect(validateNavigationLabel(longLabel).isValid).toBe(false);

      // HTML tags stripped
      const tagResult = validateNavigationLabel('<b>Guides</b>');
      expect(tagResult.isValid).toBe(true);
      expect(tagResult.normalized).toBe('Guides');

      // Tag-only label stripped to empty is rejected
      expect(validateNavigationLabel('<script></script>').isValid).toBe(false);
      expect(validateNavigationLabel('<div>   </div>').isValid).toBe(false);
      expect(validateNavigationLabel('<script>alert(1)</script>').normalized).toBe('alert(1)');
    });

    it('validates full navigation item inputs correctly', () => {
      const valid = validateNavigationItem({
        label: 'API Docs',
        href: 'https://docs.convert24.local',
        openNewTab: true,
      });
      expect(valid.isValid).toBe(true);
      expect(valid.sanitized?.label).toBe('API Docs');
      expect(valid.sanitized?.href).toBe('https://docs.convert24.local');
      expect(valid.sanitized?.isExternal).toBe(true);
      expect(valid.sanitized?.openNewTab).toBe(true);

      const invalid = validateNavigationItem({
        label: '',
        href: 'javascript:alert(1)',
      });
      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 2. Server RBAC & Authorization
  // =========================================================================
  describe('2. Server RBAC & Authorization', () => {
    it('returns 401 Unauthorized for unauthenticated requests to navigation endpoints', async () => {
      const getReq = createRequest('/api/admin/navigation', 'GET');
      const getRes = await getNavigationApi(getReq);
      expect(getRes.status).toBe(401);

      const postReq = createRequest('/api/admin/navigation', 'POST', undefined, {
        label: 'Test',
        href: '/test',
      });
      const postRes = await createNavigationApi(postReq);
      expect(postRes.status).toBe(401);

      const putReq = createRequest('/api/admin/navigation', 'PUT', undefined, {
        orderedIds: ['nav-1'],
      });
      const putRes = await putNavigationApi(putReq);
      expect(putRes.status).toBe(401);

      const putItemReq = createRequest('/api/admin/navigation/nav-blog', 'PUT', undefined, {
        label: 'Updated',
      });
      const putItemRes = await updateItemApi(putItemReq, { params: Promise.resolve({ id: 'nav-blog' }) });
      expect(putItemRes.status).toBe(401);

      const delReq = createRequest('/api/admin/navigation/nav-blog', 'DELETE');
      const delRes = await deleteItemApi(delReq, { params: Promise.resolve({ id: 'nav-blog' }) });
      expect(delRes.status).toBe(401);
    });

    it('allows read access (VIEW_CMS) to VIEWER and EDITOR roles', async () => {
      const viewerReq = createRequest('/api/admin/navigation', 'GET', viewerToken);
      const viewerRes = await getNavigationApi(viewerReq);
      expect(viewerRes.status).toBe(200);
      const data = await viewerRes.json();
      expect(Array.isArray(data.items)).toBe(true);

      const editorReq = createRequest('/api/admin/navigation', 'GET', editorToken);
      const editorRes = await getNavigationApi(editorReq);
      expect(editorRes.status).toBe(200);
    });

    it('denies mutation access (MANAGE_SETTINGS required) to VIEWER, EDITOR, and CONTENT_MANAGER', async () => {
      // Test EDITOR attempting POST
      const editorPostReq = createRequest('/api/admin/navigation', 'POST', editorToken, {
        label: 'Editor Link',
        href: '/editor-link',
      });
      const editorPostRes = await createNavigationApi(editorPostReq);
      expect(editorPostRes.status).toBe(403);
      const editorPostJson = await editorPostRes.json();
      expect(editorPostJson.error).toMatch(/Forbidden/i);

      // Test VIEWER attempting PUT reorder
      const viewerPutReq = createRequest('/api/admin/navigation', 'PUT', viewerToken, {
        itemIds: ['nav-blog'],
      });
      const viewerPutRes = await putNavigationApi(viewerPutReq);
      expect(viewerPutRes.status).toBe(403);

      // Test CONTENT_MANAGER attempting PUT item
      const cmPutReq = createRequest('/api/admin/navigation/nav-blog', 'PUT', contentManagerToken, {
        label: 'Hacked Blog',
      });
      const cmPutRes = await updateItemApi(cmPutReq, { params: Promise.resolve({ id: 'nav-blog' }) });
      expect(cmPutRes.status).toBe(403);

      // Test EDITOR attempting DELETE
      const editorDelReq = createRequest('/api/admin/navigation/nav-blog', 'DELETE', editorToken);
      const editorDelRes = await deleteItemApi(editorDelReq, { params: Promise.resolve({ id: 'nav-blog' }) });
      expect(editorDelRes.status).toBe(403);
    });

    it('grants full management rights to SUPER_ADMIN and ADMIN', async () => {
      const postReq = createRequest('/api/admin/navigation', 'POST', adminToken, {
        label: 'Admin Hub',
        destination: '/tools',
        openNewTab: false,
      });
      const postRes = await createNavigationApi(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.item.label).toBe('Admin Hub');
    });
  });

  // =========================================================================
  // 3. Complete CRUD & Reordering Lifecycle
  // =========================================================================
  describe('3. CRUD & Reordering Lifecycle', () => {
    it('creates, edits, reorders, toggles visibility, and deletes items with persistence and cache invalidation', async () => {
      // 1. Initial listing returns seeded items
      const initialItems = await getNavigationItems({ includeHidden: true });
      expect(initialItems.length).toBe(3);
      expect(initialItems.map((i) => i.label)).toEqual(['Blog', 'Pricing', 'Help']);

      // 2. Create a new item
      const created = await createNavigationItem(
        {
          label: 'PDF Tools',
          href: '/pdf-tools',
          openNewTab: false,
          visible: true,
        },
        superAdminSession
      );
      expect(created.id).toBeDefined();
      expect(created.label).toBe('PDF Tools');
      expect(created.href).toBe('/pdf-tools');
      expect(created.order).toBe(5); // Placed at the end
      expect(mockRevalidatePath).toHaveBeenCalledWith('/', 'layout');

      // 3. Update the created item
      const updated = await updateNavigationItem(
        created.id,
        {
          label: 'PDF Utilities Hub',
          destination: '/tools/pdf',
          openNewTab: true,
        },
        superAdminSession
      );
      expect(updated.label).toBe('PDF Utilities Hub');
      expect(updated.href).toBe('/tools/pdf');
      expect(updated.openNewTab).toBe(true);
      expect(updated.isExternal).toBe(true);

      // 4. Toggle visibility to false
      const hidden = await updateNavigationItem(
        created.id,
        { visible: false },
        superAdminSession
      );
      expect(hidden.visible).toBe(false);

      // Public view (includeHidden: false) should NOT include the hidden item
      const publicItems = await getNavigationItems({ includeHidden: false });
      expect(publicItems.some((i) => i.id === created.id)).toBe(false);

      // Admin view (includeHidden: true) MUST include the hidden item
      const adminItems = await getNavigationItems({ includeHidden: true });
      expect(adminItems.some((i) => i.id === created.id)).toBe(true);

      // 5. Reorder items
      const orderedIds = [created.id, 'nav-help', 'nav-blog', 'nav-pricing'];
      const reordered = await reorderNavigationItems(orderedIds, superAdminSession);
      expect(reordered.map((i) => i.id)).toEqual(orderedIds);
      expect(reordered[0].order).toBe(0);
      expect(reordered[1].order).toBe(1);

      // 6. Delete item
      await deleteNavigationItem(created.id, superAdminSession);
      const afterDelete = await getNavigationItems({ includeHidden: true });
      expect(afterDelete.length).toBe(3);
      expect(afterDelete.some((i) => i.id === created.id)).toBe(false);
      // Normalized orders
      expect(afterDelete.map((i) => i.order)).toEqual([0, 1, 2]);
    });

    it('logs audit entries for all navigation operations', async () => {
      const db = getDb();

      const created = await createNavigationItem(
        { label: 'Audit Link', href: '/audit-test' },
        adminSession
      );
      await updateNavigationItem(created.id, { label: 'Audit Link Edited' }, adminSession);
      await reorderNavigationItems([created.id, 'nav-blog'], adminSession);
      await deleteNavigationItem(created.id, adminSession);

      const logs = await db.auditLog.findMany({
        where: { entityType: 'NAVIGATION' },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.length).toBeGreaterThanOrEqual(4);
      const actions = logs.map((l: any) => l.action);
      expect(actions).toContain('CREATE_NAVIGATION_ITEM');
      expect(actions).toContain('UPDATE_NAVIGATION_ITEM');
      expect(actions).toContain('REORDER_NAVIGATION_ITEMS');
      expect(actions).toContain('DELETE_NAVIGATION_ITEM');
    });

    it('dual-persists navigation changes to globalSettings table', async () => {
      const db = getDb();

      await createNavigationItem(
        { label: 'Persistent Hub', href: '/image-tools' },
        superAdminSession
      );

      const rawSettings = await db.globalSettings.findUnique({ where: { id: 'default' } });
      const socialLinks = rawSettings?.socialLinks as any;
      const storedNav = socialLinks?.__header?.headerNav;

      expect(Array.isArray(storedNav)).toBe(true);
      expect(storedNav.some((n: any) => n.label === 'Persistent Hub')).toBe(true);
    });

    it('returns 404 error when attempting to update or delete non-existent item ID', async () => {
      await expect(
        updateNavigationItem('non-existent-id', { label: 'Fail' }, superAdminSession)
      ).rejects.toThrow(/not found/i);

      await expect(
        deleteNavigationItem('non-existent-id', superAdminSession)
      ).rejects.toThrow(/not found/i);
    });

    it('rejects reordering with duplicate IDs or non-existent IDs', async () => {
      // Duplicate IDs rejected
      await expect(
        reorderNavigationItems(['nav-blog', 'nav-blog'], superAdminSession)
      ).rejects.toThrow(/duplicate/i);

      // Non-existent ID rejected
      await expect(
        reorderNavigationItems(['non-existent-id', 'nav-blog'], superAdminSession)
      ).rejects.toThrow(/not found/i);
    });

    it('ensures transactional rollback if an error occurs during mutation', async () => {
      const db = getDb();
      const initialItems = await db.navigationItem.findMany({ where: { menu: 'header' } });
      const initialCount = initialItems.length;

      // Mock globalSettings.upsert to throw an error inside transaction
      const origUpsert = db.globalSettings.upsert;
      db.globalSettings.upsert = vi.fn().mockRejectedValueOnce(new Error('Simulated DB Crash'));

      await expect(
        createNavigationItem({ label: 'Doomed Link', href: '/doomed' }, superAdminSession)
      ).rejects.toThrow(/Simulated DB Crash/);

      // Restore
      db.globalSettings.upsert = origUpsert;

      // Verify no orphan record exists in navigation_items table
      const afterItems = await db.navigationItem.findMany({ where: { menu: 'header' } });
      expect(afterItems.length).toBe(initialCount);
      expect(afterItems.some((i: any) => i.label === 'Doomed Link')).toBe(false);
    });

    it('ensures deletion and sequential re-indexing roll back atomically if secondary write fails', async () => {
      const db = getDb();
      const initialItems = await db.navigationItem.findMany({
        where: { menu: 'header' },
        orderBy: { order: 'asc' },
      });
      const initialIds = initialItems.map((i: any) => i.id);

      // Target first item for deletion
      const targetId = initialIds[0];

      // Mock globalSettings.upsert to fail
      const origUpsert = db.globalSettings.upsert;
      db.globalSettings.upsert = vi.fn().mockRejectedValueOnce(new Error('Secondary write failed during delete'));

      await expect(
        deleteNavigationItem(targetId, superAdminSession)
      ).rejects.toThrow(/Secondary write failed during delete/);

      // Restore
      db.globalSettings.upsert = origUpsert;

      // Verify item was restored and all orders remain identical
      const afterItems = await db.navigationItem.findMany({
        where: { menu: 'header' },
        orderBy: { order: 'asc' },
      });
      expect(afterItems.map((i: any) => i.id)).toEqual(initialIds);
      expect(afterItems.map((i: any) => i.order)).toEqual(initialItems.map((i: any) => i.order));
    });

    it('ensures reordering rolls back atomically if secondary write fails', async () => {
      const db = getDb();
      const initialItems = await db.navigationItem.findMany({
        where: { menu: 'header' },
        orderBy: { order: 'asc' },
      });
      const initialIds = initialItems.map((i: any) => i.id);
      const reversedIds = [...initialIds].reverse();

      // Mock globalSettings.upsert to fail
      const origUpsert = db.globalSettings.upsert;
      db.globalSettings.upsert = vi.fn().mockRejectedValueOnce(new Error('Secondary write failed during reorder'));

      await expect(
        reorderNavigationItems(reversedIds, superAdminSession)
      ).rejects.toThrow(/Secondary write failed during reorder/);

      // Restore
      db.globalSettings.upsert = origUpsert;

      // Verify orders remain in their original pre-reorder state
      const afterItems = await db.navigationItem.findMany({
        where: { menu: 'header' },
        orderBy: { order: 'asc' },
      });
      expect(afterItems.map((i: any) => i.id)).toEqual(initialIds);
      expect(afterItems.map((i: any) => i.order)).toEqual(initialItems.map((i: any) => i.order));
    });
  });

  // =========================================================================
  // 4. Backward Compatibility & Fallback
  // =========================================================================
  describe('4. Backward Compatibility & Fallback', () => {
    it('returns DEFAULT_HEADER_NAV when database navigation table is completely empty', async () => {
      const db = getDb();
      await db.navigationItem.deleteMany();
      await db.globalSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default', siteName: 'Convert24', siteUrl: 'https://convert24.local', socialLinks: {} as any },
        update: { socialLinks: {} as any },
      });

      const items = await getNavigationItems();
      expect(items.length).toBe(DEFAULT_HEADER_NAV.length);
      expect(items.map((i) => i.label)).toEqual(DEFAULT_HEADER_NAV.map((i) => i.label));
    });

    it('returns empty list when all items in DB are hidden', async () => {
      const db = getDb();
      // Hide all seeded items
      const existing = await db.navigationItem.findMany({ where: { menu: 'header' } });
      for (const item of existing) {
        await db.navigationItem.update({
          where: { id: item.id },
          data: { visible: false },
        });
      }

      // Public view should be empty
      const publicItems = await getNavigationItems({ includeHidden: false });
      expect(publicItems.length).toBe(0);

      // Admin view should still show all 3 hidden items
      const adminItems = await getNavigationItems({ includeHidden: true });
      expect(adminItems.length).toBe(3);
    });
  });

  // =========================================================================
  // 5. Public Header SSR Rendering & HTML Output
  // =========================================================================
  describe('5. Public Header Rendering & Accessibility', () => {
    it('renders custom CMS navigation items into public Header output', () => {
      const customNav: HeaderNavItem[] = [
        { id: '1', label: 'Image Converter', href: '/image-tools', order: 1, visible: true },
        { id: '2', label: 'Documentation', href: 'https://docs.convert24.local', order: 2, visible: true, openNewTab: true },
        { id: '3', label: 'Hidden Feature', href: '/secret', order: 3, visible: false },
      ];

      const html = renderToString(React.createElement(Header as any, { initialSettings: { headerNav: customNav } }));

      // Visible items rendered
      expect(html).toContain('Image Converter');
      expect(html).toContain('href="/image-tools"');
      expect(html).toContain('Documentation');
      expect(html).toContain('href="https://docs.convert24.local"');

      // Hidden item NOT rendered
      expect(html).not.toContain('Hidden Feature');
      expect(html).not.toContain('href="/secret"');

      // External link attributes
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('falls back to DEFAULT_HEADER_NAV when initialSettings has no headerNav', () => {
      const html = renderToString(React.createElement(Header as any, { initialSettings: {} }));
      for (const item of DEFAULT_HEADER_NAV) {
        expect(html).toContain(item.label);
      }
    });

    it('renders an empty navigation bar when headerNav is explicitly set to empty array', () => {
      const html = renderToString(React.createElement(Header as any, { initialSettings: { headerNav: [] } }));
      // Should not resurrect default links
      expect(html).not.toContain('nav-blog');
      expect(html).not.toContain('nav-pricing');
    });
  });
});
