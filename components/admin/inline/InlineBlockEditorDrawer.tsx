'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  HelpCircle,
  FileText,
  ListOrdered,
  Grid,
  Shield,
  Briefcase,
  Share2,
  MousePointerClick,
  Cpu,
  FileCheck,
  Sparkles,
  Image as ImageIcon,
  Link as LinkIcon,
  DollarSign,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  FolderOpen,
  Copy,
  Code,
  Eye,
  EyeOff,
  Palette,
  Pencil,
} from 'lucide-react';
import { UniversalContentBlock, duplicateBlock, getBlockLabel } from '@/lib/cms/blocks';
import {
  DEFAULT_CONTAINER_SETTINGS,
  sanitizeContainerSettings,
  getContainerWrapperClasses,
  getContainerInnerClasses,
  isSupportedContainerChildType,
  MAX_CONTAINER_DEPTH,
  type ContainerBlockSettings,
  type ContainerInnerWidth,
  type ContainerLayout,
  type ContainerGridCols,
  type ContainerGap,
  type ContainerAlign,
  type ContainerPadding,
  type ContainerBackground,
  type ContainerBorderRadius,
  type ContainerBorder,
} from '@/lib/cms/container-contract';
import { getAllTools } from '@/lib/tools';
import {
  isSafeUrl,
  sanitizeCustomHtml,
  scopeAndSanitizeCss,
  extractStylesFromHtml,
} from '@/lib/admin/validation';
import MediaPickerModal from '@/components/admin/media/MediaPickerModal';
import { MediaAssetItem } from '@/lib/admin/types';

interface InlineBlockEditorDrawerProps {
  block: UniversalContentBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveBlock: (updatedBlock: UniversalContentBlock) => void;
  onCopyBlock?: (block: UniversalContentBlock) => void;
  onSelectBlock?: (blockId: string) => void;
  parentBlock?: UniversalContentBlock | null;
}

