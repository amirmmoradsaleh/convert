import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import { getDashboardStats } from '@/lib/admin/services/dashboard.service';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const stats = await getDashboardStats();
    return NextResponse.json({ stats });
  } catch (err: unknown) {
    console.error('[Dashboard API Error]:', err);
    const msg = err instanceof Error ? err.message : 'Failed to retrieve dashboard statistics.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
