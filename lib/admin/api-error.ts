import { NextResponse } from 'next/server';
import { JwtConfigError } from './session';
import { DatabasePersistenceError } from '@/lib/db';

export function handleAdminApiError(err: unknown): NextResponse {
  if (err instanceof JwtConfigError || (err instanceof Error && err.name === 'JwtConfigError') || (err instanceof Error && err.message.includes('Authentication configuration error'))) {
    return NextResponse.json(
      {
        error: 'Authentication configuration error. Please contact system administrator.',
        failureType: 'auth_config_error',
      },
      { status: 500 }
    );
  }

  if (err instanceof DatabasePersistenceError || (err instanceof Error && (err.name === 'DatabasePersistenceError' || err.message.includes('Database persistence unavailable')))) {
    return NextResponse.json(
      {
        error: 'Database persistence unavailable. Your changes could not be saved to durable storage.',
        failureType: 'database_unavailable',
      },
      { status: 503 }
    );
  }

  const message = err instanceof Error ? err.message : 'An error occurred during request processing.';
  if (
    message.startsWith('Forbidden:') ||
    message.startsWith('FORBIDDEN:') ||
    (message.includes('lacks') && message.includes('permission'))
  ) {
    return NextResponse.json({ error: message, failureType: 'forbidden' }, { status: 403 });
  }

  const status = message.includes('CONCURRENT_MODIFICATION') ? 409 : 400;

  return NextResponse.json({ error: message }, { status });
}
