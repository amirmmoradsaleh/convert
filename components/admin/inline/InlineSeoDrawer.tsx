'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Search,
  Share2,
  Code2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Globe,
  FileText,
  Lock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { isSafeUrl } from '@/lib/admin/validation';
import { siteConfig } from '@/lib/seo';

export interface InlineSeoData {
  seoTitle?: string | null;
  metaDescription?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogType?: string | null;
  twitterCard?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  schemaType?: string | null;
  schemaJson?: Record<string, any> | string | null;
  focusKeyword?: string | null;
}

interface InlineSeoDrawerProps {
  slug: string;
  pageType?: 'tool' | 'page' | 'format' | 'blog' | 'home';
  isOpen: boolean;
  onClose: () => void;
  seoData: InlineSeoData | null;
  inheritedDefaults: {
    title: string;
    description: string;
    canonicalUrl: string;
    ogImage?: string;
  };
  onSaveSeo: (updatedSeo: InlineSeoData) => void;
}

export function InlineSeoDrawer({
  slug,
  pageType = 'tool',
  isOpen,
  onClose,
  seoData,
  inheritedDefaults,
  onSaveSeo,
}: InlineSeoDrawerProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'social' | 'schema'>('search');
  const [formData, setFormData] = useState<InlineSeoData>({});
  const [schemaRawText, setSchemaRawText] = useState('');
  const [schemaJsonError, setSchemaJsonError] = useState<string | null>(null);
  const [urlErrors, setUrlErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (seoData) {
      setFormData({
        seoTitle: seoData.seoTitle ?? '',
        metaDescription: seoData.metaDescription ?? '',
        canonicalUrl: seoData.canonicalUrl ?? '',
        robotsIndex: seoData.robotsIndex !== false,
        robotsFollow: seoData.robotsFollow !== false,
        ogTitle: seoData.ogTitle ?? '',
        ogDescription: seoData.ogDescription ?? '',
        ogImage: seoData.ogImage ?? '',
        ogType: seoData.ogType ?? 'website',
        twitterCard: seoData.twitterCard ?? 'summary_large_image',
        twitterTitle: seoData.twitterTitle ?? '',
        twitterDescription: seoData.twitterDescription ?? '',
        twitterImage: seoData.twitterImage ?? '',
        schemaType: seoData.schemaType ?? (pageType === 'tool' ? 'WebApplication' : 'WebPage'),
        focusKeyword: seoData.focusKeyword ?? '',
      });

      if (seoData.schemaJson) {
        if (typeof seoData.schemaJson === 'string') {
          setSchemaRawText(seoData.schemaJson);
        } else {
          setSchemaRawText(JSON.stringify(seoData.schemaJson, null, 2));
        }
      } else {
        setSchemaRawText('');
      }
    }
  }, [seoData, pageType]);

  if (!isOpen) return null;

  // Real-time calculated values with inheritance fallback
  const effectiveTitle = (formData.seoTitle && formData.seoTitle.trim().length > 0)
    ? formData.seoTitle.trim()
    : inheritedDefaults.title;

  const effectiveDescription = (formData.metaDescription && formData.metaDescription.trim().length > 0)
    ? formData.metaDescription.trim()
    : inheritedDefaults.description;

  const effectiveCanonicalUrl = (formData.canonicalUrl && formData.canonicalUrl.trim().length > 0)
    ? formData.canonicalUrl.trim()
    : inheritedDefaults.canonicalUrl;

  const effectiveOgTitle = (formData.ogTitle && formData.ogTitle.trim().length > 0)
    ? formData.ogTitle.trim()
    : effectiveTitle;

  const effectiveOgDescription = (formData.ogDescription && formData.ogDescription.trim().length > 0)
    ? formData.ogDescription.trim()
    : effectiveDescription;

  const effectiveOgImage = (formData.ogImage && formData.ogImage.trim().length > 0)
    ? formData.ogImage.trim()
    : (inheritedDefaults.ogImage || siteConfig.ogImage);

  const effectiveTwitterTitle = (formData.twitterTitle && formData.twitterTitle.trim().length > 0)
    ? formData.twitterTitle.trim()
    : effectiveOgTitle;

  const effectiveTwitterDescription = (formData.twitterDescription && formData.twitterDescription.trim().length > 0)
    ? formData.twitterDescription.trim()
    : effectiveOgDescription;

  const effectiveTwitterImage = (formData.twitterImage && formData.twitterImage.trim().length > 0)
    ? formData.twitterImage.trim()
    : effectiveOgImage;

  // Title character length advice
  const titleLength = (formData.seoTitle || '').length;
  const getTitleLengthStatus = () => {
    if (titleLength === 0) return { label: 'Inherited from page title', color: 'text-gray-500', bg: 'bg-gray-100' };
    if (titleLength < 30) return { label: 'Shorter than recommended (30-60 chars)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    if (titleLength <= 60) return { label: 'Optimal length (30-60 chars)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    return { label: 'May be truncated in search snippets (>60 chars)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  };

  // Description character length advice
  const descLength = (formData.metaDescription || '').length;
  const getDescLengthStatus = () => {
    if (descLength === 0) return { label: 'Inherited from default description', color: 'text-gray-500', bg: 'bg-gray-100' };
    if (descLength < 120) return { label: 'Shorter than recommended (120-160 chars)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
    if (descLength <= 160) return { label: 'Optimal length (120-160 chars)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
    return { label: 'May be clipped in snippets (>160 chars)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  };

  const handleSchemaJsonChange = (val: string) => {
    setSchemaRawText(val);
    if (!val.trim()) {
      setSchemaJsonError(null);
      return;
    }
    try {
      JSON.parse(val);
      setSchemaJsonError(null);
    } catch (err: any) {
      setSchemaJsonError(err.message || 'Invalid JSON syntax');
    }
  };

  const handleUrlChange = (field: keyof InlineSeoData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (value && !isSafeUrl(value)) {
      setUrlErrors((prev) => ({
        ...prev,
        [field]: 'Unsafe URL scheme detected (e.g. javascript:, data:). Use http(s) or relative paths.',
      }));
    } else {
      setUrlErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    if (Object.keys(urlErrors).length > 0) {
      alert('Please fix URL scheme errors before saving.');
      return;
    }

    let parsedSchema: Record<string, any> | null = null;
    if (schemaRawText.trim()) {
      try {
        parsedSchema = JSON.parse(schemaRawText);
      } catch {
        alert('Cannot save malformed JSON-LD structured data. Please fix syntax errors.');
        return;
      }
    }

    const payload: InlineSeoData = {
      seoTitle: formData.seoTitle?.trim() || null,
      metaDescription: formData.metaDescription?.trim() || null,
      canonicalUrl: formData.canonicalUrl?.trim() || null,
      robotsIndex: formData.robotsIndex !== false,
      robotsFollow: formData.robotsFollow !== false,
      ogTitle: formData.ogTitle?.trim() || null,
      ogDescription: formData.ogDescription?.trim() || null,
      ogImage: formData.ogImage?.trim() || null,
      ogType: formData.ogType || 'website',
      twitterCard: formData.twitterCard || 'summary_large_image',
      twitterTitle: formData.twitterTitle?.trim() || null,
      twitterDescription: formData.twitterDescription?.trim() || null,
      twitterImage: formData.twitterImage?.trim() || null,
      schemaType: formData.schemaType || null,
      schemaJson: parsedSchema,
      focusKeyword: formData.focusKeyword?.trim() || null,
    };

    onSaveSeo(payload);
    onClose();
  };

  const resetField = (field: keyof InlineSeoData) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === 'robotsIndex' || field === 'robotsFollow' ? true : '',
    }));
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
      aria-labelledby="seo-drawer-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="pointer-events-auto fixed inset-y-0 right-0 flex max-w-full pl-10">
          <div className="w-screen max-w-xl bg-white border-l border-[#E4E2F0] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E4E2F0] bg-[#FAF9FF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shadow-sm">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="seo-drawer-title" className="text-base font-bold text-[#0F112E]">
                    SEO & Metadata Configuration
                  </h3>
                  <p className="text-xs text-[#5E6488] capitalize">
                    {pageType} route: <span className="font-mono font-semibold">/{slug}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-[#5E6488] hover:text-[#0F112E] hover:bg-slate-100 transition-colors"
                aria-label="Close SEO editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Header Navigation Tabs */}
            <div className="flex border-b border-[#E4E2F0] bg-white px-4 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'search'
                    ? 'border-[#7C3AED] text-[#7C3AED]'
                    : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Search Engine (SERP)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('social')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'social'
                    ? 'border-[#7C3AED] text-[#7C3AED]'
                    : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
                }`}
              >
                <Share2 className="w-4 h-4" />
                <span>Social Sharing Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('schema')}
                className={`py-3 px-4 border-b-2 transition-all flex items-center gap-2 ${
                  activeTab === 'schema'
                    ? 'border-[#7C3AED] text-[#7C3AED]'
                    : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>JSON-LD Schema</span>
              </button>
            </div>

            {/* Drawer Body Forms */}
            <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* TAB 1: SEARCH ENGINE (SERP) PREVIEW & FIELDS */}
              {activeTab === 'search' && (
                <div className="space-y-6">
                  {/* Google Search Result Snippet Simulator */}
                  <div className="p-4 bg-[#FAF9FF] border border-[#E4E2F0] rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#5E6488]">
                      <span className="flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5 text-[#7C3AED]" />
                        Search Engine Snippet Preview (Simulated)
                      </span>
                      <span className="text-[10px] text-gray-400">Desktop / Mobile View</span>
                    </div>

                    <div className="p-4 bg-white border border-[#E4E2F0] rounded-xl shadow-sm space-y-1 font-sans">
                      <div className="flex items-center gap-2 text-xs text-[#202124]">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-[#7C3AED] flex items-center justify-center text-[10px] font-bold">
                          C
                        </span>
                        <span className="text-xs text-[#202124] truncate">{siteConfig.name}</span>
                        <span className="text-xs text-[#5f6368] truncate">{effectiveCanonicalUrl}</span>
                      </div>
                      <h4 className="text-lg font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug line-clamp-1">
                        {effectiveTitle}
                      </h4>
                      <p className="text-sm text-[#4d5156] leading-snug line-clamp-2">
                        {effectiveDescription}
                      </p>
                    </div>
                  </div>

                  {/* SEO Title */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] flex items-center gap-2">
                        <span>SEO Title Tag</span>
                        {formData.seoTitle ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-purple-100 text-purple-800 font-bold">
                            Custom Override
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-gray-100 text-gray-600 font-medium">
                            Inherited
                          </span>
                        )}
                      </label>
                      {formData.seoTitle && (
                        <button
                          type="button"
                          onClick={() => resetField('seoTitle')}
                          className="text-[11px] text-[#7C3AED] hover:underline flex items-center gap-1 font-semibold"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset to Inherited
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.seoTitle || ''}
                      onChange={(e) => setFormData({ ...formData, seoTitle: e.target.value })}
                      placeholder={`Inherited: "${inheritedDefaults.title}"`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getTitleLengthStatus().bg} ${getTitleLengthStatus().color}`}>
                        {getTitleLengthStatus().label}
                      </span>
                      <span className="text-gray-400 font-mono text-[11px]">{titleLength} chars</span>
                    </div>
                  </div>

                  {/* Meta Description */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] flex items-center gap-2">
                        <span>Meta Description</span>
                        {formData.metaDescription ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-purple-100 text-purple-800 font-bold">
                            Custom Override
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-gray-100 text-gray-600 font-medium">
                            Inherited
                          </span>
                        )}
                      </label>
                      {formData.metaDescription && (
                        <button
                          type="button"
                          onClick={() => resetField('metaDescription')}
                          className="text-[11px] text-[#7C3AED] hover:underline flex items-center gap-1 font-semibold"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset to Inherited
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={formData.metaDescription || ''}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      placeholder={`Inherited: "${inheritedDefaults.description}"`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getDescLengthStatus().bg} ${getDescLengthStatus().color}`}>
                        {getDescLengthStatus().label}
                      </span>
                      <span className="text-gray-400 font-mono text-[11px]">{descLength} chars</span>
                    </div>
                  </div>

                  {/* Canonical URL */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] flex items-center gap-2">
                        <span>Canonical URL</span>
                        {formData.canonicalUrl ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-purple-100 text-purple-800 font-bold">
                            Custom Override
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] bg-gray-100 text-gray-600 font-medium">
                            Inherited
                          </span>
                        )}
                      </label>
                      {formData.canonicalUrl && (
                        <button
                          type="button"
                          onClick={() => resetField('canonicalUrl')}
                          className="text-[11px] text-[#7C3AED] hover:underline flex items-center gap-1 font-semibold"
                        >
                          <RotateCcw className="w-3 h-3" /> Reset to Inherited
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.canonicalUrl || ''}
                      onChange={(e) => handleUrlChange('canonicalUrl', e.target.value)}
                      placeholder={`Inherited: ${inheritedDefaults.canonicalUrl}`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                    {urlErrors.canonicalUrl && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {urlErrors.canonicalUrl}
                      </p>
                    )}
                  </div>

                  {/* Robots Directives */}
                  <div className="p-4 bg-[#FAF9FF] border border-[#E4E2F0] rounded-2xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                      Search Engine Robots Indexing Directives
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2.5 p-3 bg-white border border-[#E4E2F0] rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.robotsIndex !== false}
                          onChange={(e) => setFormData({ ...formData, robotsIndex: e.target.checked })}
                          className="w-4 h-4 text-[#7C3AED] rounded border-[#E4E2F0] focus:ring-[#7C3AED]"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-[#0F112E] block">Index (index)</span>
                          <span className="text-gray-500">Allow search engine indexing</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 bg-white border border-[#E4E2F0] rounded-xl cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.robotsFollow !== false}
                          onChange={(e) => setFormData({ ...formData, robotsFollow: e.target.checked })}
                          className="w-4 h-4 text-[#7C3AED] rounded border-[#E4E2F0] focus:ring-[#7C3AED]"
                        />
                        <div className="text-xs">
                          <span className="font-bold text-[#0F112E] block">Follow (follow)</span>
                          <span className="text-gray-500">Allow link crawler follow</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Focus Keyword */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                      Primary Focus Keyword (Internal)
                    </label>
                    <input
                      type="text"
                      value={formData.focusKeyword || ''}
                      onChange={(e) => setFormData({ ...formData, focusKeyword: e.target.value })}
                      placeholder="e.g. jpg to png converter, merge pdf online"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: SOCIAL SHARING CARDS (OPENGRAPH & TWITTER) */}
              {activeTab === 'social' && (
                <div className="space-y-6">
                  {/* Social Share Card Preview */}
                  <div className="p-4 bg-[#FAF9FF] border border-[#E4E2F0] rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-[#5E6488] flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                      Social Media Card Preview (OpenGraph / X)
                    </span>

                    <div className="bg-white border border-[#E4E2F0] rounded-xl overflow-hidden shadow-sm">
                      <div className="h-40 bg-slate-100 flex items-center justify-center relative overflow-hidden border-b border-[#E4E2F0]">
                        {effectiveOgImage ? (
                          <img
                            src={effectiveOgImage}
                            alt="Social Share Banner"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-center p-4">
                            <Share2 className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                            <span className="text-xs text-slate-400 font-medium">Default Site Share Card</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3.5 space-y-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          {siteConfig.name}
                        </span>
                        <h5 className="text-sm font-bold text-[#0F112E] line-clamp-1">
                          {effectiveOgTitle}
                        </h5>
                        <p className="text-xs text-[#5E6488] line-clamp-2 leading-relaxed">
                          {effectiveOgDescription}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Open Graph Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                      Open Graph Title (og:title)
                    </label>
                    <input
                      type="text"
                      value={formData.ogTitle || ''}
                      onChange={(e) => setFormData({ ...formData, ogTitle: e.target.value })}
                      placeholder={`Inherited: "${effectiveTitle}"`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                  </div>

                  {/* Open Graph Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                      Open Graph Description (og:description)
                    </label>
                    <textarea
                      rows={2}
                      value={formData.ogDescription || ''}
                      onChange={(e) => setFormData({ ...formData, ogDescription: e.target.value })}
                      placeholder={`Inherited: "${effectiveDescription}"`}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                  </div>

                  {/* Open Graph Image URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                      Social Card Image URL (og:image)
                    </label>
                    <input
                      type="text"
                      value={formData.ogImage || ''}
                      onChange={(e) => handleUrlChange('ogImage', e.target.value)}
                      placeholder="e.g. /images/og-share-jpg-to-png.png or https://..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                    {urlErrors.ogImage && (
                      <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {urlErrors.ogImage}
                      </p>
                    )}
                  </div>

                  {/* Twitter / X Card Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                        Open Graph Type
                      </label>
                      <select
                        value={formData.ogType || 'website'}
                        onChange={(e) => setFormData({ ...formData, ogType: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      >
                        <option value="website">website (Standard Utility / Web Page)</option>
                        <option value="article">article (Blog Article / Editorial)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                        Twitter Card Format
                      </label>
                      <select
                        value={formData.twitterCard || 'summary_large_image'}
                        onChange={(e) => setFormData({ ...formData, twitterCard: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      >
                        <option value="summary_large_image">summary_large_image (Large Hero Card)</option>
                        <option value="summary">summary (Compact Square Card)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SCHEMA.ORG JSON-LD STRUCTURED DATA */}
              {activeTab === 'schema' && (
                <div className="space-y-6">
                  <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1">
                    <p className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#7C3AED]" />
                      Schema.org Rich Snippet Structured Data
                    </p>
                    <p className="text-xs text-indigo-800 leading-relaxed">
                      Structured data helps Google understand tool functionality, FAQs, and step-by-step instructions. JSON-LD is safely serialized as raw data.
                    </p>
                  </div>

                  {/* Schema Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                      Schema Entity Type
                    </label>
                    <select
                      value={formData.schemaType || 'WebApplication'}
                      onChange={(e) => setFormData({ ...formData, schemaType: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    >
                      <option value="WebApplication">WebApplication (Online Conversion Utility)</option>
                      <option value="SoftwareApplication">SoftwareApplication (General Application)</option>
                      <option value="HowTo">HowTo (Instructional Conversion Guide)</option>
                      <option value="FAQPage">FAQPage (Frequently Asked Questions)</option>
                      <option value="CollectionPage">CollectionPage (Tools Category / Directory)</option>
                      <option value="WebPage">WebPage (General Informational Page)</option>
                      <option value="Article">Article (Editorial Content)</option>
                      <option value="BlogPosting">BlogPosting (Blog Article)</option>
                    </select>
                  </div>

                  {/* Schema JSON Editor */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488] block">
                        Custom JSON-LD Schema Payload (JSON)
                      </label>
                      {schemaJsonError ? (
                        <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Syntax Error
                        </span>
                      ) : schemaRawText.trim() ? (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Check className="w-3 h-3" /> Valid JSON Syntax
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">Optional</span>
                      )}
                    </div>
                    <textarea
                      rows={10}
                      value={schemaRawText}
                      onChange={(e) => handleSchemaJsonChange(e.target.value)}
                      placeholder={`{\n  "@context": "https://schema.org",\n  "@type": "${formData.schemaType || 'WebApplication'}",\n  "name": "${effectiveTitle}"\n}`}
                      className="w-full p-3 rounded-xl border border-[#E4E2F0] text-xs font-mono text-[#0F112E] bg-slate-900 text-emerald-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                    />
                    {schemaJsonError && (
                      <p className="text-xs text-red-600 font-mono font-medium">
                        Error: {schemaJsonError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-[#E4E2F0] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#5E6488] hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(schemaJsonError) || Object.keys(urlErrors).length > 0}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    schemaJsonError || Object.keys(urlErrors).length > 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#7C3AED] text-white hover:bg-[#6D28D9] cursor-pointer'
                  }`}
                >
                  <Check className="w-4 h-4" /> Apply SEO Edits
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
