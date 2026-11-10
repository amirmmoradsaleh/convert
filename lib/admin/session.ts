import { SignJWT, jwtVerify } from 'jose';
import { AdminUserSession } from './types';
import type { NextRequest } from 'next/server';

export class JwtConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtConfigError';
  }
}

export const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || 'admin_session';
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

export const DEV_FALLBACK_JWT_SECRET = 'fallback-dev-secret-only-for-local-testing-min-32-chars';

export function getJwtSecret(): Uint8Array {
  const rawSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!rawSecret) {
      throw new JwtConfigError(
        'Authentication configuration error: ADMIN_JWT_SECRET environment variable is missing in production.'
      );
    }
    const cleanSecret = rawSecret.trim();
    if (!cleanSecret || cleanSecret === DEV_FALLBACK_JWT_SECRET) {
      throw new JwtConfigError(
        'Authentication configuration error: ADMIN_JWT_SECRET must not use development fallback in production.'
      );
    }
    if (cleanSecret.length < 32) {
      throw new JwtConfigError(
        'Authentication configuration error: ADMIN_JWT_SECRET must be at least 32 characters in production.'
      );
    }
    return new TextEncoder().encode(cleanSecret);
  }

  // Development & testing environment
  const secret = rawSecret?.trim() || DEV_FALLBACK_JWT_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Creates and signs an admin session token.
 */
export async function createSessionToken(user: AdminUserSession): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret);
}

/**
 * Verifies an admin session token and returns the authenticated user payload.
 */
export async function verifySessionToken(token: string): Promise<AdminUserSession | null> {
  if (!token) return null;
  const secret = getJwtSecret(); // Throws JwtConfigError if invalid in production
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || !payload.email || !payload.role) {
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email as string,
      name: (payload.name as string) || '',
      role: payload.role as AdminUserSession['role'],
    };
  } catch (err) {
    if (err instanceof JwtConfigError || (err instanceof Error && err.name === 'JwtConfigError')) {
      throw err;
    }
    return null;
  }
}

/**
 * Robustly parses boolean-like environment variable values.
 * Handles casing, quotes, numeric flags ('1'/'0'), and common aliases ('true'/'false', 'yes'/'no', 'on'/'off').
 */
export function parseBooleanEnv(val?: string | null): boolean | undefined {
  if (val === undefined || val === null) return undefined;
  const normalized = String(val).trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

/**
 * Resolves whether the session cookie should include the 'Secure' attribute.
 *
 * Rules:
 * 1. Explicit COOKIE_SECURE environment setting takes highest precedence.
 * 2. If TRUST_PROXY=true and request is provided, inspect X-Forwarded-Proto.
 *    (Untrusted X-Forwarded-Proto headers are ignored when TRUST_PROXY is false).
 * 3. Default: Secure in production (NODE_ENV === 'production'), Insecure otherwise.
 */
export function resolveCookieSecure(req?: NextRequest | Request): boolean {
  const explicit = parseBooleanEnv(process.env.COOKIE_SECURE);
  if (explicit !== undefined) {
    return explicit;
  }

  const isTrustProxy = parseBooleanEnv(process.env.TRUST_PROXY) === true;
  if (isTrustProxy && req) {
    const forwardedProto = req.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      const proto = forwardedProto.split(',')[0].trim().toLowerCase();
      return proto === 'https';
    }
  }

  return process.env.NODE_ENV === 'production';
}

/**
 * Canonical session cookie options for setting the authentication cookie.
 */
export function getSessionCookieOptions(req?: NextRequest | Request) {
  return {
    name: ADMIN_COOKIE_NAME,
    httpOnly: true,
    secure: resolveCookieSecure(req),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_SECONDS,
  };
}

/**
 * Canonical options for expiring/clearing the session cookie upon logout.
 * Uses identical attributes (name, path, sameSite, secure) to ensure reliable browser deletion.
 */
export function getExpireSessionCookieOptions(req?: NextRequest | Request) {
  return {
    ...getSessionCookieOptions(req),
    value: '',
    maxAge: 0,
  };
}

/**
 * Shared cookie options object with dynamic property getters for backwards compatibility.
 */
export const sessionCookieOptions = {
  get name() {
    return ADMIN_COOKIE_NAME;
  },
  get httpOnly() {
    return true;
  },
  get secure() {
    return resolveCookieSecure();
  },
  get sameSite() {
    return 'lax' as const;
  },
  get path() {
    return '/';
  },
  get maxAge() {
    return SESSION_DURATION_SECONDS;
  },
};
