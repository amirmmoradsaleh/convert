'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ToolDefinition, getToolBySlug } from '@/lib/tools';
import Container from '@/components/layout/Container';
import Breadcrumbs from '@/components/seo/Breadcrumbs';
import AdSlot from '@/components/ads/AdSlot';
import FAQ from '@/components/seo/FAQ';
import RelatedTools from '@/components/seo/RelatedTools';
import UploadZone from './UploadZone';
import FileList from './FileList';
import { FileItemData } from './FileItem';
import JpgToPngController from './JpgToPngController';
import PngToJpgController from './PngToJpgController';
import JpgToWebpController from './JpgToWebpController';
import WebpToJpgController from './WebpToJpgController';
import PngToWebpController from './PngToWebpController';
import WebpToPngController from './WebpToPngController';
import HeicToJpgController from './HeicToJpgController';
import SvgToPngController from './SvgToPngController';
import { GifToPngController } from './GifToPngController';
import { BmpToPngController } from './BmpToPngController';
import { CompressImageController } from './CompressImageController';
import { ResizeImageController } from './ResizeImageController';
import { CropImageController } from './CropImageController';
import { RotateImageController } from './RotateImageController';
import { ImageToPdfController } from './ImageToPdfController';
import { JpgToPdfController } from './JpgToPdfController';
import { PngToPdfController } from './PngToPdfController';
import { PdfToJpgController } from './PdfToJpgController';
import { PdfToPngController } from './PdfToPngController';
import { MergePdfController } from './MergePdfController';
import { SplitPdfController } from './SplitPdfController';
import { CompressPdfController } from './CompressPdfController';
import { RotatePdfController } from './RotatePdfController';
import { DeletePdfPagesController } from './DeletePdfPagesController';
import { ReorderPdfPagesController } from './ReorderPdfPagesController';
import {
  ShieldCheck,
  Zap,
  Lock,
  Cpu,
  Sparkles,
  CheckCircle2,
  FileCheck,
  Layers,
  Palette,
  Globe,
  FileText,
  Repeat,
  ArrowLeft,
  Plus,
  Trash2,
  Type,
  Image as ImageIcon,
  MousePointerClick,
  HelpCircle,
  Grid,
  ClipboardPaste,
  Copy,
  Code,
} from 'lucide-react';
import JsonLd from '@/components/seo/JsonLd';
import {
  createWebApplicationSchema,
  createBreadcrumbSchema,
  createFAQSchema,
  createHowToSchema,
  siteConfig,
} from '@/lib/seo';
import {
  UniversalContentBlock,
  duplicateBlock,
  findBlockById,
  findParentBlock,
  updateBlockInTree,
  deleteBlockFromTree,
} from '@/lib/cms/blocks';
import { sanitizeCustomHtml, scopeAndSanitizeCss, sanitizeRichTextHtml } from '@/lib/admin/validation';
import {
  DEFAULT_CONTAINER_SETTINGS,
  getContainerWrapperClasses,
  getContainerInnerClasses,
} from '@/lib/cms/container-contract';
import {
  copyBlockToClipboard,
  pasteBlockFromClipboard,
  getClipboardState,
  CLIPBOARD_EVENT_NAME,
} from '@/lib/cms/block-clipboard';
import { generateCanonicalToolContract } from '@/lib/cms/tool-contract';
import { InlineBlockWrapper } from '@/components/admin/inline/InlineBlockWrapper';
import { InlineBlockEditorDrawer } from '@/components/admin/inline/InlineBlockEditorDrawer';
import { InlineRevisionDrawer } from '@/components/admin/inline/InlineRevisionDrawer';
import { InlineEditorToolbar } from '@/components/admin/inline/InlineEditorToolbar';
import { InlineSeoDrawer, InlineSeoData } from '@/components/admin/inline/InlineSeoDrawer';
import { InlineSharedSettingsDrawer } from '@/components/admin/inline/InlineSharedSettingsDrawer';

interface ToolPageProps {
  tool: ToolDefinition;
  isPreview?: boolean;
}

