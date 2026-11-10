import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { schedulePost } from '@/lib/admin/services/blog.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'PUBLISH_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    const body = await req.json();
    if (!body.scheduledFor) {
      return NextResponse.json({ error: 'Field "scheduledFor" is required.' }, { status: 400 });
    }
    const post = await schedulePost(id, body.scheduledFor, auth.user);
    return NextResponse.json({ post, success: true, message: `Blog post scheduled for ${post.scheduledFor}.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to schedule blog post.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
