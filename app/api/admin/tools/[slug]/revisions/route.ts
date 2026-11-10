import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getToolRevisions } from '@/lib/admin/services/tool.service';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug } = await params;
  try {
    const revisions = await getToolRevisions(slug);
    return NextResponse.json({ success: true, revisions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve revisions.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
