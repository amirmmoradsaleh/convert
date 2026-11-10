import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = 'mb-4' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[#667085] max-w-full">
        <li className="shrink-0">
          <Link
            href="/"
            className="hover:text-[#124A57] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#124A57] rounded"
          >
            Home
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li
              key={`${item.name}-${index}`}
              className={`flex items-center gap-1.5 ${isLast ? 'min-w-0 max-w-full flex-1' : 'shrink-0'}`}
            >
              <ChevronRight className="w-3.5 h-3.5 text-[#667085]/60 flex-shrink-0" aria-hidden="true" />
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-[#124A57] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#124A57] rounded"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  className="font-medium text-[#17202A] truncate block min-w-0"
                  title={item.name}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.name}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
