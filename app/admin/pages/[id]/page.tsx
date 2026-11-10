'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  History,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Search,
  Globe,
  Settings,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { StructuredPageBlock, BlockType } from '@/lib/admin/types';
import MediaPickerModal from '@/components/admin/media/MediaPickerModal';

interface PageData {
  id: string;
  slug: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
  updatedAt: string;
  content: {
    id: string;
    version: number;
    isPublished: boolean;
    blocks: any[];
    customCss: string | null;
  } | null;
  seo: {
    id: string;
    seoTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    twitterImage: string | null;
    schemaType: string | null;
    schemaJson: any | null;
    focusKeyword: string | null;
  } | null;
}

interface PageEditorProps {
  params: Promise<{ id: string }>;
}

export default function AdminPageEditor({ params }: PageEditorProps) {
  const { id } = use(params);
  const router = useRouter();

  const [page, setPage] = useState<PageData | null>(null);
  const [activeTab, setActiveTab] = useState<'CONTENT' | 'SEO' | 'SETTINGS'>('CONTENT');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [blocks, setBlocks] = useState<any[]>([]);

  // SEO Form State
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [twitterTitle, setTwitterTitle] = useState('');
  const [twitterDescription, setTwitterDescription] = useState('');
  const [twitterImage, setTwitterImage] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [schemaJsonText, setSchemaJsonText] = useState('');

  // Media Picker State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'ogImage' | { blockIndex: number }>('ogImage');

  const fetchPage = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/pages/${id}`);
      if (!res.ok) throw new Error('Page not found or error loading page.');
      const data = await res.json();
      const p: PageData = data.page;
      setPage(p);
      setName(p.name || '');
      setSlug(p.slug || '');
      setBlocks(Array.isArray(p.content?.blocks) ? p.content.blocks : []);

      if (p.seo) {
        setSeoTitle(p.seo.seoTitle || '');
        setMetaDescription(p.seo.metaDescription || '');
        setCanonicalUrl(p.seo.canonicalUrl || '');
        setRobotsIndex(p.seo.robotsIndex !== false);
        setRobotsFollow(p.seo.robotsFollow !== false);
        setOgTitle(p.seo.ogTitle || '');
        setOgDescription(p.seo.ogDescription || '');
        setOgImage(p.seo.ogImage || '');
        setTwitterTitle(p.seo.twitterTitle || '');
        setTwitterDescription(p.seo.twitterDescription || '');
        setTwitterImage(p.seo.twitterImage || '');
        setFocusKeyword(p.seo.focusKeyword || '');
        setSchemaJsonText(p.seo.schemaJson ? JSON.stringify(p.seo.schemaJson, null, 2) : '');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error loading page.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPage();
  }, [id]);

  // Block Manipulation Handlers
  const handleAddBlock = (type: BlockType) => {
    const newId = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let newBlock: any;

    switch (type) {
      case 'heading':
        newBlock = { id: newId, type: 'heading', level: 2, text: 'New Heading' };
        break;
      case 'paragraph':
        newBlock = { id: newId, type: 'paragraph', text: 'Add your paragraph description here.' };
        break;
      case 'section':
        newBlock = { id: newId, type: 'section', title: 'New Section', description: '' };
        break;
      case 'rich_text':
        newBlock = { id: newId, type: 'rich_text', html: '<p>Formatted content with <strong>bold</strong> or <em>italic</em>.</p>' };
        break;
      case 'cta':
        newBlock = { id: newId, type: 'cta', label: 'Explore Tools', href: '/image-tools', variant: 'primary' };
        break;
      case 'link':
        newBlock = { id: newId, type: 'link', text: 'Visit Our Documentation', href: '/about', isExternal: false };
        break;
      case 'feature':
        newBlock = { id: newId, type: 'feature', title: 'Feature Title', description: 'Describe the key benefit here.' };
        break;
      case 'faq':
        newBlock = { id: newId, type: 'faq', question: 'Frequently asked question?', answer: 'Clear and helpful answer.' };
        break;
      case 'image':
        newBlock = { id: newId, type: 'image', src: '/images/hero-preview.png', alt: 'Descriptive alt text', caption: '' };
        break;
      default:
        newBlock = { id: newId, type: 'paragraph', text: '' };
    }

    setBlocks([...blocks, newBlock]);
  };

  const handleUpdateBlock = (index: number, updatedFields: Record<string, any>) => {
    const updated = [...blocks];
    updated[index] = { ...updated[index], ...updatedFields };
    setBlocks(updated);
  };

  const handleRemoveBlock = (index: number) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const handleMoveBlock = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === blocks.length - 1) return;

    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...blocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setBlocks(updated);
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    let parsedSchemaJson: any = null;
    if (schemaJsonText.trim()) {
      try {
        parsedSchemaJson = JSON.parse(schemaJsonText);
      } catch {
        setStatusMessage({ type: 'error', text: 'Structured Data contains invalid JSON. Please correct syntax before saving.' });
        setIsSaving(false);
        return;
      }
    }

    try {
      const payload = {
        name,
        slug,
        blocks,
        reason: revisionReason.trim() || 'Admin draft update',
        seo: {
          seoTitle: seoTitle.trim() || null,
          metaDescription: metaDescription.trim() || null,
          canonicalUrl: canonicalUrl.trim() || null,
          robotsIndex,
          robotsFollow,
          ogTitle: ogTitle.trim() || null,
          ogDescription: ogDescription.trim() || null,
          ogImage: ogImage.trim() || null,
          twitterTitle: twitterTitle.trim() || null,
          twitterDescription: twitterDescription.trim() || null,
          twitterImage: twitterImage.trim() || null,
          schemaJson: parsedSchemaJson,
          focusKeyword: focusKeyword.trim() || null,
        },
      };

      const res = await fetch(`/api/admin/pages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes.');

      setPage(data.page);
      setRevisionReason('');
      setStatusMessage({ type: 'success', text: 'Draft updated and new revision snapshot created.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving draft.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish / Unpublish Toggle
  const handleTogglePublish = async () => {
    if (!page) return;
    setIsPublishing(true);
    setStatusMessage(null);

    const isPublishAction = page.status !== 'PUBLISHED';
    const action = isPublishAction ? 'publish' : 'unpublish';

    try {
      // First save changes if dirty, then publish
      await handleSaveDraft();

      const res = await fetch(`/api/admin/pages/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} page.`);

      setPage(data.page);
      setStatusMessage({
        type: 'success',
        text: isPublishAction
          ? 'Page published successfully! Changes are now live to public visitors.'
          : 'Page unpublished. Page is now in Draft mode and hidden from public view.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Failed to ${action} page.`;
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-[#5E6488]">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <span>Loading page content and SEO configuration...</span>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-[#E4E2F0] space-y-4">
        <h2 className="text-lg font-bold text-[#0F112E]">Page Not Found</h2>
        <p className="text-xs text-[#5E6488]">The requested page could not be located in the CMS repository.</p>
        <Link
          href="/admin/pages"
          className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] rounded-lg"
        >
          Return to Pages List
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E4E2F0]">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/pages"
            className="p-2 text-[#5E6488] hover:text-[#0F112E] hover:bg-[#F4F3FA] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#0F112E]">
                {name || page.name}
              </h1>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  page.status === 'PUBLISHED'
                    ? 'bg-[#F4F0FD] text-[#7C3AED]'
                    : 'bg-[#FFFBEB] text-[#B45309]'
                }`}
              >
                {page.status === 'PUBLISHED' ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-[#7C3AED]" />
                    Published
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-[#B45309]" />
                    Draft
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-[#5E6488] mt-0.5 font-mono">
              Path: /{slug === 'home' ? '' : slug}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/pages/${page.id}/preview`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F112E] bg-white border border-[#E4E2F0] hover:bg-[#F4F3FA] rounded-lg shadow-2xs transition-all"
          >
            <Eye className="w-3.5 h-3.5 text-[#5E6488]" />
            <span>Preview Draft</span>
          </Link>

          <Link
            href={`/admin/pages/${page.id}/revisions`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0F112E] bg-white border border-[#E4E2F0] hover:bg-[#F4F3FA] rounded-lg shadow-2xs transition-all"
          >
            <History className="w-3.5 h-3.5 text-[#5E6488]" />
            <span>Revisions</span>
          </Link>

          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-[#6D28D9] rounded-lg shadow-sm disabled:opacity-50 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handleTogglePublish}
            disabled={isPublishing}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
              page.status === 'PUBLISHED'
                ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] border border-[#FECACA]'
                : 'bg-[#0E7490] text-white hover:bg-[#155E75]'
            }`}
          >
            {page.status === 'PUBLISHED' ? 'Unpublish' : 'Publish Page'}
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs sm:text-sm font-medium border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-[#F4F0FD] border-[#BCE1D9] text-[#7C3AED]'
              : statusMessage.type === 'warning'
              ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
              : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="ml-2 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-[#E4E2F0]">
        <button
          onClick={() => setActiveTab('CONTENT')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'CONTENT'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Structured Content Blocks ({blocks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('SEO')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'SEO'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Advanced SEO & Social</span>
        </button>

        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'SETTINGS'
              ? 'border-[#7C3AED] text-[#7C3AED]'
              : 'border-transparent text-[#5E6488] hover:text-[#0F112E]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Page Settings & Audit</span>
        </button>
      </div>

      {/* TAB 1: CONTENT BLOCKS */}
      {activeTab === 'CONTENT' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#5E6488]">
              Organize page sections using structured content blocks. Content is sanitized and safely rendered.
            </p>

            {/* Add Block Menu */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-[#475467] mr-1">Add Block:</span>
              {(
                [
                  { type: 'heading', label: '+ Heading' },
                  { type: 'paragraph', label: '+ Paragraph' },
                  { type: 'section', label: '+ Section' },
                  { type: 'cta', label: '+ CTA Button' },
                  { type: 'feature', label: '+ Feature' },
                  { type: 'faq', label: '+ FAQ' },
                  { type: 'rich_text', label: '+ Rich Text' },
                  { type: 'link', label: '+ Link' },
                  { type: 'image', label: '+ Image' },
                ] as const
              ).map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddBlock(item.type)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-white border border-[#E4E2F0] hover:border-[#7C3AED] hover:text-[#7C3AED] rounded-md transition-colors shadow-2xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {blocks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-[#E4E2F0] space-y-3">
              <Layers className="w-8 h-8 text-[#94A3B8] mx-auto" />
              <h3 className="text-sm font-semibold text-[#0F112E]">No content blocks yet</h3>
              <p className="text-xs text-[#5E6488] max-w-sm mx-auto">
                Click one of the block buttons above to add your first heading, paragraph, or feature card.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {blocks.map((block, index) => (
                <div
                  key={block.id || index}
                  className="bg-white p-4 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-3 hover:border-[#E4E2F0] transition-colors"
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#F4F3FA]">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F4F3FA] text-[#475467]">
                        {block.type}
                      </span>
                      <span className="text-[11px] font-mono text-[#94A3B8]">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveBlock(index, 'UP')}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1 text-[#5E6488] hover:text-[#0F112E] disabled:opacity-30 rounded hover:bg-[#F4F3FA]"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveBlock(index, 'DOWN')}
                        disabled={index === blocks.length - 1}
                        title="Move Down"
                        className="p-1 text-[#5E6488] hover:text-[#0F112E] disabled:opacity-30 rounded hover:bg-[#F4F3FA]"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveBlock(index)}
                        title="Delete Block"
                        className="p-1 text-[#EF4444] hover:bg-[#FEF2F2] rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Block Body Editor Fields */}
                  {block.type === 'heading' && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Heading Level
                        </label>
                        <select
                          value={block.level || 2}
                          onChange={(e) => handleUpdateBlock(index, { level: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        >
                          <option value={1}>H1 (Main Headline)</option>
                          <option value={2}>H2 (Section Heading)</option>
                          <option value={3}>H3 (Subheading)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Heading Text
                        </label>
                        <input
                          type="text"
                          value={block.text || ''}
                          onChange={(e) => handleUpdateBlock(index, { text: e.target.value })}
                          placeholder="Heading title..."
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'paragraph' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                        Paragraph Body
                      </label>
                      <textarea
                        rows={3}
                        value={block.text || ''}
                        onChange={(e) => handleUpdateBlock(index, { text: e.target.value })}
                        placeholder="Enter paragraph text..."
                        className="w-full px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                  )}

                  {block.type === 'section' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Section Title
                        </label>
                        <input
                          type="text"
                          value={block.title || ''}
                          onChange={(e) => handleUpdateBlock(index, { title: e.target.value })}
                          placeholder="e.g. Why Choose Us"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Section Description (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={block.description || ''}
                          onChange={(e) => handleUpdateBlock(index, { description: e.target.value })}
                          placeholder="Subtitle or introduction to this section..."
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'cta' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Button Label
                        </label>
                        <input
                          type="text"
                          value={block.label || ''}
                          onChange={(e) => handleUpdateBlock(index, { label: e.target.value })}
                          placeholder="e.g. Get Started Free"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Target URL (href)
                        </label>
                        <input
                          type="text"
                          value={block.href || ''}
                          onChange={(e) => handleUpdateBlock(index, { href: e.target.value })}
                          placeholder="e.g. /image-tools"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Style Variant
                        </label>
                        <select
                          value={block.variant || 'primary'}
                          onChange={(e) => handleUpdateBlock(index, { variant: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        >
                          <option value="primary">Primary (Teal Solid)</option>
                          <option value="secondary">Secondary (White Outline)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {block.type === 'link' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Anchor Text
                        </label>
                        <input
                          type="text"
                          value={block.text || ''}
                          onChange={(e) => handleUpdateBlock(index, { text: e.target.value })}
                          placeholder="Link text..."
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Target URL
                        </label>
                        <input
                          type="text"
                          value={block.href || ''}
                          onChange={(e) => handleUpdateBlock(index, { href: e.target.value })}
                          placeholder="/about or https://example.com"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div className="flex items-center pt-5">
                        <label className="inline-flex items-center gap-2 text-xs text-[#344054] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(block.isExternal)}
                            onChange={(e) => handleUpdateBlock(index, { isExternal: e.target.checked })}
                            className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                          />
                          <span>Open in new tab</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {block.type === 'feature' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Feature Title
                        </label>
                        <input
                          type="text"
                          value={block.title || ''}
                          onChange={(e) => handleUpdateBlock(index, { title: e.target.value })}
                          placeholder="e.g. Zero Server Uploads"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Feature Description
                        </label>
                        <input
                          type="text"
                          value={block.description || ''}
                          onChange={(e) => handleUpdateBlock(index, { description: e.target.value })}
                          placeholder="e.g. Complete privacy by default."
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'faq' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Question
                        </label>
                        <input
                          type="text"
                          value={block.question || ''}
                          onChange={(e) => handleUpdateBlock(index, { question: e.target.value })}
                          placeholder="e.g. Are my files stored on your servers?"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Answer
                        </label>
                        <textarea
                          rows={2}
                          value={block.answer || ''}
                          onChange={(e) => handleUpdateBlock(index, { answer: e.target.value })}
                          placeholder="Clear and concise answer..."
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === 'rich_text' && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-[#475467]">
                          HTML Content
                        </label>
                        <span className="text-[10px] text-[#5E6488]">
                          Scripts and unsafe attributes are stripped automatically.
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        value={block.html || ''}
                        onChange={(e) => handleUpdateBlock(index, { html: e.target.value })}
                        placeholder="<p>Formatted text...</p>"
                        className="w-full font-mono px-3 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                  )}

                  {block.type === 'image' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-[#475467]">
                            Image Source URL
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setMediaPickerTarget({ blockIndex: index });
                              setIsMediaPickerOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#7C3AED] hover:underline"
                          >
                            <ImageIcon className="w-3 h-3" />
                            <span>Select Media</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={block.src || ''}
                          onChange={(e) => handleUpdateBlock(index, { src: e.target.value })}
                          placeholder="/images/example.png or /uploads/..."
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Alt Text
                        </label>
                        <input
                          type="text"
                          value={block.alt || ''}
                          onChange={(e) => handleUpdateBlock(index, { alt: e.target.value })}
                          placeholder="Image description"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#475467] mb-1">
                          Caption (Optional)
                        </label>
                        <input
                          type="text"
                          value={block.caption || ''}
                          onChange={(e) => handleUpdateBlock(index, { caption: e.target.value })}
                          placeholder="Photo credits or caption"
                          className="w-full px-3 py-1.5 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ADVANCED SEO & SOCIAL */}
      {activeTab === 'SEO' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-6">
          <div className="border-b border-[#F4F3FA] pb-4">
            <h2 className="text-base font-bold text-[#0F112E]">Search Engine Optimization & Social Sharing</h2>
            <p className="text-xs text-[#5E6488] mt-0.5">
              Customize meta tags, canonical URLs, indexing instructions, Open Graph, Twitter Cards, and JSON-LD schema.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Meta Tags */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#475467]">Core Search Metadata</h3>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#344054]">
                    SEO Title
                  </label>
                  <span className={`text-[10px] font-mono ${
                    seoTitle.length > 70 ? 'text-[#DC2626] font-bold' : seoTitle.length < 10 && seoTitle.length > 0 ? 'text-[#B45309]' : 'text-[#5E6488]'
                  }`}>
                    {seoTitle.length} / 70 chars
                  </span>
                </div>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder="e.g. Free Online File Tools – Convert & Compress Files"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#344054]">
                    Meta Description
                  </label>
                  <span className={`text-[10px] font-mono ${
                    metaDescription.length > 160 ? 'text-[#DC2626] font-bold' : metaDescription.length < 50 && metaDescription.length > 0 ? 'text-[#B45309]' : 'text-[#5E6488]'
                  }`}>
                    {metaDescription.length} / 160 chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="Summarize the page content for search engine snippets (aim for 50-160 characters)..."
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Canonical URL
                </label>
                <input
                  type="text"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  placeholder="e.g. /about or https://example.com/about"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Focus Keyword
                </label>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g. free online file converter"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div className="pt-2 border-t border-[#F4F3FA] space-y-2">
                <label className="block text-xs font-semibold text-[#344054]">
                  Robots Indexing Directives
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs text-[#344054] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={robotsIndex}
                      onChange={(e) => setRobotsIndex(e.target.checked)}
                      className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <span>Allow search engines to index (index)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-[#344054] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={robotsFollow}
                      onChange={(e) => setRobotsFollow(e.target.checked)}
                      className="rounded text-[#7C3AED] focus:ring-[#7C3AED]"
                    />
                    <span>Follow links on this page (follow)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right: Social & Structured Data */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#475467]">Social Sharing & JSON-LD</h3>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Open Graph Title (Facebook / LinkedIn)
                </label>
                <input
                  type="text"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  placeholder="Defaults to SEO Title if empty"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#344054]">
                    Open Graph Image URL
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTarget('ogImage');
                      setIsMediaPickerOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] hover:underline"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Select from Media Library</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={ogImage}
                  onChange={(e) => setOgImage(e.target.value)}
                  placeholder="/images/og-default.png or /uploads/..."
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Twitter Card Title
                </label>
                <input
                  type="text"
                  value={twitterTitle}
                  onChange={(e) => setTwitterTitle(e.target.value)}
                  placeholder="Defaults to SEO Title if empty"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Twitter Card Image URL
                </label>
                <input
                  type="text"
                  value={twitterImage}
                  onChange={(e) => setTwitterImage(e.target.value)}
                  placeholder="/images/twitter-default.png"
                  className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#344054]">
                    Structured Data (JSON-LD)
                  </label>
                  <span className="text-[10px] text-[#5E6488]">Valid JSON object</span>
                </div>
                <textarea
                  rows={4}
                  value={schemaJsonText}
                  onChange={(e) => setSchemaJsonText(e.target.value)}
                  placeholder='{ "@context": "https://schema.org", "@type": "WebPage", "name": "..." }'
                  className="w-full font-mono px-3.5 py-2 text-[11px] border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SETTINGS & REVISION NOTE */}
      {activeTab === 'SETTINGS' && (
        <div className="bg-white p-6 rounded-xl border border-[#E4E2F0] shadow-subtle space-y-6">
          <div className="border-b border-[#F4F3FA] pb-4">
            <h2 className="text-base font-bold text-[#0F112E]">General Settings & Audit Trail</h2>
            <p className="text-xs text-[#5E6488] mt-0.5">
              Update page path identity and specify reason for content updates.
            </p>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Page Internal Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. About Us"
                className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                URL Slug
              </label>
              <div className="flex items-center">
                <span className="px-3.5 py-2 bg-[#F4F3FA] border border-r-0 border-[#E4E2F0] rounded-l-lg text-xs text-[#5E6488]">
                  /
                </span>
                <input
                  type="text"
                  value={slug}
                  disabled={page?.slug === 'home'}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
                  placeholder="about"
                  className={`w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-r-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] ${
                    page?.slug === 'home' ? 'bg-[#F4F3FA] text-[#5E6488] cursor-not-allowed' : ''
                  }`}
                />
              </div>
              {page?.slug === 'home' && (
                <p className="text-[11px] text-[#2563EB] font-medium mt-1">
                  Reserved homepage slug: maps to the root website path (/) and cannot be renamed.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                Revision Note / Reason for Update
              </label>
              <input
                type="text"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="e.g. Updated hero headline and improved meta description"
                className="w-full px-3.5 py-2 text-xs border border-[#E4E2F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
              <p className="text-[11px] text-[#5E6488] mt-1">
                Recorded in immutable audit history for this version snapshot.
              </p>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        currentUrl={typeof mediaPickerTarget === 'object' ? blocks[mediaPickerTarget.blockIndex]?.src : ogImage}
        onSelect={(asset) => {
          if (typeof mediaPickerTarget === 'object') {
            if (!asset) {
              handleUpdateBlock(mediaPickerTarget.blockIndex, { src: '' });
            } else {
              handleUpdateBlock(mediaPickerTarget.blockIndex, {
                src: asset.url,
                alt: asset.alt || blocks[mediaPickerTarget.blockIndex]?.alt || asset.title || '',
              });
            }
          } else {
            setOgImage(asset ? asset.url : '');
          }
        }}
      />
    </div>
  );
}
