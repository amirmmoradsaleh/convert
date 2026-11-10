import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { listTags, createTag } from '@/lib/admin/services/blog.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const tags = await listTags();
  return NextResponse.json({ tags });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const tag = await createTag(body, auth.user);
    return NextResponse.json({ tag, success: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create tag.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
