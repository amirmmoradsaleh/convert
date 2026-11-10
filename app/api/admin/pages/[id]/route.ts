import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { hasPermission } from '@/lib/admin/permissions';
import { getPageById, getPageBySlug, updateDraftPage, deletePage } from '@/lib/admin/services/page.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function resolvePageRecord(id: string) {
  let page = await getPageById(id);
  if (!page) {
    const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
    page = await getPageBySlug(slugCandidate);
  }
  return page;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  const page = await resolvePageRecord(id);

  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return NextResponse.json({ page });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    const body = await req.json();
    const existing = await resolvePageRecord(id);

    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (existing.status === 'PUBLISHED' && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to modify published pages.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    if (body.status === 'PUBLISHED' && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to publish pages.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    const updated = await updateDraftPage(existing.id, body, auth.user);
    return NextResponse.json({ page: updated });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    const existing = await resolvePageRecord(id);

    if (!existing) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (existing.status === 'PUBLISHED' && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to delete published pages.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    const result = await deletePage(existing.id, auth.user);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

