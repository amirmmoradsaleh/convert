'use client';

import React from 'react';

export default function Error({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-extrabold mb-3 text-[#0F112E]">Something went wrong</h2>
      <p className="text-sm text-[#5E6488] mb-6 max-w-md">
        An error occurred while loading this page.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl font-bold shadow-sm transition-all"
      >
        Try again
      </button>
    </div>
  );
}
