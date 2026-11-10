import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getPageRevisionById } from '@/lib/admin/services/page.service';

interface RouteParams {
  params: Promise<{ id: string; revisionId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { id, revisionId } = await params;
  const revision = await getPageRevisionById(id, revisionId);
  if (!revision) {
    return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
  }

  return NextResponse.json({ revision });
}
