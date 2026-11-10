import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getAuditLogs } from '@/lib/admin/services/audit.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_AUDIT_LOGS');
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const userId = searchParams.get('userId') || undefined;
  const entityType = searchParams.get('entityType') || undefined;

  const data = await getAuditLogs({ limit, offset, userId, entityType });
  return NextResponse.json(data);
}