export function InlineBlockEditorDrawer({
  block,
  isOpen,
  onClose,
  onSaveBlock,
  onCopyBlock,
  onSelectBlock,
  parentBlock,
}: InlineBlockEditorDrawerProps) {
  const [content, setContent] = useState<Record<string, any>>({});
  const [containerSettings, setContainerSettings] = useState<ContainerBlockSettings>(DEFAULT_CONTAINER_SETTINGS);
  const [containerActiveTab, setContainerActiveTab] = useState<'settings' | 'children' | 'preview'>('settings');
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [htmlViewMode, setHtmlViewMode] = useState<'source' | 'css' | 'preview'>('source');
  const [validationError, setValidationError] = useState<string | null>(null);
  const allCanonicalTools = getAllTools();

  useEffect(() => {
    if (block) {
      setContent(JSON.parse(JSON.stringify(block.content || {})));
      if (block.type === 'container') {
        const rawSettings = block.settings || block.content?.settings || {};
        setContainerSettings(sanitizeContainerSettings(rawSettings));
        setContainerActiveTab('settings');
      }
      setValidationError(null);
      setHtmlViewMode('source');
    }
  }, [block]);

  if (!isOpen || !block) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate any URLs present in content
    if (content.href && !isSafeUrl(content.href)) {
      setValidationError('Destination URL contains an unsafe protocol (javascript:, vbscript:, etc.).');
      return;
    }
    if (content.buttonHref && !isSafeUrl(content.buttonHref)) {
      setValidationError('Button URL contains an unsafe protocol.');
      return;
    }
    if (content.secondaryHref && !isSafeUrl(content.secondaryHref)) {
      setValidationError('Secondary button URL contains an unsafe protocol.');
      return;
    }
    if (content.exploreHref && !isSafeUrl(content.exploreHref)) {
      setValidationError('Explore URL contains an unsafe protocol.');
      return;
    }
    if (content.imageHubHref && !isSafeUrl(content.imageHubHref)) {
      setValidationError('Image Hub URL contains an unsafe protocol.');
      return;
    }
    if (content.pdfHubHref && !isSafeUrl(content.pdfHubHref)) {
      setValidationError('PDF Hub URL contains an unsafe protocol.');
      return;
    }
    if (content.src && !isSafeUrl(content.src)) {
      setValidationError('Image source URL contains an unsafe protocol.');
      return;
    }
    if (block.type === 'custom_html') {
      const htmlStr = content.html || '';
      if (typeof htmlStr === 'string' && htmlStr.length > 200000) {
        setValidationError('Custom HTML content exceeds the 200KB limit.');
        return;
      }
      const cssStr = content.css || '';
      if (typeof cssStr === 'string' && cssStr.length > 50000) {
        setValidationError('Custom CSS content exceeds the 50KB limit.');
        return;
      }
    }

    if (block.type === 'container') {
      const sanitizedSettings = sanitizeContainerSettings(containerSettings);
      const childBlocks = Array.isArray(content.blocks) ? content.blocks : [];
      onSaveBlock({
        ...block,
        settings: sanitizedSettings,
        content: {
          ...content,
          settings: sanitizedSettings,
          blocks: childBlocks,
        },
        blocks: childBlocks,
        children: childBlocks,
      });
      onClose();
      return;
    }

    onSaveBlock({
      ...block,
      content,
      // sync root properties for backward-compatibility
      ...content,
    });
    onClose();
  };

  const handleMediaSelect = (asset: MediaAssetItem | null) => {
    if (asset) {
      setContent((prev) => ({
        ...prev,
        src: asset.url,
        alt: asset.alt || asset.title || prev.alt || 'Selected media asset',
      }));
    }
    setIsMediaPickerOpen(false);
  };

  const handleAddChildBlock = (type: string) => {
    const currentDepth = parentBlock ? 2 : 1;
    const check = isSupportedContainerChildType(type, currentDepth);
    if (!check.supported) {
      setValidationError(check.reason || `Type "${type}" is not supported inside a container.`);
      return;
    }
    setValidationError(null);

    const newChildId = `blk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const currentChildren = Array.isArray(content.blocks) ? [...content.blocks] : [];
    let childBlock: any;

    switch (type) {
      case 'heading':
        childBlock = {
          id: newChildId,
          type: 'heading',
          order: currentChildren.length + 1,
          enabled: true,
          content: { level: 3, text: 'Child Heading' },
          text: 'Child Heading',
          level: 3,
        };
        break;
      case 'paragraph':
        childBlock = {
          id: newChildId,
          type: 'paragraph',
          order: currentChildren.length + 1,
          enabled: true,
          content: { text: 'Child paragraph content goes here.' },
          text: 'Child paragraph content goes here.',
        };
        break;
      case 'cta':
        childBlock = {
          id: newChildId,
          type: 'cta',
          order: currentChildren.length + 1,
          enabled: true,
          content: {
            title: 'Call to Action',
            description: 'Action description',
            buttonText: 'Click Here',
            label: 'Click Here',
            href: '#',
            variant: 'primary',
          },
          buttonText: 'Click Here',
          label: 'Click Here',
          href: '#',
          variant: 'primary',
        };
        break;
      case 'feature':
        childBlock = {
          id: newChildId,
          type: 'feature',
          order: currentChildren.length + 1,
          enabled: true,
          content: { title: 'Feature Item', description: 'Feature description' },
          title: 'Feature Item',
          description: 'Feature description',
        };
        break;
      case 'faq':
        childBlock = {
          id: newChildId,
          type: 'faq',
          order: currentChildren.length + 1,
          enabled: true,
          content: { question: 'Question?', answer: 'Answer here.' },
          question: 'Question?',
          answer: 'Answer here.',
        };
        break;
      case 'image':
        childBlock = {
          id: newChildId,
          type: 'image',
          order: currentChildren.length + 1,
          enabled: true,
          content: { src: '/images/og-image.png', alt: 'Child Image', caption: '' },
          src: '/images/og-image.png',
          alt: 'Child Image',
        };
        break;
      case 'link':
        childBlock = {
          id: newChildId,
          type: 'link',
          order: currentChildren.length + 1,
          enabled: true,
          content: { text: 'Learn More', href: '#', isExternal: false },
          text: 'Learn More',
          href: '#',
        };
        break;
      case 'rich_text':
        childBlock = {
          id: newChildId,
          type: 'rich_text',
          order: currentChildren.length + 1,
          enabled: true,
          content: { html: '<p>Rich text child content.</p>' },
          html: '<p>Rich text child content.</p>',
        };
        break;
      case 'custom_html':
        childBlock = {
          id: newChildId,
          type: 'custom_html',
          order: currentChildren.length + 1,
          enabled: true,
          content: { html: '<div>Custom child HTML</div>', css: '' },
          html: '<div>Custom child HTML</div>',
        };
        break;
      case 'container':
        childBlock = {
          id: newChildId,
          type: 'container',
          order: currentChildren.length + 1,
          enabled: true,
          settings: { ...DEFAULT_CONTAINER_SETTINGS },
          content: { settings: { ...DEFAULT_CONTAINER_SETTINGS }, blocks: [] },
          blocks: [],
          children: [],
        };
        break;
      default:
        childBlock = {
          id: newChildId,
          type: 'paragraph',
          order: currentChildren.length + 1,
          enabled: true,
          content: { text: 'New child item' },
        };
    }

    setContent({
      ...content,
      blocks: [...currentChildren, childBlock],
    });
  };

  const handleMoveChildBlock = (index: number, direction: 'up' | 'down') => {
    const currentChildren = Array.isArray(content.blocks) ? [...content.blocks] : [];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentChildren.length) return;
    const temp = currentChildren[index];
    currentChildren[index] = currentChildren[targetIndex];
    currentChildren[targetIndex] = temp;
    setContent({
      ...content,
      blocks: currentChildren.map((b, i) => ({ ...b, order: i + 1 })),
    });
  };

  const handleDuplicateChildBlock = (index: number) => {
    const currentChildren = Array.isArray(content.blocks) ? [...content.blocks] : [];
    if (!currentChildren[index]) return;
    const duplicated = duplicateBlock(currentChildren[index]);
    currentChildren.splice(index + 1, 0, duplicated);
    setContent({
      ...content,
      blocks: currentChildren.map((b, i) => ({ ...b, order: i + 1 })),
    });
  };

  const handleDeleteChildBlock = (index: number) => {
    const currentChildren = Array.isArray(content.blocks) ? [...content.blocks] : [];
    currentChildren.splice(index, 1);
    setContent({
      ...content,
      blocks: currentChildren.map((b, i) => ({ ...b, order: i + 1 })),
    });
  };

  const handleEditChildBlock = (childId: string) => {
    if (!onSelectBlock) return;
    if (block.type === 'container') {
      const sanitizedSettings = sanitizeContainerSettings(containerSettings);
      const childBlocks = Array.isArray(content.blocks) ? content.blocks : [];
      onSaveBlock({
        ...block,
        settings: sanitizedSettings,
        content: {
          ...content,
          settings: sanitizedSettings,
          blocks: childBlocks,
        },
        blocks: childBlocks,
        children: childBlocks,
      });
    }
    onSelectBlock(childId);
  };

  const handleBackToParent = () => {
    if (!parentBlock || !onSelectBlock) return;

    if (content.href && !isSafeUrl(content.href)) {
      setValidationError('Destination URL contains an unsafe protocol (javascript:, vbscript:, etc.).');
      return;
    }
    if (content.buttonHref && !isSafeUrl(content.buttonHref)) {
      setValidationError('Button URL contains an unsafe protocol.');
      return;
    }
    if (content.secondaryHref && !isSafeUrl(content.secondaryHref)) {
      setValidationError('Secondary button URL contains an unsafe protocol.');
      return;
    }
    if (content.src && !isSafeUrl(content.src)) {
      setValidationError('Image source URL contains an unsafe protocol.');
      return;
    }
    if (block.type === 'custom_html') {
      const htmlStr = content.html || '';
      if (typeof htmlStr === 'string' && htmlStr.length > 200000) {
        setValidationError('Custom HTML content exceeds the 200KB limit.');
        return;
      }
      const cssStr = content.css || '';
      if (typeof cssStr === 'string' && cssStr.length > 50000) {
        setValidationError('Custom CSS content exceeds the 50KB limit.');
        return;
      }
    }

    setValidationError(null);

    if (block.type === 'container') {
      const sanitizedSettings = sanitizeContainerSettings(containerSettings);
      const childBlocks = Array.isArray(content.blocks) ? content.blocks : [];
      onSaveBlock({
        ...block,
        settings: sanitizedSettings,
        content: {
          ...content,
          settings: sanitizedSettings,
          blocks: childBlocks,
        },
        blocks: childBlocks,
        children: childBlocks,
      });
    } else {
      onSaveBlock({
        ...block,
        content,
        // sync root properties for backward-compatibility
        ...content,
      });
    }

    onSelectBlock(parentBlock.id);
  };

  const getBlockIcon = () => {
    switch (block.type) {
      case 'container':
        return <Layers className="w-5 h-5 text-[#7C3AED]" />;
      case 'custom_html':
        return <Code className="w-5 h-5 text-[#7C3AED]" />;
      case 'hero':
        return <Sparkles className="w-5 h-5 text-[#7C3AED]" />;
      case 'intro':
        return <FileText className="w-5 h-5 text-[#7C3AED]" />;
      case 'how_to_use':
      case 'how_to':
        return <ListOrdered className="w-5 h-5 text-[#7C3AED]" />;
      case 'features':
      case 'feature':
        return <Grid className="w-5 h-5 text-[#7C3AED]" />;
      case 'supported_formats':
        return <FileCheck className="w-5 h-5 text-[#7C3AED]" />;
      case 'technical_details':
        return <Cpu className="w-5 h-5 text-[#7C3AED]" />;
      case 'privacy_note':
      case 'benefits_trust':
        return <Shield className="w-5 h-5 text-[#7C3AED]" />;
      case 'use_cases':
        return <Briefcase className="w-5 h-5 text-[#7C3AED]" />;
      case 'faq':
        return <HelpCircle className="w-5 h-5 text-[#7C3AED]" />;
      case 'related_tools':
        return <Share2 className="w-5 h-5 text-[#7C3AED]" />;
      case 'cta':
        return <MousePointerClick className="w-5 h-5 text-[#7C3AED]" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-[#7C3AED]" />;
      case 'link':
        return <LinkIcon className="w-5 h-5 text-[#7C3AED]" />;
      case 'pricing':
        return <DollarSign className="w-5 h-5 text-[#7C3AED]" />;
      case 'hubs':
      case 'popular_tools':
      case 'spacer':
        return <Layers className="w-5 h-5 text-[#7C3AED]" />;
      default:
        return <FileText className="w-5 h-5 text-[#7C3AED]" />;
    }
  };

  const getBlockTitle = () => {
    switch (block.type) {
      case 'container':
        return 'Edit Container Block';
      case 'custom_html':
        return 'Edit Custom HTML Block';
      case 'hero':
        return 'Edit Hero & Heading';
      case 'popular_tools':
        return 'Edit Popular Tools Section';
      case 'hubs':
        return 'Edit Discovery Hubs Section';
      case 'pricing':
        return 'Edit Pricing Section';
      case 'intro':
        return 'Edit Introduction';
      case 'how_to_use':
      case 'how_to':
        return 'Edit How-To Instructions';
      case 'features':
        return 'Edit Features Grid & Highlights';
      case 'feature':
        return 'Edit Feature Card';
      case 'supported_formats':
        return 'Edit Supported Formats';
      case 'technical_details':
        return 'Edit Technical Details & Specs';
      case 'benefits_trust':
        return 'Edit Trust & Benefits Badges';
      case 'spacer':
        return 'Edit Vertical Spacer';
      case 'privacy_note':
        return 'Edit Privacy & Guarantee';
      case 'use_cases':
        return 'Edit Common Use Cases';
      case 'faq':
        return 'Edit Frequently Asked Questions';
      case 'related_tools':
        return 'Edit Related Tools';
      case 'cta':
        return 'Edit Call to Action';
      case 'image':
        return 'Edit Image & Media';
      case 'link':
        return 'Edit Text Link';
      case 'rich_text':
        return 'Edit Rich Text HTML';
      case 'heading':
        return 'Edit Heading';
      case 'paragraph':
        return 'Edit Paragraph';
      case 'section':
        return 'Edit Section Container';
      default:
        return `Edit Block (${block.type})`;
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-hidden pointer-events-none"
        aria-labelledby="slide-over-title"
        role="dialog"
        aria-modal="true"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-auto fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="w-screen max-w-lg bg-white border-l border-[#E4E2F0] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#E4E2F0] bg-[#FAF9FF] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-[#E4E2F0] flex items-center justify-center shadow-sm">
                    {getBlockIcon()}
                  </div>
                  <div>
                    <h3 id="slide-over-title" className="text-base font-bold text-[#0F112E]">
                      {getBlockTitle()}
                    </h3>
                    <p className="text-xs text-[#5E6488]">Type: {block.type} • ID: {block.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {onCopyBlock && (
                    <button
                      type="button"
                      onClick={() => onCopyBlock({ ...block, content, ...content })}
                      className="p-2 rounded-xl text-[#5E6488] hover:text-[#7C3AED] hover:bg-[#F4F0FD] transition-colors"
                      title="Copy Block to Clipboard"
                      aria-label="Copy Block"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl text-[#5E6488] hover:text-[#0F112E] hover:bg-slate-100 transition-colors"
                    aria-label="Close editor"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {parentBlock && onSelectBlock && (
                <div className="px-5 py-2.5 bg-indigo-50/80 border-b border-indigo-100/90 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-600 min-w-0 pr-2">
                    <span className="font-bold text-indigo-700 shrink-0">Parent Container:</span>
                    <span className="font-semibold text-slate-800 truncate">
                      {parentBlock.content?.title || parentBlock.title || getBlockLabel(parentBlock.type)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToParent}
                    className="inline-flex items-center gap-1.5 font-bold text-[#7C3AED] hover:text-[#6D28D9] bg-white hover:bg-white/80 px-2.5 py-1 rounded-lg border border-[#E4E2F0] shadow-2xs transition-colors shrink-0"
                    title="Save changes and return to parent container"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Container</span>
                  </button>
                </div>
              )}

              {validationError && (
                <div className="p-3 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-700">
                  {validationError}
                </div>
              )}

              {/* Drawer Body Forms */}
              <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* 1. HERO BLOCK */}
                {block.type === 'hero' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Badge Text (Optional)
                      </label>
                      <input
                        type="text"
                        value={content.badge || ''}
                        onChange={(e) => setContent({ ...content, badge: e.target.value })}
                        placeholder="e.g. 100% Free & Client-Side Private"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Headline / Title
                      </label>
                      <input
                        type="text"
                        value={content.title || ''}
                        onChange={(e) => setContent({ ...content, title: e.target.value })}
                        placeholder="Main Page Headline"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Subtitle / Value Proposition
                      </label>
                      <textarea
                        rows={3}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        placeholder="Description of the service or page..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Supporting Trust Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={content.supportingText || ''}
                        onChange={(e) => setContent({ ...content, supportingText: e.target.value })}
                        placeholder="e.g. Processed 100% locally in your browser"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Search Heading Prompt
                      </label>
                      <input
                        type="text"
                        value={content.searchPrompt || ''}
                        onChange={(e) => setContent({ ...content, searchPrompt: e.target.value })}
                        placeholder="What do you want to do?"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Quick Search Links ({content.quickLinks?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const links = content.quickLinks || [];
                            setContent({
                              ...content,
                              quickLinks: [
                                ...links,
                                { label: 'new converter', slug: 'compress-pdf' },
                              ],
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Link
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(content.quickLinks || []).map((link: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl">
                            <input
                              type="text"
                              value={link.label || ''}
                              onChange={(e) => {
                                const updated = [...(content.quickLinks || [])];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setContent({ ...content, quickLinks: updated });
                              }}
                              placeholder="Label"
                              className="w-1/2 px-2 py-1 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                            <input
                              type="text"
                              value={link.slug || ''}
                              onChange={(e) => {
                                const updated = [...(content.quickLinks || [])];
                                updated[idx] = { ...updated[idx], slug: e.target.value };
                                setContent({ ...content, quickLinks: updated });
                              }}
                              placeholder="Tool slug (e.g. merge-pdf)"
                              className="w-1/2 px-2 py-1 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (content.quickLinks || []).filter((_: any, i: number) => i !== idx);
                                setContent({ ...content, quickLinks: updated });
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                              title="Delete Link"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. POPULAR TOOLS */}
                {block.type === 'popular_tools' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Subheading
                      </label>
                      <input
                        type="text"
                        value={content.subheading || ''}
                        onChange={(e) => setContent({ ...content, subheading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Explore Link Text
                      </label>
                      <input
                        type="text"
                        value={content.exploreText || ''}
                        onChange={(e) => setContent({ ...content, exploreText: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Explore Link URL
                      </label>
                      <input
                        type="text"
                        value={content.exploreHref || ''}
                        onChange={(e) => setContent({ ...content, exploreHref: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                  </div>
                )}

                {/* 3. DISCOVERY HUBS */}
                {block.type === 'hubs' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Subheading
                      </label>
                      <input
                        type="text"
                        value={content.subheading || ''}
                        onChange={(e) => setContent({ ...content, subheading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                      />
                    </div>
                    <div className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-[#7C3AED] uppercase">Image Tools Hub Card</h4>
                      <input
                        type="text"
                        placeholder="Image Hub Title"
                        value={content.imageHubTitle || ''}
                        onChange={(e) => setContent({ ...content, imageHubTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                      />
                      <textarea
                        rows={2}
                        placeholder="Image Hub Description"
                        value={content.imageHubDescription || ''}
                        onChange={(e) => setContent({ ...content, imageHubDescription: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Button Label"
                          value={content.imageHubButton || ''}
                          onChange={(e) => setContent({ ...content, imageHubButton: e.target.value })}
                          className="px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Button Link"
                          value={content.imageHubHref || ''}
                          onChange={(e) => setContent({ ...content, imageHubHref: e.target.value })}
                          className="px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                        />
                      </div>
                    </div>
                    <div className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-[#3B82F6] uppercase">PDF Tools Hub Card</h4>
                      <input
                        type="text"
                        placeholder="PDF Hub Title"
                        value={content.pdfHubTitle || ''}
                        onChange={(e) => setContent({ ...content, pdfHubTitle: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                      />
                      <textarea
                        rows={2}
                        placeholder="PDF Hub Description"
                        value={content.pdfHubDescription || ''}
                        onChange={(e) => setContent({ ...content, pdfHubDescription: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Button Label"
                          value={content.pdfHubButton || ''}
                          onChange={(e) => setContent({ ...content, pdfHubButton: e.target.value })}
                          className="px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Button Link"
                          value={content.pdfHubHref || ''}
                          onChange={(e) => setContent({ ...content, pdfHubHref: e.target.value })}
                          className="px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. FEATURES GRID & SINGLE FEATURE */}
                {(block.type === 'features' || block.type === 'feature') && (
                  <div className="space-y-4">
                    {block.type === 'features' && (
                      <>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Section Heading
                          </label>
                          <input
                            type="text"
                            value={content.heading || ''}
                            onChange={(e) => setContent({ ...content, heading: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Subheading
                          </label>
                          <input
                            type="text"
                            value={content.subheading || content.description || ''}
                            onChange={(e) => setContent({ ...content, subheading: e.target.value, description: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                          />
                        </div>
                      </>
                    )}

                    {block.type === 'feature' ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Feature Title
                          </label>
                          <input
                            type="text"
                            value={content.title || ''}
                            onChange={(e) => setContent({ ...content, title: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Feature Description
                          </label>
                          <textarea
                            rows={3}
                            value={content.description || ''}
                            onChange={(e) => setContent({ ...content, description: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Icon
                          </label>
                          <select
                            value={content.icon || 'ShieldCheck'}
                            onChange={(e) => setContent({ ...content, icon: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                          >
                            <option value="ShieldCheck">Shield Check (Security)</option>
                            <option value="Lock">Lock (Privacy)</option>
                            <option value="Zap">Zap (Speed)</option>
                            <option value="Smartphone">Smartphone (Mobile)</option>
                            <option value="Sparkles">Sparkles (Quality)</option>
                            <option value="Cpu">CPU (Hardware)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                            Feature Cards ({content.items?.length || 0})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const items = content.items || [];
                              setContent({
                                ...content,
                                items: [
                                  ...items,
                                  {
                                    id: `feat-${Date.now()}`,
                                    title: `Feature ${items.length + 1}`,
                                    description: 'Describe feature benefit here.',
                                    icon: 'ShieldCheck',
                                  },
                                ],
                              });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Card
                          </button>
                        </div>
                        <div className="space-y-3">
                          {(content.items || []).map((item: any, idx: number) => (
                            <div key={idx} className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#7C3AED]">Card {idx + 1}</span>
                                <div className="flex items-center gap-1">
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const items = [...content.items];
                                        const temp = items[idx - 1];
                                        items[idx - 1] = items[idx];
                                        items[idx] = temp;
                                        setContent({ ...content, items });
                                      }}
                                      className="p-1 text-slate-500 hover:text-slate-800"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                  )}
                                  {idx < (content.items || []).length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const items = [...content.items];
                                        const temp = items[idx + 1];
                                        items[idx + 1] = items[idx];
                                        items[idx] = temp;
                                        setContent({ ...content, items });
                                      }}
                                      className="p-1 text-slate-500 hover:text-slate-800"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const items = content.items.filter((_: any, i: number) => i !== idx);
                                      setContent({ ...content, items });
                                    }}
                                    className="p-1 text-red-500 hover:text-red-700"
                                    title="Delete Card"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="Title"
                                value={item.title || ''}
                                onChange={(e) => {
                                  const items = [...content.items];
                                  items[idx] = { ...items[idx], title: e.target.value };
                                  setContent({ ...content, items });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                              />
                              <textarea
                                rows={2}
                                placeholder="Description"
                                value={item.description || ''}
                                onChange={(e) => {
                                  const items = [...content.items];
                                  items[idx] = { ...items[idx], description: e.target.value };
                                  setContent({ ...content, items });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                              />
                              <select
                                value={item.icon || 'ShieldCheck'}
                                onChange={(e) => {
                                  const items = [...content.items];
                                  items[idx] = { ...items[idx], icon: e.target.value };
                                  setContent({ ...content, items });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                              >
                                <option value="ShieldCheck">Shield Check</option>
                                <option value="Lock">Lock</option>
                                <option value="Zap">Zap</option>
                                <option value="Smartphone">Smartphone</option>
                                <option value="Sparkles">Sparkles</option>
                                <option value="Cpu">CPU</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. PRICING BLOCK */}
                {block.type === 'pricing' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Badge Text
                      </label>
                      <input
                        type="text"
                        value={content.badge || ''}
                        onChange={(e) => setContent({ ...content, badge: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Title
                      </label>
                      <input
                        type="text"
                        value={content.title || ''}
                        onChange={(e) => setContent({ ...content, title: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Price Display
                        </label>
                        <input
                          type="text"
                          value={content.price || '$0'}
                          onChange={(e) => setContent({ ...content, price: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Price Period
                        </label>
                        <input
                          type="text"
                          value={content.period || '/ forever'}
                          onChange={(e) => setContent({ ...content, period: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Included Benefits ({content.items?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const items = content.items || [];
                            setContent({
                              ...content,
                              items: [...items, 'New plan benefit'],
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Benefit
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(content.items || []).map((bullet: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => {
                                const items = [...(content.items || [])];
                                items[idx] = e.target.value;
                                setContent({ ...content, items });
                              }}
                              className="flex-1 px-3 py-1.5 bg-[#FAF9FF] border border-[#E4E2F0] rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const items = content.items.filter((_: any, i: number) => i !== idx);
                                setContent({ ...content, items });
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Button Text
                        </label>
                        <input
                          type="text"
                          value={content.buttonText || ''}
                          onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Button Link URL
                        </label>
                        <input
                          type="text"
                          value={content.buttonHref || ''}
                          onChange={(e) => setContent({ ...content, buttonHref: e.target.value })}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. FAQ BLOCK */}
                {block.type === 'faq' && (
                  <div className="space-y-4">
                    {/* Check if it's a multi-item FAQ or single item */}
                    {content.items !== undefined ? (
                      <div>
                        <div className="mb-4">
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            FAQ Section Heading
                          </label>
                          <input
                            type="text"
                            value={content.heading || ''}
                            onChange={(e) => setContent({ ...content, heading: e.target.value })}
                            placeholder="e.g. Frequently Asked Questions"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                          />
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                            FAQ Question & Answer Pairs ({content.items?.length || 0})
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const items = content.items || [];
                              setContent({
                                ...content,
                                items: [
                                  ...items,
                                  {
                                    question: 'Frequently Asked Question?',
                                    answer: 'Detailed helpful answer explaining the topic clearly.',
                                  },
                                ],
                              });
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add FAQ
                          </button>
                        </div>
                        <div className="space-y-3">
                          {(content.items || []).map((faq: any, idx: number) => (
                            <div key={idx} className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#7C3AED]">Q&A #{idx + 1}</span>
                                <div className="flex items-center gap-1">
                                  {idx > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const items = [...content.items];
                                        const temp = items[idx - 1];
                                        items[idx - 1] = items[idx];
                                        items[idx] = temp;
                                        setContent({ ...content, items });
                                      }}
                                      className="p-1 text-slate-500 hover:text-slate-800"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                  )}
                                  {idx < (content.items || []).length - 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const items = [...content.items];
                                        const temp = items[idx + 1];
                                        items[idx + 1] = items[idx];
                                        items[idx] = temp;
                                        setContent({ ...content, items });
                                      }}
                                      className="p-1 text-slate-500 hover:text-slate-800"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const items = content.items.filter((_: any, i: number) => i !== idx);
                                      setContent({ ...content, items });
                                    }}
                                    className="p-1 text-red-500 hover:text-red-700"
                                    title="Delete FAQ"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="Question"
                                value={faq.question || ''}
                                onChange={(e) => {
                                  const items = [...content.items];
                                  items[idx] = { ...items[idx], question: e.target.value };
                                  setContent({ ...content, items });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs font-bold"
                              />
                              <textarea
                                rows={3}
                                placeholder="Answer"
                                value={faq.answer || ''}
                                onChange={(e) => {
                                  const items = [...content.items];
                                  items[idx] = { ...items[idx], answer: e.target.value };
                                  setContent({ ...content, items });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Question
                          </label>
                          <input
                            type="text"
                            value={content.question || ''}
                            onChange={(e) => setContent({ ...content, question: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Answer
                          </label>
                          <textarea
                            rows={4}
                            value={content.answer || ''}
                            onChange={(e) => setContent({ ...content, answer: e.target.value })}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. IMAGE BLOCK */}
                {block.type === 'image' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Image Source URL
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsMediaPickerOpen(true)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F4F0FD] text-[#7C3AED] hover:bg-[#EDE9FE] rounded-lg text-xs font-bold transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> Select from Media Library
                        </button>
                      </div>
                      <input
                        type="text"
                        value={content.src || ''}
                        onChange={(e) => setContent({ ...content, src: e.target.value })}
                        placeholder="https://... or /images/..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    {content.src && (
                      <div className="p-3 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl flex items-center justify-center max-h-48 overflow-hidden">
                        <img
                          src={content.src}
                          alt={content.alt || 'Preview'}
                          className="max-h-40 object-contain rounded"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Alt Text (Accessibility & SEO)
                      </label>
                      <input
                        type="text"
                        value={content.alt || ''}
                        onChange={(e) => setContent({ ...content, alt: e.target.value })}
                        placeholder="Descriptive image summary"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Caption (Optional)
                      </label>
                      <input
                        type="text"
                        value={content.caption || ''}
                        onChange={(e) => setContent({ ...content, caption: e.target.value })}
                        placeholder="Image caption text"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                  </div>
                )}

                {/* 8. CTA CALL TO ACTION */}
                {block.type === 'cta' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Card Title / Headline (Optional)
                      </label>
                      <input
                        type="text"
                        value={content.title || ''}
                        onChange={(e) => setContent({ ...content, title: e.target.value })}
                        placeholder="e.g. Need more file processing?"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Card Description / Subtitle (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        placeholder="e.g. Convert24 offers dozens of free, fast, private online conversion and PDF tools."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div className="p-3.5 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-[#7C3AED] uppercase">Primary Action Button</h4>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Button Label
                        </label>
                        <input
                          type="text"
                          value={content.label || content.buttonText || ''}
                          onChange={(e) =>
                            setContent({ ...content, label: e.target.value, buttonText: e.target.value })
                          }
                          placeholder="e.g. Explore All Tools"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Button Link URL
                        </label>
                        <input
                          type="text"
                          value={content.href || ''}
                          onChange={(e) => setContent({ ...content, href: e.target.value })}
                          placeholder="/tools or #section"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Button Style Variant
                        </label>
                        <select
                          value={content.variant || 'primary'}
                          onChange={(e) => setContent({ ...content, variant: e.target.value })}
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#E4E2F0] text-sm text-[#0F112E]"
                        >
                          <option value="primary">Primary (Gradient Purple)</option>
                          <option value="secondary">Secondary (Dark)</option>
                          <option value="outline">Outline</option>
                        </select>
                      </div>
                    </div>
                    <div className="p-3.5 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase">Secondary Action Button (Optional)</h4>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Secondary Button Label
                        </label>
                        <input
                          type="text"
                          value={content.secondaryLabel || ''}
                          onChange={(e) => setContent({ ...content, secondaryLabel: e.target.value })}
                          placeholder="e.g. Learn More"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                          Secondary Button URL
                        </label>
                        <input
                          type="text"
                          value={content.secondaryHref || ''}
                          onChange={(e) => setContent({ ...content, secondaryHref: e.target.value })}
                          placeholder="/about or https://example.com"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-[#E4E2F0] text-sm text-[#0F112E]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 9. TEXT LINK */}
                {block.type === 'link' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Link Text
                      </label>
                      <input
                        type="text"
                        value={content.text || ''}
                        onChange={(e) => setContent({ ...content, text: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Destination URL
                      </label>
                      <input
                        type="text"
                        value={content.href || ''}
                        onChange={(e) => setContent({ ...content, href: e.target.value })}
                        placeholder="/tools/merge-pdf"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#0F112E]">
                      <input
                        type="checkbox"
                        checked={Boolean(content.isExternal)}
                        onChange={(e) => setContent({ ...content, isExternal: e.target.checked })}
                        className="rounded border-[#E4E2F0] text-[#7C3AED]"
                      />
                      <span>Open in new tab (External link)</span>
                    </label>
                  </div>
                )}

                {/* 10. HEADING */}
                {block.type === 'heading' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Heading Level
                      </label>
                      <select
                        value={content.level || 2}
                        onChange={(e) => setContent({ ...content, level: Number(e.target.value) })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      >
                        <option value={1}>H1 (Main Heading)</option>
                        <option value={2}>H2 (Section Header)</option>
                        <option value={3}>H3 (Sub-Header)</option>
                        <option value={4}>H4 (Minor Header)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Heading Text
                      </label>
                      <input
                        type="text"
                        value={content.text || ''}
                        onChange={(e) => setContent({ ...content, text: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                  </div>
                )}

                {/* 11. PARAGRAPH */}
                {block.type === 'paragraph' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                      Paragraph Content
                    </label>
                    <textarea
                      rows={6}
                      value={content.text || ''}
                      onChange={(e) => setContent({ ...content, text: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                    />
                  </div>
                )}

                {/* 12. RICH TEXT */}
                {block.type === 'rich_text' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        HTML Content
                      </label>
                      <textarea
                        rows={8}
                        value={content.html || ''}
                        onChange={(e) => setContent({ ...content, html: e.target.value })}
                        className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-[#0F112E]"
                        placeholder="<p>Formatted HTML content...</p>"
                      />
                    </div>
                  </div>
                )}

                {/* 13. SECTION */}
                {block.type === 'section' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Title
                      </label>
                      <input
                        type="text"
                        value={content.title || ''}
                        onChange={(e) => setContent({ ...content, title: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Description
                      </label>
                      <textarea
                        rows={3}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                  </div>
                )}

                {/* 14. INTRO */}
                {block.type === 'intro' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading / Title
                      </label>
                      <input
                        type="text"
                        value={content.heading || content.title || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value, title: e.target.value })}
                        placeholder="Page Introduction"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Introduction Text (Plain Text)
                      </label>
                      <textarea
                        rows={4}
                        value={content.text || content.description || ''}
                        onChange={(e) => setContent({ ...content, text: e.target.value, description: e.target.value })}
                        placeholder="Descriptive overview of the tool or topic..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Custom HTML (Optional - overrides plain text)
                      </label>
                      <textarea
                        rows={4}
                        value={content.html || ''}
                        onChange={(e) => setContent({ ...content, html: e.target.value })}
                        placeholder="<p>Formatted HTML content...</p>"
                        className="w-full font-mono text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-[#0F112E]"
                      />
                    </div>
                  </div>
                )}

                {/* 15. HOW TO USE */}
                {(block.type === 'how_to_use' || block.type === 'how_to') && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Description
                      </label>
                      <input
                        type="text"
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Instruction Steps ({content.items?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const items = content.items || [];
                            setContent({
                              ...content,
                              items: [
                                ...items,
                                { id: `step-${Date.now()}`, title: `Step ${items.length + 1}`, description: '' },
                              ],
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Step
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(content.items || []).map((step: any, idx: number) => (
                          <div key={idx} className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#7C3AED]">Step {idx + 1}</span>
                              <div className="flex items-center gap-1">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const items = [...content.items];
                                      const temp = items[idx - 1];
                                      items[idx - 1] = items[idx];
                                      items[idx] = temp;
                                      setContent({ ...content, items });
                                    }}
                                    className="p-1 text-slate-500 hover:text-slate-800"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                )}
                                {idx < (content.items || []).length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const items = [...content.items];
                                      const temp = items[idx + 1];
                                      items[idx + 1] = items[idx];
                                      items[idx] = temp;
                                      setContent({ ...content, items });
                                    }}
                                    className="p-1 text-slate-500 hover:text-slate-800"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const items = content.items.filter((_: any, i: number) => i !== idx);
                                    setContent({ ...content, items });
                                  }}
                                  className="p-1 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={step.title || ''}
                              onChange={(e) => {
                                const items = [...content.items];
                                items[idx] = { ...items[idx], title: e.target.value };
                                setContent({ ...content, items });
                              }}
                              placeholder="Step title"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                            <textarea
                              rows={2}
                              value={step.description || ''}
                              onChange={(e) => {
                                const items = [...content.items];
                                items[idx] = { ...items[idx], description: e.target.value };
                                setContent({ ...content, items });
                              }}
                              placeholder="Step instructions"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 16. PRIVACY NOTE */}
                {block.type === 'privacy_note' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Title
                      </label>
                      <input
                        type="text"
                        value={content.title || ''}
                        onChange={(e) => setContent({ ...content, title: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Trust Points ({content.bullets?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const bullets = content.bullets || [];
                            setContent({ ...content, bullets: [...bullets, 'New guarantee point'] });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Point
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(content.bullets || []).map((bullet: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={bullet}
                              onChange={(e) => {
                                const bullets = [...(content.bullets || [])];
                                bullets[idx] = e.target.value;
                                setContent({ ...content, bullets });
                              }}
                              className="flex-1 px-3 py-1.5 bg-[#FAF9FF] border border-[#E4E2F0] rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const bullets = content.bullets.filter((_: any, i: number) => i !== idx);
                                setContent({ ...content, bullets });
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 17. USE CASES */}
                {block.type === 'use_cases' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Description
                      </label>
                      <input
                        type="text"
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Use Cases ({content.items?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const items = content.items || [];
                            setContent({
                              ...content,
                              items: [
                                ...items,
                                { title: 'New Scenario', description: 'Describe workflow scenario here.' },
                              ],
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Case
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(content.items || []).map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#7C3AED]">Case {idx + 1}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const items = content.items.filter((_: any, i: number) => i !== idx);
                                  setContent({ ...content, items });
                                }}
                                className="p-1 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.title || ''}
                              onChange={(e) => {
                                const items = [...content.items];
                                items[idx] = { ...items[idx], title: e.target.value };
                                setContent({ ...content, items });
                              }}
                              placeholder="Title"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                            <textarea
                              rows={2}
                              value={item.description || ''}
                              onChange={(e) => {
                                const items = [...content.items];
                                items[idx] = { ...items[idx], description: e.target.value };
                                setContent({ ...content, items });
                              }}
                              placeholder="Description"
                              className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 18. RELATED TOOLS */}
                {block.type === 'related_tools' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-2">
                        Select Related Tools (Choose up to 4)
                      </label>
                      <div className="space-y-1.5 max-h-56 overflow-y-auto p-2 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl">
                        {allCanonicalTools.map((t) => {
                          const currentSlugs = content.slugs || [];
                          const isChecked = currentSlugs.includes(t.slug);
                          return (
                            <label
                              key={t.slug}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                isChecked ? 'bg-[#F4F0FD] text-[#7C3AED] font-bold' : 'hover:bg-slate-50 text-[#0F112E]'
                              }`}
                            >
                              <span>{t.name}</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    if (currentSlugs.length < 4) {
                                      setContent({ ...content, slugs: [...currentSlugs, t.slug] });
                                    }
                                  } else {
                                    setContent({
                                      ...content,
                                      slugs: currentSlugs.filter((s: string) => s !== t.slug),
                                    });
                                  }
                                }}
                                className="rounded border-[#E4E2F0] text-[#7C3AED] focus:ring-[#7C3AED]"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 19. SUPPORTED FORMATS */}
                {block.type === 'supported_formats' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        placeholder="Supported File Formats"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        placeholder="Convert between multiple formats safely..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    {/* Input Formats */}
                    <div className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
                          Input Formats ({content.inputFormats?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const list = content.inputFormats || [];
                            setContent({ ...content, inputFormats: [...list, 'ext'] });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Format
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(content.inputFormats || []).map((fmt: string, idx: number) => (
                          <div key={idx} className="flex items-center bg-white border border-[#E4E2F0] rounded-lg px-2 py-1 gap-1.5">
                            <input
                              type="text"
                              value={fmt}
                              onChange={(e) => {
                                const updated = [...(content.inputFormats || [])];
                                updated[idx] = e.target.value.replace(/^\./, '').trim();
                                setContent({ ...content, inputFormats: updated });
                              }}
                              className="w-16 text-xs font-bold uppercase text-[#0F112E] bg-transparent outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = content.inputFormats.filter((_: any, i: number) => i !== idx);
                                setContent({ ...content, inputFormats: updated });
                              }}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Output Formats */}
                    <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                          Output Formats ({content.outputFormats?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const list = content.outputFormats || [];
                            setContent({ ...content, outputFormats: [...list, 'ext'] });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Format
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(content.outputFormats || []).map((fmt: string, idx: number) => (
                          <div key={idx} className="flex items-center bg-white border border-emerald-200 rounded-lg px-2 py-1 gap-1.5">
                            <input
                              type="text"
                              value={fmt}
                              onChange={(e) => {
                                const updated = [...(content.outputFormats || [])];
                                updated[idx] = e.target.value.replace(/^\./, '').trim();
                                setContent({ ...content, outputFormats: updated });
                              }}
                              className="w-16 text-xs font-bold uppercase text-emerald-900 bg-transparent outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = content.outputFormats.filter((_: any, i: number) => i !== idx);
                                setContent({ ...content, outputFormats: updated });
                              }}
                              className="text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Additional Format Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={content.notes || ''}
                        onChange={(e) => setContent({ ...content, notes: e.target.value })}
                        placeholder="e.g. Max upload size 100MB per file"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                  </div>
                )}

                {/* 20. TECHNICAL DETAILS */}
                {block.type === 'technical_details' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Section Heading
                      </label>
                      <input
                        type="text"
                        value={content.heading || ''}
                        onChange={(e) => setContent({ ...content, heading: e.target.value })}
                        placeholder="Technical Details & Limitations"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        value={content.description || ''}
                        onChange={(e) => setContent({ ...content, description: e.target.value })}
                        placeholder="Architecture specifications and processing limits..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                    </div>
                    {/* Specs List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Specifications ({content.specs?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const specs = content.specs || [];
                            setContent({
                              ...content,
                              specs: [...specs, { label: 'Spec Name', value: 'Value', notes: '' }],
                            });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Spec
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(content.specs || []).map((spec: any, idx: number) => (
                          <div key={idx} className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#7C3AED]">Spec #{idx + 1}</span>
                              <div className="flex items-center gap-1">
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const specs = [...content.specs];
                                      const temp = specs[idx - 1];
                                      specs[idx - 1] = specs[idx];
                                      specs[idx] = temp;
                                      setContent({ ...content, specs });
                                    }}
                                    className="p-1 text-slate-500 hover:text-slate-800"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                )}
                                {idx < (content.specs || []).length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const specs = [...content.specs];
                                      const temp = specs[idx + 1];
                                      specs[idx + 1] = specs[idx];
                                      specs[idx] = temp;
                                      setContent({ ...content, specs });
                                    }}
                                    className="p-1 text-slate-500 hover:text-slate-800"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const specs = content.specs.filter((_: any, i: number) => i !== idx);
                                    setContent({ ...content, specs });
                                  }}
                                  className="p-1 text-red-500 hover:text-red-700"
                                  title="Delete Spec"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Label (e.g. Engine)"
                                value={spec.label || ''}
                                onChange={(e) => {
                                  const specs = [...content.specs];
                                  specs[idx] = { ...specs[idx], label: e.target.value };
                                  setContent({ ...content, specs });
                                }}
                                className="px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs font-medium"
                              />
                              <input
                                type="text"
                                placeholder="Value (e.g. WebAssembly)"
                                value={spec.value || ''}
                                onChange={(e) => {
                                  const specs = [...content.specs];
                                  specs[idx] = { ...specs[idx], value: e.target.value };
                                  setContent({ ...content, specs });
                                }}
                                className="px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={spec.notes || ''}
                              onChange={(e) => {
                                const specs = [...content.specs];
                                specs[idx] = { ...specs[idx], notes: e.target.value };
                                setContent({ ...content, specs });
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Limitations List */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                          Limitations / Notes ({content.limitations?.length || 0})
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const list = content.limitations || [];
                            setContent({ ...content, limitations: [...list, 'New technical limitation or note'] });
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Limitation
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(content.limitations || []).map((lim: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={lim}
                              onChange={(e) => {
                                const list = [...(content.limitations || [])];
                                list[idx] = e.target.value;
                                setContent({ ...content, limitations: list });
                              }}
                              className="flex-1 px-3 py-1.5 bg-[#FAF9FF] border border-[#E4E2F0] rounded-lg text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const list = content.limitations.filter((_: any, i: number) => i !== idx);
                                setContent({ ...content, limitations: list });
                              }}
                              className="p-1 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 21. BENEFITS & TRUST */}
                {block.type === 'benefits_trust' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                        Trust & Benefit Badges ({content.items?.length || 0})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const items = content.items || [];
                          setContent({
                            ...content,
                            items: [
                              ...items,
                              { id: `b-${Date.now()}`, title: '100% Private', description: 'Processed on-device in browser memory.' },
                            ],
                          });
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Benefit
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(content.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#7C3AED]">Benefit #{idx + 1}</span>
                            <div className="flex items-center gap-1">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const items = [...content.items];
                                    const temp = items[idx - 1];
                                    items[idx - 1] = items[idx];
                                    items[idx] = temp;
                                    setContent({ ...content, items });
                                  }}
                                  className="p-1 text-slate-500 hover:text-slate-800"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                              )}
                              {idx < (content.items || []).length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const items = [...content.items];
                                    const temp = items[idx + 1];
                                    items[idx + 1] = items[idx];
                                    items[idx] = temp;
                                    setContent({ ...content, items });
                                  }}
                                  className="p-1 text-slate-500 hover:text-slate-800"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const items = content.items.filter((_: any, i: number) => i !== idx);
                                  setContent({ ...content, items });
                                }}
                                className="p-1 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Title"
                            value={item.title || item.heading || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[idx] = { ...items[idx], title: e.target.value };
                              setContent({ ...content, items });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs font-bold"
                          />
                          <textarea
                            rows={2}
                            placeholder="Description"
                            value={item.description || item.text || ''}
                            onChange={(e) => {
                              const items = [...content.items];
                              items[idx] = { ...items[idx], description: e.target.value };
                              setContent({ ...content, items });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-[#E4E2F0] rounded text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 22. SPACER */}
                {block.type === 'spacer' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                        Spacer Height (Pixels)
                      </label>
                      <input
                        type="number"
                        min={4}
                        max={240}
                        value={content.height || 24}
                        onChange={(e) => setContent({ ...content, height: Number(e.target.value) || 24 })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] text-sm text-[#0F112E]"
                      />
                      <p className="text-xs text-[#5E6488] mt-1.5">
                        Controls vertical spacing on the page between blocks.
                      </p>
                    </div>
                  </div>
                )}

                {/* 23. CUSTOM HTML */}
                {block.type === 'custom_html' && (
                  <div className="space-y-4">
                    {/* View Switcher Tabs: Source Code vs Scoped CSS vs Live Preview */}
                    <div className="flex items-center justify-between border-b border-[#E4E2F0] pb-2">
                      <div className="flex items-center gap-1.5 p-1 bg-[#F4F3FA] rounded-xl border border-[#E4E2F0]">
                        <button
                          type="button"
                          onClick={() => setHtmlViewMode('source')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            htmlViewMode === 'source'
                              ? 'bg-white text-[#7C3AED] shadow-sm'
                              : 'text-[#5E6488] hover:text-[#0F112E]'
                          }`}
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>Source HTML</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHtmlViewMode('css')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            htmlViewMode === 'css'
                              ? 'bg-white text-[#7C3AED] shadow-sm'
                              : 'text-[#5E6488] hover:text-[#0F112E]'
                          }`}
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span>Scoped CSS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHtmlViewMode('preview')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            htmlViewMode === 'preview'
                              ? 'bg-white text-[#7C3AED] shadow-sm'
                              : 'text-[#5E6488] hover:text-[#0F112E]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Sanitized Preview</span>
                        </button>
                      </div>

                      <div className="text-right text-[11px] text-[#5E6488]">
                        {htmlViewMode === 'css' ? (
                          <>
                            <span className="font-semibold text-[#0F112E]">
                              {(content.css || '').length.toLocaleString()}
                            </span>{' '}
                            / 50,000 chars
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-[#0F112E]">
                              {(content.html || '').length.toLocaleString()}
                            </span>{' '}
                            / 200,000 chars
                          </>
                        )}
                      </div>
                    </div>

                    {/* Source Editor Tab */}
                    {htmlViewMode === 'source' && (
                      <div className="space-y-3">
                        {/* Style extraction banner if HTML contains embedded <style> tags */}
                        {/<style\b/i.test(content.html || '') && (
                          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-800">
                            <span>Embedded &lt;style&gt; tag detected in HTML. Extract into Scoped CSS for security and scoping?</span>
                            <button
                              type="button"
                              onClick={() => {
                                const ext = extractStylesFromHtml(content.html);
                                setContent({
                                  ...content,
                                  html: ext.html,
                                  css: content.css ? `${content.css}\n\n${ext.extractedCss}` : ext.extractedCss,
                                });
                                setHtmlViewMode('css');
                              }}
                              className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-colors shrink-0"
                            >
                              Extract to CSS
                            </button>
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            HTML Markup
                          </label>
                          <textarea
                            rows={14}
                            value={content.html || ''}
                            onChange={(e) => setContent({ ...content, html: e.target.value })}
                            placeholder="<div class=&quot;custom-card&quot;>&#10;  <h3>Custom Title</h3>&#10;  <p>Your HTML content here...</p>&#10;</div>"
                            className="w-full font-mono text-xs leading-relaxed px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent selection:bg-[#7C3AED] selection:text-white"
                            spellCheck={false}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                            Caption or Note (Optional)
                          </label>
                          <input
                            type="text"
                            value={content.caption || ''}
                            onChange={(e) => setContent({ ...content, caption: e.target.value })}
                            placeholder="e.g. Embedded calculator widget or announcement callout"
                            className="w-full px-3.5 py-2 rounded-xl border border-[#E4E2F0] text-xs text-[#0F112E]"
                          />
                          <p className="text-[11px] text-[#5E6488] mt-1">
                            Shown as a subtle note or description beneath the custom HTML block if set.
                          </p>
                        </div>

                        {/* Security & Allowed Tags Guidelines */}
                        <div className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-1.5 text-xs text-[#5E6488]">
                          <p className="font-bold text-[#0F112E] flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
                            Security & Safe HTML Guidelines
                          </p>
                          <p className="leading-relaxed text-[11px]">
                            • Standard layout and semantic elements (<code className="text-[#7C3AED]">div</code>, <code className="text-[#7C3AED]">section</code>, <code className="text-[#7C3AED]">p</code>, <code className="text-[#7C3AED]">h1-h6</code>, <code className="text-[#7C3AED]">table</code>, <code className="text-[#7C3AED]">ul</code>, <code className="text-[#7C3AED]">img</code>, <code className="text-[#7C3AED]">a</code>) and Tailwind CSS classes are fully supported.
                          </p>
                          <p className="leading-relaxed text-[11px]">
                            • Executable script tags (<code className="text-red-500">&lt;script&gt;</code>), embeds (<code className="text-red-500">&lt;iframe&gt;</code>, <code className="text-red-500">&lt;object&gt;</code>), form inputs, event handlers (<code className="text-red-500">onclick</code>, <code className="text-red-500">onload</code>), and <code className="text-red-500">javascript:</code> links are neutralized for XSS protection.
                          </p>
                          <p className="leading-relaxed text-[11px]">
                            • For custom styling rules, use the <strong>Scoped CSS</strong> tab.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Scoped CSS Editor Tab */}
                    {htmlViewMode === 'css' && (
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                              Block CSS (Scoped)
                            </label>
                            <span className="text-[11px] text-[#7C3AED] font-semibold">
                              Scoped to #{`custom-html-${block.id}`}
                            </span>
                          </div>
                          <textarea
                            rows={14}
                            value={content.css || ''}
                            onChange={(e) => setContent({ ...content, css: e.target.value })}
                            placeholder={".custom-card {\n  padding: 1.5rem;\n  background: #f8fafc;\n  border-radius: 1rem;\n}\n.custom-card h3 {\n  color: #1e293b;\n  font-weight: 700;\n}"}
                            className="w-full font-mono text-xs leading-relaxed px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent selection:bg-[#7C3AED] selection:text-white"
                            spellCheck={false}
                          />
                        </div>

                        {/* CSS Security & Scoping Guidelines */}
                        <div className="p-3 bg-[#FAF9FF] border border-[#E4E2F0] rounded-xl space-y-1.5 text-xs text-[#5E6488]">
                          <p className="font-bold text-[#0F112E] flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-[#7C3AED]" />
                            Scoped Styling Rules & Guarantees
                          </p>
                          <p className="leading-relaxed text-[11px]">
                            • Every selector is automatically prefixed with <code className="text-[#7C3AED]">#custom-html-{block.id}</code> to prevent bleeding into site headers, footers, or neighboring blocks.
                          </p>
                          <p className="leading-relaxed text-[11px]">
                            • Global selectors (<code className="text-[#7C3AED]">:root</code>, <code className="text-[#7C3AED]">html</code>, <code className="text-[#7C3AED]">body</code>) are safely redirected to target this block container.
                          </p>
                          <p className="leading-relaxed text-[11px]">
                            • <code className="text-red-500">@import</code> rules, external <code className="text-red-500">url(...)</code> asset requests, expressions, and angle brackets are neutralized.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Live Preview Tab */}
                    {htmlViewMode === 'preview' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
                            Sanitized Live Preview
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setHtmlViewMode('source')}
                              className="text-xs text-[#7C3AED] hover:underline font-semibold"
                            >
                              Edit HTML
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => setHtmlViewMode('css')}
                              className="text-xs text-[#7C3AED] hover:underline font-semibold"
                            >
                              Edit CSS
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-[#E4E2F0] bg-white min-h-[160px] max-h-[380px] overflow-auto shadow-inner">
                          {content.css && (
                            <style
                              dangerouslySetInnerHTML={{
                                __html: scopeAndSanitizeCss(content.css, `custom-html-${block.id}`),
                              }}
                            />
                          )}
                          {content.html && content.html.trim().length > 0 ? (
                            <div
                              id={`custom-html-${block.id}`}
                              className="prose prose-sm max-w-none break-words"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeCustomHtml(content.html),
                              }}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center text-[#5E6488]">
                              <Code className="w-8 h-8 text-slate-300 mb-2" />
                              <p className="text-xs font-semibold">No HTML content entered yet</p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                Switch to the Source HTML tab to write markup.
                              </p>
                            </div>
                          )}
                        </div>

                        {content.caption && (
                          <p className="text-xs text-slate-500 italic text-center">
                            Caption: {content.caption}
                          </p>
                        )}

                        <p className="text-[11px] text-[#5E6488] italic">
                          This preview renders both sanitized HTML and scoped CSS exactly as public visitors will see it.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 24. CONTAINER BLOCK */}
                {block.type === 'container' && (
                  <div className="space-y-4">
                    {/* View Switcher Tabs: Settings vs Nested Blocks vs Live Preview */}
                    <div className="flex items-center justify-between border-b border-[#E4E2F0] pb-2">
                      <div className="flex items-center gap-1.5 p-1 bg-[#F4F3FA] rounded-xl border border-[#E4E2F0]">
                        <button
                          type="button"
                          onClick={() => setContainerActiveTab('settings')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            containerActiveTab === 'settings'
                              ? 'bg-white text-[#7C3AED] shadow-sm'
                              : 'text-[#5E6488] hover:text-[#0F112E]'
                          }`}
                        >
                          <Palette className="w-3.5 h-3.5" />
                          <span>Layout & Style</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setContainerActiveTab('children')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            containerActiveTab === 'children'
                              ? 'bg-white text-[#7C3AED] shadow-sm'
                              : 'text-[#5E6488] hover:text-[#0F112E]'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Child Blocks ({Array.isArray(content.blocks) ? content.blocks.length : 0})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setContainerActiveTab('preview')}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            containerActiveTab === 'preview'
                              ? 'bg-white text-[#7C3AED] shadow-sm'
                              : 'text-[#5E6488] hover:text-[#0F112E]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Container Preview</span>
                        </button>
                      </div>

                      <div className="text-right text-[11px] text-[#5E6488]">
                        <span className="font-semibold text-[#7C3AED]">
                          Max Depth: {MAX_CONTAINER_DEPTH}
                        </span>
                      </div>
                    </div>

                    {/* Tab 1: Layout & Style Settings */}
                    {containerActiveTab === 'settings' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Inner Max Width
                            </label>
                            <select
                              value={containerSettings.innerWidth}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  innerWidth: e.target.value as ContainerInnerWidth,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="narrow">Narrow (Max 48rem / 768px - Compact)</option>
                              <option value="default">Default (Max 64rem / 1024px - Standard)</option>
                              <option value="wide">Wide (Max 80rem / 1280px - Broad)</option>
                              <option value="full">Full Width (100% - Edge to Edge)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Layout Direction
                            </label>
                            <select
                              value={containerSettings.layout}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  layout: e.target.value as ContainerLayout,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="vertical">Vertical Stack (Column - default)</option>
                              <option value="horizontal">Horizontal Row (Flex wrap, stacks on mobile)</option>
                              <option value="grid">Responsive Grid (Multi-column desktop)</option>
                            </select>
                          </div>
                        </div>

                        {containerSettings.layout === 'grid' && (
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Grid Columns (Desktop)
                            </label>
                            <select
                              value={containerSettings.gridCols}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  gridCols: Number(e.target.value) as ContainerGridCols,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value={2}>2 Columns (1 col mobile, 2 cols tablet/desktop)</option>
                              <option value={3}>3 Columns (1 col mobile, 2 cols tablet, 3 cols desktop)</option>
                              <option value={4}>4 Columns (1 col mobile, 2 cols tablet, 4 cols desktop)</option>
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Gap Spacing
                            </label>
                            <select
                              value={containerSettings.gap}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  gap: e.target.value as ContainerGap,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="none">None (0px)</option>
                              <option value="sm">Small (12px / 0.75rem)</option>
                              <option value="md">Medium (24px / 1.5rem - default)</option>
                              <option value="lg">Large (32px / 2rem)</option>
                              <option value="xl">Extra Large (48px / 3rem)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Alignment
                            </label>
                            <select
                              value={containerSettings.align}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  align: e.target.value as ContainerAlign,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="stretch">Stretch (Fill width/height - default)</option>
                              <option value="start">Start (Top / Left)</option>
                              <option value="center">Center</option>
                              <option value="end">End (Bottom / Right)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Padding
                            </label>
                            <select
                              value={containerSettings.padding}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  padding: e.target.value as ContainerPadding,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="none">None (0px)</option>
                              <option value="sm">Small (12-16px)</option>
                              <option value="md">Medium (20-32px - default)</option>
                              <option value="lg">Large (32-48px)</option>
                              <option value="xl">Extra Large (40-64px)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Background Theme
                            </label>
                            <select
                              value={containerSettings.background}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  background: e.target.value as ContainerBackground,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="transparent">Transparent (Default)</option>
                              <option value="white">White with Shadow</option>
                              <option value="muted">Warm Muted (#FAF9FF)</option>
                              <option value="slate">Cool Slate (slate-50)</option>
                              <option value="indigo">Soft Indigo Tint</option>
                              <option value="purple">Soft Purple Tint</option>
                              <option value="gradient">Subtle Diagonal Gradient</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Corner Radius
                            </label>
                            <select
                              value={containerSettings.borderRadius}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  borderRadius: e.target.value as ContainerBorderRadius,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="none">None (0px)</option>
                              <option value="sm">Small (6px)</option>
                              <option value="md">Medium (8px)</option>
                              <option value="lg">Large (12px)</option>
                              <option value="xl">Extra Large (16px / 2xl - default)</option>
                              <option value="2xl">Card Radius (28px)</option>
                              <option value="full">Pill / Max Rounding</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#5E6488] mb-1.5">
                              Border Style
                            </label>
                            <select
                              value={containerSettings.border}
                              onChange={(e) =>
                                setContainerSettings({
                                  ...containerSettings,
                                  border: e.target.value as ContainerBorder,
                                })
                              }
                              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#E4E2F0] bg-white text-[#0F112E] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                            >
                              <option value="none">None (Default)</option>
                              <option value="subtle">Subtle (1px #E4E2F0)</option>
                              <option value="solid">Solid (2px slate-300)</option>
                              <option value="primary">Accent Brand (2px #7C3AED/30)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Child Blocks Management */}
                    {containerActiveTab === 'children' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">
                            Nested Blocks ({Array.isArray(content.blocks) ? content.blocks.length : 0})
                          </span>
                        </div>

                        {/* Child blocks list */}
                        {Array.isArray(content.blocks) && content.blocks.length > 0 ? (
                          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                            {content.blocks.map((child: any, idx: number) => {
                              const childType = String(child.type || 'paragraph');
                              const childTitle =
                                child.content?.title ||
                                child.content?.heading ||
                                child.content?.text ||
                                child.content?.buttonText ||
                                child.content?.question ||
                                child.title ||
                                child.text ||
                                '';
                              return (
                                <div
                                  key={child.id || idx}
                                  className="p-3 bg-white border border-[#E4E2F0] rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-[#7C3AED]/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-5 h-5 rounded-md bg-[#F4F0FD] text-[#7C3AED] text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 mr-1.5">
                                        {childType}
                                      </span>
                                      <span className="text-xs font-semibold text-[#0F112E] truncate">
                                        {childTitle || `Empty ${childType} block`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {onSelectBlock && (
                                      <button
                                        type="button"
                                        onClick={() => handleEditChildBlock(child.id)}
                                        title="Edit Child Block"
                                        className="p-1 text-slate-400 hover:text-[#7C3AED] hover:bg-[#F4F0FD] rounded transition-colors"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      onClick={() => handleMoveChildBlock(idx, 'up')}
                                      title="Move Up"
                                      className="p-1 text-slate-400 hover:text-[#7C3AED] disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === content.blocks.length - 1}
                                      onClick={() => handleMoveChildBlock(idx, 'down')}
                                      title="Move Down"
                                      className="p-1 text-slate-400 hover:text-[#7C3AED] disabled:opacity-30 disabled:pointer-events-none"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateChildBlock(idx)}
                                      title="Duplicate Block"
                                      className="p-1 text-slate-400 hover:text-[#7C3AED]"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteChildBlock(idx)}
                                      title="Delete Block"
                                      className="p-1 text-slate-400 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-8 text-center bg-[#FAF9FF] border border-dashed border-[#E4E2F0] rounded-xl text-[#5E6488]">
                            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-semibold">Container has no child blocks yet</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Use the buttons below to insert child blocks into this container.
                            </p>
                          </div>
                        )}

                        {/* Add Child Block Buttons */}
                        <div className="pt-2 border-t border-[#E4E2F0]">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#5E6488] mb-2">
                            Insert Child Block:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { type: 'heading', label: 'Heading' },
                              { type: 'paragraph', label: 'Paragraph' },
                              { type: 'cta', label: 'CTA Button' },
                              { type: 'feature', label: 'Feature Card' },
                              { type: 'faq', label: 'FAQ Item' },
                              { type: 'image', label: 'Image' },
                              { type: 'link', label: 'Link' },
                              { type: 'rich_text', label: 'Rich Text' },
                              { type: 'custom_html', label: 'Custom HTML' },
                              ...(parentBlock ? [] : [{ type: 'container', label: 'Sub-Container' }]),
                            ].map((item) => (
                              <button
                                key={item.type}
                                type="button"
                                onClick={() => handleAddChildBlock(item.type)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-[#E4E2F0] bg-white hover:bg-[#F4F0FD] hover:border-[#7C3AED]/40 hover:text-[#7C3AED] transition-colors shadow-2xs"
                              >
                                + {item.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-[#5E6488] italic mt-2">
                            Top-level sections (Hero, Popular Tools, Hubs, Pricing) are restricted from nesting inside containers.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tab 3: Container Preview */}
                    {containerActiveTab === 'preview' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
                            Live Visual Preview
                          </span>
                          <span className="text-[11px] text-[#5E6488]">
                            Layout: {containerSettings.layout} | Width: {containerSettings.innerWidth}
                          </span>
                        </div>

                        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 overflow-x-auto min-h-[160px]">
                          <div className={getContainerWrapperClasses(containerSettings)}>
                            <div className={getContainerInnerClasses(containerSettings)}>
                              {Array.isArray(content.blocks) && content.blocks.length > 0 ? (
                                content.blocks.map((child: any, idx: number) => (
                                  <div
                                    key={child.id || idx}
                                    className="p-3 bg-white/90 border border-slate-200 rounded-lg text-xs space-y-1 shadow-2xs"
                                  >
                                    <span className="text-[10px] uppercase font-bold text-[#7C3AED]">
                                      {child.type}
                                    </span>
                                    <p className="font-semibold text-[#0F112E]">
                                      {child.content?.title ||
                                        child.content?.heading ||
                                        child.content?.text ||
                                        child.content?.buttonText ||
                                        child.title ||
                                        `Block #${idx + 1}`}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-400 italic text-center py-4">
                                  No child blocks inside container.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#5E6488] italic">
                          Preview reflects current layout direction, background styling, border radius, padding, and gap spacing.
                        </p>
                      </div>
                    )}
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
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors shadow-sm"
                  >
                    <Check className="w-4 h-4" /> Apply Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        currentUrl={content.src}
        title="Choose Image Asset"
      />
    </>
  );
}
