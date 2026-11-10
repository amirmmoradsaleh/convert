import { getDb } from '@/lib/db';
import { AuditLogItem } from '../types';

interface CreateAuditLogInput {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any> | null;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'secret',
  'jwt',
  'hash',
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeMetadata(raw?: Record<string, any> | null): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeMetadata(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogItem> {
  const db = getDb();
  const cleanMeta = sanitizeMetadata(input.metadata);

  const entry = await db.auditLog.create({
    data: {
      userId: input.userId || null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId || null,
      metadata: (cleanMeta as any) ?? undefined,
    },
  });

  return {
    id: entry.id,
    userId: entry.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.metadata,
    createdAt: entry.createdAt.toISOString(),
  };
}

export async function getAuditLogs(options?: {
  limit?: number;
  offset?: number;
  userId?: string;
  entityType?: string;
}): Promise<{ logs: AuditLogItem[]; total: number }> {
  const db = getDb();
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  const where: any = {};
  if (options?.userId) where.userId = options.userId;
  if (options?.entityType) where.entityType = options.entityType;

  try {
    const [rawLogs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where }),
    ]);

    const logs: AuditLogItem[] = (rawLogs || []).map((l: any) => {
      let createdAtStr: string;
      try {
        if (l.createdAt instanceof Date) {
          createdAtStr = l.createdAt.toISOString();
        } else if (l.createdAt) {
          createdAtStr = new Date(l.createdAt).toISOString();
        } else {
          createdAtStr = new Date().toISOString();
        }
      } catch {
        createdAtStr = new Date().toISOString();
      }

      return {
        id: l.id || '',
        userId: l.userId || null,
        userName: l.user?.name || null,
        userEmail: l.user?.email || null,
        action: l.action || 'UNKNOWN',
        entityType: l.entityType || 'SYSTEM',
        entityId: l.entityId || null,
        metadata: l.metadata || null,
        createdAt: createdAtStr,
      };
    });

    return { logs, total: typeof total === 'number' ? total : logs.length };
  } catch (err: unknown) {
    console.warn('[Audit Service] getAuditLogs error:', err);
    return { logs: [], total: 0 };
  }
}
