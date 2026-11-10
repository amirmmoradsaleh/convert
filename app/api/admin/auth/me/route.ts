import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getPermissionsForRole } from '@/lib/admin/permissions';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req);
  if (auth.errorResponse) return auth.errorResponse;

  return NextResponse.json({
    user: auth.user,
    permissions: getPermissionsForRole(auth.user.role),
  });
}
