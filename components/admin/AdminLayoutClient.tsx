'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { AdminUserSession } from '@/lib/admin/types';

interface AdminLayoutClientProps {
  children: React.ReactNode;
}

export function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<AdminUserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'fallback_memory'>('connected');

  const isLoginPage = pathname === '/admin/login';

  const checkAuth = async (signal?: AbortSignal) => {
    if (isLoginPage) {
      setIsLoading(false);
      return;
    }

    setAuthError(null);

    try {
      const res = await fetch('/api/admin/auth/me', { signal });

      // 1. Genuine unauthenticated state -> Redirect to login
      if (res.status === 401) {
        if (!signal?.aborted) {
          router.push('/admin/login');
        }
        return;
      }

      // 2. Authenticated but unauthorized for this section
      if (res.status === 403) {
        if (!signal?.aborted) {
          setAuthError('Access forbidden: You do not have sufficient permissions to access this administrative section.');
          setIsLoading(false);
        }
        return;
      }

      // 3. Transient server error (e.g. 500, 502, 503) -> Do NOT boot user out; show retryable message
      if (!res.ok) {
        if (!signal?.aborted) {
          setAuthError(`Administrative session verification temporarily unavailable (Server responded with HTTP ${res.status}).`);
          setIsLoading(false);
        }
        return;
      }

      const data = await res.json();
      if (!signal?.aborted) {
        setUser(data.user);
        setAuthError(null);
        setIsLoading(false);
      }

      // 4. Fetch DB status non-blockingly; background stats errors must NEVER affect session
      try {
        const dashRes = await fetch('/api/admin/dashboard', { signal });
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          if (!signal?.aborted && dashData.stats?.databaseStatus) {
            setDbStatus(dashData.stats.databaseStatus);
          }
        }
      } catch {
        // Ignore non-critical background status polling errors
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Stale or cancelled request on route transition; safely ignore
        return;
      }
      // Network or connection failure -> Do NOT boot user out to login; retain page with retry option
      if (!signal?.aborted) {
        setAuthError('Network error: Unable to connect to the administrative server. Please verify your connection.');
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    checkAuth(controller.signal);

    return () => {
      controller.abort();
    };
  }, [pathname, isLoginPage, router]);

  // If on login page, render clean standalone view without admin sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFBFF] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-[#5E6488]">Verifying administrative session...</p>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="min-h-screen bg-[#FCFBFF] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-2xl border border-[#FCA5A5] shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0F112E]">Session Verification Error</h2>
          <p className="text-sm text-[#5E6488]">{authError}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setIsLoading(true);
                checkAuth();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#7C3AED] rounded-xl hover:bg-[#6D28D9] transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Verification</span>
            </button>
            <button
              onClick={() => router.push('/admin/login')}
              className="px-4 py-2 text-xs font-semibold text-[#0F112E] bg-white border border-[#E4E2F0] rounded-xl hover:bg-[#F4F3FA] transition-colors"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFBFF] flex flex-col md:pl-64 text-[#0F112E]">
      <AdminSidebar
        role={user?.role}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          user={user}
          dbStatus={dbStatus}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminLayoutClient;
