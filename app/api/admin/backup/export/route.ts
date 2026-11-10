import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { exportCmsBackup } from '@/lib/admin/services/backup.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup/export
 * Exports all allowlisted CMS content and settings into a downloadable JSON file.
 * Requires MANAGE_SETTINGS permission.
 */
export async function GET(req: NextRequest) {
  const authCheck = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (authCheck.errorResponse) {
    return authCheck.errorResponse;
  }

  try {
    const backup = await exportCmsBackup(authCheck.user);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `convert24-cms-backup-${dateStr}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: unknown) {
    console.error('[CMS Backup Export Error]', err);
    return handleAdminApiError(err);
  }
}
