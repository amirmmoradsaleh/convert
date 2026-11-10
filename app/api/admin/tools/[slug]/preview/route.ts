import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getMergedTool } from '@/lib/admin/services/tool.service';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const { slug } = await params;
  const tool = await getMergedTool(slug, { preview: true });
  if (!tool) {
    return NextResponse.json({ error: `Tool '${slug}' not found.` }, { status: 404 });
  }

  return NextResponse.json({ success: true, tool });
}
