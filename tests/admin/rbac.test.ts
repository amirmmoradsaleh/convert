import { describe, it, expect } from 'vitest';
import { hasPermission, getPermissionsForRole } from '@/lib/admin/permissions';
import { AdminPermission } from '@/lib/admin/types';

describe('Admin CMS Phase 01 — RBAC & Permissions', () => {
  describe('SUPER_ADMIN Role', () => {
    it('has all administrative permissions', () => {
      const allPermissions: AdminPermission[] = [
        'MANAGE_USERS',
        'MANAGE_SETTINGS',
        'PUBLISH_CONTENT',
        'EDIT_CONTENT',
        'MANAGE_MEDIA',
        'MANAGE_SEO',
        'VIEW_AUDIT_LOGS',
        'VIEW_CMS',
      ];

      for (const p of allPermissions) {
        expect(hasPermission('SUPER_ADMIN', p)).toBe(true);
      }
    });
  });

  describe('ADMIN Role', () => {
    it('has full CMS administration except MANAGE_USERS', () => {
      expect(hasPermission('ADMIN', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('ADMIN', 'MANAGE_SETTINGS')).toBe(true);
      expect(hasPermission('ADMIN', 'PUBLISH_CONTENT')).toBe(true);
      expect(hasPermission('ADMIN', 'EDIT_CONTENT')).toBe(true);
      expect(hasPermission('ADMIN', 'MANAGE_MEDIA')).toBe(true);
      expect(hasPermission('ADMIN', 'MANAGE_SEO')).toBe(true);
      expect(hasPermission('ADMIN', 'VIEW_AUDIT_LOGS')).toBe(true);
      expect(hasPermission('ADMIN', 'VIEW_CMS')).toBe(true);
    });
  });

  describe('CONTENT_MANAGER Role', () => {
    it('can publish content, edit, manage SEO and media, but cannot manage users, settings or view audit logs', () => {
      expect(hasPermission('CONTENT_MANAGER', 'PUBLISH_CONTENT')).toBe(true);
      expect(hasPermission('CONTENT_MANAGER', 'EDIT_CONTENT')).toBe(true);
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_MEDIA')).toBe(true);
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_SEO')).toBe(true);
      expect(hasPermission('CONTENT_MANAGER', 'VIEW_CMS')).toBe(true);

      // Blocked
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('CONTENT_MANAGER', 'MANAGE_SETTINGS')).toBe(false);
      expect(hasPermission('CONTENT_MANAGER', 'VIEW_AUDIT_LOGS')).toBe(false);
    });
  });

  describe('EDITOR Role', () => {
    it('can edit content and view CMS, but cannot publish or manage settings', () => {
      expect(hasPermission('EDITOR', 'EDIT_CONTENT')).toBe(true);
      expect(hasPermission('EDITOR', 'VIEW_CMS')).toBe(true);

      // Blocked
      expect(hasPermission('EDITOR', 'PUBLISH_CONTENT')).toBe(false);
      expect(hasPermission('EDITOR', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('EDITOR', 'MANAGE_SETTINGS')).toBe(false);
      expect(hasPermission('EDITOR', 'VIEW_AUDIT_LOGS')).toBe(false);
    });
  });

  describe('VIEWER Role', () => {
    it('has read-only access to view CMS, but cannot edit, publish, or configure', () => {
      expect(hasPermission('VIEWER', 'VIEW_CMS')).toBe(true);

      // Blocked
      expect(hasPermission('VIEWER', 'EDIT_CONTENT')).toBe(false);
      expect(hasPermission('VIEWER', 'PUBLISH_CONTENT')).toBe(false);
      expect(hasPermission('VIEWER', 'MANAGE_USERS')).toBe(false);
      expect(hasPermission('VIEWER', 'MANAGE_SETTINGS')).toBe(false);
      expect(hasPermission('VIEWER', 'VIEW_AUDIT_LOGS')).toBe(false);
    });
  });

  describe('Permission Retrieval Helper', () => {
    it('returns array of granted permissions for role', () => {
      const perms = getPermissionsForRole('EDITOR');
      expect(perms).toContain('EDIT_CONTENT');
      expect(perms).toContain('VIEW_CMS');
      expect(perms).not.toContain('PUBLISH_CONTENT');
    });
  });
});
