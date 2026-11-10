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
  Trash2,
  Search,
  Globe,
  Settings,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Bold,
  Italic,
  Heading2,
  Heading3,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Calendar,
  Image as ImageIcon,
  Tag,
  FolderPlus,
} from 'lucide-react';
import { BlogPostItem, BlogCategoryItem, BlogTagItem, MediaAssetItem } from '@/lib/admin/types';
import MediaPickerModal from '@/components/admin/media/MediaPickerModal';
import BlogContentRenderer from '@/components/blog/BlogContentRenderer';

interface BlogEditorProps {
  params: Promise<{ id: string }>;
}

export default function BlogPostEditorPage({ params }: BlogEditorProps) {
  const { id } = use(params);
  const router = useRouter();

  const [post, setPost] = useState<BlogPostItem | null>(null);
  const [categories, setCategories] = useState<BlogCategoryItem[]>([]);
  const [allTags, setAllTags] = useState<BlogTagItem[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [featuredImage, setFeaturedImage] = useState('');
  const [featuredImageAlt, setFeaturedImageAlt] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState('');

  // SEO State
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

  // UI State
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [activeSettingsSection, setActiveSettingsSection] = useState<'content' | 'seo' | 'publishing'>('content');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Media Picker State
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'featured' | 'ogImage' | 'inline'>('featured');
  const [cursorPos, setCursorPos] = useState<{ start: number; end: number } | null>(null);

  // Load post and taxonomies
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const [postRes, catRes, tagRes] = await Promise.all([
          fetch(`/api/admin/blog/${id}`),
          fetch('/api/admin/blog/categories'),
          fetch('/api/admin/blog/tags'),
        ]);

        if (!postRes.ok) throw new Error('Failed to load blog post.');
        const postData = await postRes.json();
        const p: BlogPostItem = postData.post;
        setPost(p);

        // Populate fields
        setTitle(p.title || '');
        setSlug(p.slug || '');
        setExcerpt(p.excerpt || '');
        setContent(p.content || '');
        setFeaturedImage(p.featuredImage || '');
        setFeaturedImageAlt(p.featuredImageAlt || '');
        setCategoryId(p.categoryId || '');
        setSelectedTagIds(p.tags?.map((t) => t.tagId) || []);
        setScheduledFor(p.scheduledFor ? new Date(p.scheduledFor).toISOString().slice(0, 16) : '');

        // Populate SEO
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
        }

        if (catRes.ok) {
          const cData = await catRes.json();
          setCategories(cData.categories || []);
        }

        if (tagRes.ok) {
          const tData = await tagRes.json();
          setAllTags(tData.tags || []);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error loading editor.';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id]);

  // Markdown Toolbar Action
  const insertMarkdown = (prefix: string, suffix = '') => {
    const textarea = document.getElementById('post-markdown-editor') as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + replacement.length - suffix.length);
    }, 50);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        content,
        featuredImage: featuredImage.trim() || null,
        featuredImageAlt: featuredImageAlt.trim() || null,
        categoryId: categoryId || null,
        tagIds: selectedTagIds,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
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
          focusKeyword: focusKeyword.trim() || null,
        },
        reason: 'Saved in editor',
      };

      const res = await fetch(`/api/admin/blog/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save changes.');
      }

      const data = await res.json();
      setPost(data.post);
      setSuccessMsg('Draft content saved and revision snapshot created.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving draft.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!post) return;
    const isPub = post.status === 'PUBLISHED';
    const action = isPub ? 'unpublish' : 'publish';

    if (!window.confirm(`Are you sure you want to ${action} this article?`)) {
      return;
    }

    setIsPublishing(true);
    setError(null);
    try {
      // First save current content
      await handleSaveDraft();

      const res = await fetch(`/api/admin/blog/${id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} article.`);
      }

      const data = await res.json();
      setPost(data.post);
      setSuccessMsg(`Article is now ${isPub ? 'UNPUBLISHED (Draft)' : 'PUBLISHED'}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed.';
      setError(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-[#5E6488]">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#7C3AED]" />
        <p className="text-sm font-medium">Loading post editor...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="p-8 bg-white border border-[#E4E2F0] rounded-xl text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-[#DC2626] mx-auto" />
        <h2 className="text-lg font-bold text-[#1E293B]">Post Not Found</h2>
        <p className="text-sm text-[#5E6488]">The requested article does not exist or was deleted.</p>
        <Link href="/admin/blog" className="inline-block px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-semibold">
          Return to Blog Directory
        </Link>
      </div>
    );
  }

  const isPublished = post.status === 'PUBLISHED';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E4E2F0]">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5E6488] mb-1">
            <Link href="/admin/blog" className="hover:text-[#0F112E] flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Blog Directory</span>
            </Link>
            <span>/</span>
            <span className="font-mono text-[11px] text-[#94A3B8]">/blog/{slug}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] line-clamp-1">
              {title || 'Untitled Post'}
            </h1>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                isPublished
                  ? 'bg-[#DCFCE7] text-[#166534]'
                  : post.status === 'SCHEDULED'
                  ? 'bg-[#FEF3C7] text-[#92400E]'
                  : 'bg-[#F4F3FA] text-[#475569]'
              }`}
            >
              {isPublished ? 'Published' : post.status === 'SCHEDULED' ? 'Scheduled' : 'Draft'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/blog/${id}/preview`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E2F0] bg-white text-xs font-medium text-[#475569] hover:bg-[#F4F3FA]"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </Link>

          <Link
            href={`/admin/blog/${id}/revisions`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E2F0] bg-white text-xs font-medium text-[#475569] hover:bg-[#F4F3FA]"
          >
            <History className="w-3.5 h-3.5" />
            <span>Revisions</span>
          </Link>

          {isPublished && (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E2F0] bg-white text-xs font-medium text-[#0284C7] hover:bg-[#F4F3FA]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Live Page</span>
            </Link>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#E4E2F0] bg-white text-xs font-semibold text-[#1E293B] hover:bg-[#F4F3FA] disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            onClick={handlePublishToggle}
            disabled={isPublishing}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-colors shadow-xs ${
              isPublished
                ? 'bg-[#DC2626] hover:bg-[#B91C1C]'
                : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isPublishing ? '...' : isPublished ? 'Unpublish' : 'Publish'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Editor & Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Content Column (2 spans) */}
        <div className="lg:col-span-2 space-y-5 bg-white border border-[#E4E2F0] rounded-xl p-5 md:p-6 shadow-xs">
          {/* Post Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article Title..."
              className="w-full px-3.5 py-2.5 border border-[#E4E2F0] rounded-lg text-base font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#475569] mb-1.5">
              Excerpt / Subtitle
            </label>
            <textarea
              rows={2}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Brief summary for search engines and social share previews..."
              className="w-full px-3.5 py-2 border border-[#E4E2F0] rounded-lg text-sm text-[#334155] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          {/* Markdown Content Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#475569]">
                Article Content (Markdown)
              </label>

              {/* Write vs Preview Tabs */}
              <div className="inline-flex rounded-lg border border-[#E4E2F0] p-0.5 bg-[#F4F3FA]">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === 'write' ? 'bg-white shadow-xs text-[#0F172A]' : 'text-[#5E6488]'
                  }`}
                >
                  Write
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    activeTab === 'preview' ? 'bg-white shadow-xs text-[#0F172A]' : 'text-[#5E6488]'
                  }`}
                >
                  Live Preview
                </button>
              </div>
            </div>

            {/* Markdown Toolbar */}
            {activeTab === 'write' && (
              <div className="flex flex-wrap items-center gap-1 p-2 bg-[#F4F3FA] border border-[#E4E2F0] rounded-t-lg border-b-0 text-[#475569]">
                <button
                  type="button"
                  onClick={() => insertMarkdown('**', '**')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Bold"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('*', '*')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Italic"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-[#E4E2F0] mx-1" />
                <button
                  type="button"
                  onClick={() => insertMarkdown('## ')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Heading 2"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('### ')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Heading 3"
                >
                  <Heading3 className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-[#E4E2F0] mx-1" />
                <button
                  type="button"
                  onClick={() => insertMarkdown('[', '](https://example.com)')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Link"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('- ')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Unordered List"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('1. ')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Ordered List"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('> ')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Blockquote"
                >
                  <Quote className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => insertMarkdown('```\n', '\n```')}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded"
                  title="Code Block"
                >
                  <Code className="w-3.5 h-3.5" />
                </button>
                <span className="w-px h-4 bg-[#E4E2F0] mx-1" />
                <button
                  type="button"
                  onClick={() => {
                    const textarea = document.getElementById('post-markdown-editor') as HTMLTextAreaElement | null;
                    const start = textarea ? textarea.selectionStart : content.length;
                    const end = textarea ? textarea.selectionEnd : content.length;
                    setCursorPos({ start, end });
                    setMediaPickerTarget('inline');
                    setIsMediaPickerOpen(true);
                  }}
                  className="p-1.5 hover:bg-[#E4E2F0] rounded text-[#7C3AED]"
                  title="Insert Body Image (Media Library)"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Editor Textarea */}
            {activeTab === 'write' ? (
              <textarea
                id="post-markdown-editor"
                rows={18}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your article in Markdown syntax..."
                className="w-full p-4 border border-[#E4E2F0] rounded-b-lg font-mono text-xs md:text-sm text-[#0F172A] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            ) : (
              <div className="min-h-[400px] p-6 border border-[#E4E2F0] rounded-b-lg bg-[#FAFAFA]">
                <BlogContentRenderer content={content} />
              </div>
            )}
          </div>
        </div>

        {/* Right Settings Sidebar (1 span) */}
        <div className="space-y-5">
          {/* Settings Section Selector */}
          <div className="flex border border-[#E4E2F0] rounded-lg p-0.5 bg-white text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveSettingsSection('content')}
              className={`flex-1 py-1.5 rounded transition-colors text-center ${
                activeSettingsSection === 'content' ? 'bg-[#7C3AED] text-white' : 'text-[#5E6488] hover:text-[#0F172A]'
              }`}
            >
              Post
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsSection('publishing')}
              className={`flex-1 py-1.5 rounded transition-colors text-center ${
                activeSettingsSection === 'publishing' ? 'bg-[#7C3AED] text-white' : 'text-[#5E6488] hover:text-[#0F172A]'
              }`}
            >
              Publishing
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsSection('seo')}
              className={`flex-1 py-1.5 rounded transition-colors text-center ${
                activeSettingsSection === 'seo' ? 'bg-[#7C3AED] text-white' : 'text-[#5E6488] hover:text-[#0F172A]'
              }`}
            >
              SEO
            </button>
          </div>

          {/* Section 1: Post Settings */}
          {activeSettingsSection === 'content' && (
            <div className="bg-white border border-[#E4E2F0] rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] pb-2 border-b border-[#E4E2F0]">
                Post Attributes
              </h3>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs font-mono"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs bg-white"
                >
                  <option value="">No Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Featured Image */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#475569]">
                    Featured Image URL
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPickerTarget('featured');
                      setIsMediaPickerOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#7C3AED] hover:underline"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Select from Media Library</span>
                  </button>
                </div>
                <input
                  type="url"
                  value={featuredImage}
                  onChange={(e) => setFeaturedImage(e.target.value)}
                  placeholder="https://example.com/banner.png or /uploads/..."
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
                {featuredImage && (
                  <div className="mt-2 relative rounded-lg overflow-hidden border border-[#E4E2F0] aspect-video bg-[#F4F3FA]">
                    <img
                      src={featuredImage}
                      alt={featuredImageAlt || 'Preview'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Featured Image Alt */}
              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Image Alt Text
                </label>
                <input
                  type="text"
                  value={featuredImageAlt}
                  onChange={(e) => setFeaturedImageAlt(e.target.value)}
                  placeholder="Descriptive alt text for accessibility..."
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
              </div>

              {/* Tags */}
              {allTags.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#475569] mb-1.5">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const isSelected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id));
                            } else {
                              setSelectedTagIds((prev) => [...prev, tag.id]);
                            }
                          }}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium transition-colors ${
                            isSelected
                              ? 'bg-[#7C3AED] text-white'
                              : 'bg-[#F4F3FA] text-[#5E6488] hover:bg-[#E4E2F0]'
                          }`}
                        >
                          #{tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 2: Publishing & Scheduling */}
          {activeSettingsSection === 'publishing' && (
            <div className="bg-white border border-[#E4E2F0] rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] pb-2 border-b border-[#E4E2F0]">
                Publishing Controls
              </h3>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Current Status
                </label>
                <div className="text-xs font-semibold text-[#0F172A] py-1.5 px-3 bg-[#F4F3FA] border border-[#E4E2F0] rounded-lg">
                  {post.status}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Published Date
                </label>
                <div className="text-xs text-[#5E6488] py-1.5 px-3 bg-[#F4F3FA] border border-[#E4E2F0] rounded-lg font-mono">
                  {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'Not published yet'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Schedule Future Release
                </label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Scheduled articles remain strictly invisible to public visitors until this timestamp is reached.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePublishToggle}
                  disabled={isPublishing}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold text-white transition-colors ${
                    isPublished ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
                  }`}
                >
                  {isPublished ? 'Unpublish Article' : 'Publish Article Now'}
                </button>
              </div>
            </div>
          )}

          {/* Section 3: SEO Settings */}
          {activeSettingsSection === 'seo' && (
            <div className="bg-white border border-[#E4E2F0] rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] pb-2 border-b border-[#E4E2F0]">
                Search Engine Optimization
              </h3>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Custom SEO Title
                </label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={title || 'Default to post title'}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Meta Description
                </label>
                <textarea
                  rows={3}
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder={excerpt || 'Default to post excerpt'}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Canonical URL
                </label>
                <input
                  type="url"
                  value={canonicalUrl}
                  onChange={(e) => setCanonicalUrl(e.target.value)}
                  placeholder={`https://example.com/blog/${slug}`}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] mb-1">
                  Focus Keyword
                </label>
                <input
                  type="text"
                  value={focusKeyword}
                  onChange={(e) => setFocusKeyword(e.target.value)}
                  placeholder="e.g. compress pdf"
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={robotsIndex}
                    onChange={(e) => setRobotsIndex(e.target.checked)}
                    className="rounded text-[#7C3AED]"
                  />
                  <span>Index (Google)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-[#475569] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={robotsFollow}
                    onChange={(e) => setRobotsFollow(e.target.checked)}
                    className="rounded text-[#7C3AED]"
                  />
                  <span>Follow Links</span>
                </label>
              </div>

              {/* Social OG Image */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#475569]">
                    OpenGraph Image URL
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
                  type="url"
                  value={ogImage}
                  onChange={(e) => setOgImage(e.target.value)}
                  placeholder={featuredImage || 'Defaults to featured image'}
                  className="w-full px-3 py-1.5 border border-[#E4E2F0] rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => {
          setIsMediaPickerOpen(false);
          setCursorPos(null);
        }}
        title={
          mediaPickerTarget === 'inline'
            ? 'Insert Body Image from Media Library'
            : mediaPickerTarget === 'featured'
            ? 'Select Featured Image'
            : 'Select Social Share Image'
        }
        currentUrl={
          mediaPickerTarget === 'featured'
            ? featuredImage
            : mediaPickerTarget === 'ogImage'
            ? ogImage
            : null
        }
        onSelect={(asset) => {
          if (!asset) {
            if (mediaPickerTarget === 'featured') setFeaturedImage('');
            else if (mediaPickerTarget === 'ogImage') setOgImage('');
            return;
          }
          if (mediaPickerTarget === 'featured') {
            setFeaturedImage(asset.url);
            if (asset.alt && !featuredImageAlt) {
              setFeaturedImageAlt(asset.alt);
            }
          } else if (mediaPickerTarget === 'ogImage') {
            setOgImage(asset.url);
          } else if (mediaPickerTarget === 'inline') {
            const start = cursorPos?.start ?? content.length;
            const end = cursorPos?.end ?? content.length;
            const selected = content.substring(start, end).trim();
            const alt = selected || asset.alt || asset.title || 'Article image';
            const before = content.substring(0, start);
            const after = content.substring(end);
            const prefixNewline =
              before.length > 0 && !before.endsWith('\n\n')
                ? before.endsWith('\n')
                  ? '\n'
                  : '\n\n'
                : '';
            const suffixNewline =
              after.length > 0 && !after.startsWith('\n\n')
                ? after.startsWith('\n')
                  ? '\n'
                  : '\n\n'
                : '';
            const imgMd = `${prefixNewline}![${alt}](${asset.url})${suffixNewline}`;
            const newContent = before + imgMd + after;
            setContent(newContent);
            setTimeout(() => {
              const textarea = document.getElementById(
                'post-markdown-editor'
              ) as HTMLTextAreaElement | null;
              if (textarea) {
                textarea.focus();
                const newPos = start + imgMd.length;
                textarea.setSelectionRange(newPos, newPos);
              }
            }, 50);
          }
        }}
      />
    </div>
  );
}
