'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Wrench,
  BookOpen,
  Image as ImageIcon,
  Search,
  Settings,
  Users,
  History,
  Shield,
  X,
  Archive,
  Compass,
} from 'lucide-react';
import { AdminRole } from '@/lib/admin/types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  disabled?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface AdminSidebarProps {
  role?: AdminRole;
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const sections: NavSection[] = [
    {
      items: [
        {
          name: 'Dashboard',
          href: '/admin/dashboard',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      title: 'Content',
      items: [
        {
          name: 'Pages',
          href: '/admin/pages',
          icon: FileText,
        },
        {
          name: 'Tools',
          href: '/admin/tools',
          icon: Wrench,
        },
        {
          name: 'Blog',
          href: '/admin/blog',
          icon: BookOpen,
        },
        {
          name: 'Navigation',
          href: '/admin/navigation',
          icon: Compass,
        },
      ],
    },
    {
      title: 'Management',
      items: [
        {
          name: 'Media',
          href: '/admin/media',
          icon: ImageIcon,
        },
        {
          name: 'SEO',
          href: '/admin/seo',
          icon: Search,
          badge: 'Phase 04',
          disabled: true,
        },
        {
          name: 'Settings',
          href: '/admin/settings',
          icon: Settings,
        },
        {
          name: 'Backup & Restore',
          href: '/admin/backup',
          icon: Archive,
        },
        {
          name: 'Audit Logs',
          href: '/admin/audit',
          icon: History,
        },
        {
          name: 'Users',
          href: '/admin/users',
          icon: Users,
        },
      ],
    },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-fadeIn"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-[#0F112E] text-white flex flex-col z-50 transition-transform duration-200 ease-in-out shrink-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#1F2248]">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 font-bold text-base tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#6366F1] flex items-center justify-center text-white shadow-sm">
              <Shield className="w-4 h-4" />
            </div>
            <span>Convert24 CMS</span>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden text-[#8C92B2] hover:text-white"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1.5">
              {section.title && (
                <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-[#8C92B2]">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                  if (item.disabled) {
                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[#8C92B2]/50 cursor-not-allowed select-none"
                        title={`${item.name} is scheduled for future implementation.`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 shrink-0 text-[#8C92B2]/40" />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#8C92B2]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white shadow-sm font-bold'
                          : 'text-[#9AA0C2] hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-white' : 'text-[#8C92B2]'
                          }`}
                        />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7C3AED]/30 text-[#C4B5FD] font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-[#1F2248] text-[11px] text-[#8C92B2] flex items-center justify-between">
          <span>Convert24 CMS</span>
          <span className="font-mono text-[10px]">v2.0</span>
        </div>
      </aside>
    </>
  );
}

export default AdminSidebar;
