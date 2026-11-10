'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Menu, 
  X, 
  Layers, 
  ChevronDown, 
  Search, 
  ArrowRight, 
  Image as ImageIcon, 
  FileText,
} from 'lucide-react';
import Container from './Container';
import { getAllTools, ToolDefinition } from '@/lib/tools';
import { SiteSettingsData, HeaderNavItem, DEFAULT_HEADER_NAV } from '@/lib/admin/types';

interface HeaderProps {
  initialSettings?: Partial<SiteSettingsData>;
}

export function Header({ initialSettings }: HeaderProps = {}) {
  const [settings, setSettings] = useState<Partial<SiteSettingsData>>(() => initialSettings || {});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileImageOpen, setMobileImageOpen] = useState(false);
  const [mobilePdfOpen, setMobilePdfOpen] = useState(false);

  // Listen to live settings changes from the inline shared settings drawer
  useEffect(() => {
    function handleLiveUpdate(e: Event) {
      const customEvent = e as CustomEvent<SiteSettingsData>;
      if (customEvent.detail) {
        setSettings(customEvent.detail);
      }
    }
    window.addEventListener('convert24:settings-updated', handleLiveUpdate);
    return () => window.removeEventListener('convert24:settings-updated', handleLiveUpdate);
  }, []);

  const pathname = usePathname() || '';
  const toolsRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allTools = getAllTools();

  // Categorize canonical tools dynamically
  const imageTools = useMemo(() => {
    return allTools.filter(t => 
      t.category.startsWith('image') || 
      ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(t.slug)
    );
  }, [allTools]);

  const pdfTools = useMemo(() => {
    return allTools.filter(t => 
      t.category.startsWith('pdf') && 
      !['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(t.slug)
    );
  }, [allTools]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setToolsMenuOpen(false);
        setSearchOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter tools for header search dropdown
  const searchedTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return allTools.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.slug.toLowerCase().includes(query) ||
      (t.description || '').toLowerCase().includes(query)
    ).slice(0, 5);
  }, [searchQuery, allTools]);

  const brandName = settings.siteName || 'Convert24';
  const activeNavItems = useMemo(() => {
    const navList = Array.isArray(settings.headerNav) ? settings.headerNav : DEFAULT_HEADER_NAV;
    return navList
      .filter((item) => item.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [settings.headerNav]);

  // Do not render public customer header on admin routes
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E4E2F0] shadow-sm">
      <Container>
        <div className="flex items-center justify-between h-16 md:h-[76px] gap-2 lg:gap-4">
          
          {/* LEFT: Logo / Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[#0F112E] hover:text-[#7C3AED] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] rounded-md p-1"
            aria-label={`${brandName} Home`}
          >
            {settings.siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.siteLogo}
                alt={brandName}
                className="w-9 h-9 rounded-xl object-contain shadow-md shadow-indigo-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#6366F1] flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <Layers className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-[#0F112E] leading-tight">
                {brandName === 'Convert24' ? (
                  <>Convert<span className="text-[#7C3AED]">24</span></>
                ) : (
                  brandName
                )}
              </span>
              {settings.headerTagline && (
                <span className="hidden lg:inline text-[10px] text-[#5E6488] font-medium tracking-tight truncate max-w-[200px]">
                  {settings.headerTagline}
                </span>
              )}
            </div>
          </Link>

          {/* CENTER: Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-1.5 shrink-0" aria-label="Main Navigation">
            {/* Tools Dropdown Trigger */}
            <div ref={toolsRef} className="relative">
              <button
                type="button"
                onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
                aria-expanded={toolsMenuOpen}
                aria-haspopup="true"
                className={`flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] ${
                  toolsMenuOpen || pathname.includes('/tools')
                    ? 'text-[#7C3AED] bg-[#F4F0FD]'
                    : 'text-[#0F112E] hover:text-[#7C3AED] hover:bg-[#F4F3FA]'
                }`}
              >
                <span>Tools</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${toolsMenuOpen ? 'rotate-185 text-[#7C3AED]' : 'text-[#5E6488]'}`} />
              </button>

              {/* DESKTOP MEGA MENU */}
              {toolsMenuOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 w-[720px] bg-white border border-[#E4E2F0] rounded-[22px] shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 p-6 gap-6 bg-[#FCFBFF]">
                    
                    {/* Column 1: Image Tools */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E4E2F0]">
                        <div className="w-8 h-8 rounded-lg bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#0F112E]">Image Tools</h3>
                          <p className="text-[11px] text-[#5E6488]">Convert, compress & edit photos</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                        {imageTools.map((tool) => (
                          <Link
                            key={tool.slug}
                            href={`/tools/${tool.slug}`}
                            onClick={() => setToolsMenuOpen(false)}
                            className="group flex flex-col p-2 rounded-lg hover:bg-violet-50 transition-colors"
                          >
                            <span className="text-xs font-semibold text-[#0F112E] group-hover:text-[#7C3AED] transition-colors truncate">
                              {tool.name}
                            </span>
                            <span className="text-[9px] text-[#5E6488] uppercase tracking-wider">
                              {tool.inputFormats[0]} to {tool.outputFormats[0]}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Column 2: PDF Tools */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2.5 pb-2.5 border-b border-[#E4E2F0]">
                        <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[#0F112E]">PDF Tools</h3>
                          <p className="text-[11px] text-[#5E6488]">Merge, split & convert documents</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                        {pdfTools.map((tool) => (
                          <Link
                            key={tool.slug}
                            href={`/tools/${tool.slug}`}
                            onClick={() => setToolsMenuOpen(false)}
                            className="group flex flex-col p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <span className="text-xs font-semibold text-[#0F112E] group-hover:text-[#3B82F6] transition-colors truncate">
                              {tool.name}
                            </span>
                            <span className="text-[9px] text-[#5E6488] uppercase tracking-wider">
                              {tool.slug.includes('to-') ? 'Convert' : 'Utility'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Mega Menu Footer Action */}
                  <div className="px-6 py-3 bg-[#F4F3FA] border-t border-[#E4E2F0] flex items-center justify-between text-xs">
                    <span className="text-[#5E6488]">All tools are 100% free and client-side private.</span>
                    <Link
                      href="/#explore-hubs"
                      onClick={() => setToolsMenuOpen(false)}
                      className="font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                    >
                      <span>Explore Hubs</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Navigation Items from CMS */}
            {activeNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && !item.href.startsWith('/#') && pathname.startsWith(`${item.href}/`));
              const isExt = item.isExternal || item.openNewTab || item.href.startsWith('http');
              return (
                <Link
                  key={item.id || item.href}
                  href={item.href}
                  target={isExt ? '_blank' : undefined}
                  rel={isExt ? 'noopener noreferrer' : undefined}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    isActive
                      ? 'text-[#7C3AED] bg-[#F4F0FD]'
                      : 'text-[#0F112E] hover:text-[#7C3AED] hover:bg-[#F4F3FA]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* RIGHT: Search input + Actions */}
          <div className="flex items-center gap-2 lg:gap-2.5 shrink-0">
            {/* Search Input Container */}
            <div ref={searchRef} className="relative hidden sm:block shrink">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5E6488]" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Quick search..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="w-36 md:w-36 lg:w-48 xl:w-56 pl-9 pr-8 py-2 bg-[#F4F3FA] border border-transparent hover:border-[#E4E2F0] focus:border-[#7C3AED] focus:bg-white rounded-xl text-xs text-[#0F112E] placeholder-[#5E6488] transition-all focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#5E6488] hover:text-[#0F112E]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Dynamic Quick Dropdown Results */}
              {searchOpen && searchQuery.trim().length > 0 && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[#E4E2F0] rounded-xl shadow-lg z-50 overflow-hidden">
                  {searchedTools.length > 0 ? (
                    <div className="p-1.5 space-y-1">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-[#5E6488] uppercase tracking-wider bg-[#F4F3FA] rounded-md">
                        Matching Tools
                      </div>
                      {searchedTools.map((tool) => (
                        <Link
                          key={tool.slug}
                          href={`/tools/${tool.slug}`}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-violet-50 transition-colors group"
                        >
                          <div className="w-7 h-7 rounded bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center flex-shrink-0">
                            {tool.category.startsWith('image') ? (
                              <ImageIcon className="w-3.5 h-3.5" />
                            ) : (
                              <FileText className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#0F112E] group-hover:text-[#7C3AED] transition-colors truncate">
                              {tool.name}
                            </p>
                          </div>
                          <ArrowRight className="w-3 h-3 text-[#5E6488] group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-[#5E6488]">
                      No tools match &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Primary Action Button (Configurable CTA) */}
            {settings.headerCtaVisible !== false && (
              <Link
                href={settings.headerCtaLink || '/#explore-hubs'}
                className="hidden min-[900px]:inline-flex items-center gap-1.5 px-3.5 sm:px-4.5 py-2 bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-[#6D28D9] hover:to-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98] shrink-0"
              >
                <span>{settings.headerCtaLabel || 'Explore All'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            {/* Mobile Menu Open Button */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center p-2 rounded-xl text-[#0F112E] hover:bg-[#F4F3FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Menu className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>

        </div>
      </Container>

      {/* MOBILE NAVIGATION DRAWER */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="md:hidden border-t border-[#E4E2F0] bg-white px-4 py-4 space-y-3 shadow-lg max-h-[85vh] overflow-y-auto"
        >
          {/* Mobile Search input */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5E6488]" />
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tools"
              className="w-full h-11 pl-9 pr-4 py-2.5 bg-[#F4F3FA] rounded-xl text-sm text-[#0F112E] placeholder-[#5E6488] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
            {searchQuery && (
              <div className="mt-2 bg-[#FCFBFF] border border-[#E4E2F0] rounded-xl p-1.5 space-y-1">
                {searchedTools.length > 0 ? (
                  searchedTools.map((tool) => (
                    <Link
                      key={tool.slug}
                      href={`/tools/${tool.slug}`}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-violet-50 text-xs font-bold text-[#0F112E]"
                    >
                      {tool.name}
                    </Link>
                  ))
                ) : (
                  <p className="p-2 text-center text-xs text-[#5E6488]">No matches</p>
                )}
              </div>
            )}
          </div>

          {/* Expandable Image Tools Category Accordion */}
          <div className="border border-[#E4E2F0] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setMobileImageOpen(!mobileImageOpen)}
              className="w-full flex items-center justify-between p-3.5 bg-[#FCFBFF] hover:bg-[#F4F3FA] transition-colors text-sm font-bold text-[#0F112E]"
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#7C3AED]" />
                Image Tools
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobileImageOpen ? 'rotate-180 text-[#7C3AED]' : 'text-[#5E6488]'}`} />
            </button>
            {mobileImageOpen && (
              <div className="p-2 bg-white grid grid-cols-2 gap-1 border-t border-[#E4E2F0]">
                {imageTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-xs font-semibold text-[#0F112E] hover:bg-violet-50 truncate"
                  >
                    {tool.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Expandable PDF Tools Category Accordion */}
          <div className="border border-[#E4E2F0] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setMobilePdfOpen(!mobilePdfOpen)}
              className="w-full flex items-center justify-between p-3.5 bg-[#FCFBFF] hover:bg-[#F4F3FA] transition-colors text-sm font-bold text-[#0F112E]"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#3B82F6]" />
                PDF Tools
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${mobilePdfOpen ? 'rotate-180 text-[#3B82F6]' : 'text-[#5E6488]'}`} />
            </button>
            {mobilePdfOpen && (
              <div className="p-2 bg-white grid grid-cols-2 gap-1 border-t border-[#E4E2F0]">
                {pdfTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-xs font-semibold text-[#0F112E] hover:bg-blue-50 truncate"
                  >
                    {tool.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Navigation Links from CMS */}
          <div className="space-y-1 pt-2">
            {activeNavItems.map((item) => {
              const isExt = item.isExternal || item.openNewTab || item.href.startsWith('http');
              return (
                <Link
                  key={item.id || item.href}
                  href={item.href}
                  target={isExt ? '_blank' : undefined}
                  rel={isExt ? 'noopener noreferrer' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl text-sm font-bold text-[#0F112E] hover:bg-[#F4F3FA]"
                >
                  <span>{item.label}</span>
                  {isExt && <ArrowRight className="w-3.5 h-3.5 text-[#5E6488]" />}
                </Link>
              );
            })}
          </div>

          {/* Mobile CTA */}
          {settings.headerCtaVisible !== false && (
            <div className="pt-2">
              <Link
                href={settings.headerCtaLink || '/#explore-hubs'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white text-sm font-bold rounded-xl shadow-sm"
              >
                <span>{settings.headerCtaLabel || 'Explore All'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export default Header;
