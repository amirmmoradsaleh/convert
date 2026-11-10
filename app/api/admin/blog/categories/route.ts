import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { listCategories, createCategory } from '@/lib/admin/services/blog.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const categories = await listCategories();
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const category = await createCategory(body, auth.user);
    return NextResponse.json({ category, success: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create category.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
