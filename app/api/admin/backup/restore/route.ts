import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { restoreCmsBackup } from '@/lib/admin/services/backup.service';
import { CMS_BACKUP_MAX_PAYLOAD_SIZE } from '@/lib/admin/types';
import { readBoundedRequestBody } from '@/lib/admin/body-reader';
import { handleAdminApiError } from '@/lib/admin/api-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/backup/restore
 * Restores CMS content from an allowlisted, pre-validated backup inside a single database transaction.
 * Requires MANAGE_SETTINGS permission and explicit confirmation.
 */
export async function POST(req: NextRequest) {
  const authCheck = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (authCheck.errorResponse) {
    return authCheck.errorResponse;
  }

  try {
    const bodyResult = await readBoundedRequestBody(req, CMS_BACKUP_MAX_PAYLOAD_SIZE);
    if (bodyResult.errorResponse) {
      return bodyResult.errorResponse;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(bodyResult.text || '');
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON: Backup file is not well-formed JSON syntax.' },
        { status: 400 }
      );
    }

    // Determine backup payload vs wrapper
    const backupData = parsed.backup || (parsed.exportFormat ? parsed : null);
    if (!backupData) {
      return NextResponse.json(
        { error: 'Missing backup data in restore request.' },
        { status: 400 }
      );
    }

    // Require explicit confirmation
    if (parsed.confirm !== true && parsed.confirmed !== true) {
      return NextResponse.json(
        {
          error:
            'Confirmation required: You must explicitly set { confirm: true } to apply CMS backup restore.',
        },
        { status: 400 }
      );
    }

    const result = await restoreCmsBackup(backupData, authCheck.user);

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error('[CMS Backup Restore Error]', err);
    return handleAdminApiError(err);
  }
}
