import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { bootstrapHomepage } from '@/lib/admin/services/page.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'EDIT_CONTENT');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const result = await bootstrapHomepage(auth.user);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
