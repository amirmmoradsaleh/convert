import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { hasPermission } from '@/lib/admin/permissions';
import { getPostById, getPostBySlug, updateDraft, deletePost } from '@/lib/admin/services/blog.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  const post = await getPostById(id);
  if (!post) {
    return NextResponse.json({ error: `Blog post '${id}' not found.` }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    const body = await req.json();

    let post = await getPostById(id);
    if (!post) {
      post = await getPostBySlug(id);
    }
    if (!post) {
      return NextResponse.json({ error: `Blog post '${id}' not found.` }, { status: 404 });
    }

    if ((post.status === 'PUBLISHED' || post.status === 'SCHEDULED') && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to modify published or scheduled blog posts.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    if ((body.status === 'PUBLISHED' || body.status === 'SCHEDULED') && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to publish or schedule blog posts.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    const updated = await updateDraft(id, body, auth.user);
    return NextResponse.json({ post: updated, success: true });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { id } = await params;
  try {
    let post = await getPostById(id);
    if (!post) {
      post = await getPostBySlug(id);
    }
    if (!post) {
      return NextResponse.json({ error: `Blog post '${id}' not found.` }, { status: 404 });
    }

    if ((post.status === 'PUBLISHED' || post.status === 'SCHEDULED') && !hasPermission(auth.user.role, 'PUBLISH_CONTENT')) {
      return NextResponse.json(
        {
          error: `Forbidden: Role '${auth.user.role}' lacks 'PUBLISH_CONTENT' permission to delete published blog posts.`,
          failureType: 'forbidden',
        },
        { status: 403 }
      );
    }

    await deletePost(post.id, auth.user);
    return NextResponse.json({ success: true, message: `Blog post '${id}' deleted.` });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
