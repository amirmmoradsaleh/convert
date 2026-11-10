import { getDb } from '@/lib/db';
import { hashPassword, generateSecureToken, hashToken } from '../crypto';
import { createAuditLog } from './audit.service';
import {
  AdminUserItem,
  CreateAdminUserInput,
  UpdateAdminUserInput,
  ListAdminUsersOptions,
  AdminUserSession,
} from '../types';

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'CONTENT_MANAGER', 'EDITOR', 'VIEWER'] as const;

function formatAdminUser(user: any): AdminUserItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: Boolean(user.isActive),
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
    failedLoginAttempts: user.failedLoginAttempts || 0,
    lockedUntil: user.lockedUntil ? new Date(user.lockedUntil).toISOString() : null,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString(),
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : new Date(user.updatedAt).toISOString(),
  };
}

/**
 * List administrative users with optional search, role filter, and status filter.
 */
export async function listAdminUsers(options?: ListAdminUsersOptions): Promise<{
  users: AdminUserItem[];
  total: number;
}> {
  const db = getDb();
  const where: any = {};

  if (options?.role) {
    where.role = options.role;
  }

  if (options?.isActive !== undefined) {
    where.isActive = options.isActive;
  }

  if (options?.search) {
    const q = options.search.trim().toLowerCase();
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { email: { contains: q } },
      ];
    }
  }

  const orderBy: any = {};
  const sortBy = options?.sortBy || 'createdAt';
  const sortOrder = options?.sortOrder || 'desc';
  orderBy[sortBy] = sortOrder;

  const [rawUsers, total] = await Promise.all([
    db.adminUser.findMany({
      where,
      orderBy,
      take: options?.limit,
      skip: options?.page && options?.limit ? (options.page - 1) * options.limit : undefined,
    }),
    db.adminUser.count({ where }),
  ]);

  return {
    users: rawUsers.map(formatAdminUser),
    total,
  };
}

/**
 * Get a single administrative user by ID.
 */
export async function getAdminUserById(id: string): Promise<AdminUserItem | null> {
  const db = getDb();
  const user = await db.adminUser.findUnique({
    where: { id },
  });

  if (!user) return null;
  return formatAdminUser(user);
}

/**
 * Create a new administrative user with validation, role restrictions, and audit logging.
 */
export async function createAdminUser(
  input: CreateAdminUserInput,
  creator: AdminUserSession
): Promise<{ user: AdminUserItem; temporaryPassword?: string }> {
  const db = getDb();

  const cleanEmail = input.email.trim().toLowerCase();
  const cleanName = input.name.trim();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('A valid email address is required.');
  }

  if (!cleanName) {
    throw new Error('Name is required.');
  }

  if (!VALID_ROLES.includes(input.role as any)) {
    throw new Error(`Invalid role '${input.role}'. Allowed roles: ${VALID_ROLES.join(', ')}`);
  }

  // Security Rule: Only SUPER_ADMIN can create/assign SUPER_ADMIN role
  if (input.role === 'SUPER_ADMIN' && creator.role !== 'SUPER_ADMIN') {
    throw new Error('Only Super Administrators can create or assign the Super Administrator role.');
  }

  // Check email uniqueness
  const existing = await db.adminUser.findUnique({
    where: { email: cleanEmail },
  });

  if (existing) {
    throw new Error(`An administrative user with email '${cleanEmail}' already exists.`);
  }

  let plainPassword = input.password;
  let isGeneratedPassword = false;

  if (!plainPassword) {
    // Generate secure temporary password
    plainPassword = `Temp-${generateSecureToken().substring(0, 12)}!Aa`;
    isGeneratedPassword = true;
  } else if (plainPassword.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const passwordHash = await hashPassword(plainPassword);

  const created = await db.adminUser.create({
    data: {
      email: cleanEmail,
      name: cleanName,
      passwordHash,
      role: input.role,
      isActive: input.isActive !== undefined ? input.isActive : true,
    },
  });

  await createAuditLog({
    userId: creator.id,
    action: 'USER_CREATED',
    entityType: 'ADMIN_USER',
    entityId: created.id,
    metadata: {
      email: created.email,
      name: created.name,
      role: created.role,
      isActive: created.isActive,
    },
  });

  return {
    user: formatAdminUser(created),
    temporaryPassword: isGeneratedPassword ? plainPassword : undefined,
  };
}

/**
 * Update an administrative user (name, email, role, active status, direct password change).
 */
