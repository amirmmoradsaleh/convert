'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Calendar, Clock, ArrowLeft, Folder, Tag as TagIcon, Sparkles } from 'lucide-react';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import AdSlot from '@/components/ads/AdSlot';
import JsonLd from '@/components/seo/JsonLd';
import { InlineBlockWrapper } from '@/components/admin/inline/InlineBlockWrapper';
import { InlineBlockEditorDrawer } from '@/components/admin/inline/InlineBlockEditorDrawer';
import { InlineEditorToolbar } from '@/components/admin/inline/InlineEditorToolbar';
import { InlineRevisionDrawer } from '@/components/admin/inline/InlineRevisionDrawer';
import { InlineSeoDrawer, InlineSeoData } from '@/components/admin/inline/InlineSeoDrawer';
import { InlineSharedSettingsDrawer } from '@/components/admin/inline/InlineSharedSettingsDrawer';
import { UniversalContentBlock } from '@/lib/cms/blocks';
import BlogContentRenderer from '@/components/blog/BlogContentRenderer';
import { isSafeUrl } from '@/lib/admin/validation';

interface BlogPostClientProps {
  post: any;
  slug: string;
  jsonLd?: any;
}

export default function BlogPostClient({ post, slug, jsonLd }: BlogPostClientProps) {
  // Admin auth & editing state
  const [isAdmin, setIsAdmin] = useState(false);
  const [postRecord, setPostRecord] = useState<any>(post);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [isSharedSettingsOpen, setIsSharedSettingsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isPublished, setIsPublished] = useState<boolean>(post.status === 'PUBLISHED');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Editable fields
  const [title, setTitle] = useState<string>(post.title);
  const [excerpt, setExcerpt] = useState<string>(post.excerpt || '');
  const [content, setContent] = useState<string>(post.content || '');
  const [featuredImage, setFeaturedImage] = useState<string>(post.featuredImage || '');
  const [featuredImageAlt, setFeaturedImageAlt] = useState<string>(post.featuredImageAlt || '');
  const [seoData, setSeoData] = useState<InlineSeoData | null>(() => (post.seo as InlineSeoData) || null);

  // Authenticate with server & load full draft blog post record if admin
  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndLoadDraft() {
      try {
        const authRes = await fetch('/api/admin/auth/me');
        if (!authRes.ok) return;

        const authData = await authRes.json();
        if (isMounted && authData.user && authData.permissions?.includes('EDIT_CONTENT')) {
          setIsAdmin(true);

          // Fetch full draft blog post record
          const targetId = post.id || slug;
          const blogRes = await fetch(`/api/admin/blog/${targetId}`);
          if (blogRes.ok) {
            const blogData = await blogRes.json();
            const record = blogData.post;
            if (record && isMounted) {
              setPostRecord(record);
              setTitle(record.title);
              setExcerpt(record.excerpt || '');
              setContent(record.content || '');
              setFeaturedImage(record.featuredImage || '');
              setFeaturedImageAlt(record.featuredImageAlt || '');
              setIsPublished(record.status === 'PUBLISHED');
              if (record.seo) setSeoData(record.seo);
            }
          }
        }
      } catch {
        // Silently ignore for non-admins
      }
    }

    checkAuthAndLoadDraft();

    return () => {
      isMounted = false;
    };
  }, [post.id, slug]);

  const handleToggleEdit = () => {
    setIsEditingMode((prev) => !prev);
    setSelectedBlockId(null);
  };

  const handleSaveDraft = async () => {
    const targetId = postRecord?.id || post.id || slug;
    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/blog/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          excerpt,
          content,
          featuredImage,
          featuredImageAlt,
          seo: seoData || undefined,
          status: 'DRAFT',
          reason: 'Inline visual content edit',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsDirty(false);
        setIsPublished(data.post?.status === 'PUBLISHED');
        if (data.post) setPostRecord(data.post);
        setFeedbackMessage({
          type: 'success',
          text: 'Blog post draft saved successfully.',
        });
      } else {
        const data = await res.json();
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to save blog draft.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Network error saving draft.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to publish '${title}'? This will make your changes visible to all public readers.`
    );
    if (!confirmed) return;

    const targetId = postRecord?.id || post.id || slug;
    setIsPublishing(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/blog/${targetId}/publish`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        setIsDirty(false);
        setIsPublished(true);
        if (data.post) setPostRecord(data.post);
        setFeedbackMessage({
          type: 'success',
          text: `'${title}' published successfully!`,
        });
      } else {
        const data = await res.json();
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to publish blog post.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Network error publishing blog post.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = () => {
    const confirmed = window.confirm('Discard unsaved session edits?');
    if (!confirmed) return;

    setTitle(postRecord?.title || post.title);
    setExcerpt(postRecord?.excerpt || post.excerpt || '');
    setContent(postRecord?.content || post.content || '');
    setFeaturedImage(postRecord?.featuredImage || post.featuredImage || '');
    setFeaturedImageAlt(postRecord?.featuredImageAlt || post.featuredImageAlt || '');
    setSeoData(postRecord?.seo || post.seo || null);
    setIsDirty(false);
    setSelectedBlockId(null);
    setFeedbackMessage({ type: 'warning', text: 'Unsaved edits discarded.' });
  };

  // Virtual blocks for InlineBlockEditorDrawer
  const getSelectedBlock = (): UniversalContentBlock | null => {
    if (!selectedBlockId) return null;

    if (selectedBlockId === 'blog-title') {
      return {
        id: 'blog-title',
        type: 'heading',
        enabled: true,
        order: 0,
        content: { level: 1, text: title },
        level: 1,
        text: title,
      };
    }
    if (selectedBlockId === 'blog-excerpt') {
      return {
        id: 'blog-excerpt',
        type: 'paragraph',
        enabled: true,
        order: 1,
        content: { text: excerpt },
        text: excerpt,
      };
    }
    if (selectedBlockId === 'blog-image') {
      return {
        id: 'blog-image',
        type: 'image',
        enabled: true,
        order: 2,
        content: { src: featuredImage, alt: featuredImageAlt },
        src: featuredImage,
        alt: featuredImageAlt,
      };
    }
    if (selectedBlockId === 'blog-content') {
      return {
        id: 'blog-content',
        type: 'paragraph',
        enabled: true,
        order: 3,
        content: { text: content },
        text: content,
      };
    }
    return null;
  };

  const handleUpdateBlock = (updatedBlock: UniversalContentBlock) => {
    if (updatedBlock.id === 'blog-title') {
      setTitle(updatedBlock.content?.text || updatedBlock.text || '');
    } else if (updatedBlock.id === 'blog-excerpt') {
      setExcerpt(updatedBlock.content?.text || updatedBlock.text || '');
    } else if (updatedBlock.id === 'blog-image') {
      setFeaturedImage(updatedBlock.content?.src || updatedBlock.src || '');
      setFeaturedImageAlt(updatedBlock.content?.alt || updatedBlock.alt || '');
    } else if (updatedBlock.id === 'blog-content') {
      setContent(updatedBlock.content?.text || updatedBlock.text || '');
    }
    setIsDirty(true);
  };

  const breadcrumbs = [
    { name: 'Blog', href: '/blog' },
    { name: title },
  ];

  const authorName = postRecord?.author?.name || post.author?.name || 'Convert24 Team';
  const displayDate = postRecord?.publishedAt
    ? new Date(postRecord.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Published';

  return (
    <>
      {jsonLd && (
        <>
          <JsonLd data={jsonLd.articleSchema} />
          <JsonLd data={jsonLd.breadcrumbSchema} />
        </>
      )}

      {/* Floating Admin Toolbar (Only for Authenticated Editors) */}
      {isAdmin && (
        <InlineEditorToolbar
          slug={post.slug}
          previewUrl={`/blog/${post.slug}`}
          isEditing={isEditingMode}
          isDirty={isDirty}
          isPublished={isPublished}
          isPreviewMode={false}
          onToggleEdit={handleToggleEdit}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onDiscard={handleDiscard}
          onOpenRevisions={() => setIsRevisionsOpen(true)}
          onOpenSeo={() => setIsSeoOpen(true)}
          onOpenSharedSettings={() => setIsSharedSettingsOpen(true)}
          hasSeoOverride={Boolean(seoData?.seoTitle || seoData?.metaDescription)}
          isSaving={isSaving}
          isPublishing={isPublishing}
          feedbackMessage={feedbackMessage}
        />
      )}

      <article className="py-8 md:py-12 bg-[#FCFBFF]">
        <Container>
          <Breadcrumbs items={breadcrumbs} />

          <div className="max-w-3xl mx-auto">
            <Link
              href="/blog"
              className="inline-flex items-center text-xs font-semibold text-[#7C3AED] hover:underline mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              <span>Back to all guides</span>
            </Link>

            <header className="space-y-4 mb-8">
              {post.category && (
                <div className="mb-2">
                  <Link
                    href={`/blog?category=${post.category.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#EDE9FE]"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    <span>{post.category.name}</span>
                  </Link>
                </div>
              )}

              {/* Editable Title */}
              <InlineBlockWrapper
                blockId="blog-title"
                blockType="heading"
                label="Article Title"
                isEditing={isEditingMode}
                isSelected={selectedBlockId === 'blog-title'}
                onSelect={() => setSelectedBlockId('blog-title')}
              >
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#0F112E] tracking-tight leading-tight">
                  {title}
                </h1>
              </InlineBlockWrapper>

              {/* Editable Excerpt */}
              <InlineBlockWrapper
                blockId="blog-excerpt"
                blockType="paragraph"
                label="Article Excerpt / Subtitle"
                isEditing={isEditingMode}
                isSelected={selectedBlockId === 'blog-excerpt'}
                onSelect={() => setSelectedBlockId('blog-excerpt')}
              >
                <p className="text-lg text-[#5E6488] leading-relaxed font-normal">
                  {excerpt || 'Add an article introduction or summary...'}
                </p>
              </InlineBlockWrapper>

              <div className="flex flex-wrap items-center gap-4 text-sm text-[#5E6488] pt-2 border-b border-[#E4E2F0] pb-4">
                <span>By {authorName}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <time dateTime={post.publishedAt || undefined}>{displayDate}</time>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span>{post.readingTime}</span>
                </span>
              </div>
            </header>

            {/* Editable Featured Image */}
            <InlineBlockWrapper
              blockId="blog-image"
              blockType="image"
              label="Featured Image"
              isEditing={isEditingMode}
              isSelected={selectedBlockId === 'blog-image'}
              onSelect={() => setSelectedBlockId('blog-image')}
            >
              {featuredImage && isSafeUrl(featuredImage) ? (
                <div className="mb-8 rounded-2xl overflow-hidden border border-[#E4E2F0] bg-[#FAF9FF] shadow-sm">
                  <img
                    src={featuredImage}
                    alt={featuredImageAlt || title}
                    className="w-full h-auto object-cover max-h-[480px]"
                  />
                </div>
              ) : isEditingMode ? (
                <div className="p-8 mb-8 border-2 border-dashed border-[#7C3AED]/40 rounded-2xl text-center bg-[#FAF9FF] text-xs font-bold text-[#7C3AED]">
                  + Click to Add Featured Image
                </div>
              ) : null}
            </InlineBlockWrapper>

            <AdSlot slotId={`blog-top-${post.slug}`} />

            {/* Editable Content */}
            <InlineBlockWrapper
              blockId="blog-content"
              blockType="paragraph"
              label="Article Content Body"
              isEditing={isEditingMode}
              isSelected={selectedBlockId === 'blog-content'}
              onSelect={() => setSelectedBlockId('blog-content')}
            >
              <div className="max-w-none">
                <BlogContentRenderer content={content} />
              </div>
            </InlineBlockWrapper>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-12 pt-6 border-t border-[#E4E2F0] flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#5E6488] uppercase tracking-wider mr-2 flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5" />
                  Tags:
                </span>
                {post.tags.map((tag: any) => (
                  <Link
                    key={tag.slug}
                    href={`/blog?tag=${tag.slug}`}
                    className="px-3 py-1 bg-white border border-[#E4E2F0] hover:border-[#7C3AED] hover:text-[#7C3AED] text-xs font-semibold text-[#0F112E] rounded-full transition-colors"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Container>
      </article>

      {/* Drawers */}
      <InlineBlockEditorDrawer
        block={getSelectedBlock()}
        isOpen={Boolean(selectedBlockId && isEditingMode)}
        onClose={() => setSelectedBlockId(null)}
        onSaveBlock={handleUpdateBlock}
      />

      <InlineSeoDrawer
        slug={post.slug}
        pageType="blog"
        isOpen={isSeoOpen}
        onClose={() => setIsSeoOpen(false)}
        seoData={seoData}
        inheritedDefaults={{
          title: `${title} | Convert24 Guides`,
          description: excerpt || `Learn more about ${title} on Convert24.`,
          canonicalUrl: `https://convert24.local/blog/${post.slug}`,
        }}
        onSaveSeo={(updatedSeo) => {
          setSeoData(updatedSeo);
          setIsDirty(true);
        }}
      />

      <InlineRevisionDrawer
        slug={post.slug}
        pageId={postRecord?.id || post.id}
        entityType="blog"
        isOpen={isRevisionsOpen}
        onClose={() => setIsRevisionsOpen(false)}
        onRevisionRestored={() => {
          const targetId = postRecord?.id || post.id || slug;
          fetch(`/api/admin/blog/${targetId}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.post) {
                setPostRecord(data.post);
                setTitle(data.post.title);
                setExcerpt(data.post.excerpt || '');
                setContent(data.post.content || '');
                setFeaturedImage(data.post.featuredImage || '');
                setFeaturedImageAlt(data.post.featuredImageAlt || '');
                if (data.post.seo) setSeoData(data.post.seo);
                setIsDirty(false);
                setFeedbackMessage({ type: 'success', text: 'Revision restored successfully.' });
              }
            });
        }}
      />

      <InlineSharedSettingsDrawer
        isOpen={isSharedSettingsOpen}
        onClose={() => setIsSharedSettingsOpen(false)}
      />
    </>
  );
}
