import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { HeaderNavItem, AdminUserSession, DEFAULT_HEADER_NAV } from '../types';
import {
  validateNavigationItem,
  validateNavigationLabel,
  validateNavigationDestination,
} from '../validation';
import { createAuditLog } from './audit.service';
import { getGlobalSettings } from './settings.service';

export { DEFAULT_HEADER_NAV };

function mapDbToNavItem(n: any): HeaderNavItem {
  return {
    id: n.id,
    label: n.label,
    href: n.destination,
    order: typeof n.order === 'number' ? n.order : 0,
    visible: n.visible !== false,
    openNewTab: Boolean(n.openNewTab),
    isExternal: Boolean(n.isExternal || n.openNewTab || (n.destination && (n.destination.startsWith('http://') || n.destination.startsWith('https://')))),
  };
}

/**
 * Synchronizes navigation_items table with globalSettings.socialLinks.__header.headerNav
 * to maintain dual-persistence integrity across the entire application.
 * Executes on the active transaction client or db handle without swallowing errors,
 * ensuring transactional atomicity and preserving production fail-closed semantics.
 */
async function syncToGlobalSettings(client: any): Promise<void> {
  const allNavs = await client.navigationItem.findMany({
    where: { menu: 'header' },
    orderBy: { order: 'asc' },
  });
  const headerNav: HeaderNavItem[] = allNavs.map(mapDbToNavItem);

  const raw = await client.globalSettings.findUnique({ where: { id: 'default' } });
  const socialLinks = (raw?.socialLinks || {}) as Record<string, any>;
  const currentHeader = socialLinks.__header || {};

  await client.globalSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      siteName: raw?.siteName || 'Convert24',
      siteUrl: raw?.siteUrl || 'https://convert24.local',
      socialLinks: {
        ...socialLinks,
        __header: {
          ...currentHeader,
          headerNav,
        },
      },
    },
    update: {
      socialLinks: {
        ...socialLinks,
        __header: {
          ...currentHeader,
          headerNav,
        },
      },
    },
  });
}

/**
 * Lists navigation items.
 * When `includeHidden` is false (public mode), only returns items where visible = true.
 * When `includeHidden` is true (admin mode), returns all items.
 */
export async function getNavigationItems(options?: {
  includeHidden?: boolean;
}): Promise<HeaderNavItem[]> {
  const db = getDb();
  const includeHidden = options?.includeHidden ?? false;

  const where: any = { menu: 'header' };
  if (!includeHidden) {
    where.visible = true;
  }

  let dbNavs: any[] = [];
  try {
    if (db.navigationItem?.findMany) {
      dbNavs = await db.navigationItem.findMany({
        where,
        orderBy: { order: 'asc' },
      });
    }
  } catch (err) {
    console.warn('[Navigation Service] Could not fetch navigation items from db:', err);
  }

  if (dbNavs && dbNavs.length > 0) {
    return dbNavs.map(mapDbToNavItem);
  }

  // Check if header items exist in DB but were filtered by visible: true
  try {
    if (db.navigationItem?.findMany) {
      const allHeaderNavs = await db.navigationItem.findMany({
        where: { menu: 'header' },
      });
      if (allHeaderNavs && allHeaderNavs.length > 0) {
        // Items exist in DB but all are hidden; return empty list for public view
        return [];
      }
    }
  } catch {
    // Graceful fallback
  }

  // Check globalSettings JSON fallback
  try {
    const settings = await getGlobalSettings();
    if (settings.headerNav && settings.headerNav.length > 0) {
      return includeHidden
        ? settings.headerNav
        : settings.headerNav.filter((n) => n.visible !== false);
    }
  } catch {
    // Graceful fallback
  }

  return DEFAULT_HEADER_NAV;
}

/**
 * Creates a new navigation item atomically inside a database transaction.
 */
