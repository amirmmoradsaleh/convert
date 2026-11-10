import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { hasPermission } from '@/lib/admin/permissions';
import { restoreRevision, getPostById, getPostBySlug } from '@/lib/admin/services/blog.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ id: string; revisionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id, revisionId } = await params;
  try {
    let post = await getPostById(id);
    if (!post) {
      post = await getPostBySlug(id);
    }
    if (!post) {
      return NextResponse.json({ error: `BlogPost not found: ${id}` }, { status: 404 });
    }

    if ((post.status === 'PUBLISHED' || post.status === 'SCHEDULED') && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to restore revisions on published posts.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    const updated = await restoreRevision(post.id, revisionId, auth.user);
    return NextResponse.json({ post: updated, message: 'Revision restored successfully' });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
