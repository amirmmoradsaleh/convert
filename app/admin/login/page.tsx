'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, AlertCircle, ArrowRight, Lock, Mail, ExternalLink } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please verify your credentials.');
      }

      // Verify that the browser actually stored and sent the session cookie
      const verifyRes = await fetch('/api/admin/auth/me');
      if (!verifyRes.ok) {
        const isHttp = typeof window !== 'undefined' && window.location.protocol === 'http:';
        if (isHttp) {
          throw new Error(
            'Authentication succeeded, but your browser rejected the session cookie over plain HTTP. ' +
            'For plain-HTTP testing on a VPS, add COOKIE_SECURE=false to your .env file, or access the site over HTTPS.'
          );
        }
        throw new Error('Authentication succeeded, but the administrative session could not be established in your browser. Please check cookie settings or refresh.');
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setError(msg);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFBFF] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#6366F1] text-white flex items-center justify-center mx-auto shadow-md mb-4">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#0F112E]">
          Convert24 CMS
        </h1>
        <p className="mt-1.5 text-sm text-[#5E6488]">
          Self-hosted Administrative Control Center
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-sm rounded-[20px] border border-[#E4E2F0]">
          {error && (
            <div
              id="login-error-alert"
              className="mb-6 p-4 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] flex items-start gap-3 text-xs sm:text-sm text-[#991B1B] animate-fadeIn"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5"
              >
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C92B2]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@convert24.local"
                  className="block w-full pl-9 pr-3 py-2.5 border border-[#E4E2F0] rounded-xl text-sm text-[#0F112E] placeholder-[#8C92B2] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8C92B2]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 border border-[#E4E2F0] rounded-xl text-sm text-[#0F112E] placeholder-[#8C92B2] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-[#6D28D9] hover:to-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#7C3AED] transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign in to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#E4E2F0] text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5E6488] hover:text-[#7C3AED] transition-colors"
            >
              <span>Back to public site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Security badge */}
        <p className="mt-6 text-center text-xs text-[#8C92B2]">
          Protected by server-side RBAC and encrypted session cookies.
        </p>
      </div>
    </div>
  );
}
