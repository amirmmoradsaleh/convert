'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, X, Sparkles, Image as ImageIcon, FileText } from 'lucide-react';
import { ToolDefinition } from '@/lib/tools';

interface HomeSearchProps {
  tools: ToolDefinition[];
  placeholder?: string;
  id?: string;
}

export function HomeSearch({
  tools,
  placeholder = 'Search tools...',
  id = 'tool-search-input',
}: HomeSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close results on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTools = useMemo(() => {
    const raw = query.trim().toLowerCase();
    if (!raw) return [];

    // Split query by spaces into individual search terms
    const terms = raw.split(/\s+/).filter(Boolean);

    return tools
      .map((t) => {
        const nameLower = t.name.toLowerCase();
        const slugLower = t.slug.toLowerCase().replace(/-/g, ' ');
        const rawSlug = t.slug.toLowerCase();
        const titleLower = (t.title || '').toLowerCase();
        const introLower = (t.intro || '').toLowerCase();
        const descLower = (t.description || '').toLowerCase();
        const catLower = t.category.toLowerCase().replace(/-/g, ' ');
        const formats = [
          ...t.inputFormats.map((f) => f.toLowerCase()),
          ...t.outputFormats.map((f) => f.toLowerCase()),
        ].join(' ');

        const combinedHaystack = `${nameLower} ${rawSlug} ${slugLower} ${titleLower} ${descLower} ${introLower} ${catLower} ${formats}`;

        // Check if every search term appears in the combined haystack
        const matchesAllTerms = terms.every((term) =>
          combinedHaystack.includes(term)
        );

        if (!matchesAllTerms) return null;

        // Calculate relevance score for ranking
        let score = 0;
        if (nameLower === raw || rawSlug === raw) score += 100;
        else if (nameLower.startsWith(raw) || rawSlug.startsWith(raw)) score += 50;
        else if (nameLower.includes(raw) || slugLower.includes(raw)) score += 30;
        else if (titleLower.includes(raw)) score += 15;
        else score += 5;

        return { tool: t, score };
      })
      .filter((item): item is { tool: ToolDefinition; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.tool);
  }, [query, tools]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || filteredTools.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredTools.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredTools.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If a specific item is selected, open it; otherwise open the top/first match
      const targetIndex = selectedIndex >= 0 && selectedIndex < filteredTools.length ? selectedIndex : 0;
      const targetTool = filteredTools[targetIndex];
      if (targetTool) {
        setIsOpen(false);
        router.push(`/tools/${targetTool.slug}`);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto relative" role="search">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#5E6488]">
          <Search className="w-5 h-5 text-[#7C3AED]" aria-hidden="true" />
        </div>
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-expanded={isOpen && Boolean(query.trim())}
          aria-autocomplete="list"
          autoComplete="off"
          data-testid="tool-search-input"
          className="w-full pl-11 pr-10 py-3.5 bg-[#FFFFFF] border border-[#E4E2F0] hover:border-[#7C3AED] rounded-2xl text-base text-[#0F112E] placeholder-[#5E6488] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/20 focus-visible:border-[#7C3AED] transition-all duration-200"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            aria-label="Clear search query"
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#5E6488] hover:text-[#0F112E] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Matching Tools Dropdown / Live Results List */}
      {isOpen && query.trim().length > 0 && (
        <div
          role="region"
          aria-live="polite"
          data-testid="tool-search-results"
          className="absolute left-0 right-0 top-full mt-2 bg-[#FFFFFF] border border-[#E4E2F0] rounded-2xl shadow-xl overflow-hidden z-40 max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {filteredTools.length > 0 ? (
            <div className="py-2 divide-y divide-[#E4E2F0]/60">
              <div className="px-4 py-2 text-xs font-semibold text-[#5E6488] uppercase tracking-wider bg-[#F4F3FA] flex items-center justify-between">
                <span>
                  Found {filteredTools.length} matching {filteredTools.length === 1 ? 'tool' : 'tools'}
                </span>
                <span className="text-[11px] font-normal lowercase text-[#5E6488]/80">
                  Use ↑/↓ to navigate, Enter to open
                </span>
              </div>
              {filteredTools.map((tool, index) => {
                const isImage = tool.category.startsWith('image') || ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(tool.slug);
                const isSelected = index === selectedIndex;
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    onClick={() => setIsOpen(false)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    data-testid={`search-result-${tool.slug}`}
                    className={`flex items-center justify-between px-4 py-3 transition-colors group ${
                      isSelected ? 'bg-[#F4F0FD]' : 'hover:bg-[#FCFBFF]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isImage ? 'bg-[#F4F0FD] text-[#7C3AED]' : 'bg-[#EFF6FF] text-[#3B82F6]'
                        }`}
                      >
                        {isImage ? (
                          <ImageIcon className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <FileText className="w-4 h-4" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`font-semibold text-sm truncate ${
                              isSelected ? 'text-[#7C3AED]' : 'text-[#0F112E] group-hover:text-[#7C3AED]'
                            }`}
                          >
                            {tool.name}
                          </p>
                          {tool.clientSide && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#7C3AED] uppercase tracking-wider bg-[#F4F0FD] px-1.5 py-0.2 rounded">
                              <Sparkles className="w-2.5 h-2.5" />
                              Private
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#5E6488] line-clamp-1">
                          {tool.description || tool.intro}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#7C3AED] group-hover:translate-x-0.5 transition-transform flex-shrink-0">
                      <span className="hidden sm:inline">Open</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center space-y-2" data-testid="search-empty-state">
              <p className="text-base font-bold text-[#0F112E]">No tools found</p>
              <p className="text-sm text-[#5E6488] max-w-md mx-auto leading-relaxed">
                No tools matching &ldquo;{query}&rdquo;. Try another search, like &ldquo;compress pdf&rdquo;, &ldquo;jpg to png&rdquo;, &ldquo;resize image&rdquo;, or &ldquo;merge pdf&rdquo;.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default HomeSearch;
