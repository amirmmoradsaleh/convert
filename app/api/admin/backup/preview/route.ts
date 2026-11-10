import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { validateAndPreviewBackup } from '@/lib/admin/services/backup.service';
import { CMS_BACKUP_MAX_PAYLOAD_SIZE } from '@/lib/admin/types';
import { readBoundedRequestBody } from '@/lib/admin/body-reader';
import { handleAdminApiError } from '@/lib/admin/api-error';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/backup/preview
 * Validates and calculates planned changes (create vs update counts) for an uploaded backup without writing to DB.
 * Requires MANAGE_SETTINGS permission.
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyResult.text || '');
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON: Backup file is not well-formed JSON syntax.' },
        { status: 400 }
      );
    }

    const preview = await validateAndPreviewBackup(parsed);

    return NextResponse.json(preview, { status: 200 });
  } catch (err: unknown) {
    console.error('[CMS Backup Preview Error]', err);
    return handleAdminApiError(err);
  }
}
