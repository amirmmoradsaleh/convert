import { NextRequest, NextResponse } from 'next/server';

export interface BoundedBodyResult {
  text?: string;
  errorResponse?: NextResponse;
}

/**
 * Reads request body enforcing strict byte size bounds.
 * Prevents memory exhaustion attacks from unbounded chunked transfers or missing/spoofed Content-Length headers.
 */
export async function readBoundedRequestBody(
  req: NextRequest,
  maxBytes: number
): Promise<BoundedBodyResult> {
  // 1. Check Content-Length header if present
  const contentLength = req.headers.get('content-length');
  if (contentLength) {
    const parsed = parseInt(contentLength, 10);
    if (!isNaN(parsed) && parsed > maxBytes) {
      return {
        errorResponse: NextResponse.json(
          {
            error: `Payload exceeds maximum allowed size of ${Math.round(
              maxBytes / (1024 * 1024)
            )}MB.`,
          },
          { status: 413 }
        ),
      };
    }
  }

  // 2. Stream-based chunk reader to guard against chunked transfer encoding or missing content-length
  if (req.body) {
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          if (receivedBytes > maxBytes) {
            await reader.cancel();
            return {
              errorResponse: NextResponse.json(
                {
                  error: `Payload exceeds maximum allowed size of ${Math.round(
                    maxBytes / (1024 * 1024)
                  )}MB.`,
                },
                { status: 413 }
              ),
            };
          }
          chunks.push(value);
        }
      }
    } catch {
      return {
        errorResponse: NextResponse.json(
          { error: 'Failed to read request body stream.' },
          { status: 400 }
        ),
      };
    }

    const fullBuffer = Buffer.concat(chunks);
    return { text: fullBuffer.toString('utf8') };
  }

  // Fallback to req.text() if body stream is not available
  try {
    const text = await req.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      return {
        errorResponse: NextResponse.json(
          {
            error: `Payload exceeds maximum allowed size of ${Math.round(
              maxBytes / (1024 * 1024)
            )}MB.`,
          },
          { status: 413 }
        ),
      };
    }
    return { text };
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: 'Failed to read request body.' },
        { status: 400 }
      ),
    };
  }
}
