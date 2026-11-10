'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Compass,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Save,
  RotateCcw,
  X,
  HelpCircle,
} from 'lucide-react';
import { HeaderNavItem } from '@/lib/admin/types';

export default function AdminNavigationPage() {
  const [items, setItems] = useState<HeaderNavItem[]>([]);
  const [savedItems, setSavedItems] = useState<HeaderNavItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Item Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLabel, setAddLabel] = useState('');
  const [addDestination, setAddDestination] = useState('');
  const [addOpenNewTab, setAddOpenNewTab] = useState(false);
  const [addVisible, setAddVisible] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Edit Item Modal state
  const [editingItem, setEditingItem] = useState<HeaderNavItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editOpenNewTab, setEditOpenNewTab] = useState(false);
  const [editVisible, setEditVisible] = useState(true);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirmation Modal state
  const [deletingItem, setDeletingItem] = useState<HeaderNavItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchItems = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/navigation');
      if (!res.ok) throw new Error('Failed to load navigation items.');
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setItems(data.items);
        setSavedItems(data.items);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading navigation items.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Determine if the current in-memory order differs from saved state
  const isDirty = useMemo(() => {
    if (items.length !== savedItems.length) return true;
    for (let i = 0; i < items.length; i++) {
      if (items[i].id !== savedItems[i]?.id) return true;
    }
    return false;
  }, [items, savedItems]);

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setItems(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setItems(newItems);
  };

  const handleResetOrder = () => {
    setItems([...savedItems]);
    setStatusMessage(null);
  };

  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: items.map((i) => i.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to persist navigation item order.');
      }
      if (Array.isArray(data.items)) {
        setItems(data.items);
        setSavedItems(data.items);
      } else {
        setSavedItems([...items]);
      }
      setStatusMessage({ type: 'success', text: 'Navigation item order saved successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving navigation order.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleToggleVisibility = async (item: HeaderNavItem) => {
    setStatusMessage(null);
    try {
      const nextVisible = !item.visible;
      const res = await fetch(`/api/admin/navigation/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: nextVisible }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update item visibility.');
      }
      const updatedList = items.map((i) => (i.id === item.id ? { ...i, visible: nextVisible } : i));
      setItems(updatedList);
      setSavedItems(savedItems.map((i) => (i.id === item.id ? { ...i, visible: nextVisible } : i)));
      setStatusMessage({
        type: 'success',
        text: `Link '${item.label}' is now ${nextVisible ? 'visible on' : 'hidden from'} the public header.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating visibility.';
      setStatusMessage({ type: 'error', text: msg });
    }
  };

  const handleOpenAddModal = () => {
    setAddLabel('');
    setAddDestination('');
    setAddOpenNewTab(false);
    setAddVisible(true);
    setAddError(null);
    setShowAddModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const trimmedLabel = addLabel.trim();
    const trimmedDest = addDestination.trim();

    if (!trimmedLabel) {
      setAddError('Label is required.');
      return;
    }
    if (trimmedLabel.length > 60) {
      setAddError('Label cannot exceed 60 characters.');
      return;
    }
    if (!trimmedDest) {
      setAddError('Destination URL is required.');
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: trimmedLabel,
          destination: trimmedDest,
          openNewTab: addOpenNewTab,
          visible: addVisible,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create navigation item.');
      }
      setShowAddModal(false);
      await fetchItems();
      setStatusMessage({
        type: 'success',
        text: `Navigation item '${trimmedLabel}' created successfully.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating navigation item.';
      setAddError(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenEditModal = (item: HeaderNavItem) => {
    setEditingItem(item);
    setEditLabel(item.label);
    setEditDestination(item.href);
    setEditOpenNewTab(Boolean(item.openNewTab));
    setEditVisible(item.visible !== false);
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);

    const trimmedLabel = editLabel.trim();
    const trimmedDest = editDestination.trim();

    if (!trimmedLabel) {
      setEditError('Label is required.');
      return;
    }
    if (trimmedLabel.length > 60) {
      setEditError('Label cannot exceed 60 characters.');
      return;
    }
    if (!trimmedDest) {
      setEditError('Destination URL is required.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/navigation/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: trimmedLabel,
          destination: trimmedDest,
          openNewTab: editOpenNewTab,
          visible: editVisible,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update navigation item.');
      }
      setEditingItem(null);
      await fetchItems();
      setStatusMessage({
        type: 'success',
        text: `Navigation item '${trimmedLabel}' updated successfully.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating navigation item.';
      setEditError(msg);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenDeleteModal = (item: HeaderNavItem) => {
    setDeletingItem(item);
    setDeleteError(null);
  };

  const handleDeleteSubmit = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/navigation/${deletingItem.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete navigation item.');
      }
      const deletedLabel = deletingItem.label;
      setDeletingItem(null);
      await fetchItems();
      setStatusMessage({
        type: 'success',
        text: `Navigation item '${deletedLabel}' was deleted.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting navigation item.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E4E2F0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-[#7C3AED]" />
            <h1 className="text-xl font-extrabold text-[#0F112E] tracking-tight">
              Header Navigation
            </h1>
          </div>
          <p className="text-xs text-[#5E6488] mt-1">
            Manage public site header menu links, target destinations, ordering, and visibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${
              isDirty
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isDirty ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Pending Order Changes</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All Changes Saved</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Global Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]'
              : 'bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Reordering Pending Action Bar */}
      {isDirty && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-900">
              You have unsaved order changes. The public header will not reflect the new sequence until saved.
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={isSavingOrder}
              onClick={handleResetOrder}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#D97706]/40 hover:bg-[#FEF3C7] text-amber-900 text-xs font-semibold rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              disabled={isSavingOrder}
              onClick={handleSaveOrder}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isSavingOrder ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSavingOrder ? 'Saving...' : 'Save Order'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-[#5E6488] bg-white rounded-2xl border border-[#E4E2F0]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#7C3AED]" />
          <span>Loading navigation items...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-[#E4E2F0] p-8">
          <Compass className="w-10 h-10 mx-auto text-[#94A3B8] mb-3" />
          <h3 className="text-sm font-bold text-[#0F112E]">No Navigation Items</h3>
          <p className="text-xs text-[#5E6488] max-w-sm mx-auto mt-1 mb-5">
            The header navigation menu is currently empty. Add your first item to display links in the shared site header.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Menu Item</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E4E2F0] shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#F9F9FC] border-b border-[#E4E2F0] flex items-center justify-between text-xs font-semibold text-[#5E6488]">
            <span>Header Navigation Items ({items.length})</span>
            <span>Use the arrow buttons to change public menu display sequence</span>
          </div>

          <div className="divide-y divide-[#E4E2F0]">
            {items.map((item, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === items.length - 1;
              const isExt = item.isExternal || item.openNewTab || item.href.startsWith('http');

              return (
                <div
                  key={item.id}
                  className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    item.visible === false ? 'bg-[#FAFAFC]/60 opacity-75' : 'hover:bg-[#FBFBFF]'
                  }`}
                >
                  {/* Left: Position handle + Label & URL */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 w-7 h-7 rounded-lg bg-[#F4F3FA] text-[#0F112E] font-bold text-xs flex items-center justify-center border border-[#E4E2F0]">
                      #{idx + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#0F112E] truncate">
                          {item.label}
                        </span>

                        {/* Visibility Badge */}
                        {item.visible === false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <EyeOff className="w-2.5 h-2.5" />
                            Hidden
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Eye className="w-2.5 h-2.5" />
                            Visible
                          </span>
                        )}

                        {/* Target badge */}
                        {isExt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <ExternalLink className="w-2.5 h-2.5" />
                            {item.openNewTab ? 'New Tab' : 'External'}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#5E6488] font-mono truncate mt-0.5 max-w-md">
                        {item.href}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveUp(idx)}
                      aria-label={`Move ${item.label} up`}
                      title="Move Up"
                      className="p-1.5 rounded-lg border border-[#E4E2F0] text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveDown(idx)}
                      aria-label={`Move ${item.label} down`}
                      title="Move Down"
                      className="p-1.5 rounded-lg border border-[#E4E2F0] text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <div className="h-4 w-px bg-[#E4E2F0] mx-1" />

                    {/* Toggle Visibility */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(item)}
                      aria-label={item.visible === false ? `Make ${item.label} visible` : `Hide ${item.label}`}
                      title={item.visible === false ? 'Show in menu' : 'Hide from menu'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        item.visible === false
                          ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                          : 'border-[#E4E2F0] text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA]'
                      }`}
                    >
                      {item.visible === false ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      aria-label={`Edit ${item.label}`}
                      title="Edit Item"
                      className="p-1.5 rounded-lg border border-[#E4E2F0] text-[#5E6488] hover:text-[#7C3AED] hover:border-[#7C3AED]/40 hover:bg-purple-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleOpenDeleteModal(item)}
                      aria-label={`Delete ${item.label}`}
                      title="Delete Item"
                      className="p-1.5 rounded-lg border border-[#E4E2F0] text-[#5E6488] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Helpful Instructions Card */}
      <div className="bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl p-4 text-xs text-[#5E6488] space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-[#0F112E]">
          <HelpCircle className="w-4 h-4 text-[#7C3AED]" />
          <span>Destination Guidelines & URL Security</span>
        </div>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Internal Links:</strong> Use root-relative paths like <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">/blog</code>, <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">/tools/jpg-to-png</code>, or <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">/#faq</code>.
          </li>
          <li>
            <strong>External Links:</strong> Use full HTTPS URLs like <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">https://github.com/convert24</code>. External links automatically receive <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">rel="noopener noreferrer"</code>.
          </li>
          <li>
            <strong>Security Safeguards:</strong> Dangerous schemes (<code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">javascript:</code>, <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">data:</code>, <code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">vbscript:</code>) and protocol-relative bypasses (<code className="bg-white px-1 py-0.5 rounded border border-[#E4E2F0]">//evil.com</code>) are strictly rejected on both client and server.
          </li>
        </ul>
      </div>

      {/* CREATE MODAL */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl border border-[#E4E2F0] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E2F0] flex items-center justify-between bg-[#FBFBFF]">
              <h2 id="add-modal-title" className="text-base font-bold text-[#0F112E]">
                Add Navigation Item
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#5E6488] hover:text-[#0F112E] p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1">
                  Item Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  placeholder="e.g. Tools, Blog, Pricing"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
                <span className="text-[10px] text-[#5E6488] mt-1 block">
                  Max 60 characters. Appears directly in the site header.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1">
                  Destination URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addDestination}
                  onChange={(e) => setAddDestination(e.target.value)}
                  placeholder="e.g. /blog, /tools/merge-pdf, https://..."
                  className="w-full px-3.5 py-2 text-xs font-mono border border-[#E4E2F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
                <span className="text-[10px] text-[#5E6488] mt-1 block">
                  Relative path (starts with /), anchor (#faq), or external URL (https://).
                </span>
              </div>

              <div className="pt-2 space-y-2 border-t border-[#F4F3FA]">
                <label className="flex items-center gap-2 text-xs text-[#0F112E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addOpenNewTab}
                    onChange={(e) => setAddOpenNewTab(e.target.checked)}
                    className="w-4 h-4 text-[#7C3AED] rounded border-[#E4E2F0] focus:ring-[#7C3AED]"
                  />
                  <span>Open link in a new tab (target="_blank")</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#0F112E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addVisible}
                    onChange={(e) => setAddVisible(e.target.checked)}
                    className="w-4 h-4 text-[#7C3AED] rounded border-[#E4E2F0] focus:ring-[#7C3AED]"
                  />
                  <span>Visible in public header</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E4E2F0]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#E4E2F0] text-[#0F112E] text-xs font-semibold rounded-xl hover:bg-[#F4F3FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {isAdding ? 'Creating...' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl border border-[#E4E2F0] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E2F0] flex items-center justify-between bg-[#FBFBFF]">
              <h2 id="edit-modal-title" className="text-base font-bold text-[#0F112E]">
                Edit Navigation Item
              </h2>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-[#5E6488] hover:text-[#0F112E] p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1">
                  Item Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F112E] mb-1">
                  Destination URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDestination}
                  onChange={(e) => setEditDestination(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-mono border border-[#E4E2F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                />
              </div>

              <div className="pt-2 space-y-2 border-t border-[#F4F3FA]">
                <label className="flex items-center gap-2 text-xs text-[#0F112E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editOpenNewTab}
                    onChange={(e) => setEditOpenNewTab(e.target.checked)}
                    className="w-4 h-4 text-[#7C3AED] rounded border-[#E4E2F0] focus:ring-[#7C3AED]"
                  />
                  <span>Open link in a new tab (target="_blank")</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#0F112E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editVisible}
                    onChange={(e) => setEditVisible(e.target.checked)}
                    className="w-4 h-4 text-[#7C3AED] rounded border-[#E4E2F0] focus:ring-[#7C3AED]"
                  />
                  <span>Visible in public header</span>
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#E4E2F0]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-[#E4E2F0] text-[#0F112E] text-xs font-semibold rounded-xl hover:bg-[#F4F3FA] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl border border-[#E4E2F0] shadow-xl w-full max-w-sm overflow-hidden p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center">
              <h2 id="delete-modal-title" className="text-base font-bold text-[#0F112E]">
                Delete Navigation Item?
              </h2>
              <p className="text-xs text-[#5E6488] mt-1.5">
                Are you sure you want to remove <strong>"{deletingItem.label}"</strong> ({deletingItem.href}) from the header navigation?
              </p>
              <p className="text-[11px] text-red-600 mt-2 font-medium">
                This will immediately remove the link from the public header.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingItem(null)}
                className="w-full px-4 py-2 border border-[#E4E2F0] text-[#0F112E] text-xs font-semibold rounded-xl hover:bg-[#F4F3FA] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteSubmit}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
