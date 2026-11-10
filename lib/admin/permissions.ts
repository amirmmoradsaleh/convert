import { AdminRole, AdminPermission } from './types';

/**
 * Mapping of permissions granted to each canonical role.
 */
const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  SUPER_ADMIN: new Set<AdminPermission>([
    'MANAGE_USERS',
    'MANAGE_SETTINGS',
    'PUBLISH_CONTENT',
    'EDIT_CONTENT',
    'MANAGE_MEDIA',
    'MANAGE_SEO',
    'VIEW_AUDIT_LOGS',
    'VIEW_CMS',
  ]),
  ADMIN: new Set<AdminPermission>([
    'MANAGE_SETTINGS',
    'PUBLISH_CONTENT',
    'EDIT_CONTENT',
    'MANAGE_MEDIA',
    'MANAGE_SEO',
    'VIEW_AUDIT_LOGS',
    'VIEW_CMS',
  ]),
  CONTENT_MANAGER: new Set<AdminPermission>([
    'PUBLISH_CONTENT',
    'EDIT_CONTENT',
    'MANAGE_MEDIA',
    'MANAGE_SEO',
    'VIEW_CMS',
  ]),
  EDITOR: new Set<AdminPermission>([
    'EDIT_CONTENT',
    'VIEW_CMS',
  ]),
  VIEWER: new Set<AdminPermission>([
    'VIEW_CMS',
  ]),
};

/**
 * Server-side permission validator.
 */
export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) {
    return false;
  }
  return permissions.has(permission);
}

/**
 * Returns all permissions granted to a given role.
 */
export function getPermissionsForRole(role: AdminRole): AdminPermission[] {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? Array.from(permissions) : [];
}
