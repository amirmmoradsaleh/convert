import { PrismaClient } from '@prisma/client';

export function cleanDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  let url = raw.trim();
  while (url.startsWith('DATABASE_URL=')) {
    url = url.substring('DATABASE_URL='.length).trim();
  }
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.substring(1, url.length - 1).trim();
  }
  return url || undefined;
}

// Ensure process.env.DATABASE_URL is cleaned up for Prisma query engine
const initialCleanUrl = cleanDatabaseUrl(process.env.DATABASE_URL);
if (initialCleanUrl) {
  process.env.DATABASE_URL = initialCleanUrl;
}

export function isPrismaConfigured(): boolean {
  const url = cleanDatabaseUrl(process.env.DATABASE_URL);
  if (!url || process.env.USE_MEMORY_DB) return false;

  const isPlaceholderUrl =
    url.includes('postgres:postgres@localhost') ||
    url.includes('localhost:5432/filetools_db');

  if (isPlaceholderUrl && process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL_EXPLICIT) {
    return false;
  }

  return url.startsWith('postgresql://') || url.startsWith('postgres://');
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = cleanDatabaseUrl(process.env.DATABASE_URL);
  const isValid = Boolean(url && (url.startsWith('postgresql://') || url.startsWith('postgres://')));

  if (!isValid) {
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        throw new Error(`PrismaClient cannot execute '${String(prop)}': DATABASE_URL is not configured with postgresql:// protocol.`);
      },
    });
  }

  try {
    return (
      globalForPrisma.prisma ??
      new PrismaClient({
        datasources: {
          db: {
            url: url!,
          },
        },
        log: process.env.PRISMA_LOG === 'true' ? ['error'] : [],
      })
    );
  } catch (err) {
    console.warn('[Prisma] Failed to initialize PrismaClient instance:', err);
    return new Proxy({} as PrismaClient, {
      get(_target, _prop) {
        throw err;
      },
    });
  }
}

export const prisma: PrismaClient = createPrismaClient();

globalForPrisma.prisma = prisma;
