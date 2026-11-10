/**
 * Environment Validation Utility for Production Hardening.
 * Validates critical environment settings at runtime without exposing secret values in logs.
 */

export interface EnvValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProductionEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  // 1. ADMIN_JWT_SECRET
  const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (isProd) {
    if (!jwtSecret) {
      errors.push('ADMIN_JWT_SECRET is missing in production.');
    } else {
      const cleanSecret = jwtSecret.trim();
      if (cleanSecret === 'fallback-dev-secret-only-for-local-testing-min-32-chars') {
        errors.push('ADMIN_JWT_SECRET uses known development fallback string in production.');
      } else if (cleanSecret.length < 32) {
        errors.push('ADMIN_JWT_SECRET is shorter than 32 characters in production.');
      }
    }
  } else if (!jwtSecret) {
    warnings.push('ADMIN_JWT_SECRET is unset; using local development fallback secret.');
  }

  // 2. DATABASE_URL
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (isProd) {
    if (!dbUrl) {
      errors.push('DATABASE_URL is missing in production.');
    } else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      errors.push('DATABASE_URL invalid protocol (must start with postgresql:// or postgres://) in production.');
    }
  } else if (!dbUrl) {
    warnings.push('DATABASE_URL is unset; using in-memory development repository.');
  }

  // 3. NEXT_PUBLIC_SITE_URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (isProd) {
    if (!siteUrl || siteUrl === 'https://example.com') {
      warnings.push('NEXT_PUBLIC_SITE_URL is unset or using example.com placeholder in production.');
    }
  }

  // 4. TRUST_PROXY
  const trustProxy = process.env.TRUST_PROXY?.trim()?.toLowerCase();
  if (isProd && !['true', '1', 'yes', 'on'].includes(trustProxy || '')) {
    warnings.push('TRUST_PROXY is not enabled. Forwarded headers (X-Forwarded-Proto) will be ignored unless explicitly configured.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
