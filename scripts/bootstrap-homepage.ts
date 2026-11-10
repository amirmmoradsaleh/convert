/**
 * Convert24 — Phase 10B: Homepage Bootstrap Script
 *
 * Explicit, idempotent CLI command to initialize the reserved 'home' page record
 * in the active database (PostgreSQL via Prisma or in-memory repository).
 *
 * Safety Guarantees:
 * 1. Idempotent: repeated runs never duplicate or overwrite an existing homepage.
 * 2. Preserves existing content, SEO settings, publication status, IDs, and revisions.
 * 3. Never deletes or resets existing Pages CMS data.
 * 4. Fails safely if PostgreSQL is unreachable or DATABASE_URL is misconfigured.
 * 5. Does not log secrets or credentials.
 *
 * Usage:
 *   node scripts/bootstrap-homepage.ts
 */

import { bootstrapHomepage } from '@/lib/admin/services/page.service';

async function run() {
  console.log('[Bootstrap] Initializing Convert24 reserved homepage record...');

  try {
    const result = await bootstrapHomepage({
      id: 'system-bootstrap',
      email: 'system@convert24.local',
      name: 'System Bootstrap',
      role: 'SUPER_ADMIN',
    });

    console.log(`[Bootstrap] Status: ${result.created ? 'CREATED' : 'ALREADY_EXISTS'}`);
    console.log(`[Bootstrap] Message: ${result.message}`);
    console.log(`[Bootstrap] Page Record: ID=${result.page?.id}, Slug=${result.page?.slug}, Status=${result.page?.status}`);

    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Bootstrap] Initialization failed: ${message}`);
    process.exit(1);
  }
}

run();
