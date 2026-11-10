'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers } from 'lucide-react';
import Container from './Container';
import { SiteSettingsData, FooterGroupItem, DEFAULT_FOOTER_GROUPS } from '@/lib/admin/types';

interface FooterProps {
  initialSettings?: Partial<SiteSettingsData>;
}

export function Footer({ initialSettings }: FooterProps = {}) {
  const [settings, setSettings] = useState<Partial<SiteSettingsData>>(() => initialSettings || {});
  const currentYear = new Date().getFullYear();

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

  const brandName = settings.siteName || 'Convert24';
  const description =
    settings.footerDescription ||
    'Fast, privacy-focused image and PDF utility tools. Process files safely in your browser without registration, subscriptions, or remote cloud uploads.';

  const groups: FooterGroupItem[] = useMemo(() => {
    if (settings.footerGroups && settings.footerGroups.length > 0) {
      return settings.footerGroups;
    }
    return DEFAULT_FOOTER_GROUPS;
  }, [settings.footerGroups]);

  const socialEntries = useMemo(() => {
    if (!settings.socialLinks) return [];
    return Object.entries(settings.socialLinks).filter(([key, val]) => {
      return !key.startsWith('__') && typeof val === 'string' && val.trim().length > 0;
    });
  }, [settings.socialLinks]);

  const copyrightTemplate =
    settings.copyrightText || '© {year} Convert24. Free online file utility service. All rights reserved.';
  const copyrightText = copyrightTemplate.replace('{year}', currentYear.toString());

  const trustText = settings.trustText || 'Client-side processing • 100% Free • No registration';

  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="w-full bg-[#F4F3FA] border-t border-[#E4E2F0] mt-auto">
      <Container className="py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          {/* Brand Column */}
          <div className="md:col-span-1 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-[#0F112E] hover:text-[#7C3AED] font-extrabold text-lg transition-colors"
              aria-label={`${brandName} Home`}
            >
              {settings.siteLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.siteLogo}
                  alt={brandName}
                  className="w-7 h-7 rounded-lg object-contain shadow-sm"
                />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#7C3AED] to-[#6366F1] flex items-center justify-center text-white shadow-sm">
                  <Layers className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
              )}
              <span>
                {brandName === 'Convert24' ? (
                  <>Convert<span className="text-[#7C3AED]">24</span></>
                ) : (
                  brandName
                )}
              </span>
            </Link>
            <p className="text-sm text-[#5E6488] leading-relaxed">
              {description}
            </p>

            {/* Social Media Links */}
            {socialEntries.length > 0 && (
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                {socialEntries.map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={platform}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-[#E4E2F0] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[#5E6488] transition-colors capitalize"
                  >
                    {platform}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer Navigation Columns */}
          {groups.map((group, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-bold text-[#0F112E] uppercase tracking-widest mb-4">
                {group.title}
              </h3>
              <ul className="space-y-2.5 text-sm text-[#5E6488]">
                {group.links.map((link, lIdx) => {
                  const isExt = link.openNewTab || link.href.startsWith('http');
                  return (
                    <li key={lIdx}>
                      <Link
                        href={link.href}
                        target={isExt ? '_blank' : undefined}
                        rel={isExt ? 'noopener noreferrer' : undefined}
                        className="hover:text-[#7C3AED] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom copyright & Trust statement */}
        <div className="pt-8 border-t border-[#E4E2F0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#5E6488] gap-4">
          <p>{copyrightText}</p>
          <p>{trustText}</p>
        </div>
      </Container>
    </footer>
  );
}

export default Footer;
