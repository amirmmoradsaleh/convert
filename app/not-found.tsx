import React from 'react';
import Link from 'next/link';
import Container from '@/components/layout/Container';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="py-20 md:py-32">
      <Container className="text-center">
        <div className="max-w-md mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center mx-auto shadow-sm">
            <FileQuestion className="w-8 h-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-[#7C3AED]">
              404 – Page Not Found
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-[#0F112E] tracking-tight">
              Tool or Page Not Found
            </h1>
            <p className="text-sm md:text-base text-[#5E6488] leading-relaxed">
              The tool, format guide, or page you requested does not exist or may have been moved.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-all shadow-sm text-sm"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Homepage</span>
            </Link>

            <Link
              href="/image-tools"
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold text-[#0F112E] hover:bg-[#F4F3FA] border border-[#E4E2F0] transition-colors"
            >
              Browse Image Tools
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
