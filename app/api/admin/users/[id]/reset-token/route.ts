import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { generatePasswordResetToken } from '@/lib/admin/services/user.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth(req, 'MANAGE_USERS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    const result = await generatePasswordResetToken(id, auth.user);

    return NextResponse.json({
      success: true,
      resetToken: result.resetToken,
      expiresAt: result.expiresAt,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate reset token.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
