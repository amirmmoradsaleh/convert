'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  LogOut,
  ShieldCheck,
  User,
  Database,
  Menu,
} from 'lucide-react';
import { AdminUserSession } from '@/lib/admin/types';

interface AdminHeaderProps {
  user: AdminUserSession | null;
  dbStatus?: 'connected' | 'fallback_memory';
  onToggleSidebar?: () => void;
}

export function AdminHeader({
  user,
  dbStatus = 'connected',
  onToggleSidebar,
}: AdminHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      // Continue to redirect
    }
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <header className="h-16 bg-white border-b border-[#E4E2F0] px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA]"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm md:text-base text-[#0F112E]">
            CMS Control Center
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F4F0FD] text-[#7C3AED]">
            <Database className="w-3 h-3" />
            {dbStatus === 'connected' ? 'PostgreSQL' : 'In-Memory DB'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <Link
          href="/"
          target="_blank"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E6488] hover:text-[#7C3AED] transition-colors"
          title="Open public website in new tab"
        >
          <span>View Public Site</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>

        {user && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-[#E4E2F0]">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-[#0F112E] leading-tight">
                {user.name}
              </div>
              <div className="text-[10px] font-semibold text-[#7C3AED] flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3 text-[#7C3AED]" />
                {user.role}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] rounded-xl transition-colors disabled:opacity-50"
          title="Sign out of administration"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}

export default AdminHeader;
