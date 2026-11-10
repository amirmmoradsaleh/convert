import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { unpublishPage } from '@/lib/admin/services/page.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'PUBLISH_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    const page = await unpublishPage(id, auth.user);
    return NextResponse.json({ page, message: 'Page unpublished successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to unpublish page.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
