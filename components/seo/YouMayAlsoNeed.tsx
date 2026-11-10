import React from 'react';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, FileText, Layers } from 'lucide-react';
import { resolveRelatedTools } from '@/lib/related-tools';

interface YouMayAlsoNeedProps {
  slugs: string[];
  title?: string;
  className?: string;
}

export function YouMayAlsoNeed({
  slugs,
  title = 'You may also need',
  className = '',
}: YouMayAlsoNeedProps) {
  const tools = resolveRelatedTools(slugs.slice(0, 3));

  if (tools.length === 0) return null;

  return (
    <section
      className={`w-full py-6 my-6 border-y border-[#E5E7EB] bg-[#F8FAFC]/60 rounded-xl px-4 md:px-6 ${className}`}
      aria-labelledby="you-may-also-need-heading"
    >
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-[#124A57]" aria-hidden="true" />
        <h2
          id="you-may-also-need-heading"
          className="text-base md:text-lg font-bold text-[#17202A] tracking-tight"
        >
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {tools.map((tool) => {
          const isImage = tool.category.startsWith('image');
          return (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group flex items-start gap-3 p-3.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-lg hover:border-[#124A57]/50 hover:shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#124A57]"
            >
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  isImage ? 'bg-[#F0F7F8] text-[#124A57]' : 'bg-[#FAF0F6] text-[#CD78B3]'
                }`}
              >
                {isImage ? (
                  <ImageIcon className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <FileText className="w-4 h-4" aria-hidden="true" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-semibold text-sm text-[#17202A] group-hover:text-[#124A57] transition-colors truncate">
                    {tool.name}
                  </h3>
                  <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#124A57] group-hover:translate-x-0.5 transition-all flex-shrink-0" aria-hidden="true" />
                </div>
                <p className="text-xs text-[#667085] line-clamp-1 mt-0.5">
                  {tool.intro || tool.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default YouMayAlsoNeed;