function CmsToolBlock({
  block,
  tool,
  isEditing,
  selectedBlockId,
  onSelectBlock,
}: {
  block: any;
  tool: ToolDefinition;
  isEditing?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
}) {
  if (!block || block.enabled === false) return null;

  const type = block.type;
  const content = block.content || {};

  switch (type) {
    case 'hero':
      return (
        <header className="max-w-3xl mb-8 space-y-3">
          {content.badge && (
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F4F0FD] text-[#7C3AED] mb-2">
              {content.badge}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F112E] tracking-tight">
            {content.title || tool.h1}
          </h1>
          <p className="text-base sm:text-lg text-[#5E6488] leading-relaxed">
            {content.description || tool.description}
          </p>
          {content.supportingText && (
            <p className="text-xs sm:text-sm text-[#5E6488] opacity-80 italic mt-1">
              {content.supportingText}
            </p>
          )}
        </header>
      );

    case 'benefits_trust': {
      const items = content.items || [];
      if (items.length === 0) return null;
      return (
        <div className="py-4 px-4 md:px-6 bg-[#F4F3FA] border border-[#E4E2F0] rounded-2xl flex flex-wrap items-center justify-around gap-4 text-xs sm:text-sm font-bold text-[#7C3AED] mb-10 shadow-sm">
          {items.map((item: any, idx: number) => {
            if (item.enabled === false) return null;
            return (
              <span key={item.id || idx} className="inline-flex items-center gap-2">
                {item.icon === 'Zap' && <Zap className="w-4 h-4 text-[#7C3AED]" />}
                {item.icon === 'Check' && <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" />}
                {item.icon === 'Shield' && <ShieldCheck className="w-4 h-4 text-[#7C3AED]" />}
                {item.icon === 'Lock' && <Lock className="w-4 h-4 text-[#7C3AED]" />}
                {item.text}
              </span>
            );
          })}
        </div>
      );
    }

    case 'intro':
      return (
        <section className="py-10 border-t border-[#E4E2F0]">
          <div className="max-w-4xl space-y-4">
            {content.heading && (
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                {content.heading}
              </h2>
            )}
            <div className="text-base text-[#5E6488] leading-relaxed space-y-3">
              {content.html ? (
                <div dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(content.html) }} />
              ) : (
                <p>{content.text}</p>
              )}
            </div>
          </div>
        </section>
      );

    case 'features': {
      const items = content.items || [];
      return (
        <section className="py-10 border-t border-[#E4E2F0]">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
              {content.heading || `Key Features of ${tool.name}`}
            </h2>
            {content.description && (
              <p className="text-sm md:text-base text-[#5E6488] mt-1.5">{content.description}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item: any, idx: number) => {
              if (item.enabled === false) return null;
              return (
                <div key={item.id || idx} className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 hover:border-[#7C3AED]/40 transition-colors shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                    {idx === 0 ? (
                      <Cpu className="w-5 h-5" />
                    ) : idx === 1 ? (
                      <FileCheck className="w-5 h-5" />
                    ) : idx === 2 ? (
                      <Layers className="w-5 h-5" />
                    ) : idx === 3 ? (
                      <Sparkles className="w-5 h-5" />
                    ) : (
                      <Zap className="w-5 h-5" />
                    )}
                  </div>
                  <h3 className="font-bold text-base text-[#0F112E]">{item.title}</h3>
                  <p className="text-sm text-[#5E6488] leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    case 'how_to_use':
    case 'how_to': {
      const items = content.items || [];
      return (
        <section className="py-10 border-t border-[#E4E2F0]">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
              {content.heading || `How to Use ${tool.name}`}
            </h2>
            {content.description && (
              <p className="text-sm md:text-base text-[#5E6488] mt-1.5">{content.description}</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {items.map((item: any, idx: number) => {
              if (item.enabled === false) return null;
              return (
                <div key={item.id || idx} className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-4 relative shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#6366F1] text-white flex items-center justify-center text-sm font-bold shadow-md shadow-indigo-100">
                    {idx + 1}
                  </div>
                  <h3 className="font-bold text-base text-[#0F112E]">{item.title}</h3>
                  <p className="text-sm text-[#5E6488] leading-relaxed">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    case 'faq': {
      const items = content.items || [];
      if (items.length === 0) return null;
      const enabledFaqs = items.filter((item: any) => item.enabled !== false);
      return (
        <div className="border-t border-[#E4E2F0] pt-6">
          <FAQ items={enabledFaqs} title={content.heading || `Frequently Asked Questions about ${tool.name}`} />
        </div>
      );
    }

    case 'related_tools': {
      const slugs = content.slugs || [];
      if (slugs.length === 0) return null;
      const validSlugs = slugs
        .filter((s: any) => typeof s === 'string' && Boolean(getToolBySlug(s)))
        .slice(0, 4);
      if (validSlugs.length === 0) return null;
      return (
        <div className="border-t border-[#E4E2F0] pt-6">
          <RelatedTools slugs={validSlugs} title={content.heading || "Related Tools"} />
        </div>
      );
    }

    case 'cta':
      return (
        <section className="py-10 border-t border-[#E4E2F0]">
          <div className="p-8 md:p-12 bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] rounded-[24px] text-white text-center space-y-6 shadow-lg shadow-indigo-100">
            <div className="max-w-2xl mx-auto space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                {content.title}
              </h2>
              {content.description && (
                <p className="text-sm sm:text-base text-white/90 leading-relaxed">
                  {content.description}
                </p>
              )}
            </div>
            {content.buttonText && (
              <div className="pt-2">
                <Link
                  href={content.href || '#'}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold bg-white text-[#7C3AED] hover:bg-slate-50 transition-colors shadow-md"
                >
                  {content.buttonText}
                </Link>
              </div>
            )}
          </div>
        </section>
      );

    case 'section':
      return (
        <section className="py-10 border-t border-[#E4E2F0]">
          <div className="max-w-4xl space-y-2">
            {content.title && (
              <h2 className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                {content.title}
              </h2>
            )}
            {content.description && (
              <p className="text-base text-[#5E6488] leading-relaxed">{content.description}</p>
            )}
          </div>
        </section>
      );

    case 'heading': {
      // Prevent competing H1 headings on tool pages; primary H1 is reserved for tool title
      const level = content.level === 1 ? 2 : content.level === 3 ? 3 : 2;
      const Tag = level === 3 ? 'h3' : 'h2';
      const classes =
        level === 3
          ? "text-xl font-bold text-[#0F112E]"
          : "text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight";
      return <Tag className={`${classes} my-4`}>{content.text}</Tag>;
    }

    case 'paragraph':
      return <p className="text-base text-[#5E6488] leading-relaxed my-3">{content.text}</p>;

    case 'rich_text':
      return (
        <div
          className="text-base text-[#5E6488] leading-relaxed space-y-3 my-3"
          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(content.html || '') }}
        />
      );

    case 'custom_html': {
      const rawHtml = content.html || block.html || '';
      const rawCss = content.css || block.css || '';
      const cleanHtml = sanitizeCustomHtml(rawHtml);
      const scopeId = `custom-html-${block.id}`;
      const cleanCss = rawCss ? scopeAndSanitizeCss(rawCss, scopeId) : '';
      if (!cleanHtml && !cleanCss) return null;
      return (
        <div id={scopeId} className="custom-html-tool-block my-4 space-y-2">
          {cleanCss && <style dangerouslySetInnerHTML={{ __html: cleanCss }} />}
          <div
            className="w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
          {content.caption && (
            <p className="text-xs text-[#5E6488] italic pt-1">{content.caption}</p>
          )}
        </div>
      );
    }

    case 'image':
      return (
        <figure className="my-6">
          <img
            src={content.src}
            alt={content.alt || ''}
            className="rounded-2xl border border-[#E4E2F0] max-h-[400px] object-cover"
          />
          {content.caption && (
            <figcaption className="text-xs text-[#5E6488] mt-2 text-center">{content.caption}</figcaption>
          )}
        </figure>
      );

    case 'link':
      return (
        <Link
          href={content.href || '#'}
          target={content.isExternal ? "_blank" : undefined}
          rel={content.isExternal ? "noopener noreferrer" : undefined}
          className="text-[#7C3AED] hover:text-[#6D28D9] font-semibold underline inline-flex items-center gap-1 my-1"
        >
          <span>{content.text}</span>
          {content.isExternal && <ArrowLeft className="w-3 h-3 rotate-180" />}
        </Link>
      );

    case 'feature':
      return (
        <div className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 hover:border-[#7C3AED]/40 transition-colors shadow-sm my-4 max-w-md">
          <h3 className="font-bold text-base text-[#0F112E]">{content.title}</h3>
          <p className="text-sm text-[#5E6488] leading-relaxed">{content.description}</p>
        </div>
      );

    case 'privacy_note':
      return (
        <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="privacy-heading">
          <div className="p-6 md:p-8 bg-gradient-to-br from-[#FAF9FF] to-[#FFFFFF] border border-[#E4E2F0] rounded-[24px] shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-indigo-100">
                <ShieldCheck className="w-6 h-6 text-white" aria-hidden="true" />
              </div>
              <div className="space-y-3 flex-1">
                <h2 id="privacy-heading" className="text-xl md:text-2xl font-bold text-[#0F112E]">
                  {content.title || tool.privacyNote?.title || 'Your Privacy is Fully Protected'}
                </h2>
                <p className="text-sm md:text-base text-[#5E6488] leading-relaxed">
                  {content.description ||
                    tool.privacyNote?.description ||
                    'Your files are processed directly in your browser and do not need to be uploaded to our servers. Conversions execute locally on your device in temporary memory.'}
                </p>

                {((content.bullets && content.bullets.length > 0) || (tool.privacyNote?.bullets && tool.privacyNote.bullets.length > 0)) && (
                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {(content.bullets || tool.privacyNote?.bullets || []).map((bullet: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-xs md:text-sm text-[#5E6488]">
                        <CheckCircle2 className="w-4 h-4 text-[#7C3AED] flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      );

    case 'use_cases': {
      const items = content.items || tool.useCases || [];
      if (items.length === 0) return null;
      return (
        <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="use-cases-heading">
          <div className="mb-8">
            <h2 id="use-cases-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
              {content.heading || `Common Use Cases for ${tool.name}`}
            </h2>
            <p className="text-sm md:text-base text-[#5E6488] mt-1.5">
              {content.description || 'Practical scenarios where this tool saves time and streamlines workflows.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {items.map((useCase: any, idx: number) => {
              if (useCase.enabled === false) return null;
              return (
                <div
                  key={useCase.id || idx}
                  className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 hover:border-[#7C3AED]/30 transition-colors shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#F4F3FA] border border-[#E4E2F0] text-[#7C3AED] flex items-center justify-center shadow-sm">
                    {idx === 0 ? (
                      <Palette className="w-5 h-5" aria-hidden="true" />
                    ) : idx === 1 ? (
                      <Globe className="w-5 h-5" aria-hidden="true" />
                    ) : idx === 2 ? (
                      <FileText className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Repeat className="w-5 h-5" aria-hidden="true" />
                    )}
                  </div>
                  <h3 className="font-bold text-base text-[#0F112E]">{useCase.title}</h3>
                  <p className="text-sm text-[#5E6488] leading-relaxed">{useCase.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    case 'supported_formats': {
      const inputFormats = content.inputFormats || tool.inputFormats || [];
      const outputFormats = content.outputFormats || tool.outputFormats || [];
      return (
        <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="supported-formats-heading">
          <div className="max-w-4xl space-y-4">
            <h2 id="supported-formats-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
              {content.heading || 'Supported File Formats'}
            </h2>
            {content.description && (
              <p className="text-sm md:text-base text-[#5E6488] leading-relaxed">
                {content.description}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-5 bg-white border border-[#E4E2F0] rounded-2xl shadow-sm space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
                  Accepted Input Formats
                </span>
                <div className="flex flex-wrap gap-2">
                  {inputFormats.map((fmt: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-[#F4F3FA] text-[#0F112E] border border-[#E4E2F0]"
                    >
                      .{String(fmt).toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="p-5 bg-white border border-[#E4E2F0] rounded-2xl shadow-sm space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#10B981]">
                  Available Output Formats
                </span>
                <div className="flex flex-wrap gap-2">
                  {outputFormats.map((fmt: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      .{String(fmt).toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {content.notes && (
              <p className="text-xs text-[#5E6488] italic pt-1">{content.notes}</p>
            )}
          </div>
        </section>
      );
    }

    case 'technical_details': {
      const specs = content.specs || [];
      const limitations = content.limitations || [];
      return (
        <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="technical-details-heading">
          <div className="max-w-4xl space-y-6">
            <div>
              <h2 id="technical-details-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                {content.heading || 'Technical Details & Limitations'}
              </h2>
              {content.description && (
                <p className="text-sm md:text-base text-[#5E6488] mt-1.5 leading-relaxed">
                  {content.description}
                </p>
              )}
            </div>

            {specs.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {specs.map((spec: any, idx: number) => (
                  <div key={idx} className="p-4 bg-white border border-[#E4E2F0] rounded-xl shadow-sm space-y-1">
                    <span className="text-xs font-bold text-[#5E6488] uppercase tracking-wider">{spec.label}</span>
                    <p className="text-sm font-semibold text-[#0F112E]">{spec.value}</p>
                    {spec.notes && <p className="text-xs text-[#5E6488]">{spec.notes}</p>}
                  </div>
                ))}
              </div>
            )}

            {limitations.length > 0 && (
              <div className="p-5 bg-[#FAF9FF] border border-[#E4E2F0] rounded-2xl space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#5E6488]">Known Limitations & Device Notes</span>
                <ul className="space-y-1.5">
                  {limitations.map((lim: string, idx: number) => (
                    <li key={idx} className="text-xs sm:text-sm text-[#5E6488] flex items-start gap-2">
                      <span className="text-[#7C3AED] font-bold">•</span>
                      <span>{lim}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'spacer':
      return <div style={{ height: `${content.height || 24}px` }} />;

    case 'container': {
      const containerSettings = block.settings || content.settings || {};
      const wrapperClass = getContainerWrapperClasses(containerSettings);
      const innerClass = getContainerInnerClasses(containerSettings);
      const childBlocks = Array.isArray(content.blocks)
        ? content.blocks
        : Array.isArray(block.blocks)
        ? block.blocks
        : [];

      return (
        <div key={block.id} className={wrapperClass} data-block-id={block.id} data-block-type="container">
          <div className={innerClass}>
            {childBlocks.map((child: any) => {
              const isChildSelected = selectedBlockId === child.id;
              const renderedChild = (
                <CmsToolBlock
                  key={child.id}
                  block={child}
                  tool={tool}
                  isEditing={isEditing}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={onSelectBlock}
                />
              );
              if (!isEditing || !onSelectBlock) {
                return renderedChild;
              }
              return (
                <div
                  key={child.id}
                  data-child-block-id={child.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select child ${child.type} block`}
                  aria-pressed={isChildSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBlock(child.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectBlock(child.id);
                    }
                  }}
                  className={`relative group/child transition-all duration-150 rounded-xl outline-none cursor-pointer ${
                    isChildSelected
                      ? 'ring-2 ring-[#7C3AED] ring-offset-2 bg-[#7C3AED]/[0.03] shadow-sm'
                      : 'hover:ring-2 hover:ring-[#7C3AED]/50 hover:ring-offset-1'
                  }`}
                >
                  <div
                    className={`absolute -top-2.5 left-3 z-10 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-opacity shadow-xs pointer-events-none ${
                      isChildSelected
                        ? 'bg-[#7C3AED] text-white opacity-100'
                        : 'bg-slate-800 text-white opacity-0 group-hover/child:opacity-100'
                    }`}
                  >
                    {child.type}
                  </div>
                  {renderedChild}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

function getBlockLabel(type: string): string {
  switch (type) {
    case 'hero':
      return 'Hero';
    case 'intro':
      return 'Introduction';
    case 'how_to_use':
    case 'how_to':
      return 'How-To Steps';
    case 'features':
      return 'Features';
    case 'supported_formats':
      return 'Supported Formats';
    case 'technical_details':
      return 'Technical Details';
    case 'privacy_note':
      return 'Privacy & Guarantee';
    case 'use_cases':
      return 'Use Cases';
    case 'faq':
      return 'FAQ';
    case 'related_tools':
      return 'Related Tools';
    case 'cta':
      return 'Call to Action';
    case 'custom_html':
      return 'Custom HTML';
    case 'container':
      return 'Container';
    default:
      return type.replace('_', ' ');
  }
}

export function ToolPage({ tool, isPreview = false }: ToolPageProps) {
  const [selectedFiles, setSelectedFiles] = useState<FileItemData[]>([]);

  // Inline editing state
  const [activeBlocks, setActiveBlocks] = useState<UniversalContentBlock[]>(() => {
    if (Array.isArray(tool.blocks) && tool.blocks.length > 0) {
      return tool.blocks;
    }
    return [];
  });
  const [seoData, setSeoData] = useState<InlineSeoData | null>(() => (tool as any).seo || null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isSeoOpen, setIsSeoOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isPublished, setIsPublished] = useState(!isPreview);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [isSharedSettingsOpen, setIsSharedSettingsOpen] = useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Clipboard state tracking
  const [clipboardState, setClipboardState] = useState(() => getClipboardState());

  useEffect(() => {
    const handleClipboardChange = () => {
      setClipboardState(getClipboardState());
    };
    window.addEventListener(CLIPBOARD_EVENT_NAME, handleClipboardChange);
    window.addEventListener('focus', handleClipboardChange);
    return () => {
      window.removeEventListener(CLIPBOARD_EVENT_NAME, handleClipboardChange);
      window.removeEventListener('focus', handleClipboardChange);
    };
  }, []);

  const handleToggleEdit = () => {
    if (!isEditingMode && activeBlocks.length === 0) {
      const canonicalBlocks = generateCanonicalToolContract(tool);
      setActiveBlocks(canonicalBlocks);
    }
    setIsEditingMode((prev) => !prev);
    setSelectedBlockId(null);
  };

  const handleSaveSeoFromDrawer = (updatedSeo: InlineSeoData) => {
    setSeoData(updatedSeo);
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch(`/api/admin/tools/${tool.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: activeBlocks,
          seo: seoData || undefined,
          isPublished: false,
          expectedUpdatedAt: expectedUpdatedAt || undefined,
          reason: 'Inline visual content edit',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsDirty(false);
        setIsPublished(false);
        if (data.toolContent?.updatedAt) {
          setExpectedUpdatedAt(data.toolContent.updatedAt);
        }
        setFeedbackMessage({
          type: 'success',
          text: 'Draft saved successfully. Content is preserved in draft state.',
        });
      } else if (res.status === 409) {
        const data = await res.json();
        setFeedbackMessage({
          type: 'warning',
          text: data.error || 'Concurrent edit conflict: Content has been modified by another admin.',
        });
      } else {
        const data = await res.json();
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to save draft.',
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
      `Are you sure you want to publish your changes to '${tool.name}'? This will make the draft visible to all public visitors.`
    );
    if (!confirmed) return;

    setIsPublishing(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch(`/api/admin/tools/${tool.slug}/publish`, {
        method: 'POST',
      });

      if (res.ok) {
        setIsPublished(true);
        setFeedbackMessage({
          type: 'success',
          text: `'${tool.name}' published successfully to the live site!`,
        });
      } else {
        const data = await res.json();
        setFeedbackMessage({
          type: 'error',
          text: data.error || 'Failed to publish tool.',
        });
      }
    } catch {
      setFeedbackMessage({
        type: 'error',
        text: 'Network error publishing tool.',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDiscard = () => {
    if (!isDirty) return;
    const confirmed = window.confirm('Discard all unsaved edits made during this session?');
    if (confirmed) {
      setActiveBlocks(tool.blocks || []);
      setIsDirty(false);
      setSelectedBlockId(null);
      setFeedbackMessage({
        type: 'warning',
        text: 'Unsaved edits discarded.',
      });
    }
  };

  const handleSaveBlockFromDrawer = (updatedBlock: UniversalContentBlock) => {
    setActiveBlocks((prev) => updateBlockInTree(prev, updatedBlock));
    setIsDirty(true);
  };

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
          content: { level: 2, text: `More About ${tool.name}` },
          text: `More About ${tool.name}`,
          level: 2,
        };
        break;
      case 'paragraph':
        newBlock = {
          id: newId,
          type: 'paragraph',
          order: nextOrder,
          enabled: true,
          content: { text: `Learn how ${tool.name} processes your files locally and securely.` },
          text: `Learn how ${tool.name} processes your files locally and securely.`,
        };
        break;
      case 'feature':
        newBlock = {
          id: newId,
          type: 'feature',
          order: nextOrder,
          enabled: true,
          content: { title: 'Specialized Algorithm', description: 'Optimized specifically for speed and quality retention.', icon: 'Zap' },
          title: 'Specialized Algorithm',
          description: 'Optimized specifically for speed and quality retention.',
        };
        break;
      case 'faq':
        newBlock = {
          id: newId,
          type: 'faq',
          order: nextOrder,
          enabled: true,
          content: { question: `How secure is ${tool.name}?`, answer: 'Your files are processed directly in your browser without cloud uploads.' },
          question: `How secure is ${tool.name}?`,
          answer: 'Your files are processed directly in your browser without cloud uploads.',
        };
        break;
      case 'cta':
        newBlock = {
          id: newId,
          type: 'cta',
          order: nextOrder,
          enabled: true,
          content: {
            title: 'Need more file processing?',
            description: 'Convert24 offers dozens of free, fast, private online conversion and PDF tools.',
            buttonText: 'Explore More Converters',
            label: 'Explore More Converters',
            href: '/#explore-hubs',
            variant: 'primary',
            secondaryLabel: 'Learn More',
            secondaryHref: '/about',
          },
          title: 'Need more file processing?',
          description: 'Convert24 offers dozens of free, fast, private online conversion and PDF tools.',
          buttonText: 'Explore More Converters',
          label: 'Explore More Converters',
          href: '/#explore-hubs',
          variant: 'primary',
          secondaryLabel: 'Learn More',
          secondaryHref: '/about',
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

  const handleDeleteBlock = (blockId: string) => {
    setActiveBlocks((prev) => deleteBlockFromTree(prev, blockId));
    setIsDirty(true);
    if (selectedBlockId === blockId) setSelectedBlockId(null);
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
    const res = await pasteBlockFromClipboard('tool', activeBlocks.length);
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
      text: `Pasted "${getBlockLabel(pasted.type)}" block into tool page.`,
    });
  };

  const handleRevisionRestored = async () => {
    try {
      const res = await fetch(`/api/admin/tools/${tool.slug}`);
      if (res.ok) {
        const data = await res.json();
        if (data.override?.blocks) {
          setActiveBlocks(data.override.blocks);
        }
        setIsDirty(false);
        setIsPublished(false);
        if (data.override?.updatedAt) {
          setExpectedUpdatedAt(data.override.updatedAt);
        }
      }
    } catch {
      // Ignore
    }
  };

  const isImageCategory = tool.category.startsWith('image') || ['image-to-pdf', 'jpg-to-pdf', 'png-to-pdf'].includes(tool.slug);
  const categoryName = isImageCategory ? 'Image Tools' : 'PDF Tools';
  const categoryHref = isImageCategory ? '/image-tools' : '/pdf-tools';

  const breadcrumbs = [
    { name: categoryName, href: categoryHref },
    { name: tool.name },
  ];

  const handleFilesSelected = (files: File[]) => {
    const newItems: FileItemData[] = files.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      file,
      status: 'idle',
    }));
    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
  };

  const currentToolUrl = `${siteConfig.url}/tools/${tool.slug}`;
  const webAppSchema = createWebApplicationSchema(tool.name, tool.description, currentToolUrl);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: siteConfig.url },
    { name: categoryName, url: `${siteConfig.url}${categoryHref}` },
    { name: tool.name, url: currentToolUrl },
  ]);
  const faqSchema = tool.faq && tool.faq.length > 0 ? createFAQSchema(tool.faq) : null;
  const howToSchema =
    tool.howTo && tool.howTo.length > 0
      ? createHowToSchema(tool.name, tool.intro || tool.description, tool.howTo)
      : null;

  const valuePropText = tool.valueProposition || tool.description;
  const relatedSlugs =
    tool.relatedTools && tool.relatedTools.length > 0
      ? tool.relatedTools.slice(0, 4)
      : tool.youMayAlsoNeed || [];

  const blocksToRender = activeBlocks.length > 0 ? activeBlocks : (tool.blocks || []);
  const hasCmsBlocks = blocksToRender.length > 0;
  const heroBlock = hasCmsBlocks ? blocksToRender.find((b: any) => b.type === 'hero' && b.enabled !== false) : null;
  const subsequentBlocks = hasCmsBlocks ? blocksToRender.filter((b: any) => b.type !== 'hero' && b.enabled !== false) : [];
  const selectedBlock = findBlockById(activeBlocks, selectedBlockId);
  const parentContainer = findParentBlock(activeBlocks, selectedBlockId);

  return (
    <>
      <JsonLd data={webAppSchema} />
      <JsonLd data={breadcrumbSchema} />
      {faqSchema && <JsonLd data={faqSchema} />}
      {howToSchema && <JsonLd data={howToSchema} />}

      {/* Add CMS Content Block Toolbar (Visible in Edit Mode) */}
      {isEditingMode && (
        <div className="sticky top-16 z-30 bg-[#0F112E]/95 backdrop-blur-md text-white py-2.5 px-4 shadow-lg border-b border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7C3AED]" />
            <span>Tool Page Content Editor ({tool.name})</span>
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

      <div className="py-8 md:py-12 bg-[#FCFBFF]">
        <Container>
          {/* Breadcrumb Navigation & Back Affordance */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <Breadcrumbs items={breadcrumbs} className="mb-0" />
            <Link
              href={categoryHref}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#7C3AED] hover:text-[#6D28D9] hover:underline transition-colors py-1.5 px-3 rounded-xl hover:bg-[#F4F0FD]"
              aria-label={`Back to ${categoryName}`}
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to {categoryName}</span>
            </Link>
          </div>

          {/* 1. H1 Header & Short Description */}
          {hasCmsBlocks && heroBlock ? (
            <InlineBlockWrapper
              blockId={heroBlock.id}
              blockType={heroBlock.type}
              label={getBlockLabel(heroBlock.type)}
              isEditing={isEditingMode}
              isSelected={selectedBlockId === heroBlock.id}
              onSelect={() => setSelectedBlockId(heroBlock.id)}
              onCopy={() => handleCopyBlock(heroBlock)}
              onPasteAfter={() => handlePasteBlock(heroBlock.id)}
              canPaste={clipboardState.hasContent}
              copiedBlockLabel={clipboardState.label}
            >
              <CmsToolBlock block={heroBlock} tool={tool} />
            </InlineBlockWrapper>
          ) : (
            <header className="max-w-3xl mb-8 space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F112E] tracking-tight">
                {tool.h1}
              </h1>
              <p className="text-base sm:text-lg text-[#5E6488] leading-relaxed">
                {valuePropText}
              </p>
            </header>
          )}

          {/* 2. PRIMARY FUNCTIONAL TOOL UI (Immediate access, top priority on desktop & mobile) */}
          <section aria-label={`${tool.name} Converter Interface`} className="mb-8">
            {tool.slug === 'jpg-to-png' ? (
              <JpgToPngController />
            ) : tool.slug === 'png-to-jpg' ? (
              <PngToJpgController />
            ) : tool.slug === 'jpg-to-webp' ? (
              <JpgToWebpController />
            ) : tool.slug === 'webp-to-jpg' ? (
              <WebpToJpgController />
            ) : tool.slug === 'png-to-webp' ? (
              <PngToWebpController />
            ) : tool.slug === 'webp-to-png' ? (
              <WebpToPngController />
            ) : tool.slug === 'heic-to-jpg' ? (
              <HeicToJpgController />
            ) : tool.slug === 'svg-to-png' ? (
              <SvgToPngController />
            ) : tool.slug === 'gif-to-png' ? (
              <GifToPngController />
            ) : tool.slug === 'bmp-to-png' ? (
              <BmpToPngController />
            ) : tool.slug === 'compress-image' ? (
              <CompressImageController />
            ) : tool.slug === 'resize-image' ? (
              <ResizeImageController />
            ) : tool.slug === 'crop-image' ? (
              <CropImageController />
            ) : tool.slug === 'rotate-image' ? (
              <RotateImageController />
            ) : tool.slug === 'image-to-pdf' ? (
              <ImageToPdfController />
            ) : tool.slug === 'jpg-to-pdf' ? (
              <JpgToPdfController />
            ) : tool.slug === 'png-to-pdf' ? (
              <PngToPdfController />
            ) : tool.slug === 'pdf-to-jpg' ? (
              <PdfToJpgController />
            ) : tool.slug === 'pdf-to-png' ? (
              <PdfToPngController />
            ) : tool.slug === 'merge-pdf' ? (
              <MergePdfController />
            ) : tool.slug === 'split-pdf' ? (
              <SplitPdfController />
            ) : tool.slug === 'compress-pdf' ? (
              <CompressPdfController />
            ) : tool.slug === 'rotate-pdf' ? (
              <RotatePdfController />
            ) : tool.slug === 'delete-pdf-pages' ? (
              <DeletePdfPagesController />
            ) : tool.slug === 'reorder-pdf-pages' ? (
              <ReorderPdfPagesController />
            ) : (
              <div className="bg-[#FFFFFF] border border-[#E4E2F0] rounded-[24px] p-6 md:p-8 shadow-sm mb-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  <UploadZone
                    acceptedFormats={tool.inputFormats.map((f) => f.toUpperCase())}
                    onFilesSelected={handleFilesSelected}
                  />

                  {selectedFiles.length > 0 && (
                    <FileList
                      items={selectedFiles}
                      onRemove={handleRemoveFile}
                      onClearAll={handleClearAll}
                    />
                  )}

                  <div className="p-4 bg-[#F4F3FA] border border-[#E4E2F0] rounded-xl text-center space-y-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#7C3AED]">
                      Tool Interface Foundation
                    </p>
                    <p className="text-sm text-[#5E6488]">
                      Tool interface coming next. The engine will plug into this controller without modifying page architecture.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {hasCmsBlocks ? (
            subsequentBlocks.map((block: any, idx: number) => (
              <InlineBlockWrapper
                key={block.id}
                blockId={block.id}
                blockType={block.type}
                label={getBlockLabel(block.type)}
                isEditing={isEditingMode}
                isSelected={selectedBlockId === block.id}
                onSelect={() => setSelectedBlockId(block.id)}
                onMoveUp={idx > 0 ? () => handleMoveBlock(activeBlocks.indexOf(block), 'up') : undefined}
                onMoveDown={idx < subsequentBlocks.length - 1 ? () => handleMoveBlock(activeBlocks.indexOf(block), 'down') : undefined}
                onDuplicate={() => handleDuplicateBlock(block)}
                onDelete={() => handleDeleteBlock(block.id)}
                onCopy={() => handleCopyBlock(block)}
                onPasteAfter={() => handlePasteBlock(block.id)}
                canPaste={clipboardState.hasContent}
                copiedBlockLabel={clipboardState.label}
              >
                <CmsToolBlock
                  block={block}
                  tool={tool}
                  isEditing={isEditingMode}
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={setSelectedBlockId}
                />
              </InlineBlockWrapper>
            ))
          ) : (
            <>
              {/* 3. Trust / Benefit Row (Fast • Free • No signup) */}
              <div className="py-4 px-4 md:px-6 bg-[#F4F3FA] border border-[#E4E2F0] rounded-2xl flex flex-wrap items-center justify-around gap-4 text-xs sm:text-sm font-bold text-[#7C3AED] mb-10 shadow-sm">
                <span className="inline-flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
                  Fast & Local
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
                  100% Free
                </span>
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
                  No Signup
                </span>
                <span className="inline-flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#7C3AED]" aria-hidden="true" />
                  Client-Side Privacy
                </span>
              </div>

              {/* 4. How to Use Section */}
              {tool.howTo && tool.howTo.length > 0 && (
                <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="how-to-heading">
                  <div className="mb-8">
                    <h2 id="how-to-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                      How to Use {tool.name}
                    </h2>
                    <p className="text-sm md:text-base text-[#5E6488] mt-1.5">
                      Follow these simple steps to process your files directly in your browser.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {tool.howTo.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-4 relative shadow-sm"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#6366F1] text-white flex items-center justify-center text-sm font-bold shadow-md shadow-indigo-100">
                          {idx + 1}
                        </div>
                        <h3 className="font-bold text-base text-[#0F112E]">{step.title}</h3>
                        <p className="text-sm text-[#5E6488] leading-relaxed">{step.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Natural Ad Placement Slot */}
              <AdSlot slotId={`tool-${tool.slug}-middle`} format="horizontal" />

              {/* 5. Related Tools Section */}
              {relatedSlugs && relatedSlugs.length > 0 && (
                <div className="border-t border-[#E4E2F0] pt-6">
                  <RelatedTools slugs={relatedSlugs} title="Related Tools" />
                </div>
              )}

              {/* 6. Short Introduction / About Tool */}
              {tool.intro && (
                <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="intro-heading">
                  <div className="max-w-4xl space-y-4">
                    <h2 id="intro-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                      About {tool.name}
                    </h2>
                    <p className="text-base text-[#5E6488] leading-relaxed">
                      {tool.intro}
                    </p>
                  </div>
                </section>
              )}

              {/* 7. Key Features */}
              <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="features-heading">
                <div className="mb-8">
                  <h2 id="features-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                    Key Features of {tool.name}
                  </h2>
                  <p className="text-sm md:text-base text-[#5E6488] mt-1.5">
                    Engineered for speed, privacy, and seamless browser-based processing.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tool.features && tool.features.length > 0 ? (
                    tool.features.map((feature, idx) => (
                      <div key={idx} className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 hover:border-[#7C3AED]/40 transition-colors shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                          {idx === 0 ? (
                            <Cpu className="w-5 h-5" aria-hidden="true" />
                          ) : idx === 1 ? (
                            <FileCheck className="w-5 h-5" aria-hidden="true" />
                          ) : idx === 2 ? (
                            <Layers className="w-5 h-5" aria-hidden="true" />
                          ) : idx === 3 ? (
                            <Sparkles className="w-5 h-5" aria-hidden="true" />
                          ) : idx === 4 ? (
                            <Zap className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                          )}
                        </div>
                        <h3 className="font-bold text-base text-[#0F112E]">{feature.title}</h3>
                        <p className="text-sm text-[#5E6488] leading-relaxed">{feature.description}</p>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                          <Lock className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <h3 className="font-bold text-base text-[#0F112E]">100% Privacy</h3>
                        <p className="text-sm text-[#5E6488] leading-relaxed">Files are processed directly in your browser. Nothing is saved or sent to external servers.</p>
                      </div>

                      <div className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                          <Zap className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <h3 className="font-bold text-base text-[#0F112E]">Lightning Fast</h3>
                        <p className="text-sm text-[#5E6488] leading-relaxed">Instant conversion without server queuing delays or upload wait times.</p>
                      </div>

                      <div className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#F4F0FD] text-[#7C3AED] flex items-center justify-center shadow-sm">
                          <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <h3 className="font-bold text-base text-[#0F112E]">Free Forever</h3>
                        <p className="text-sm text-[#5E6488] leading-relaxed">No subscriptions, credit card requirements, or artificial limits on conversions.</p>
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* 8. Privacy Notice */}
              <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="privacy-heading">
                <div className="p-6 md:p-8 bg-gradient-to-br from-[#FAF9FF] to-[#FFFFFF] border border-[#E4E2F0] rounded-[24px] shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-indigo-100">
                      <ShieldCheck className="w-6 h-6 text-white" aria-hidden="true" />
                    </div>
                    <div className="space-y-3 flex-1">
                      <h2 id="privacy-heading" className="text-xl md:text-2xl font-bold text-[#0F112E]">
                        {tool.privacyNote?.title || 'Your Privacy is Fully Protected'}
                      </h2>
                      <p className="text-sm md:text-base text-[#5E6488] leading-relaxed">
                        {tool.privacyNote?.description ||
                          'Your files are processed directly in your browser and do not need to be uploaded to our servers. Conversions execute locally on your device in temporary memory.'}
                      </p>

                      {tool.privacyNote?.bullets && tool.privacyNote.bullets.length > 0 && (
                        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                          {tool.privacyNote.bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs md:text-sm text-[#5E6488]">
                              <CheckCircle2 className="w-4 h-4 text-[#7C3AED] flex-shrink-0 mt-0.5" aria-hidden="true" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* 9. Common Use Cases */}
              {tool.useCases && tool.useCases.length > 0 && (
                <section className="py-10 border-t border-[#E4E2F0]" aria-labelledby="use-cases-heading">
                  <div className="mb-8">
                    <h2 id="use-cases-heading" className="text-2xl md:text-3xl font-extrabold text-[#0F112E] tracking-tight">
                      Common Use Cases for {tool.name}
                    </h2>
                    <p className="text-sm md:text-base text-[#5E6488] mt-1.5">
                      Practical scenarios where this tool saves time and streamlines workflows.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {tool.useCases.map((useCase, idx) => (
                      <div
                        key={idx}
                        className="p-6 bg-[#FFFFFF] border border-[#E4E2F0] rounded-[20px] space-y-3 hover:border-[#7C3AED]/30 transition-colors shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#F4F3FA] border border-[#E4E2F0] text-[#7C3AED] flex items-center justify-center shadow-sm">
                          {idx === 0 ? (
                            <Palette className="w-5 h-5" aria-hidden="true" />
                          ) : idx === 1 ? (
                            <Globe className="w-5 h-5" aria-hidden="true" />
                          ) : idx === 2 ? (
                            <FileText className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <Repeat className="w-5 h-5" aria-hidden="true" />
                          )}
                        </div>
                        <h3 className="font-bold text-base text-[#0F112E]">{useCase.title}</h3>
                        <p className="text-sm text-[#5E6488] leading-relaxed">{useCase.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Natural Ad Placement Slot */}
              <AdSlot slotId={`tool-${tool.slug}-bottom`} format="horizontal" />

              {/* 10. FAQ Section */}
              {tool.faq && tool.faq.length > 0 && (
                <div className="border-t border-[#E4E2F0] pt-6">
                  <FAQ items={tool.faq} title={`Frequently Asked Questions about ${tool.name}`} />
                </div>
              )}
            </>
          )}
        </Container>
      </div>

      {/* Admin Inline Visual Content Editor Controls */}
      <InlineEditorToolbar
        slug={tool.slug}
        isEditing={isEditingMode}
        isDirty={isDirty}
        isPublished={isPublished}
        isPreviewMode={isPreview}
        onToggleEdit={handleToggleEdit}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onDiscard={handleDiscard}
        onOpenRevisions={() => setIsRevisionsOpen(true)}
        onOpenSeo={() => setIsSeoOpen(true)}
        onOpenSharedSettings={() => setIsSharedSettingsOpen(true)}
        hasSeoOverride={Boolean(
          seoData &&
            (seoData.seoTitle ||
              seoData.metaDescription ||
              seoData.canonicalUrl ||
              seoData.ogTitle ||
              seoData.ogDescription ||
              seoData.ogImage)
        )}
        isSaving={isSaving}
        isPublishing={isPublishing}
        feedbackMessage={feedbackMessage}
      />

      <InlineBlockEditorDrawer
        block={selectedBlock}
        parentBlock={parentContainer}
        isOpen={isEditingMode && Boolean(selectedBlockId)}
        onClose={() => setSelectedBlockId(null)}
        onSaveBlock={handleSaveBlockFromDrawer}
        onSelectBlock={setSelectedBlockId}
        onCopyBlock={selectedBlock ? () => handleCopyBlock(selectedBlock) : undefined}
      />

      <InlineSeoDrawer
        slug={tool.slug}
        pageType="tool"
        isOpen={isSeoOpen}
        onClose={() => setIsSeoOpen(false)}
        seoData={seoData}
        inheritedDefaults={{
          title: tool.title,
          description: tool.description,
          canonicalUrl: `${siteConfig.url}/tools/${tool.slug}`,
        }}
        onSaveSeo={handleSaveSeoFromDrawer}
      />

      <InlineRevisionDrawer
        slug={tool.slug}
        isOpen={isRevisionsOpen}
        onClose={() => setIsRevisionsOpen(false)}
        onRevisionRestored={handleRevisionRestored}
      />

      <InlineSharedSettingsDrawer
        isOpen={isSharedSettingsOpen}
        onClose={() => setIsSharedSettingsOpen(false)}
      />
    </>
  );
}

export default ToolPage;