export async function updateAdminUser(
  id: string,
  input: UpdateAdminUserInput,
  editor: AdminUserSession
): Promise<AdminUserItem> {
  const db = getDb();

  const target = await db.adminUser.findUnique({
    where: { id },
  });

  if (!target) {
    throw new Error(`User with ID '${id}' not found.`);
  }

  const updates: any = {};
  const auditDetails: Record<string, any> = {};

  // 1. Role Change Validation
  if (input.role && input.role !== target.role) {
    if (!VALID_ROLES.includes(input.role as any)) {
      throw new Error(`Invalid role '${input.role}'. Allowed roles: ${VALID_ROLES.join(', ')}`);
    }

    // Only SUPER_ADMIN can promote to or demote from SUPER_ADMIN
    if ((input.role === 'SUPER_ADMIN' || target.role === 'SUPER_ADMIN') && editor.role !== 'SUPER_ADMIN') {
      throw new Error('Only Super Administrators can modify Super Administrator permissions or assign the Super Administrator role.');
    }

    // Prevent demoting the final active SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && input.role !== 'SUPER_ADMIN') {
      const activeSuperAdmins = await db.adminUser.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        throw new Error('Cannot demote the final active Super Administrator. Promote another Super Administrator first.');
      }
    }

    updates.role = input.role;
    auditDetails.previousRole = target.role;
    auditDetails.newRole = input.role;
  }

  // 2. Active Status Change (Activation / Deactivation)
  if (input.isActive !== undefined && input.isActive !== target.isActive) {
    // Prevent deactivating the final active SUPER_ADMIN
    if (target.role === 'SUPER_ADMIN' && input.isActive === false) {
      const activeSuperAdmins = await db.adminUser.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });
      if (activeSuperAdmins <= 1) {
        throw new Error('Cannot deactivate the final active Super Administrator. Ensure another active Super Administrator exists.');
      }
    }

    updates.isActive = input.isActive;
    auditDetails.isActive = input.isActive;
  }

  // 3. Name update
  if (input.name !== undefined) {
    const cleanName = input.name.trim();
    if (!cleanName) {
      throw new Error('Name cannot be empty.');
    }
    updates.name = cleanName;
    auditDetails.name = cleanName;
  }

  // 4. Email update
  if (input.email !== undefined) {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('A valid email address is required.');
    }
    if (cleanEmail !== target.email.toLowerCase()) {
      const existing = await db.adminUser.findUnique({
        where: { email: cleanEmail },
      });
      if (existing && existing.id !== id) {
        throw new Error(`Email '${cleanEmail}' is already in use by another administrator.`);
      }
      updates.email = cleanEmail;
      auditDetails.email = cleanEmail;
    }
  }

  // 5. Password update (if supplied)
  if (input.password) {
    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters long.');
    }
    // Only SUPER_ADMIN or user themselves can change password directly
    if (editor.role !== 'SUPER_ADMIN' && editor.id !== id) {
      throw new Error('You do not have permission to directly change another user’s password. Use password reset instead.');
    }
    updates.passwordHash = await hashPassword(input.password);
    updates.failedLoginAttempts = 0;
    updates.lockedUntil = null;
    auditDetails.passwordChanged = true;
  }

  const updated = await db.adminUser.update({
    where: { id },
    data: updates,
  });

  const action = input.isActive !== undefined && input.isActive !== target.isActive
    ? (input.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED')
    : input.role && input.role !== target.role
    ? 'USER_ROLE_CHANGED'
    : 'USER_UPDATED';

  await createAuditLog({
    userId: editor.id,
    action,
    entityType: 'ADMIN_USER',
    entityId: updated.id,
    metadata: {
      targetEmail: updated.email,
      ...auditDetails,
    },
  });

  return formatAdminUser(updated);
}

/**
 * Deactivates or removes an administrative user with safety validation.
 */
export async function deleteAdminUser(
  id: string,
  editor: AdminUserSession
): Promise<{ success: boolean; message: string }> {
  const db = getDb();

  const target = await db.adminUser.findUnique({
    where: { id },
  });

  if (!target) {
    throw new Error(`User with ID '${id}' not found.`);
  }

  // Prevent deleting oneself while logged in
  if (editor.id === id) {
    throw new Error('You cannot delete your own account while currently logged in.');
  }

  // Prevent deleting the final active Super Admin
  if (target.role === 'SUPER_ADMIN') {
    const activeSuperAdmins = await db.adminUser.count({
      where: { role: 'SUPER_ADMIN', isActive: true },
    });
    if (activeSuperAdmins <= 1) {
      throw new Error('Cannot delete the final active Super Administrator.');
    }
  }

  // Soft deactivation to preserve audit log foreign keys and revisions
  await db.adminUser.update({
    where: { id },
    data: {
      isActive: false,
    },
  });

  await createAuditLog({
    userId: editor.id,
    action: 'USER_DEACTIVATED',
    entityType: 'ADMIN_USER',
    entityId: id,
    metadata: {
      email: target.email,
      name: target.name,
      role: target.role,
      reason: 'admin_action_delete',
    },
  });

  return {
    success: true,
    message: `User '${target.email}' has been deactivated.`,
  };
}

/**
 * Generates a cryptographically secure, single-use password reset token with 1-hour expiry.
 */
export async function generatePasswordResetToken(
  id: string,
  author: AdminUserSession
): Promise<{ resetToken: string; expiresAt: string }> {
  const db = getDb();

  const user = await db.adminUser.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error(`User with ID '${id}' not found.`);
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.adminUser.update({
    where: { id },
    data: {
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: expiresAt,
    },
  });

  await createAuditLog({
    userId: author.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'ADMIN_USER',
    entityId: id,
    metadata: {
      targetEmail: user.email,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    resetToken: rawToken,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Completes a password reset using a raw single-use token.
 */
export async function completePasswordReset(
  token: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!token || token.trim().length < 16) {
    throw new Error('Invalid or missing reset token.');
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  const db = getDb();
  const tokenHash = hashToken(token.trim());

  const user = await db.adminUser.findFirst({
    where: {
      passwordResetTokenHash: tokenHash,
    },
  });

  if (!user) {
    throw new Error('Invalid or expired password reset token.');
  }

  if (!user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt) < new Date()) {
    // Clear expired token
    await db.adminUser.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });
    throw new Error('Password reset token has expired. Please request a new one.');
  }

  if (!user.isActive) {
    throw new Error('This administrative account is deactivated. Please contact an administrator.');
  }

  const newHash = await hashPassword(newPassword);

  // Invalidate token (single use) and reset any failed attempts / lockouts
  await db.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'ADMIN_USER',
    entityId: user.id,
    metadata: {
      email: user.email,
    },
  });

  return {
    success: true,
    message: 'Your password has been successfully reset. You can now log in with your new password.',
  };
}
