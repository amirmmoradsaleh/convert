import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import {
  getAdminUserById,
  updateAdminUser,
  deleteAdminUser,
} from '@/lib/admin/services/user.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(req, 'MANAGE_USERS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    const user = await getAdminUserById(id);

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve user.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(req, 'MANAGE_USERS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await updateAdminUser(id, body, auth.user);

    return NextResponse.json({
      success: true,
      user: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update user.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(req, 'MANAGE_USERS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    const result = await deleteAdminUser(id, auth.user);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete/deactivate user.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
