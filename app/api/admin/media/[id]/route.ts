import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getMediaById, updateMedia, deleteMedia } from '@/lib/admin/services/media.service';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { id } = await params;
    const asset = await getMediaById(id);

    if (!asset) {
      return NextResponse.json({ error: `Media asset not found: ${id}` }, { status: 404 });
    }

    return NextResponse.json({ asset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error fetching media asset.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth(req, 'MANAGE_MEDIA');
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const asset = await updateMedia(
      id,
      {
        title: body.title,
        alt: body.alt,
        caption: body.caption,
        description: body.description,
      },
      auth.user
    );

    return NextResponse.json({ asset });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error updating media metadata.';
    const status = msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth(req, 'MANAGE_MEDIA');
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { id } = await params;
    const result = await deleteMedia(id, auth.user);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error deleting media asset.';
    // If blocked by dependency safety check, return 400 with descriptive error
    const status = msg.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
