import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getGlobalSettings, updateGlobalSettings } from '@/lib/admin/services/settings.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  const settings = await getGlobalSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const updated = await updateGlobalSettings(body, auth.user);
    return NextResponse.json({ settings: updated, success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update settings.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
