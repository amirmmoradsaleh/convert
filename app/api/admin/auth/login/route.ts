import { NextRequest, NextResponse } from 'next/server';
import { loginAdmin } from '@/lib/admin/services/auth.service';
import { getSessionCookieOptions } from '@/lib/admin/session';
import { handleAdminApiError } from '@/lib/admin/api-error';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const { user, token } = await loginAdmin({ email, password });

    const response = NextResponse.json({
      success: true,
      user,
    });

    const cookieOpts = getSessionCookieOptions(req);
    response.cookies.set({
      ...cookieOpts,
      value: token,
    });

    return response;
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
