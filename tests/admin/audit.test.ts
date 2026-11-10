import { describe, it, expect, beforeEach } from 'vitest';
import { createAuditLog, getAuditLogs } from '@/lib/admin/services/audit.service';
import { resetMemoryDb } from '@/lib/db';

describe('Admin CMS Phase 01 — Audit Logging & Safety', () => {
  beforeEach(() => {
    resetMemoryDb();
  });

  it('creates an audit log entry with timestamp and metadata', async () => {
    const entry = await createAuditLog({
      userId: 'user-admin',
      action: 'UPDATE_SETTINGS',
      entityType: 'SETTINGS',
      entityId: 'default',
      metadata: { siteName: 'Updated Brand' },
    });

    expect(entry.id).toBeDefined();
    expect(entry.action).toBe('UPDATE_SETTINGS');
    expect(entry.entityType).toBe('SETTINGS');
    expect(entry.metadata).toEqual({ siteName: 'Updated Brand' });

    const { logs, total } = await getAuditLogs();
    expect(total).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('UPDATE_SETTINGS');
  });

  it('strictly sanitizes and redacts password, token, and secret fields from metadata', async () => {
    const entry = await createAuditLog({
      userId: 'user-admin',
      action: 'LOGIN_ATTEMPT',
      entityType: 'AUTH',
      metadata: {
        email: 'admin@filetools.local',
        password: 'SensitivePassword123!',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
        nested: {
          passwordHash: '$2b$12$secretHash',
          secret: 'topSecret',
        },
      },
    });

    expect(entry.metadata?.email).toBe('admin@filetools.local');
    expect(entry.metadata?.password).toBe('[REDACTED]');
    expect(entry.metadata?.token).toBe('[REDACTED]');
    expect(entry.metadata?.nested?.passwordHash).toBe('[REDACTED]');
    expect(entry.metadata?.nested?.secret).toBe('[REDACTED]');
  });
});
