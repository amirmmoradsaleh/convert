import { getDb } from '@/lib/db';
import { verifyPassword } from '../crypto';
import { createSessionToken } from '../session';
import { createAuditLog } from './audit.service';
import { AdminUserSession } from '../types';

export interface LoginResult {
  user: AdminUserSession;
  token: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function loginAdmin(credentials: {
  email?: string;
  password?: string;
}): Promise<LoginResult> {
  const email = credentials.email?.trim().toLowerCase();
  const password = credentials.password;

  if (!email || !password) {
    throw new Error('Please enter both email and password.');
  }

  const db = getDb();
  const user = await db.adminUser.findUnique({
    where: { email },
  });

  if (!user) {
    await createAuditLog({
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      metadata: { email, reason: 'user_not_found' },
    });
    throw new Error('Invalid email or password.');
  }

  if (!user.isActive) {
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_BLOCKED',
      entityType: 'AUTH',
      metadata: { email, reason: 'inactive_account' },
    });
    throw new Error('Your administrative account has been deactivated. Please contact a super administrator.');
  }

  const now = new Date();

  // Check if account is currently locked
  if (user.lockedUntil && new Date(user.lockedUntil) > now) {
    const remainingMins = Math.ceil((new Date(user.lockedUntil).getTime() - now.getTime()) / 60000);
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_LOCKED',
      entityType: 'AUTH',
      metadata: { email, reason: 'account_locked', remainingMinutes: remainingMins },
    });
    throw new Error(`Account is temporarily locked due to repeated failed login attempts. Please try again in ${remainingMins} minute${remainingMins === 1 ? '' : 's'}.`);
  }

  const isMatch = await verifyPassword(password, user.passwordHash);
  if (!isMatch) {
    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const isNowLocked = newAttempts >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = isNowLocked ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

    await db.adminUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: isNowLocked ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      entityType: 'AUTH',
      metadata: {
        email,
        reason: 'incorrect_password',
        failedAttempts: newAttempts,
        isLocked: isNowLocked,
      },
    });

    if (isNowLocked) {
      throw new Error('Account is temporarily locked due to repeated failed login attempts. Please try again in 15 minutes.');
    }

    throw new Error('Invalid email or password.');
  }

  // On successful login, reset failed attempts & update lastLoginAt
  await db.adminUser.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  const sessionUser: AdminUserSession = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AdminUserSession['role'],
  };

  const token = await createSessionToken(sessionUser);

  await createAuditLog({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'AUTH',
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });

  return {
    user: sessionUser,
    token,
  };
}

export async function logoutAdmin(user: AdminUserSession): Promise<void> {
  await createAuditLog({
    userId: user.id,
    action: 'LOGOUT',
    entityType: 'AUTH',
    entityId: user.id,
    metadata: { email: user.email },
  });
}

export async function getAdminProfile(userId: string) {
  const db = getDb();
  const user = await db.adminUser.findUnique({
    where: { id: userId },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
