import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { unpublishPost } from '@/lib/admin/services/blog.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'PUBLISH_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    const post = await unpublishPost(id, auth.user);
    return NextResponse.json({ post, success: true, message: `Blog post '${post.title}' unpublished successfully.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to unpublish blog post.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
