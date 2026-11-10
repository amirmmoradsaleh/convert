import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/admin/guard';
import {
  getNavigationItems,
  createNavigationItem,
  reorderNavigationItems,
  saveAllNavigationItems,
} from '@/lib/admin/services/navigation.service';
import { handleAdminApiError } from '@/lib/admin/api-error';

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'VIEW_CMS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const items = await getNavigationItems({ includeHidden: true });
    return NextResponse.json({ items });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();
    const item = await createNavigationItem(body, auth.user);
    return NextResponse.json({ item, success: true }, { status: 201 });
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdminAuth(req, 'MANAGE_SETTINGS');
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const body = await req.json();

    if (Array.isArray(body.orderedIds) || Array.isArray(body.itemIds)) {
      const ids = body.orderedIds || body.itemIds;
      const items = await reorderNavigationItems(ids, auth.user);
      return NextResponse.json({ items, success: true });
    }

    if (Array.isArray(body.items)) {
      const items = await saveAllNavigationItems(body.items, auth.user);
      return NextResponse.json({ items, success: true });
    }

    return NextResponse.json(
      { error: 'Invalid payload: expected "orderedIds" or "items" array.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    return handleAdminApiError(err);
  }
}
