'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Smartphone,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  ListOrdered,
  HelpCircle,
  Grid,
  MousePointerClick,
  Type,
  Link as LinkIcon,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Code,
  Layers,
} from 'lucide-react';
import Container from '@/components/layout/Container';
import ToolCard from '@/components/tool/ToolCard';
import HomeSearch from '@/components/tool/HomeSearch';
import FAQ from '@/components/seo/FAQ';
import { GENERAL_FAQS } from '@/lib/faq';
import { ResolvedCmsPage, CmsJsonLd, CmsBlockRenderer } from '@/lib/cms/page-resolver';
import { sanitizeCustomCss } from '@/lib/admin/validation';
import {
  UniversalContentBlock,
  duplicateBlock,
  findBlockById,
  findParentBlock,
  updateBlockInTree,
  deleteBlockFromTree,
} from '@/lib/cms/blocks';
import { DEFAULT_CONTAINER_SETTINGS } from '@/lib/cms/container-contract';
import {
  copyBlockToClipboard,
  pasteBlockFromClipboard,
  getClipboardState,
  CLIPBOARD_EVENT_NAME,
  getBlockLabel,
} from '@/lib/cms/block-clipboard';
import { getCanonicalHomepageBlocks } from '@/lib/cms/homepage-contract';
import { InlineBlockWrapper } from '@/components/admin/inline/InlineBlockWrapper';
import { InlineBlockEditorDrawer } from '@/components/admin/inline/InlineBlockEditorDrawer';
import { InlineEditorToolbar } from '@/components/admin/inline/InlineEditorToolbar';
import { InlineRevisionDrawer } from '@/components/admin/inline/InlineRevisionDrawer';
import { InlineSeoDrawer, InlineSeoData } from '@/components/admin/inline/InlineSeoDrawer';
import { InlineSharedSettingsDrawer } from '@/components/admin/inline/InlineSharedSettingsDrawer';

interface HomePageClientProps {
  initialCmsPage: ResolvedCmsPage | null;
  allTools: any[];
  allFormats: any[];
  popularTools: any[];
  imageToolsCount: number;
  pdfToolsCount: number;
}

