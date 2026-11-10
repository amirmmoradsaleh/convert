'use client';

import React from 'react';

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-4 bg-[#FCFBFF] text-[#0F112E]">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-extrabold mb-3 text-[#0F112E]">Something went wrong</h1>
          <p className="text-sm text-[#5E6488] mb-6">
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold shadow-sm transition-all"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
