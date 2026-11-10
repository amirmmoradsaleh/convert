import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import {
  updateNavigationItem,
  deleteNavigationItem,
} from '@/lib/admin/services/navigation.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    const body = await req.json();
    const item = await updateNavigationItem(id, body, auth.user);
    return NextResponse.json({ item, success: true });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    await deleteNavigationItem(id, auth.user);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
