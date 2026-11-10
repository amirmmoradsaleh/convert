import { NextRequest, NextResponse } from 'next/server';
import { completePasswordReset } from '@/lib/admin/services/user.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPassword } = body;

    const result = await completePasswordReset(token, newPassword);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Password reset failed.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