export async function createNavigationItem(
  input: {
    label: string;
    destination?: string;
    href?: string;
    openNewTab?: boolean;
    visible?: boolean;
    order?: number;
  },
  author: AdminUserSession
): Promise<HeaderNavItem> {
  const validation = validateNavigationItem(input);
  if (!validation.isValid || !validation.sanitized) {
    const errorDetails = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errorDetails}`);
  }

  const sanitized = validation.sanitized;
  const db = getDb();

  const created = await db.$transaction(async (tx: any) => {
    let order = sanitized.order;
    if (input.order === undefined) {
      const existing = await tx.navigationItem.findMany({
        where: { menu: 'header' },
        orderBy: { order: 'asc' },
      });
      if (existing && existing.length > 0) {
        order = Math.max(...existing.map((i: any) => i.order ?? 0)) + 1;
      } else {
        order = 0;
      }
    }

    const item = await tx.navigationItem.create({
      data: {
        id: sanitized.id,
        menu: 'header',
        label: sanitized.label,
        destination: sanitized.href,
        order,
        visible: sanitized.visible,
        openNewTab: sanitized.openNewTab,
        isExternal: sanitized.isExternal,
      },
    });

    await syncToGlobalSettings(tx);
    return item;
  });

  await createAuditLog({
    userId: author.id,
    action: 'CREATE_NAVIGATION_ITEM',
    entityType: 'NAVIGATION',
    entityId: created.id,
    metadata: {
      label: created.label,
      destination: created.destination,
      order: created.order,
      visible: created.visible,
      openNewTab: created.openNewTab,
      isExternal: created.isExternal,
    },
  });

  try {
    revalidatePath('/', 'layout');
  } catch {
    // Safe no-op outside Next.js request context
  }

  return mapDbToNavItem(created);
}

/**
 * Updates an existing navigation item atomically inside a database transaction.
 */
export async function updateNavigationItem(
  id: string,
  input: {
    label?: string;
    destination?: string;
    href?: string;
    openNewTab?: boolean;
    visible?: boolean;
    order?: number;
  },
  author: AdminUserSession
): Promise<HeaderNavItem> {
  const db = getDb();

  const updateData: any = {};

  if (input.label !== undefined) {
    const labelResult = validateNavigationLabel(input.label);
    if (!labelResult.isValid) {
      throw new Error(labelResult.error);
    }
    updateData.label = labelResult.normalized;
  }

  if (input.destination !== undefined || input.href !== undefined) {
    const rawDest = input.destination !== undefined ? input.destination : input.href;
    const destResult = validateNavigationDestination(rawDest);
    if (!destResult.isValid) {
      throw new Error(destResult.error);
    }
    updateData.destination = destResult.normalized;
    updateData.isExternal = Boolean(
      input.openNewTab ||
      destResult.normalized!.startsWith('http://') ||
      destResult.normalized!.startsWith('https://')
    );
  }

  if (input.openNewTab !== undefined) {
    updateData.openNewTab = Boolean(input.openNewTab);
    if (updateData.openNewTab) {
      updateData.isExternal = true;
    }
  }

  if (input.visible !== undefined) {
    updateData.visible = Boolean(input.visible);
  }

  if (input.order !== undefined && typeof input.order === 'number' && !isNaN(input.order)) {
    updateData.order = input.order;
  }

  const updated = await db.$transaction(async (tx: any) => {
    const existing = await tx.navigationItem.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Navigation item '${id}' not found.`);
    }

    const item = await tx.navigationItem.update({
      where: { id },
      data: updateData,
    });

    await syncToGlobalSettings(tx);
    return item;
  });

  await createAuditLog({
    userId: author.id,
    action: 'UPDATE_NAVIGATION_ITEM',
    entityType: 'NAVIGATION',
    entityId: updated.id,
    metadata: {
      label: updated.label,
      destination: updated.destination,
      order: updated.order,
      visible: updated.visible,
      openNewTab: updated.openNewTab,
      isExternal: updated.isExternal,
    },
  });

  try {
    revalidatePath('/', 'layout');
  } catch {
    // Safe no-op outside Next.js request context
  }

  return mapDbToNavItem(updated);
}

/**
 * Deletes a navigation item and sequentially normalizes remaining items' orders atomically.
 */
