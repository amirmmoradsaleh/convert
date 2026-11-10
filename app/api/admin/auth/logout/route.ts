import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/admin/guard';
import { logoutAdmin } from '@/lib/admin/services/auth.service';
import { getExpireSessionCookieOptions } from '@/lib/admin/session';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedAdmin(req);
  if (user) {
    await logoutAdmin(user);
  }

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully.',
  });

  const expireOpts = getExpireSessionCookieOptions(req);
  response.cookies.set(expireOpts);

  return response;
}
