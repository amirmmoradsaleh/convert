import React from 'react';
import { resolveRelatedTools } from '@/lib/related-tools';
import ToolCard from '@/components/tool/ToolCard';

interface RelatedToolsProps {
  slugs: string[];
  title?: string;
  className?: string;
}

export function RelatedTools({
  slugs,
  title = 'Related File Tools',
  className = '',
}: RelatedToolsProps) {
  const tools = resolveRelatedTools(slugs);

  if (tools.length === 0) return null;

  return (
    <section className={`w-full py-8 ${className}`} aria-labelledby="related-tools-heading">
      <div className="mb-6">
        <h2 id="related-tools-heading" className="text-2xl md:text-3xl font-bold text-[#17202A] tracking-tight">
          {title}
        </h2>
        <p className="text-sm md:text-base text-[#667085] mt-1">
          Explore complementary tools for your workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}

export default RelatedTools;
