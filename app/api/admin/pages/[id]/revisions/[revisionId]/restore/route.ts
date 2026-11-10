import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { hasPermission } from '@/lib/admin/permissions';
import { restorePageRevision, getPageById, getPageBySlug } from '@/lib/admin/services/page.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ id: string; revisionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id, revisionId } = await params;
  try {
    let page = await getPageById(id);
    if (!page) {
      const slugCandidate = id.startsWith('page-') ? id.replace(/^page-/, '') : id;
      page = await getPageBySlug(slugCandidate);
    }
    if (!page) {
      return NextResponse.json({ error: `Page not found: ${id}` }, { status: 404 });
    }

    if (page.status === 'PUBLISHED' && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to restore revisions on published pages.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    const updated = await restorePageRevision(page.id, revisionId, auth.user);
    return NextResponse.json({ page: updated, message: 'Revision restored successfully' });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
