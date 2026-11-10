import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { hasPermission } from '@/lib/admin/permissions';
import { getPages, getPageBySlug, createDraftPage } from '@/lib/admin/services/page.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get('status') as 'DRAFT' | 'PUBLISHED' | null;
  const slugParam = searchParams.get('slug');

  try {
    if (slugParam) {
      const page = await getPageBySlug(slugParam);
      return NextResponse.json({ page });
    }

    const pages = await getPages({ status: statusParam || undefined });
    return NextResponse.json({ pages });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    if (body.status === 'PUBLISHED' && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to create published pages.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    const page = await createDraftPage(body, auth.user);
    return NextResponse.json({ page }, { status: 201 });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

