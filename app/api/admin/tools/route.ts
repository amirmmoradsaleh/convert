import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getAllToolContents } from '@/lib/admin/services/tool.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const tools = await getAllToolContents();
  return NextResponse.json({ tools, total: tools.length });
}