export async function deleteNavigationItem(
  id: string,
  author: AdminUserSession
): Promise<void> {
  const db = getDb();

  const deleted = await db.$transaction(async (tx: any) => {
    const existing = await tx.navigationItem.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Navigation item '${id}' not found.`);
    }

    await tx.navigationItem.delete({ where: { id } });

    // Re-index remaining header items order sequentially
    const remaining = await tx.navigationItem.findMany({
      where: { menu: 'header' },
      orderBy: { order: 'asc' },
    });
    for (let idx = 0; idx < remaining.length; idx++) {
      if (remaining[idx].order !== idx) {
        await tx.navigationItem.update({
          where: { id: remaining[idx].id },
          data: { order: idx },
        });
      }
    }

    await syncToGlobalSettings(tx);
    return existing;
  });

  await createAuditLog({
    userId: author.id,
    action: 'DELETE_NAVIGATION_ITEM',
    entityType: 'NAVIGATION',
    entityId: id,
    metadata: {
      label: deleted.label,
      destination: deleted.destination,
    },
  });

  try {
    revalidatePath('/', 'layout');
  } catch {
    // Safe no-op outside Next.js request context
  }
}

/**
 * Persists an ordered sequence of navigation item IDs atomically inside a database transaction.
 * Strictly validates that all IDs belong to existing header navigation items with no duplicates.
 */
export async function reorderNavigationItems(
  orderedIds: string[],
  author: AdminUserSession
): Promise<HeaderNavItem[]> {
  if (!Array.isArray(orderedIds)) {
    throw new Error('orderedIds must be an array of item IDs.');
  }

  if (orderedIds.length === 0) {
    return getNavigationItems({ includeHidden: true });
  }

  // Validate no duplicate IDs are passed in the sequence
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    throw new Error('orderedIds array contains duplicate item IDs.');
  }

  const db = getDb();

  await db.$transaction(async (tx: any) => {
    // Fetch all current header navigation items to verify membership
    const existing = await tx.navigationItem.findMany({
      where: { menu: 'header' },
    });
    const existingMap = new Map<string, any>(existing.map((item: any) => [item.id, item]));

    // Ensure all provided IDs exist in the database
    for (const itemId of orderedIds) {
      if (!existingMap.has(itemId)) {
        throw new Error(`Navigation item '${itemId}' not found.`);
      }
    }

    // Apply sequential orders [0, 1, 2, ...] to the specified sequence
    for (let idx = 0; idx < orderedIds.length; idx++) {
      await tx.navigationItem.update({
        where: { id: orderedIds[idx] },
        data: { order: idx },
      });
      existingMap.delete(orderedIds[idx]);
    }

    // If any existing items were not in orderedIds, place them at the end preserving relative order
    if (existingMap.size > 0) {
      const remainingUnordered = Array.from(existingMap.values()).sort(
        (a: any, b: any) => (a.order || 0) - (b.order || 0)
      );
      let nextOrder = orderedIds.length;
      for (const unhandledItem of remainingUnordered) {
        await tx.navigationItem.update({
          where: { id: unhandledItem.id },
          data: { order: nextOrder++ },
        });
      }
    }

    await syncToGlobalSettings(tx);
  });

  await createAuditLog({
    userId: author.id,
    action: 'REORDER_NAVIGATION_ITEMS',
    entityType: 'NAVIGATION',
    metadata: {
      count: orderedIds.length,
      orderedIds,
    },
  });

  try {
    revalidatePath('/', 'layout');
  } catch {
    // Safe no-op outside Next.js request context
  }

  return getNavigationItems({ includeHidden: true });
}

/**
 * Saves and replaces all navigation items at once atomically inside a database transaction.
 */
export async function saveAllNavigationItems(
  items: HeaderNavItem[],
  author: AdminUserSession
): Promise<HeaderNavItem[]> {
  if (!Array.isArray(items)) {
    throw new Error('Items must be an array of navigation items.');
  }

  // Validate all items before opening transaction
  const validatedItems: HeaderNavItem[] = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const validation = validateNavigationItem(item);
    if (!validation.isValid || !validation.sanitized) {
      const errorDetails = validation.errors.map((e) => `${e.field}: ${e.message}`).join(', ');
      throw new Error(`Validation failed for item ${idx + 1}: ${errorDetails}`);
    }
    validatedItems.push({
      ...validation.sanitized,
      order: typeof item.order === 'number' ? item.order : idx,
    });
  }

  const db = getDb();

  await db.$transaction(async (tx: any) => {
    // Remove existing header items
    const existing = await tx.navigationItem.findMany({ where: { menu: 'header' } });
    for (const old of existing) {
      await tx.navigationItem.delete({ where: { id: old.id } });
    }

    // Insert validated items
    for (const item of validatedItems) {
      await tx.navigationItem.create({
        data: {
          id: item.id,
          menu: 'header',
          label: item.label,
          destination: item.href,
          order: item.order ?? 0,
          visible: item.visible !== false,
          openNewTab: Boolean(item.openNewTab),
          isExternal: Boolean(item.isExternal),
        },
      });
    }

    await syncToGlobalSettings(tx);
  });

  await createAuditLog({
    userId: author.id,
    action: 'UPDATE_NAVIGATION_ITEMS',
    entityType: 'NAVIGATION',
    metadata: {
      count: validatedItems.length,
      labels: validatedItems.map((i) => i.label),
    },
  });

  try {
    revalidatePath('/', 'layout');
  } catch {
    // Safe no-op outside Next.js request context
  }

  return getNavigationItems({ includeHidden: true });
}
