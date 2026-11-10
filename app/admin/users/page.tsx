'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Edit2,
  KeyRound,
  UserX,
  UserCheck,
  Check,
  Copy,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Mail,
  Lock,
} from 'lucide-react';
import { AdminUserItem, AdminRole } from '@/lib/admin/types';

const ROLES: { value: AdminRole; label: string; badgeClass: string }[] = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'ADMIN', label: 'Admin', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'CONTENT_MANAGER', label: 'Content Manager', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'EDITOR', label: 'Editor', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'VIEWER', label: 'Viewer', badgeClass: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<AdminRole>('EDITOR');
  const [createPassword, setCreatePassword] = useState('');
  const [createIsActive, setCreateIsActive] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [createdTempPass, setCreatedTempPass] = useState<string | null>(null);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('EDITOR');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // Reset Token Modal
  const [resetModalUser, setResetModalUser] = useState<AdminUserItem | null>(null);
  const [resetTokenData, setResetTokenData] = useState<{ token: string; expiresAt: string } | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Toggle Active State
  const [confirmToggleUser, setConfirmToggleUser] = useState<AdminUserItem | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (statusFilter !== 'ALL') params.append('isActive', statusFilter === 'ACTIVE' ? 'true' : 'false');

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch users.');
      }

      setUsers(data.users || []);
      setTotalCount(data.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching users.');
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);
    setIsCreating(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          role: createRole,
          password: createPassword || undefined,
          isActive: createIsActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user.');
      }

      if (data.temporaryPassword) {
        setCreatedTempPass(data.temporaryPassword);
      } else {
        setIsCreateOpen(false);
        resetCreateForm();
      }

      setSuccessMsg(`Administrator '${data.user.name}' created successfully.`);
      fetchUsers();
    } catch (err: unknown) {
      setCreateModalError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreateEmail('');
    setCreateRole('EDITOR');
    setCreatePassword('');
    setCreateIsActive(true);
    setCreateModalError(null);
    setCreatedTempPass(null);
  };

  const openEditModal = (user: AdminUserItem) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditIsActive(user.isActive);
    setEditPassword('');
    setEditModalError(null);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditModalError(null);
    setIsSaving(true);

    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          role: editRole,
          isActive: editIsActive,
          password: editPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user.');
      }

      setEditingUser(null);
      setSuccessMsg(`User '${data.user.name}' updated successfully.`);
      fetchUsers();
    } catch (err: unknown) {
      setEditModalError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmToggleUser) return;
    setIsTogglingStatus(true);
    setError(null);

    try {
      const newStatus = !confirmToggleUser.isActive;
      const res = await fetch(`/api/admin/users/${confirmToggleUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle status.');
      }

      setConfirmToggleUser(null);
      setSuccessMsg(`User '${confirmToggleUser.email}' ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle status.');
      setConfirmToggleUser(null);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleGenerateResetToken = async (user: AdminUserItem) => {
    setResetModalUser(user);
    setResetTokenData(null);
    setTokenCopied(false);
    setIsGeneratingToken(true);

    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-token`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate reset token.');
      }

      setResetTokenData({
        token: data.resetToken,
        expiresAt: data.expiresAt,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating reset token.');
      setResetModalUser(null);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2500);
  };

  const getRoleBadge = (role: AdminRole) => {
    const found = ROLES.find((r) => r.value === role);
    return found ? (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${found.badgeClass}`}>
        {found.label}
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
        {role}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#7C3AED]" />
            <span>User Management & Security</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage administrative credentials, role-based access controls, account security, and password resets.
          </p>
        </div>

        <button
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Administrator</span>
        </button>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start justify-between gap-3 text-red-800 text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start justify-between gap-3 text-emerald-800 text-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="ALL">All Roles</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Deactivated Only</option>
          </select>

          <button
            onClick={() => fetchUsers()}
            disabled={isLoading}
            title="Refresh list"
            className="p-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5">User</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Last Login</th>
                <th className="px-6 py-3.5">Created</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
                    <span>Loading administrators...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="font-medium text-gray-700">No administrators found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filter options.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                    {/* User Profile */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#F4F0FD] text-[#7C3AED] font-semibold text-sm flex items-center justify-center border border-[#B5E2D9] shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{user.name}</div>
                          <div className="text-xs text-gray-500 truncate flex items-center gap-1.5">
                            <Mail className="w-3 h-3 text-gray-400" />
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <ShieldAlert className="w-3 h-3" />
                          Deactivated
                        </span>
                      )}
                      {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                        <div className="text-[10px] text-red-600 font-semibold mt-0.5">
                          Locked ({user.failedLoginAttempts} attempts)
                        </div>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {user.lastLoginAt ? (
                        <div className="flex items-center gap-1.5" title={user.lastLoginAt}>
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(user.lastLoginAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Never</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          title="Edit User"
                          className="p-1.5 text-gray-600 hover:text-[#7C3AED] hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleGenerateResetToken(user)}
                          title="Generate Password Reset Link"
                          className="p-1.5 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setConfirmToggleUser(user)}
                          title={user.isActive ? 'Deactivate User' : 'Activate User'}
                          className={`p-1.5 rounded-md transition-colors ${
                            user.isActive
                              ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span>Showing {users.length} of {totalCount} administrator accounts</span>
          <span className="font-mono text-[11px]">Phase 06A User Control</span>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl relative animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#7C3AED]" />
                <span>Add Administrator</span>
              </h2>
              <button
                onClick={() => {
                  setIsCreateOpen(false);
                  resetCreateForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdTempPass ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-sm space-y-2">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Administrator account created!</span>
                  </div>
                  <p className="text-xs text-emerald-800">
                    A temporary password was generated for <strong>{createEmail}</strong>. Securely share this password with the user:
                  </p>
                  <div className="p-3 bg-white border border-emerald-300 rounded font-mono text-sm select-all flex items-center justify-between">
                    <span className="text-gray-900 font-bold">{createdTempPass}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdTempPass)}
                      className="text-emerald-700 hover:text-emerald-900 text-xs flex items-center gap-1 font-sans"
                    >
                      {tokenCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{tokenCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setIsCreateOpen(false);
                      resetCreateForm();
                    }}
                    className="px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-lg hover:bg-[#6D28D9]"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                {createModalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{createModalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="jane@filetools.local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Super Admins manage users & settings; Content Managers publish content; Editors draft content; Viewers have read-only access.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password <span className="font-normal text-gray-400">(Optional — leave blank to generate a temporary password)</span>
                  </label>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    minLength={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="createIsActive"
                    checked={createIsActive}
                    onChange={(e) => setCreateIsActive(e.target.checked)}
                    className="rounded border-gray-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                  />
                  <label htmlFor="createIsActive" className="text-xs text-gray-700 font-medium">
                    Account is active immediately
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateOpen(false);
                      resetCreateForm();
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-lg hover:bg-[#6D28D9] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCreating && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>Create User</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl relative animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#7C3AED]" />
                <span>Edit Administrator</span>
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              {editModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editModalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AdminRole)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Change Password <span className="font-normal text-gray-400">(Leave blank to keep existing password)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsActive"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-[#7C3AED] focus:ring-[#7C3AED]"
                />
                <label htmlFor="editIsActive" className="text-xs text-gray-700 font-medium">
                  Account is active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-lg hover:bg-[#6D28D9] disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PASSWORD RESET LINK MODAL */}
      {resetModalUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl relative animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <span>Password Reset Link</span>
              </h2>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isGeneratingToken ? (
              <div className="py-8 text-center text-gray-500">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
                <span>Generating secure single-use reset token...</span>
              </div>
            ) : resetTokenData ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  A single-use password reset token has been generated for <strong>{resetModalUser.email}</strong>.
                  This token expires in 1 hour.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reset Token (Secret)</label>
                  <div className="p-3 bg-gray-50 border border-gray-300 rounded font-mono text-xs select-all break-all flex items-center justify-between gap-2">
                    <span className="text-gray-900">{resetTokenData.token}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(resetTokenData.token)}
                      className="text-[#7C3AED] hover:text-[#6D28D9] text-xs flex items-center gap-1 shrink-0 font-sans font-medium"
                    >
                      {tokenCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span>{tokenCopied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <p className="font-semibold mb-1">Security Note:</p>
                  <p>Only the cryptographic SHA-256 hash is stored in the database. Once used or expired, this token is invalidated automatically.</p>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setResetModalUser(null)}
                    className="px-4 py-2 bg-[#7C3AED] text-white text-sm font-medium rounded-lg hover:bg-[#6D28D9]"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* CONFIRM TOGGLE STATUS MODAL */}
      {confirmToggleUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl relative animate-scaleUp">
            <div className="flex items-center gap-3 text-gray-900 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                confirmToggleUser.isActive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {confirmToggleUser.isActive ? <UserX className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {confirmToggleUser.isActive ? 'Deactivate Administrator?' : 'Activate Administrator?'}
                </h3>
                <p className="text-xs text-gray-500">{confirmToggleUser.email}</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-5">
              {confirmToggleUser.isActive
                ? 'Deactivating this user will immediately revoke all administrative access and prevent future logins until re-activated.'
                : 'Activating this user will allow them to log into the administrative control center with their assigned permissions.'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmToggleUser(null)}
                className="px-3.5 py-1.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={isTogglingStatus}
                className={`px-3.5 py-1.5 text-white text-sm font-medium rounded-lg flex items-center gap-2 ${
                  confirmToggleUser.isActive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTogglingStatus && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{confirmToggleUser.isActive ? 'Deactivate' : 'Activate'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
