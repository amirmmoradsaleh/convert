import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getPageRevisions, getPageById } from '@/lib/admin/services/page.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  let page = await getPageById(id);
  if (!page) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    page = await getPageById(slugCandidate);
  }

  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const revisions = await getPageRevisions(page.id);
  return NextResponse.json({ revisions });
}
