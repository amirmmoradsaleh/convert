import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getToolContentBySlug, upsertToolContent } from '@/lib/admin/services/tool.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug } = await params;
  const data = await getToolContentBySlug(slug);
  if (!data) {
    return NextResponse.json({ error: `Tool '${slug}' not found in canonical registry.` }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug } = await params;
  try {
    const body = await req.json();
    const updated = await upsertToolContent(slug, body, auth.user);
    return NextResponse.json({ toolContent: updated, success: true });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
