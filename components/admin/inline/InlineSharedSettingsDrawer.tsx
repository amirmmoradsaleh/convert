'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Check,
  Globe,
  FolderOpen,
  Layers,
  Layout,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Share2,
  HelpCircle,
} from 'lucide-react';
import MediaPickerModal from '@/components/admin/media/MediaPickerModal';
import { MediaAssetItem, HeaderNavItem, FooterGroupItem } from '@/lib/admin/types';

interface InlineSharedSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
}

export function InlineSharedSettingsDrawer({
  isOpen,
  onClose,
  onSettingsSaved,
}: InlineSharedSettingsDrawerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'header' | 'footer' | 'general'>('header');

  const [settings, setSettings] = useState<Record<string, any>>({
    siteName: 'Convert24',
    siteUrl: 'https://convert24.local',
    siteLogo: '',
    headerTagline: 'Fast, Free & Private Online File Tools',
    headerCtaLabel: 'Explore All',
    headerCtaLink: '/#explore-hubs',
    headerCtaVisible: true,
    headerNav: [
      { id: 'nav-1', label: 'Blog', href: '/blog', order: 1, visible: true, openNewTab: false },
      { id: 'nav-2', label: 'Pricing', href: '/#pricing', order: 2, visible: true, openNewTab: false },
      { id: 'nav-3', label: 'Help', href: '/#faq', order: 3, visible: true, openNewTab: false },
    ],
    footerDescription:
      'Fast, privacy-focused image and PDF utility tools. Process files safely in your browser without registration, subscriptions, or remote cloud uploads.',
    copyrightText: '© {year} Convert24. Free online file utility service. All rights reserved.',
    trustText: 'Client-side processing • 100% Free • No registration',
    footerGroups: [],
    socialLinks: {},
    defaultSeoTitle: 'Convert24 – Free Online File Tools',
    defaultMetaDescription:
      'Fast, secure, 100% free image and PDF conversion utilities entirely in your browser.',
    defaultOgImage: '/images/og-image.png',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<'logo' | 'og'>('logo');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setFeedback(null);
      fetch('/api/admin/settings')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.settings) {
            setSettings(data.settings);
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', text: 'Site settings, Header & Footer updated successfully!' });
        
        // Broadcast custom event so active Header component updates in real time
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('convert24:settings-updated', {
              detail: data.settings || settings,
            })
          );
        }

        // Refresh Next.js server components
        router.refresh();

        if (onSettingsSaved) onSettingsSaved();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Failed to update shared settings.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Network error saving settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMediaSelect = (asset: MediaAssetItem | null) => {
    if (asset) {
      if (mediaTarget === 'logo') {
        setSettings((prev) => ({ ...prev, siteLogo: asset.url }));
      } else {
        setSettings((prev) => ({ ...prev, defaultOgImage: asset.url }));
      }
    }
    setIsMediaPickerOpen(false);
  };

  // --- Header Nav Item Handlers ---
  const handleAddNavItem = () => {
    const newNav: HeaderNavItem = {
      id: `nav-${Date.now()}`,
      label: 'New Link',
      href: '/',
      order: (settings.headerNav?.length || 0) + 1,
      visible: true,
      openNewTab: false,
    };
    setSettings((prev) => ({
      ...prev,
      headerNav: [...(prev.headerNav || []), newNav],
    }));
  };

  const handleUpdateNavItem = (index: number, field: keyof HeaderNavItem, value: any) => {
    setSettings((prev) => {
      const list = [...(prev.headerNav || [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, headerNav: list };
    });
  };

  const handleRemoveNavItem = (index: number) => {
    setSettings((prev) => {
      const list = [...(prev.headerNav || [])];
      list.splice(index, 1);
      return { ...prev, headerNav: list };
    });
  };

  const handleMoveNavItem = (index: number, direction: 'up' | 'down') => {
    setSettings((prev) => {
      const list = [...(prev.headerNav || [])];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return { ...prev, headerNav: list };
    });
  };

  // --- Footer Group & Link Handlers ---
  const handleAddFooterGroup = () => {
    const newGroup: FooterGroupItem = {
      title: 'New Column',
      links: [{ label: 'Example Link', href: '/', openNewTab: false }],
    };
    setSettings((prev) => ({
      ...prev,
      footerGroups: [...(prev.footerGroups || []), newGroup],
    }));
  };

  const handleRemoveFooterGroup = (groupIndex: number) => {
    setSettings((prev) => {
      const groups = [...(prev.footerGroups || [])];
      groups.splice(groupIndex, 1);
      return { ...prev, footerGroups: groups };
    });
  };

  const handleUpdateGroupTitle = (groupIndex: number, title: string) => {
    setSettings((prev) => {
      const groups = [...(prev.footerGroups || [])];
      groups[groupIndex] = { ...groups[groupIndex], title };
      return { ...prev, footerGroups: groups };
    });
  };

  const handleAddFooterLink = (groupIndex: number) => {
    setSettings((prev) => {
      const groups = [...(prev.footerGroups || [])];
      const targetGroup = { ...groups[groupIndex] };
      targetGroup.links = [...(targetGroup.links || []), { label: 'New Link', href: '/', openNewTab: false }];
      groups[groupIndex] = targetGroup;
      return { ...prev, footerGroups: groups };
    });
  };

  const handleUpdateFooterLink = (
    groupIndex: number,
    linkIndex: number,
    field: string,
    value: any
  ) => {
    setSettings((prev) => {
      const groups = [...(prev.footerGroups || [])];
      const targetGroup = { ...groups[groupIndex] };
      const links = [...(targetGroup.links || [])];
      links[linkIndex] = { ...links[linkIndex], [field]: value };
      targetGroup.links = links;
      groups[groupIndex] = targetGroup;
      return { ...prev, footerGroups: groups };
    });
  };

  const handleRemoveFooterLink = (groupIndex: number, linkIndex: number) => {
    setSettings((prev) => {
      const groups = [...(prev.footerGroups || [])];
      const targetGroup = { ...groups[groupIndex] };
      const links = [...(targetGroup.links || [])];
      links.splice(linkIndex, 1);
      targetGroup.links = links;
      groups[groupIndex] = targetGroup;
      return { ...prev, footerGroups: groups };
    });
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
        aria-labelledby="shared-settings-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-auto fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-xl bg-white border-l border-[#E4E2F0] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
              
              {/* Header */}
              <div className="p-5 border-b border-[#E4E2F0] bg-[#FAF9FF] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E4E2F0] flex items-center justify-center shadow-sm">
                    <Layout className="w-5 h-5 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h3 id="shared-settings-title" className="text-base font-bold text-[#0F112E]">
                      Header & Footer CMS Settings
                    </h3>
                    <p className="text-xs text-[#5E6488]">Manage Navigation, Brand Identity, and Footer</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl text-[#5E6488] hover:text-[#0F112E] hover:bg-slate-100 transition-colors"
                  aria-label="Close settings"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-[#E4E2F0] bg-[#FCFBFF] px-5 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('header')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'header'
                      ? 'border-[#7C3AED] text-[#7C3AED]'
                      : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Header & Nav
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('footer')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'footer'
                      ? 'border-[#7C3AED] text-[#7C3AED]'
                      : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  Footer & Links
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('general')}
                  className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === 'general'
                      ? 'border-[#7C3AED] text-[#7C3AED]'
                      : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  SEO & General
                </button>
              </div>

              {/* Notification Banner */}
              {feedback && (
                <div
                  className={`p-3 text-xs font-semibold ${
                    feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'
                  }`}
                >
                  {feedback.text}
                </div>
              )}

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* TAB 1: HEADER & BRAND */}
                {activeTab === 'header' && (
                  <div className="space-y-5 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        value={settings.siteName || ''}
                        onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                        placeholder="Convert24"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Brand Tagline / Header Subtitle
                      </label>
                      <input
                        type="text"
                        value={settings.headerTagline || ''}
                        onChange={(e) => setSettings({ ...settings, headerTagline: e.target.value })}
                        placeholder="Fast, Free & Private Online File Tools"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>

                    {/* Logo Image */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Custom Brand Logo (Optional)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMediaTarget('logo');
                            setIsMediaPickerOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#EDE9FE] rounded-lg text-xs font-bold transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Media Library
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        {settings.siteLogo ? (
                          <div className="w-10 h-10 rounded-xl border border-[#E4E2F0] overflow-hidden flex items-center justify-center bg-slate-50 flex-shrink-0">
                            <img src={settings.siteLogo} alt="Logo preview" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#6366F1] flex items-center justify-center text-white flex-shrink-0">
                            <Layers className="w-5 h-5" />
                          </div>
                        )}
                        <input
                          type="text"
                          value={settings.siteLogo || ''}
                          onChange={(e) => setSettings({ ...settings, siteLogo: e.target.value })}
                          placeholder="Logo image URL (leave empty for default icon)"
                          className="flex-1 px-3.5 py-2 rounded-xl border border-[#E4E2F0] text-xs text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                    </div>

                    {/* Header CTA Button */}
                    <div className="p-4 bg-[#FAF9FF] border border-[#E4E2F0] rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0F112E]">
                          Header Action Button (CTA)
                        </span>
                        <label className="inline-flex items-center gap-1.5 text-xs text-[#5E6488] font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.headerCtaVisible !== false}
                            onChange={(e) => setSettings({ ...settings, headerCtaVisible: e.target.checked })}
                            className="rounded border-[#E4E2F0] text-[#7C3AED] focus:ring-[#7C3AED]"
                          />
                          Display CTA
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#5E6488] mb-1">Button Label</label>
                          <input
                            type="text"
                            value={settings.headerCtaLabel || ''}
                            onChange={(e) => setSettings({ ...settings, headerCtaLabel: e.target.value })}
                            placeholder="Explore All"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#5E6488] mb-1">Destination URL</label>
                          <input
                            type="text"
                            value={settings.headerCtaLink || ''}
                            onChange={(e) => setSettings({ ...settings, headerCtaLink: e.target.value })}
                            placeholder="/#explore-hubs"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Header Navigation Links */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                            Header Navigation Items
                          </label>
                          <p className="text-[11px] text-[#5E6488]">
                            Tools mega menu is fixed. Edit secondary navigation links here:
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddNavItem}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Link
                        </button>
                      </div>

                      <div className="space-y-2">
                        {(settings.headerNav || []).map((nav: HeaderNavItem, idx: number) => (
                          <div
                            key={nav.id || idx}
                            className="p-3 bg-white border border-[#E4E2F0] rounded-xl flex items-center gap-2.5 shadow-sm"
                          >
                            <div className="flex flex-col">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveNavItem(idx, 'up')}
                                className="text-[#5E6488] hover:text-[#0F112E] disabled:opacity-20 p-0.5"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === (settings.headerNav?.length || 0) - 1}
                                onClick={() => handleMoveNavItem(idx, 'down')}
                                className="text-[#5E6488] hover:text-[#0F112E] disabled:opacity-20 p-0.5"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                value={nav.label || ''}
                                onChange={(e) => handleUpdateNavItem(idx, 'label', e.target.value)}
                                placeholder="Label"
                                className="px-2.5 py-1.5 rounded-lg border border-[#E4E2F0] text-xs font-semibold text-[#0F112E]"
                              />
                              <input
                                type="text"
                                value={nav.href || ''}
                                onChange={(e) => handleUpdateNavItem(idx, 'href', e.target.value)}
                                placeholder="/path or https://"
                                className="px-2.5 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                              />
                            </div>

                            <label className="flex items-center gap-1 text-[11px] text-[#5E6488] cursor-pointer" title="Open in new tab">
                              <input
                                type="checkbox"
                                checked={Boolean(nav.openNewTab)}
                                onChange={(e) => handleUpdateNavItem(idx, 'openNewTab', e.target.checked)}
                                className="rounded text-[#7C3AED]"
                              />
                              <ExternalLink className="w-3 h-3" />
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveNavItem(idx)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: FOOTER & LINKS */}
                {activeTab === 'footer' && (
                  <div className="space-y-5 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Footer Description
                      </label>
                      <textarea
                        rows={3}
                        value={settings.footerDescription || ''}
                        onChange={(e) => setSettings({ ...settings, footerDescription: e.target.value })}
                        placeholder="Fast, privacy-focused image and PDF utility tools..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-xs text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Copyright Notice
                        </label>
                        <input
                          type="text"
                          value={settings.copyrightText || ''}
                          onChange={(e) => setSettings({ ...settings, copyrightText: e.target.value })}
                          placeholder="© {year} Convert24. All rights reserved."
                          className="w-full px-3.5 py-2 rounded-xl border border-[#E4E2F0] text-xs text-[#0F112E]"
                        />
                        <span className="text-[10px] text-[#5E6488] mt-1 block">Tip: Use {"{year}"} for automatic current year.</span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Trust Statement Tagline
                        </label>
                        <input
                          type="text"
                          value={settings.trustText || ''}
                          onChange={(e) => setSettings({ ...settings, trustText: e.target.value })}
                          placeholder="Client-side processing • 100% Free • No registration"
                          className="w-full px-3.5 py-2 rounded-xl border border-[#E4E2F0] text-xs text-[#0F112E]"
                        />
                      </div>
                    </div>

                    {/* Social Media Links */}
                    <div className="p-4 bg-[#FAF9FF] border border-[#E4E2F0] rounded-2xl space-y-3">
                      <div className="flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-[#7C3AED]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-[#0F112E]">
                          Social Media Profiles
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#5E6488] mb-1">Twitter / X URL</label>
                          <input
                            type="text"
                            value={settings.socialLinks?.twitter || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                socialLinks: { ...settings.socialLinks, twitter: e.target.value },
                              })
                            }
                            placeholder="https://x.com/convert24"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#5E6488] mb-1">GitHub URL</label>
                          <input
                            type="text"
                            value={settings.socialLinks?.github || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                socialLinks: { ...settings.socialLinks, github: e.target.value },
                              })
                            }
                            placeholder="https://github.com/convert24"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#5E6488] mb-1">Discord / Community URL</label>
                          <input
                            type="text"
                            value={settings.socialLinks?.discord || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                socialLinks: { ...settings.socialLinks, discord: e.target.value },
                              })
                            }
                            placeholder="https://discord.gg/..."
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#5E6488] mb-1">LinkedIn URL</label>
                          <input
                            type="text"
                            value={settings.socialLinks?.linkedin || ''}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                socialLinks: { ...settings.socialLinks, linkedin: e.target.value },
                              })
                            }
                            placeholder="https://linkedin.com/company/..."
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Footer Navigation Columns */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                            Footer Navigation Columns & Groups
                          </label>
                          <p className="text-[11px] text-[#5E6488]">Manage footer columns and their link lists:</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddFooterGroup}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Column
                        </button>
                      </div>

                      <div className="space-y-4">
                        {(settings.footerGroups || []).map((group: FooterGroupItem, gIdx: number) => (
                          <div
                            key={gIdx}
                            className="p-4 bg-[#FCFBFF] border border-[#E4E2F0] rounded-2xl space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <input
                                type="text"
                                value={group.title || ''}
                                onChange={(e) => handleUpdateGroupTitle(gIdx, e.target.value)}
                                placeholder="Column Title"
                                className="px-3 py-1.5 rounded-xl border border-[#E4E2F0] text-xs font-bold text-[#0F112E] bg-white flex-1 max-w-xs"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleAddFooterLink(gIdx)}
                                  className="text-xs font-bold text-[#7C3AED] hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Add Link
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFooterGroup(gIdx)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete column"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2 pl-2 border-l-2 border-[#E4E2F0]">
                              {(group.links || []).map((link, lIdx) => (
                                <div key={lIdx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={link.label || ''}
                                    onChange={(e) =>
                                      handleUpdateFooterLink(gIdx, lIdx, 'label', e.target.value)
                                    }
                                    placeholder="Label"
                                    className="w-1/3 px-2.5 py-1.5 rounded-lg border border-[#E4E2F0] text-xs font-medium text-[#0F112E] bg-white"
                                  />
                                  <input
                                    type="text"
                                    value={link.href || ''}
                                    onChange={(e) =>
                                      handleUpdateFooterLink(gIdx, lIdx, 'href', e.target.value)
                                    }
                                    placeholder="/destination"
                                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#E4E2F0] text-xs text-[#0F112E] bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFooterLink(gIdx, lIdx)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: GENERAL & SEO */}
                {activeTab === 'general' && (
                  <div className="space-y-5 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Production Canonical Site URL
                      </label>
                      <input
                        type="text"
                        value={settings.siteUrl || ''}
                        onChange={(e) => setSettings({ ...settings, siteUrl: e.target.value })}
                        placeholder="https://convert24.local"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Default Site SEO Title
                      </label>
                      <input
                        type="text"
                        value={settings.defaultSeoTitle || ''}
                        onChange={(e) => setSettings({ ...settings, defaultSeoTitle: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Default Meta Description
                      </label>
                      <textarea
                        rows={3}
                        value={settings.defaultMetaDescription || ''}
                        onChange={(e) =>
                          setSettings({ ...settings, defaultMetaDescription: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Default Social Share Image (OG Image)
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMediaTarget('og');
                            setIsMediaPickerOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#EDE9FE] rounded-lg text-xs font-bold transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Media Library
                        </button>
                      </div>
                      <input
                        type="text"
                        value={settings.defaultOgImage || ''}
                        onChange={(e) => setSettings({ ...settings, defaultOgImage: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-[#E4E2F0] flex items-center justify-end gap-3 sticky bottom-0 bg-white py-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#5E6488] hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        currentUrl={mediaTarget === 'logo' ? settings.siteLogo : settings.defaultOgImage}
        title={mediaTarget === 'logo' ? 'Select Site Logo' : 'Select Default OG Image'}
      />
    </>
  );
}
