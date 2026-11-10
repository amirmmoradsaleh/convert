import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { restoreRevision, getRevision } from '@/lib/admin/services/blog.service';

interface RouteParams {
  params: Promise<{ id: string; revisionId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { revisionId } = await params;
  const revision = await getRevision(revisionId);
  if (!revision) {
    return NextResponse.json({ error: `Revision '${revisionId}' not found.` }, { status: 404 });
  }

  return NextResponse.json({ revision });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id, revisionId } = await params;
  try {
    const restored = await restoreRevision(id, revisionId, auth.user);
    return NextResponse.json({
      post: restored,
      success: true,
      message: `Revision '${revisionId}' restored successfully.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to restore revision.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
