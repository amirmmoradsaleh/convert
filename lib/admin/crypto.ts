import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with strong salt rounds.
 */
export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || plainText.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a bcrypt hash.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  if (!plainText || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(plainText, hash);
  } catch {
    return false;
  }
}

/**
 * Generates a cryptographically secure 64-character hex token for password resets.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes a SHA-256 hash of a reset token for secure database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

