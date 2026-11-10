import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getToolRevisionById } from '@/lib/admin/services/tool.service';

interface RouteParams {
  params: Promise<{ slug: string; revisionId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug, revisionId } = await params;
  try {
    const revision = await getToolRevisionById(slug, revisionId);
    if (!revision) {
      return NextResponse.json({ error: 'Revision not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, revision });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve revision.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
