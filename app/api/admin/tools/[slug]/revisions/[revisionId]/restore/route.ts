import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { restoreToolRevision } from '@/lib/admin/services/tool.service';

interface RouteParams {
  params: Promise<{ slug: string; revisionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'PUBLISH_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug, revisionId } = await params;
  try {
    const restored = await restoreToolRevision(slug, revisionId, auth.user);
    return NextResponse.json({ success: true, toolContent: restored });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to restore revision.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
