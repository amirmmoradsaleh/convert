import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { listMedia, uploadMedia } from '@/lib/admin/services/media.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const mimeType = searchParams.get('mimeType') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = (searchParams.get('sortBy') as any) || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') as any) || 'desc';

    const result = await listMedia({
      search,
      mimeType,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error listing media assets.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'MANAGE_MEDIA');
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name || 'unnamed-file';
    const mimeType = file.type || 'application/octet-stream';
    const alt = (formData.get('alt') as string) || undefined;
    const title = (formData.get('title') as string) || undefined;
    const caption = (formData.get('caption') as string) || undefined;
    const description = (formData.get('description') as string) || undefined;

    const asset = await uploadMedia(
      {
        buffer,
        filename,
        mimeType,
        size: buffer.length,
      },
      auth.user,
      { alt, title, caption, description }
    );

    return NextResponse.json({ asset }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error uploading media file.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
