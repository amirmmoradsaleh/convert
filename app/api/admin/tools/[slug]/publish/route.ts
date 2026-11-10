import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdminAuth } from '@/lib/admin/guard';
import { publishTool } from '@/lib/admin/services/tool.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'PUBLISH_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug } = await params;
  try {
    const updated = await publishTool(slug, auth.user);
    revalidatePath(`/tools/${slug}`);
    return NextResponse.json({ success: true, toolContent: updated });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
