import React from 'react';
import Link from 'next/link';
import { ArrowRight, Image as ImageIcon, FileText, Sparkles } from 'lucide-react';
import { ToolDefinition } from '@/lib/tools';

interface ToolCardProps {
  tool: ToolDefinition;
}

export function ToolCard({ tool }: ToolCardProps) {
  const isImage = tool.category.startsWith('image') || ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(tool.slug);

  // Clean unboxed metadata formats using typographic separators instead of pill badges (anti-slop rule)
  const formatsText = [
    ...tool.inputFormats.map(f => f.toUpperCase()),
    ...tool.outputFormats.map(f => f.toUpperCase())
  ].filter((value, index, self) => self.indexOf(value) === index).join(' · ');

  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="group flex flex-col justify-between p-6 bg-white border border-[#E4E2F0] rounded-[20px] hover:border-[#7C3AED]/40 hover:shadow-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          {/* Pastel icon container */}
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-105 ${
              isImage ? 'bg-[#F4F0FD] text-[#7C3AED]' : 'bg-[#EFF6FF] text-[#3B82F6]'
            }`}
          >
            {isImage ? (
              <ImageIcon className="w-5 h-5" aria-hidden="true" />
            ) : (
              <FileText className="w-5 h-5" aria-hidden="true" />
            )}
          </div>
          
          {tool.clientSide && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider bg-[#F4F0FD] px-2 py-0.5 rounded-md">
              <Sparkles className="w-3 h-3 text-[#7C3AED]" aria-hidden="true" />
              Private
            </span>
          )}
        </div>

        <h3 className="font-bold text-[#0F112E] text-lg mb-2 group-hover:text-[#7C3AED] transition-colors">
          {tool.name}
        </h3>
        
        <p className="text-sm text-[#5E6488] line-clamp-2 leading-relaxed mb-4">
          {tool.description || tool.intro}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#F4F3FA]">
        {/* Unboxed format metadata with subtle dots */}
        <span className="text-[11px] font-medium text-[#5E6488] tracking-wide">
          {formatsText}
        </span>
        <div className="flex items-center text-xs font-bold text-[#7C3AED] group-hover:translate-x-1 transition-transform duration-200">
          <span>Open Tool</span>
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

export default ToolCard;
