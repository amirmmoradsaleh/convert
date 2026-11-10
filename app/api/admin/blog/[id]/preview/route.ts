import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getPreviewPostById } from '@/lib/cms/blog-resolver';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  const post = await getPreviewPostById(id);
  if (!post) {
    return NextResponse.json({ error: `Blog post '${id}' not found.` }, { status: 404 });
  }

  return NextResponse.json({ post, preview: true });
}
