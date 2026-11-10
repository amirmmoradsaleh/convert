import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verifySessionToken, JwtConfigError } from './session';
import { hasPermission } from './permissions';
import { AdminPermission, AdminUserSession } from './types';
import { getDb } from '@/lib/db';

export type AdminAuthVerificationResult =
  | { success: true; user: AdminUserSession }
  | {
      success: false;
      failureType: 'missing_token' | 'invalid_token' | 'user_not_found' | 'user_disabled';
      message: string;
      httpStatus: 401;
    }
  | {
      success: false;
      failureType: 'infrastructure_error';
      message: string;
      httpStatus: 500 | 503;
      error?: unknown;
    };

/**
 * Detailed verification of an administrative session.
 * Distinguishes between:
 * - 401: Missing token, invalid/expired token, deleted account, deactivated account.
 * - 500: JWT authentication configuration error.
 * - 503: Database / infrastructure failure.
 */
export async function verifyAdminSession(
  req: NextRequest
): Promise<AdminAuthVerificationResult> {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  let token = cookie?.value;

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return {
      success: false,
      failureType: 'missing_token',
      message: 'Unauthorized: Authentication required to access administrative API.',
      httpStatus: 401,
    };
  }

  try {
    const session = await verifySessionToken(token);
    if (!session) {
      return {
        success: false,
        failureType: 'invalid_token',
        message: 'Unauthorized: Administrative session token is invalid or expired.',
        httpStatus: 401,
      };
    }

    // Verify that the user still exists and is active in the database
    const db = getDb();
    let user = await db.adminUser.findUnique({
      where: { id: session.id },
    });

    // Also try lookup by email if id differed between seeds/environments
    if (!user && session.email) {
      user = await db.adminUser.findUnique({
        where: { email: session.email },
      });
    }

    if (!user) {
      // User does not exist in the database (deleted or removed).
      // Security rule: Never silently authorize deleted accounts!
      return {
        success: false,
        failureType: 'user_not_found',
        message: 'Unauthorized: Administrative account not found or has been removed.',
        httpStatus: 401,
      };
    }

    if (!user.isActive) {
      // User account is deactivated
      return {
        success: false,
        failureType: 'user_disabled',
        message: 'Unauthorized: Administrative account has been deactivated.',
        httpStatus: 401,
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as AdminUserSession['role'],
      },
    };
  } catch (err: unknown) {
    if (err instanceof JwtConfigError || (err instanceof Error && err.name === 'JwtConfigError')) {
      return {
        success: false,
        failureType: 'infrastructure_error',
        message: 'Authentication configuration error. Please contact system administrator.',
        httpStatus: 500,
        error: err,
      };
    }

    console.error('[Admin Guard] Database verification failed due to infrastructure error:', err);
    return {
      success: false,
      failureType: 'infrastructure_error',
      message: 'Administrative service temporarily unavailable. Please retry shortly.',
      httpStatus: 503,
      error: err,
    };
  }
}

export async function getAuthenticatedAdmin(
  req: NextRequest
): Promise<AdminUserSession | null> {
  const result = await verifyAdminSession(req);
  return result.success ? result.user : null;
}

export type AuthCheckResult =
  | { user: AdminUserSession; errorResponse?: never }
  | { user?: never; errorResponse: NextResponse };

export async function requireAdminAuth(
  req: NextRequest,
  requiredPermission?: AdminPermission
): Promise<AuthCheckResult> {
  const result = await verifyAdminSession(req);

  if (!result.success) {
    return {
      errorResponse: NextResponse.json(
        { error: result.message, failureType: result.failureType },
        { status: result.httpStatus }
      ),
    };
  }

  if (requiredPermission && !hasPermission(result.user.role, requiredPermission)) {
    return {
      errorResponse: NextResponse.json(
        {
          error: `Forbidden: Role '${result.user.role}' does not have the '${requiredPermission}' permission.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      ),
    };
  }

  return { user: result.user };
}