export default function HomePageClient({
  initialCmsPage,
  allTools,
  allFormats,
  popularTools,
  imageToolsCount,
  pdfToolsCount,
}: HomePageClientProps) {
  // Admin auth & editing state
  const [isAdmin, setIsAdmin] = useState(false);
  const [pageRecord, setPageRecord] = useState<any | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [isSharedSettingsOpen, setIsSharedSettingsOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isPublished, setIsPublished] = useState<boolean>(
    initialCmsPage?.status === 'PUBLISHED' || true
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Editable fields state
  const [pageName, setPageName] = useState<string>(
    initialCmsPage?.name || 'Free Online File Tools'
  );
  const [activeBlocks, setActiveBlocks] = useState<UniversalContentBlock[]>(() =>
    getCanonicalHomepageBlocks(initialCmsPage?.blocks as any[], initialCmsPage?.name)
  );
  const [customCss, setCustomCss] = useState<string>(
    initialCmsPage?.customCss || ''
  );
  const [seoData, setSeoData] = useState<InlineSeoData | null>(
    () => (initialCmsPage?.seo as InlineSeoData) || null
  );

  // In-session cross-page block clipboard state
  const [clipboardState, setClipboardState] = useState<{
    hasContent: boolean;
    type?: string;
    label?: string;
  }>(() => getClipboardState());

  useEffect(() => {
    const updateState = () => setClipboardState(getClipboardState());
    updateState();
    window.addEventListener(CLIPBOARD_EVENT_NAME, updateState);
    window.addEventListener('focus', updateState);
    return () => {
      window.removeEventListener(CLIPBOARD_EVENT_NAME, updateState);
      window.removeEventListener('focus', updateState);
    };
  }, []);

  // Authenticate with server & load full draft page record if admin
  useEffect(() => {
    let isMounted = true;

    async function checkAuthAndLoadDraft() {
      try {
        const authRes = await fetch('/api/admin/auth/me');
        if (!authRes.ok) return;

        const authData = await authRes.json();
        if (isMounted && authData.user && authData.permissions?.includes('EDIT_CONTENT')) {
          setIsAdmin(true);

          // Fetch full page draft record from Pages API
          const pageRes = await fetch('/api/admin/pages?slug=home');
          if (pageRes.ok) {
            const pageData = await pageRes.json();
            const record = pageData.page;
            if (record && isMounted) {
              setPageRecord(record);
              setPageName(record.name || 'Free Online File Tools');
              setIsPublished(record.status === 'PUBLISHED');

              if (record.content) {
                const blocksFromDb = Array.isArray(record.content.blocks)
                  ? record.content.blocks
                  : [];
                setActiveBlocks(getCanonicalHomepageBlocks(blocksFromDb, record.name));

                if (record.content.customCss !== undefined) {
                  setCustomCss(record.content.customCss || '');
                }
              }

              if (record.seo) {
                setSeoData(record.seo);
              }
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
  }, []);

  const handleToggleEdit = () => {
    setIsEditingMode((prev) => !prev);
    setSelectedBlockId(null);
  };

  const handleSaveDraft = async () => {
    if (!pageRecord?.id) {
      setFeedbackMessage({
        type: 'warning',
        text: 'Homepage record is missing in database. Initializing...',
      });
      try {
        const bootRes = await fetch('/api/admin/pages/bootstrap', { method: 'POST' });
        const bootData = await bootRes.json();
        if (bootData.page) {
          setPageRecord(bootData.page);
        }
      } catch {
        setFeedbackMessage({ type: 'error', text: 'Failed to initialize homepage record.' });
        return;
      }
    }

    const targetId = pageRecord?.id || 'home';
    setIsSaving(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/pages/${targetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pageName,
          blocks: activeBlocks,
          customCss: customCss || null,
          seo: seoData || undefined,
          status: 'DRAFT',
          reason: 'Inline visual editor update',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsDirty(false);
        setIsPublished(data.page?.status === 'PUBLISHED');
        if (data.page) setPageRecord(data.page);
        setFeedbackMessage({
          type: 'success',
          text: 'Homepage draft saved successfully. Public visitors continue to see published content.',
        });
      } else {
        const data = await res.json();
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to save homepage draft.',
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
      'Are you sure you want to publish your changes to the Homepage? This will make your draft visible to all public visitors.'
    );
    if (!confirmed) return;

    const targetId = pageRecord?.id || 'home';
    setIsPublishing(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/pages/${targetId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsDirty(false);
        setIsPublished(true);
        if (data.page) setPageRecord(data.page);
        setFeedbackMessage({
          type: 'success',
          text: 'Homepage published successfully to /.',
        });
      } else {
        const data = await res.json();
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to publish homepage.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Network error publishing homepage.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = () => {
    const confirmed = window.confirm('Discard unsaved edits in this session?');
    if (!confirmed) return;

    if (pageRecord?.content?.blocks) {
      setActiveBlocks(getCanonicalHomepageBlocks(pageRecord.content.blocks, pageRecord.name));
    } else {
      setActiveBlocks(getCanonicalHomepageBlocks(initialCmsPage?.blocks as any[], initialCmsPage?.name));
    }
    setCustomCss(pageRecord?.content?.customCss || initialCmsPage?.customCss || '');
    setSeoData(pageRecord?.seo || initialCmsPage?.seo || null);
    setPageName(pageRecord?.name || initialCmsPage?.name || 'Free Online File Tools');
    setIsDirty(false);
    setSelectedBlockId(null);
    setFeedbackMessage({ type: 'warning', text: 'Unsaved session changes discarded.' });
  };

  // Block management helper
  const handleAddBlock = (type: string) => {
    const newId = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const nextOrder = activeBlocks.length + 1;
    let newBlock: UniversalContentBlock;

    switch (type) {
      case 'heading':
        newBlock = {
          id: newId,
          type: 'heading',
          order: nextOrder,
          enabled: true,
          content: { level: 2, text: 'New Section Heading' },
          text: 'New Section Heading',
          level: 2,
        };
        break;
      case 'paragraph':
        newBlock = {
          id: newId,
          type: 'paragraph',
          order: nextOrder,
          enabled: true,
          content: { text: 'Add your paragraph description here.' },
          text: 'Add your paragraph description here.',
        };
        break;
      case 'rich_text':
        newBlock = {
          id: newId,
          type: 'rich_text',
          order: nextOrder,
          enabled: true,
          content: { html: '<p>Custom formatted HTML content.</p>' },
          html: '<p>Custom formatted HTML content.</p>',
        };
        break;
      case 'image':
        newBlock = {
          id: newId,
          type: 'image',
          order: nextOrder,
          enabled: true,
          content: { src: '/images/og-image.png', alt: 'Convert24 Feature Graphic', caption: '' },
          src: '/images/og-image.png',
          alt: 'Convert24 Feature Graphic',
        };
        break;
      case 'feature':
        newBlock = {
          id: newId,
          type: 'feature',
          order: nextOrder,
          enabled: true,
          content: {
            title: 'New Feature Highlight',
            description: 'Feature details and user benefit explanation.',
            icon: 'ShieldCheck',
          },
          title: 'New Feature Highlight',
          description: 'Feature details and user benefit explanation.',
        };
        break;
      case 'faq':
        newBlock = {
          id: newId,
          type: 'faq',
          order: nextOrder,
          enabled: true,
          content: {
            question: 'Frequently Asked Question?',
            answer: 'Detailed answer providing helpful instructions.',
          },
          question: 'Frequently Asked Question?',
          answer: 'Detailed answer providing helpful instructions.',
        };
        break;
      case 'cta':
        newBlock = {
          id: newId,
          type: 'cta',
          order: nextOrder,
          enabled: true,
          content: {
            title: 'Ready to Convert Your Files?',
            description: 'Fast, secure, and completely private online conversion in your browser.',
            buttonText: 'Explore Converters',
            label: 'Explore Converters',
            href: '#explore-hubs',
            variant: 'primary',
            secondaryLabel: 'Learn More',
            secondaryHref: '/about',
          },
          title: 'Ready to Convert Your Files?',
          description: 'Fast, secure, and completely private online conversion in your browser.',
          buttonText: 'Explore Converters',
          label: 'Explore Converters',
          href: '#explore-hubs',
          variant: 'primary',
          secondaryLabel: 'Learn More',
          secondaryHref: '/about',
        };
        break;
      case 'link':
        newBlock = {
          id: newId,
          type: 'link',
          order: nextOrder,
          enabled: true,
          content: {
            text: 'Discover PDF Tools',
            href: '/pdf-tools',
            isExternal: false,
          },
          text: 'Discover PDF Tools',
          href: '/pdf-tools',
        };
        break;
      case 'section':
        newBlock = {
          id: newId,
          type: 'section',
          order: nextOrder,
          enabled: true,
          content: {
            title: 'New Section Container',
            description: 'Section subtitle explaining the content below.',
          },
          title: 'New Section Container',
          description: 'Section subtitle explaining the content below.',
        };
        break;
      case 'custom_html':
        newBlock = {
          id: newId,
          type: 'custom_html',
          order: nextOrder,
          enabled: true,
          content: {
            html: '<div class="custom-card">\n  <h3>Custom Component</h3>\n  <p>Enter custom HTML and style it with scoped CSS or Tailwind utility classes.</p>\n</div>',
            css: '.custom-card {\n  padding: 1.5rem;\n  background: #f8fafc;\n  border: 1px solid #e2e8f0;\n  border-radius: 1rem;\n}\n.custom-card h3 {\n  font-size: 1.125rem;\n  font-weight: 700;\n  color: #0f172a;\n  margin-bottom: 0.5rem;\n}\n.custom-card p {\n  font-size: 0.875rem;\n  color: #64748b;\n}',
            caption: '',
          },
          html: '<div class="custom-card">\n  <h3>Custom Component</h3>\n  <p>Enter custom HTML and style it with scoped CSS or Tailwind utility classes.</p>\n</div>',
          css: '.custom-card {\n  padding: 1.5rem;\n  background: #f8fafc;\n  border: 1px solid #e2e8f0;\n  border-radius: 1rem;\n}\n.custom-card h3 {\n  font-size: 1.125rem;\n  font-weight: 700;\n  color: #0f172a;\n  margin-bottom: 0.5rem;\n}\n.custom-card p {\n  font-size: 0.875rem;\n  color: #64748b;\n}',
        };
        break;
      case 'container':
        newBlock = {
          id: newId,
          type: 'container',
          order: nextOrder,
          enabled: true,
          settings: { ...DEFAULT_CONTAINER_SETTINGS },
          content: {
            settings: { ...DEFAULT_CONTAINER_SETTINGS },
            blocks: [
              {
                id: `blk-${Date.now()}-1`,
                type: 'heading',
                order: 1,
                enabled: true,
                content: { level: 3, text: 'Custom Container' },
                level: 3,
                text: 'Custom Container',
              },
              {
                id: `blk-${Date.now()}-2`,
                type: 'paragraph',
                order: 2,
                enabled: true,
                content: { text: 'Group content in flexible layouts, grids, and backgrounds.' },
                text: 'Group content in flexible layouts, grids, and backgrounds.',
              },
            ],
          },
          blocks: [],
        };
        newBlock.blocks = newBlock.content.blocks;
        newBlock.children = newBlock.content.blocks;
        break;
      default:
        newBlock = {
          id: newId,
          type: 'paragraph',
          order: nextOrder,
          enabled: true,
          content: { text: 'New content block.' },
        };
    }

    setActiveBlocks((prev) => [...prev, newBlock]);
    setIsDirty(true);
    setSelectedBlockId(newId);
  };

  const handleUpdateSelectedBlock = (updatedBlock: UniversalContentBlock) => {
    setActiveBlocks((prev) => updateBlockInTree(prev, updatedBlock));
    // If the updated block is hero and has a new title, update pageName as well
    if (updatedBlock.type === 'hero' && updatedBlock.content?.title) {
      setPageName(updatedBlock.content.title);
    }
    setIsDirty(true);
  };

  const handleDeleteBlock = (blockId: string) => {
    setActiveBlocks((prev) => deleteBlockFromTree(prev, blockId));
    setIsDirty(true);
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeBlocks.length) return;

    const updated = [...activeBlocks];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setActiveBlocks(updated.map((b, idx) => ({ ...b, order: idx })));
    setIsDirty(true);
  };

  const handleDuplicateBlock = (block: UniversalContentBlock) => {
    const copy = duplicateBlock(block);
    const idx = activeBlocks.findIndex((b) => b.id === block.id);
    const updated = [...activeBlocks];
    if (idx !== -1) {
      updated.splice(idx + 1, 0, copy);
    } else {
      updated.push(copy);
    }
    setActiveBlocks(updated.map((b, i) => ({ ...b, order: i })));
    setIsDirty(true);
    setSelectedBlockId(copy.id);
    setFeedbackMessage({
      type: 'success',
      text: `Duplicated "${getBlockLabel(block.type)}" block on this page.`,
    });
  };

  const handleCopyBlock = async (block: UniversalContentBlock) => {
    const res = await copyBlockToClipboard(block);
    if (res.success) {
      setFeedbackMessage({ type: 'success', text: res.message });
    } else {
      setFeedbackMessage({ type: 'error', text: res.message });
    }
  };

  const handlePasteBlock = async (afterBlockId?: string) => {
    const res = await pasteBlockFromClipboard('home', activeBlocks.length);
    if (!res.success || !res.block) {
      setFeedbackMessage({
        type: 'warning',
        text: res.error || 'Failed to paste block.',
      });
      return;
    }
    const pasted = res.block;
    let updated: UniversalContentBlock[];
    if (afterBlockId) {
      const idx = activeBlocks.findIndex((b) => b.id === afterBlockId);
      updated = [...activeBlocks];
      if (idx !== -1) {
        updated.splice(idx + 1, 0, pasted);
      } else {
        updated.push(pasted);
      }
    } else if (selectedBlockId) {
      const idx = activeBlocks.findIndex((b) => b.id === selectedBlockId);
      updated = [...activeBlocks];
      if (idx !== -1) {
        updated.splice(idx + 1, 0, pasted);
      } else {
        updated.push(pasted);
      }
    } else {
      updated = [...activeBlocks, pasted];
    }
    setActiveBlocks(updated.map((b, i) => ({ ...b, order: i })));
    setIsDirty(true);
    setSelectedBlockId(pasted.id);
    setFeedbackMessage({
      type: 'success',
      text: `Pasted "${getBlockLabel(pasted.type)}" block successfully.`,
    });
  };

  // Find canonical blocks from state
  const heroBlock = activeBlocks.find((b) => b.type === 'hero');
  const popularBlock = activeBlocks.find((b) => b.type === 'popular_tools');
  const hubsBlock = activeBlocks.find((b) => b.type === 'hubs');
  const featuresBlock = activeBlocks.find((b) => b.type === 'features');
  const pricingBlock = activeBlocks.find((b) => b.type === 'pricing');
  const faqBlock = activeBlocks.find((b) => b.type === 'faq');

  // Any custom CMS blocks outside the standard 6 canonical blocks
  const canonicalIds = [
    heroBlock?.id,
    popularBlock?.id,
    hubsBlock?.id,
    featuresBlock?.id,
    pricingBlock?.id,
    faqBlock?.id,
  ].filter(Boolean);

  const customCmsBlocks = activeBlocks.filter(
    (b) => !canonicalIds.includes(b.id) && b.enabled !== false
  );

  // Content extraction helpers
  const heroContent = heroBlock?.content || {
    badge: '100% Free & Client-Side Private',
    title: pageName,
    description:
      'Convert, compress and manage your files quickly and easily without sending them across the internet.',
    searchPrompt: 'What do you want to do?',
    quickLinks: [
      { label: 'compress pdf', slug: 'compress-pdf' },
      { label: 'jpg to png', slug: 'jpg-to-png' },
      { label: 'merge pdf', slug: 'merge-pdf' },
      { label: 'compress image', slug: 'compress-image' },
      { label: 'resize image', slug: 'resize-image' },
    ],
  };

  const popularContent = popularBlock?.content || {
    heading: 'Popular tools',
    subheading: 'Frequently used converters and optimizers.',
    exploreText: 'Explore all tools',
    exploreHref: '#explore-hubs',
  };

  const hubsContent = hubsBlock?.content || {
    heading: 'Explore all tools',
    subheading: 'Browse our simple discovery hubs to find exactly what you need without clutter.',
    imageHubTitle: 'Image Tools Hub',
    imageHubDescription:
      'Convert between JPG, PNG, WebP, HEIC, SVG, GIF, and BMP. Compress photos, resize dimensions, crop frames, and orient images.',
    imageHubButton: 'Explore image tools',
    imageHubHref: '/image-tools',
    pdfHubTitle: 'PDF Tools Hub',
    pdfHubDescription:
      'Merge multiple documents, split pages, compress file sizes, rotate orientation, delete pages, reorder pages, and convert to images.',
    pdfHubButton: 'Explore PDF tools',
    pdfHubHref: '/pdf-tools',
  };

  const featuresContent = featuresBlock?.content || {
    heading: 'Why Use Convert24',
    subheading: 'Engineered for speed, strict privacy, and hassle-free utility.',
    items: [
      { id: 'f-1', title: 'Client-Side Privacy', description: 'Files process directly in your browser. No files are uploaded to external cloud servers.', icon: 'Lock' },
      { id: 'f-2', title: '100% Free', description: 'No registrations, no subscriptions, and no watermarks placed on your documents or photos.', icon: 'ShieldCheck' },
      { id: 'f-3', title: 'Ultra Fast', description: 'Skip remote file upload latency. Local browser execution delivers near-instant conversion.', icon: 'Zap' },
      { id: 'f-4', title: 'Mobile Friendly', description: 'Designed mobile-first with touch-friendly controls for smartphones, tablets, and desktops.', icon: 'Smartphone' },
    ],
  };

  const pricingContent = pricingBlock?.content || {
    badge: 'Pricing Plans',
    title: 'Always 100% Free. No Hidden Fees.',
    description:
      'Unlike other tools that lock premium features like high-quality compression or batch uploads behind payment walls, all 25 tools on Convert24 are fully free with unlimited conversions, zero registration, and complete browser security.',
    planName: 'Standard plan',
    price: '$0',
    period: '/ forever',
    items: [
      'Unlimited Batch Conversions',
      '50 MB File Size Allowance',
      'Safe Local Browser Processing',
    ],
    buttonText: 'Get Started Instantly',
    buttonHref: '#explore-hubs',
  };

  const faqContent = faqBlock?.content || {
    heading: 'Frequently Asked Questions',
    items: GENERAL_FAQS,
  };

  const safeCustomCss = customCss ? sanitizeCustomCss(customCss) : '';
  const selectedBlock = findBlockById(activeBlocks, selectedBlockId);
  const parentContainer = findParentBlock(activeBlocks, selectedBlockId);

  const schemaJsonObj =
    seoData?.schemaJson && typeof seoData.schemaJson === 'object'
      ? seoData.schemaJson
      : initialCmsPage?.seo?.schemaJson;

  return (
    <div className="space-y-16 md:space-y-24 pb-20 bg-[#FCFBFF] relative">
      <CmsJsonLd schema={schemaJsonObj as any} />

      {safeCustomCss && (
        <style dangerouslySetInnerHTML={{ __html: safeCustomCss }} />
      )}

      {/* Floating Admin Toolbar (Only for Authenticated Editors) */}
      {isAdmin && (
        <InlineEditorToolbar
          slug="home"
          previewUrl="/"
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

      {/* Add CMS Content Block Toolbar (Visible in Edit Mode) */}
      {isAdmin && isEditingMode && (
        <div className="sticky top-16 z-30 bg-[#0F112E]/95 backdrop-blur-md text-white py-2.5 px-4 shadow-lg border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7C3AED]" />
            <span>Universal Visual Block Editor</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-white/60 pr-1">Insert Block:</span>
            <button
              type="button"
              onClick={() => handleAddBlock('heading')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Type className="w-3 h-3 text-purple-300" />
              <span>Heading</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('paragraph')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <FileText className="w-3 h-3 text-purple-300" />
              <span>Paragraph</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('rich_text')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <FileText className="w-3 h-3 text-emerald-300" />
              <span>Rich Text</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('image')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <ImageIcon className="w-3 h-3 text-blue-300" />
              <span>Image</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('feature')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Grid className="w-3 h-3 text-purple-300" />
              <span>Feature</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('faq')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <HelpCircle className="w-3 h-3 text-purple-300" />
              <span>FAQ</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('cta')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <MousePointerClick className="w-3 h-3 text-purple-300" />
              <span>CTA Button</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('link')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <LinkIcon className="w-3 h-3 text-purple-300" />
              <span>Link</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('custom_html')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Code className="w-3 h-3 text-amber-300" />
              <span>Custom HTML</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddBlock('container')}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg flex items-center gap-1 transition-colors"
            >
              <Layers className="w-3 h-3 text-purple-300" />
              <span>Container</span>
            </button>
            <div className="h-4 w-px bg-white/20 mx-1" />
            <button
              type="button"
              onClick={() => handlePasteBlock()}
              disabled={!clipboardState.hasContent}
              title={
                clipboardState.hasContent
                  ? `Paste copied ${clipboardState.label || 'block'}`
                  : 'Clipboard is empty. Copy a block first.'
              }
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                clipboardState.hasContent
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm font-semibold'
                  : 'bg-white/5 text-white/40 cursor-not-allowed'
              }`}
            >
              <ClipboardPaste className="w-3 h-3 text-purple-200" />
              <span>Paste Block{clipboardState.hasContent && clipboardState.label ? ` (${clipboardState.label})` : ''}</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. HERO SECTION */}
      <section className="pt-8 md:pt-12 px-4 sm:px-6 overflow-hidden">
        <Container>
          <InlineBlockWrapper
            blockId={heroBlock?.id || 'home-hero'}
            blockType="hero"
            label="Hero Section"
            isEditing={isEditingMode}
            isSelected={selectedBlockId === (heroBlock?.id || 'home-hero')}
            onSelect={() => setSelectedBlockId(heroBlock?.id || 'home-hero')}
            onCopy={heroBlock ? () => handleCopyBlock(heroBlock) : undefined}
            onPasteAfter={() => handlePasteBlock(heroBlock?.id || 'home-hero')}
            canPaste={clipboardState.hasContent}
            copiedBlockLabel={clipboardState.label}
          >
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#FAF9FF] via-[#EEEDFC] to-[#E5E7FF] border border-[#E4E2F0] px-6 py-12 md:py-20 text-center shadow-xl shadow-indigo-100/50">
              <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-violet-300/20 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-80 sm:w-96 h-80 sm:h-96 rounded-full bg-indigo-300/25 blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-3xl mx-auto space-y-6 mb-10">
                {heroContent.badge && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E4E2F0] text-xs font-bold text-[#7C3AED] uppercase tracking-wider rounded-full shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                    {heroContent.badge}
                  </span>
                )}

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0F112E] tracking-tight leading-tight text-wrap-balance">
                  {heroContent.title || pageName}
                </h1>

                <p className="text-base sm:text-lg md:text-xl text-[#5E6488] max-w-2xl mx-auto leading-relaxed">
                  {heroContent.description}
                </p>

                {heroContent.supportingText && (
                  <p className="text-xs sm:text-sm text-[#7C3AED] font-semibold italic">
                    {heroContent.supportingText}
                  </p>
                )}
              </div>

              {/* Core Tool Search & Discovery Header */}
              <div className="relative z-10 max-w-2xl mx-auto space-y-4 mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-[#7C3AED] tracking-tight">
                  {heroContent.searchPrompt || 'What do you want to do?'}
                </h2>

                <HomeSearch tools={allTools} placeholder="Search tools..." id="home-tool-search" />

                <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs text-[#5E6488]">
                  <span className="font-bold text-[#0F112E]">Quick search:</span>
                  {(heroContent.quickLinks || []).map((item: any, idx: number) => (
                    <Link
                      key={item.slug || idx}
                      href={`/tools/${item.slug}`}
                      className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E4E2F0] hover:border-[#7C3AED] hover:text-[#7C3AED] text-[#0F112E] rounded-xl shadow-sm transition-all font-semibold"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </InlineBlockWrapper>
        </Container>
      </section>

      {/* Custom CMS Content Blocks (If Added) */}
      {customCmsBlocks.length > 0 && (
        <section aria-label="Custom CMS Content">
          <Container>
            <div className="bg-white p-6 md:p-8 rounded-[24px] border border-[#E4E2F0] shadow-sm space-y-6">
              {customCmsBlocks.map((block, idx) => (
                <div key={block.id} className="relative group">
                  <InlineBlockWrapper
                    blockId={block.id}
                    blockType={block.type}
                    label={block.type.toUpperCase()}
                    isEditing={isEditingMode}
                    isSelected={selectedBlockId === block.id}
                    onSelect={() => setSelectedBlockId(block.id)}
                    onMoveUp={idx > 0 ? () => handleMoveBlock(activeBlocks.indexOf(block), 'up') : undefined}
                    onMoveDown={idx < customCmsBlocks.length - 1 ? () => handleMoveBlock(activeBlocks.indexOf(block), 'down') : undefined}
                    onDuplicate={() => handleDuplicateBlock(block)}
                    onDelete={() => handleDeleteBlock(block.id)}
                    onCopy={() => handleCopyBlock(block)}
                    onPasteAfter={() => handlePasteBlock(block.id)}
                    canPaste={clipboardState.hasContent}
                    copiedBlockLabel={clipboardState.label}
                  >
                    <CmsBlockRenderer blocks={[block as any]} />
                  </InlineBlockWrapper>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* 2. POPULAR TOOLS */}
      <section aria-labelledby="popular-tools-heading">
        <Container>
          <InlineBlockWrapper
            blockId={popularBlock?.id || 'home-popular-tools'}
            blockType="popular_tools"
            label="Popular Tools Section"
            isEditing={isEditingMode}
            isSelected={selectedBlockId === (popularBlock?.id || 'home-popular-tools')}
            onSelect={() => setSelectedBlockId(popularBlock?.id || 'home-popular-tools')}
            onCopy={popularBlock ? () => handleCopyBlock(popularBlock) : undefined}
            onPasteAfter={() => handlePasteBlock(popularBlock?.id || 'home-popular-tools')}
            canPaste={clipboardState.hasContent}
            copiedBlockLabel={clipboardState.label}
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
              <div>
                <h2
                  id="popular-tools-heading"
                  className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight"
                >
                  {popularContent.heading || 'Popular tools'}
                </h2>
                <p className="text-sm md:text-base text-[#5E6488] mt-1.5">
                  {popularContent.subheading || 'Frequently used converters and optimizers.'}
                </p>
              </div>
              <Link
                href={popularContent.exploreHref || '#explore-hubs'}
                className="inline-flex items-center text-sm font-bold text-[#7C3AED] hover:underline transition-colors"
              >
                <span>{popularContent.exploreText || 'Explore all tools'}</span>
                <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {popularTools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </InlineBlockWrapper>
        </Container>
      </section>

      {/* 3. EXPLORE ALL TOOLS HUBS */}
      <section id="explore-hubs" aria-labelledby="explore-all-tools-heading" className="scroll-mt-20">
        <Container>
          <InlineBlockWrapper
            blockId={hubsBlock?.id || 'home-hubs'}
            blockType="hubs"
            label="Discovery Hubs Section"
            isEditing={isEditingMode}
            isSelected={selectedBlockId === (hubsBlock?.id || 'home-hubs')}
            onSelect={() => setSelectedBlockId(hubsBlock?.id || 'home-hubs')}
            onCopy={hubsBlock ? () => handleCopyBlock(hubsBlock) : undefined}
            onPasteAfter={() => handlePasteBlock(hubsBlock?.id || 'home-hubs')}
            canPaste={clipboardState.hasContent}
            copiedBlockLabel={clipboardState.label}
          >
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2
                id="explore-all-tools-heading"
                className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight"
              >
                {hubsContent.heading || 'Explore all tools'}
              </h2>
              <p className="text-sm md:text-base text-[#5E6488] mt-2">
                {hubsContent.subheading || 'Browse our simple discovery hubs to find exactly what you need without clutter.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Image Tools Discovery Hub */}
              <div className="p-6 md:p-8 bg-[#FCFBFF] border border-[#E4E2F0] hover:border-[#7C3AED]/40 rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                      <ImageIcon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-[#F4F0FD] text-[#7C3AED] rounded-md border border-[#E4E2F0]/40">
                      {imageToolsCount} Tools
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-[#0F112E] group-hover:text-[#7C3AED] transition-colors">
                      {hubsContent.imageHubTitle || 'Image Tools Hub'}
                    </h3>
                    <p className="text-sm text-[#5E6488] mt-2 leading-relaxed">
                      {hubsContent.imageHubDescription ||
                        'Convert between JPG, PNG, WebP, HEIC, SVG, GIF, and BMP. Compress photos, resize dimensions, crop frames, and orient images.'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#F4F3FA]">
                  <Link
                    href={hubsContent.imageHubHref || '/image-tools'}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-[#6D28D9] hover:to-[#4F46E5] transition-all shadow-sm"
                  >
                    <span>
                      {hubsContent.imageHubButton || 'Explore image tools'} ({imageToolsCount})
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* PDF Tools Discovery Hub */}
              <div className="p-6 md:p-8 bg-[#FCFBFF] border border-[#E4E2F0] hover:border-[#7C3AED]/40 rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center shadow-sm">
                      <FileText className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold px-3 py-1 bg-[#EFF6FF] text-[#3B82F6] rounded-md border border-[#E4E2F0]/40">
                      {pdfToolsCount} Tools
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-[#0F112E] group-hover:text-[#3B82F6] transition-colors">
                      {hubsContent.pdfHubTitle || 'PDF Tools Hub'}
                    </h3>
                    <p className="text-sm text-[#5E6488] mt-2 leading-relaxed">
                      {hubsContent.pdfHubDescription ||
                        'Merge multiple documents, split pages, compress file sizes, rotate orientation, delete pages, reorder pages, and convert to images.'}
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#F4F3FA]">
                  <Link
                    href={hubsContent.pdfHubHref || '/pdf-tools'}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-[#6D28D9] hover:to-[#4F46E5] transition-all shadow-sm"
                  >
                    <span>
                      {hubsContent.pdfHubButton || 'Explore PDF tools'} ({pdfToolsCount})
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </InlineBlockWrapper>
        </Container>
      </section>

      {/* 4. WHY USE CONVERT24 (Feature Cards) */}
      <section
        className="bg-[#F4F3FA] py-16 md:py-20 border-y border-[#E4E2F0]"
        aria-labelledby="why-use-us-heading"
      >
        <Container>
          <InlineBlockWrapper
            blockId={featuresBlock?.id || 'home-features'}
            blockType="features"
            label="Why Use Convert24 Section"
            isEditing={isEditingMode}
            isSelected={selectedBlockId === (featuresBlock?.id || 'home-features')}
            onSelect={() => setSelectedBlockId(featuresBlock?.id || 'home-features')}
            onCopy={featuresBlock ? () => handleCopyBlock(featuresBlock) : undefined}
            onPasteAfter={() => handlePasteBlock(featuresBlock?.id || 'home-features')}
            canPaste={clipboardState.hasContent}
            copiedBlockLabel={clipboardState.label}
          >
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2
                id="why-use-us-heading"
                className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight"
              >
                {featuresContent.heading || 'Why Use Convert24'}
              </h2>
              <p className="text-sm md:text-base text-[#5E6488] mt-2">
                {featuresContent.subheading || 'Engineered for speed, strict privacy, and hassle-free utility.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {(featuresContent.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="p-6 bg-white border border-[#E4E2F0] rounded-[20px] space-y-4 shadow-sm h-full flex flex-col">
                  <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                    {item.icon === 'Lock' ? (
                      <Lock className="w-5 h-5" aria-hidden="true" />
                    ) : item.icon === 'Zap' ? (
                      <Zap className="w-5 h-5" aria-hidden="true" />
                    ) : item.icon === 'Smartphone' ? (
                      <Smartphone className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="font-bold text-lg text-[#0F112E]">{item.title}</h3>
                  <p className="text-sm text-[#5E6488] leading-relaxed flex-1">{item.description}</p>
                </div>
              ))}
            </div>
          </InlineBlockWrapper>
        </Container>
      </section>

      {/* 5. PRICING SECTION */}
      <section id="pricing" className="scroll-mt-20 overflow-hidden">
        <Container>
          <InlineBlockWrapper
            blockId={pricingBlock?.id || 'home-pricing'}
            blockType="pricing"
            label="Pricing Section"
            isEditing={isEditingMode}
            isSelected={selectedBlockId === (pricingBlock?.id || 'home-pricing')}
            onSelect={() => setSelectedBlockId(pricingBlock?.id || 'home-pricing')}
            onCopy={pricingBlock ? () => handleCopyBlock(pricingBlock) : undefined}
            onPasteAfter={() => handlePasteBlock(pricingBlock?.id || 'home-pricing')}
            canPaste={clipboardState.hasContent}
            copiedBlockLabel={clipboardState.label}
          >
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-tr from-[#0F112E] to-[#1E1B4B] text-white p-8 md:p-12 shadow-xl border border-indigo-900/50">
              <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/4 w-72 sm:w-80 h-72 sm:h-80 rounded-full bg-violet-600/30 blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  {pricingContent.badge && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-500/20 text-xs font-bold text-violet-300 uppercase tracking-wider rounded-full border border-violet-500/30">
                      {pricingContent.badge}
                    </span>
                  )}
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                    {pricingContent.title || 'Always 100% Free. No Hidden Fees.'}
                  </h2>
                  <p className="text-sm md:text-base text-indigo-200 max-w-2xl leading-relaxed">
                    {pricingContent.description}
                  </p>
                </div>
                <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-4 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-widest text-violet-300 font-bold">
                    {pricingContent.planName || 'Standard plan'}
                  </p>
                  <p className="text-4xl md:text-5xl font-black">
                    {pricingContent.price || '$0'}
                    <span className="text-xs text-indigo-300 font-normal">
                      {' '}
                      {pricingContent.period || '/ forever'}
                    </span>
                  </p>
                  <ul className="text-xs text-indigo-200 space-y-2 text-left max-w-xs mx-auto">
                    {(pricingContent.items || []).map((bullet: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={pricingContent.buttonHref || '#explore-hubs'}
                    className="block w-full text-center py-3 bg-gradient-to-r from-[#7C3AED] to-[#6366F1] hover:from-[#6D28D9] hover:to-[#4F46E5] text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98]"
                  >
                    {pricingContent.buttonText || 'Get Started Instantly'}
                  </Link>
                </div>
              </div>
            </div>
          </InlineBlockWrapper>
        </Container>
      </section>

      {/* 6. FAQ SECTION */}
      <section id="faq" className="scroll-mt-20">
        <Container>
          <InlineBlockWrapper
            blockId={faqBlock?.id || 'home-faq'}
            blockType="faq"
            label="FAQ Section"
            isEditing={isEditingMode}
            isSelected={selectedBlockId === (faqBlock?.id || 'home-faq')}
            onSelect={() => setSelectedBlockId(faqBlock?.id || 'home-faq')}
            onCopy={faqBlock ? () => handleCopyBlock(faqBlock) : undefined}
            onPasteAfter={() => handlePasteBlock(faqBlock?.id || 'home-faq')}
            canPaste={clipboardState.hasContent}
            copiedBlockLabel={clipboardState.label}
          >
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight text-center mb-6">
                {faqContent.heading || 'Frequently Asked Questions'}
              </h2>
              <FAQ items={faqContent.items || GENERAL_FAQS} />
            </div>
          </InlineBlockWrapper>
        </Container>
      </section>

      {/* Additional CMS Content Blocks */}
      {customCmsBlocks.length > 0 && (
        <section className="py-8">
          <Container>
            <div className="space-y-6">
              {customCmsBlocks.map((block) => {
                const idx = activeBlocks.findIndex((b) => b.id === block.id);
                return (
                  <div key={block.id} className="relative group">
                    <InlineBlockWrapper
                      blockId={block.id}
                      blockType={block.type}
                      label={getBlockLabel(block.type)}
                      isEditing={isEditingMode}
                      isSelected={selectedBlockId === block.id}
                      onSelect={() => setSelectedBlockId(block.id)}
                      onMoveUp={idx > 0 ? () => handleMoveBlock(idx, 'up') : undefined}
                      onMoveDown={idx < activeBlocks.length - 1 ? () => handleMoveBlock(idx, 'down') : undefined}
                      onDuplicate={() => handleDuplicateBlock(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onCopy={() => handleCopyBlock(block)}
                      onPasteAfter={() => handlePasteBlock(block.id)}
                      canPaste={clipboardState.hasContent}
                      copiedBlockLabel={clipboardState.label}
                    >
                      <CmsBlockRenderer
                        blocks={[block as any]}
                        isEditing={isEditingMode}
                        selectedBlockId={selectedBlockId}
                        onSelectBlock={setSelectedBlockId}
                      />
                    </InlineBlockWrapper>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>
      )}

      {/* Drawers for Block Editing, SEO, and Revisions */}
      <InlineBlockEditorDrawer
        block={selectedBlock}
        parentBlock={parentContainer}
        isOpen={Boolean(selectedBlock && isEditingMode)}
        onClose={() => setSelectedBlockId(null)}
        onSaveBlock={handleUpdateSelectedBlock}
        onSelectBlock={setSelectedBlockId}
        onCopyBlock={selectedBlock ? () => handleCopyBlock(selectedBlock) : undefined}
      />

      <InlineSeoDrawer
        slug="home"
        pageType="home"
        isOpen={isSeoOpen}
        onClose={() => setIsSeoOpen(false)}
        seoData={seoData}
        inheritedDefaults={{
          title: pageName,
          description: 'Free online file conversion and optimization utilities.',
          canonicalUrl: 'https://convert24.local/',
        }}
        onSaveSeo={(updatedSeo) => {
          setSeoData(updatedSeo);
          setIsDirty(true);
        }}
      />

      <InlineRevisionDrawer
        slug="home"
        pageId={pageRecord?.id || 'page-home'}
        entityType="page"
        isOpen={isRevisionsOpen}
        onClose={() => setIsRevisionsOpen(false)}
        onRevisionRestored={() => {
          // Re-fetch page draft state after revision restore
          fetch('/api/admin/pages?slug=home')
            .then((res) => res.json())
            .then((data) => {
              if (data.page) {
                setPageRecord(data.page);
                setPageName(data.page.name || pageName);
                if (data.page.content?.blocks) {
                  setActiveBlocks(
                    getCanonicalHomepageBlocks(data.page.content.blocks, data.page.name)
                  );
                }
                if (data.page.content?.customCss !== undefined) {
                  setCustomCss(data.page.content.customCss || '');
                }
                if (data.page.seo) setSeoData(data.page.seo);
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
    </div>
  );
}
