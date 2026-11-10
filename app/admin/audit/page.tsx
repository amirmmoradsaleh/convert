'use client';

import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Shield, Filter, Search } from 'lucide-react';
import { AuditLogItem } from '@/lib/admin/types';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/audit?limit=50');
      if (!res.ok) throw new Error('Failed to load audit logs.');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading audit logs.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F112E]">
            Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-[#5E6488] mt-0.5">
            Immutable administrative action tracking and security event records.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#475467] bg-white border border-[#E4E2F0] rounded-lg hover:bg-[#F4F3FA] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E2F0] shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-[#5E6488]">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#7C3AED]" />
            <span>Retrieving audit trail...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#5E6488]">
            No administrative actions recorded in the audit log yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F3FA] border-b border-[#E4E2F0] text-[#5E6488] uppercase font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Target</th>
                  <th className="px-5 py-3.5">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2F0]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F4F3FA] transition-colors">
                    <td className="px-5 py-3.5 text-[#5E6488] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-[#0F112E] whitespace-nowrap">
                      {log.userEmail || (log.userId ? log.userId : 'System')}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#F4F0FD] text-[#7C3AED]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[#5E6488] whitespace-nowrap">
                      <span className="font-semibold text-[#0F112E]">{log.entityType}</span>
                      {log.entityId && (
                        <span className="ml-1 text-[11px] text-[#94A3B8]">({log.entityId})</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[11px] text-[#475467] max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
