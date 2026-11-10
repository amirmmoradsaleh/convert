import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { listAdminUsers, createAdminUser } from '@/lib/admin/services/user.service';
import { AdminRole } from '@/lib/admin/types';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'MANAGE_USERS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const role = (searchParams.get('role') as AdminRole) || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam !== null ? isActiveParam === 'true' : undefined;
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;

    const result = await listAdminUsers({
      search,
      role,
      isActive,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      users: result.users,
      total: result.total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list users.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'MANAGE_USERS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const result = await createAdminUser(body, auth.user);

    return NextResponse.json({
      success: true,
      user: result.user,
      temporaryPassword: result.temporaryPassword,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create user.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
