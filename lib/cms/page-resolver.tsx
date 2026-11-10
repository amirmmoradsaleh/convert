import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import { StructuredPageBlock } from '@/lib/admin/types';
import { sanitizeRichTextHtml, sanitizeCustomHtml, scopeAndSanitizeCss } from '@/lib/admin/validation';
import { getContainerWrapperClasses, getContainerInnerClasses } from '@/lib/cms/container-contract';
import JsonLd from '@/components/seo/JsonLd';
import { ShieldCheck, CheckCircle2, Zap, Lock, Cpu, Sparkles } from 'lucide-react';

export interface ResolvedCmsPage {
  id: string;
  slug: string;
  name: string;
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: Date | null;
  blocks: StructuredPageBlock[];
  customCss?: string | null;
  seo?: {
    seoTitle?: string | null;
    metaDescription?: string | null;
    canonicalUrl?: string | null;
    robotsIndex?: boolean;
    robotsFollow?: boolean;
    ogTitle?: string | null;
    ogDescription?: string | null;
    ogImage?: string | null;
    twitterTitle?: string | null;
    twitterDescription?: string | null;
    twitterImage?: string | null;
    schemaType?: string | null;
    schemaJson?: Record<string, any> | null;
    focusKeyword?: string | null;
  } | null;
}

/**
 * Public Content Resolver.
 * Resolves a published page by slug.
 * Strictly enforces that draft pages return NULL to public visitors.
 */
export async function getPublishedPage(slug: string): Promise<ResolvedCmsPage | null> {
  const db = getDb();
  const page = await db.page.findUnique({
    where: { slug },
    include: {
      content: true,
      seo: true,
    },
  });

  if (!page || page.status !== 'PUBLISHED') {
    return null;
  }

  const rawBlocks = (page.content?.blocks as any[]) || [];

  return {
    id: page.id,
    slug: page.slug,
    name: page.name,
    status: page.status,
    publishedAt: page.publishedAt,
    blocks: rawBlocks,
    customCss: page.content?.customCss,
    seo: page.seo,
  };
}

/**
 * Generates Next.js App Router Metadata from CMS page data, falling back to default site metadata.
 */
export function buildCmsMetadata(
  cmsPage: ResolvedCmsPage | null,
  defaultMeta: Metadata
): Metadata {
  if (!cmsPage || !cmsPage.seo) {
    return defaultMeta;
  }

  const seo = cmsPage.seo;
  const title = seo.seoTitle || (defaultMeta.title as string);
  const description = seo.metaDescription || (defaultMeta.description as string);
  const canonical = seo.canonicalUrl || (defaultMeta.alternates as any)?.canonical;

  return {
    ...defaultMeta,
    title,
    description,
    alternates: canonical
      ? {
          canonical,
        }
      : defaultMeta.alternates,
    robots: {
      index: seo.robotsIndex !== false,
      follow: seo.robotsFollow !== false,
    },
    openGraph: {
      ...defaultMeta.openGraph,
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      images: seo.ogImage ? [{ url: seo.ogImage }] : (defaultMeta.openGraph?.images as any),
    },
    twitter: {
      ...defaultMeta.twitter,
      title: seo.twitterTitle || title,
      description: seo.twitterDescription || description,
      images: seo.twitterImage ? [seo.twitterImage] : (defaultMeta.twitter?.images as any),
    },
  };
}

/**
 * Edit context interface for interactive child block visual editing.
 */
export interface CmsBlockEditContext {
  isEditing?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
}

/**
 * Safe CmsBlockRenderer that renders structured content blocks using the existing design language.
 */
export function renderCmsBlock(block: any, editContext?: CmsBlockEditContext): React.ReactNode {
  if (!block || block.enabled === false) return null;

  const type = block.type;
        const title = block.title || block.content?.title || block.data?.title;
        const description = block.description || block.content?.description || block.data?.description;
        const text = block.text || block.content?.text || block.data?.text;
        const html = block.html || block.content?.html || block.data?.html;
        const level = block.level || block.content?.level || block.data?.level || 2;
        const href = block.href || block.content?.href || block.data?.href || '#';
        const label = block.label || block.content?.label || block.data?.label || text || 'Click Here';
        const variant = block.variant || block.content?.variant || block.data?.variant;
        const isExternal = block.isExternal || block.content?.isExternal || block.data?.isExternal;
        const question = block.question || block.content?.question || block.data?.question;
        const answer = block.answer || block.content?.answer || block.data?.answer;
        const src = block.src || block.content?.src || block.data?.src;
        const alt = block.alt || block.content?.alt || block.data?.alt || 'CMS Image';
        const caption = block.caption || block.content?.caption || block.data?.caption;

        switch (type) {
          case 'section':
            return (
              <section key={block.id} className="pt-4 pb-2 space-y-2 border-t border-[#F1F5F9] first:border-0 first:pt-0">
                {title && (
                  <h2 className="text-2xl md:text-3xl font-bold text-[#17202A] tracking-tight">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="text-base text-[#667085] leading-relaxed">
                    {description}
                  </p>
                )}
              </section>
            );

          case 'heading': {
            if (Number(level) === 1) {
              return (
                <h1 key={block.id} className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#17202A] tracking-tight">
                  {text}
                </h1>
              );
            }
            if (Number(level) === 3) {
              return (
                <h3 key={block.id} className="text-xl font-bold text-[#17202A] tracking-tight">
                  {text}
                </h3>
              );
            }
            return (
              <h2 key={block.id} className="text-2xl md:text-3xl font-bold text-[#17202A] tracking-tight">
                {text}
              </h2>
            );
          }

          case 'intro': {
            const introTitle = title;
            const introDesc = description || text;
            return (
              <div key={block.id} className="space-y-3 pb-2">
                {introTitle && (
                  <h1 className="text-3xl md:text-4xl font-bold text-[#17202A] tracking-tight">
                    {introTitle}
                  </h1>
                )}
                {html ? (
                  <div
                    className="text-base text-[#475569] leading-relaxed prose prose-slate max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
                  />
                ) : introDesc ? (
                  <p className="text-base text-[#475569] leading-relaxed">{introDesc}</p>
                ) : null}
              </div>
            );
          }

          case 'paragraph':
            return (
              <p key={block.id} className="text-base text-[#17202A] leading-relaxed">
                {text}
              </p>
            );

          case 'rich_text': {
            const cleanHtml = sanitizeRichTextHtml(html || '');
            return (
              <div
                key={block.id}
                className="text-base text-[#17202A] leading-relaxed prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: cleanHtml }}
              />
            );
          }

          case 'cta': {
            const isPrimary = variant !== 'outline' && variant !== 'secondary';
            const ctaTitle = title;
            const ctaDesc = description;
            const ctaBtnText = block.buttonText || block.content?.buttonText || block.label || block.content?.label || label || 'Get Started';
            const ctaHref = href;
            const ctaSecLabel = block.secondaryLabel || block.content?.secondaryLabel || block.data?.secondaryLabel;
            const ctaSecHref = block.secondaryHref || block.content?.secondaryHref || block.data?.secondaryHref;

            if (ctaTitle || ctaDesc) {
              return (
                <div
                  key={block.id}
                  className="my-6 p-6 md:p-8 bg-gradient-to-br from-[#124A57]/10 via-[#124A57]/5 to-transparent border border-[#124A57]/20 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6"
                >
                  <div className="space-y-1 text-center md:text-left">
                    {ctaTitle && <h3 className="text-xl md:text-2xl font-bold text-[#17202A]">{ctaTitle}</h3>}
                    {ctaDesc && <p className="text-sm md:text-base text-[#475569]">{ctaDesc}</p>}
                  </div>
                  <div className="flex flex-wrap items-center justify-center md:justify-end gap-3 shrink-0">
                    <Link
                      href={ctaHref}
                      className={`inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isPrimary
                          ? 'bg-[#124A57] text-white hover:bg-[#0E3B46] shadow-sm'
                          : 'bg-white border border-[#CBD5E1] text-[#17202A] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {ctaBtnText}
                    </Link>
                    {ctaSecLabel && ctaSecHref && (
                      <Link
                        href={ctaSecHref}
                        className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold bg-white border border-[#CBD5E1] text-[#17202A] hover:bg-[#F8FAFC] transition-all"
                      >
                        {ctaSecLabel}
                      </Link>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div key={block.id} className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  href={ctaHref}
                  className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    isPrimary
                      ? 'bg-[#124A57] text-white hover:bg-[#0E3B46] shadow-sm'
                      : 'bg-white border border-[#CBD5E1] text-[#17202A] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {ctaBtnText}
                </Link>
                {ctaSecLabel && ctaSecHref && (
                  <Link
                    href={ctaSecHref}
                    className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold bg-white border border-[#CBD5E1] text-[#17202A] hover:bg-[#F8FAFC] transition-all"
                  >
                    {ctaSecLabel}
                  </Link>
                )}
              </div>
            );
          }

          case 'link':
            return (
              <div key={block.id}>
                <Link
                  href={href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className="text-sm font-semibold text-[#124A57] hover:underline"
                >
                  {text}
                </Link>
              </div>
            );

          case 'feature':
            return (
              <div key={block.id} className="p-5 bg-white border border-[#E5E7EB] rounded-card space-y-2">
                <h3 className="font-semibold text-base text-[#17202A]">{title}</h3>
                <p className="text-sm text-[#667085]">{description}</p>
              </div>
            );

          case 'features': {
            const items = Array.isArray(block.items) ? block.items : Array.isArray(block.content?.items) ? block.content.items : [];
            const heading = block.heading || block.content?.heading || title || 'Features';
            const subheading = block.subheading || block.content?.subheading || description;
            return (
              <section key={block.id} className="py-6 space-y-6">
                {(heading || subheading) && (
                  <div className="space-y-1">
                    {heading && <h2 className="text-2xl md:text-3xl font-bold text-[#17202A]">{heading}</h2>}
                    {subheading && <p className="text-sm md:text-base text-[#667085]">{subheading}</p>}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {items.map((item: any, idx: number) => {
                    if (item && item.enabled === false) return null;
                    return (
                      <div key={item?.id || idx} className="p-5 bg-white border border-[#E5E7EB] rounded-2xl space-y-2 shadow-sm">
                        <h3 className="font-semibold text-base text-[#17202A]">{item?.title || item?.heading}</h3>
                        <p className="text-sm text-[#667085] leading-relaxed">{item?.description || item?.text}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'how_to_use':
          case 'how_to': {
            const items = Array.isArray(block.items) ? block.items : Array.isArray(block.content?.items) ? block.content.items : [];
            const heading = block.heading || block.content?.heading || title || 'How to Use';
            const desc = block.description || block.content?.description;
            return (
              <section key={block.id} className="py-6 space-y-6">
                {(heading || desc) && (
                  <div className="space-y-1">
                    {heading && <h2 className="text-2xl md:text-3xl font-bold text-[#17202A]">{heading}</h2>}
                    {desc && <p className="text-sm md:text-base text-[#667085]">{desc}</p>}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {items.map((item: any, idx: number) => {
                    if (item && item.enabled === false) return null;
                    return (
                      <div key={item?.id || idx} className="p-6 bg-white border border-[#E5E7EB] rounded-2xl space-y-3 relative shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-[#124A57] text-white flex items-center justify-center text-sm font-bold">
                          {idx + 1}
                        </div>
                        <h3 className="font-semibold text-base text-[#17202A]">{item?.title || item?.step}</h3>
                        <p className="text-sm text-[#667085] leading-relaxed">{item?.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'faq': {
            const items = Array.isArray(block.items) ? block.items : Array.isArray(block.content?.items) ? block.content.items : [];
            const heading = block.heading || block.content?.heading || title;

            if (items.length > 0) {
              return (
                <section key={block.id} className="py-6 space-y-4">
                  {heading && <h2 className="text-2xl md:text-3xl font-bold text-[#17202A]">{heading}</h2>}
                  <div className="space-y-3">
                    {items.map((item: any, idx: number) => {
                      if (item && item.enabled === false) return null;
                      return (
                        <div key={item?.id || idx} className="p-5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl space-y-2">
                          <h3 className="font-semibold text-base text-[#17202A]">{item?.question || item?.q}</h3>
                          <p className="text-sm text-[#64748B] leading-relaxed">{item?.answer || item?.a}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            }

            return (
              <div key={block.id} className="p-4 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg space-y-1.5">
                <h4 className="font-semibold text-sm text-[#17202A]">{question}</h4>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">{answer}</p>
              </div>
            );
          }

          case 'supported_formats': {
            const heading = block.heading || block.content?.heading || 'Supported File Formats';
            const desc = block.description || block.content?.description;
            const inputFormats = Array.isArray(block.inputFormats) ? block.inputFormats : Array.isArray(block.content?.inputFormats) ? block.content.inputFormats : [];
            const outputFormats = Array.isArray(block.outputFormats) ? block.outputFormats : Array.isArray(block.content?.outputFormats) ? block.content.outputFormats : [];
            const notes = block.notes || block.content?.notes;

            return (
              <section key={block.id} className="py-6 space-y-4">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#17202A]">{heading}</h2>
                  {desc && <p className="text-sm md:text-base text-[#667085]">{desc}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#124A57]">Accepted Input Formats</span>
                    <div className="flex flex-wrap gap-2">
                      {inputFormats.map((fmt: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 rounded-lg text-xs font-bold bg-[#F1F5F9] text-[#17202A] border border-[#E2E8F0]">
                          .{String(fmt).replace(/^\./, '').toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="p-5 bg-white border border-[#E5E7EB] rounded-2xl shadow-sm space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Available Output Formats</span>
                    <div className="flex flex-wrap gap-2">
                      {outputFormats.map((fmt: string, idx: number) => (
                        <span key={idx} className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          .{String(fmt).replace(/^\./, '').toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {notes && <p className="text-xs text-[#64748B] italic pt-1">{notes}</p>}
              </section>
            );
          }

          case 'technical_details': {
            const heading = block.heading || block.content?.heading || 'Technical Details & Limitations';
            const desc = block.description || block.content?.description;
            const specs = Array.isArray(block.specs) ? block.specs : Array.isArray(block.content?.specs) ? block.content.specs : [];
            const limitations = Array.isArray(block.limitations) ? block.limitations : Array.isArray(block.content?.limitations) ? block.content.limitations : [];

            return (
              <section key={block.id} className="py-6 space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-bold text-[#17202A]">{heading}</h2>
                  {desc && <p className="text-sm md:text-base text-[#667085] leading-relaxed">{desc}</p>}
                </div>
                {specs.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {specs.map((spec: any, idx: number) => (
                      <div key={idx} className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-sm space-y-1">
                        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">{spec.label}</span>
                        <p className="text-sm font-semibold text-[#17202A]">{spec.value}</p>
                        {spec.notes && <p className="text-xs text-[#64748B]">{spec.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {limitations.length > 0 && (
                  <div className="p-5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-2xl space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Known Limitations & Notes</span>
                    <ul className="space-y-1.5">
                      {limitations.map((lim: string, idx: number) => (
                        <li key={idx} className="text-xs sm:text-sm text-[#64748B] flex items-start gap-2">
                          <span className="text-[#124A57] font-bold">•</span>
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            );
          }

          case 'benefits_trust': {
            const items = Array.isArray(block.items) ? block.items : Array.isArray(block.content?.items) ? block.content.items : [];
            return (
              <section key={block.id} className="py-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {items.map((item: any, idx: number) => {
                    if (item && item.enabled === false) return null;
                    return (
                      <div key={item?.id || idx} className="p-5 bg-white border border-[#E5E7EB] rounded-2xl flex items-start gap-3 shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h3 className="font-semibold text-sm text-[#17202A]">{item?.title || item?.heading}</h3>
                          <p className="text-xs text-[#64748B] leading-relaxed">{item?.description || item?.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'privacy_note': {
            const noteTitle = block.title || block.content?.title || 'Your Privacy is Protected';
            const noteDesc = block.description || block.content?.description || block.text || block.content?.text || 'Your files are processed directly and securely in temporary memory.';
            const bullets = Array.isArray(block.bullets) ? block.bullets : Array.isArray(block.content?.bullets) ? block.content.bullets : [];

            return (
              <section key={block.id} className="py-6">
                <div className="p-6 md:p-8 bg-gradient-to-br from-[#F8FAFC] to-white border border-[#E5E7EB] rounded-2xl shadow-sm flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#124A57] text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                    <ShieldCheck className="w-6 h-6 text-white" />
                  </div>
                  <div className="space-y-3 flex-1">
                    <h2 className="text-xl md:text-2xl font-bold text-[#17202A]">{noteTitle}</h2>
                    <p className="text-sm md:text-base text-[#64748B] leading-relaxed">{noteDesc}</p>
                    {bullets.length > 0 && (
                      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {bullets.map((bullet: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-xs md:text-sm text-[#64748B]">
                            <CheckCircle2 className="w-4 h-4 text-[#124A57] shrink-0 mt-0.5" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            );
          }

          case 'use_cases': {
            const heading = block.heading || block.content?.heading || 'Common Use Cases';
            const desc = block.description || block.content?.description;
            const items = Array.isArray(block.items) ? block.items : Array.isArray(block.content?.items) ? block.content.items : [];

            return (
              <section key={block.id} className="py-6 space-y-6">
                {(heading || desc) && (
                  <div className="space-y-1">
                    {heading && <h2 className="text-2xl md:text-3xl font-bold text-[#17202A]">{heading}</h2>}
                    {desc && <p className="text-sm md:text-base text-[#667085]">{desc}</p>}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {items.map((item: any, idx: number) => {
                    if (item && item.enabled === false) return null;
                    return (
                      <div key={item?.id || idx} className="p-5 bg-white border border-[#E5E7EB] rounded-2xl space-y-2 shadow-sm">
                        <h3 className="font-semibold text-base text-[#17202A]">{item?.title}</h3>
                        <p className="text-sm text-[#64748B] leading-relaxed">{item?.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          case 'spacer': {
            const height = block.height || block.content?.height || 24;
            return <div key={block.id} style={{ height: `${height}px` }} aria-hidden="true" />;
          }

          case 'image':
            return (
              <div key={block.id} className="space-y-1.5 pt-2">
                <img
                  src={src}
                  alt={alt}
                  className="rounded-card border border-[#E5E7EB] max-w-full h-auto"
                />
                {caption && (
                  <p className="text-xs text-[#64748B] italic">{caption}</p>
                )}
              </div>
            );

          case 'custom_html': {
            const rawCustomHtml = block.html || block.content?.html || block.data?.html || '';
            const rawCustomCss = block.css || block.content?.css || block.data?.css || '';
            const cleanCustomHtml = sanitizeCustomHtml(rawCustomHtml);
            const customCaption = block.caption || block.content?.caption || block.data?.caption;
            const scopeId = `custom-html-${block.id}`;
            const cleanCustomCss = rawCustomCss ? scopeAndSanitizeCss(rawCustomCss, scopeId) : '';

            if (!cleanCustomHtml && !cleanCustomCss) return null;

            return (
              <div key={block.id} id={scopeId} className="custom-html-block space-y-2">
                {cleanCustomCss && <style dangerouslySetInnerHTML={{ __html: cleanCustomCss }} />}
                <div
                  className="w-full overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: cleanCustomHtml }}
                />
                {customCaption && (
                  <p className="text-xs text-[#64748B] italic pt-1">{customCaption}</p>
                )}
              </div>
            );
          }

          case 'container': {
            const containerSettings = block.settings || block.content?.settings || {};
            const wrapperClass = getContainerWrapperClasses(containerSettings);
            const innerClass = getContainerInnerClasses(containerSettings);
            const childBlocks = Array.isArray(block.blocks)
              ? block.blocks
              : Array.isArray(block.content?.blocks)
              ? block.content.blocks
              : [];

            return (
              <div key={block.id} className={wrapperClass} data-block-id={block.id} data-block-type="container">
                <div className={innerClass}>
                  {childBlocks.map((child: any) => {
                    const isChildSelected = editContext?.selectedBlockId === child.id;
                    const renderedChild = renderCmsBlock(child, editContext);
                    if (!editContext?.isEditing || !editContext?.onSelectBlock) {
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
                          editContext.onSelectBlock!(child.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            editContext.onSelectBlock!(child.id);
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

/**
 * Safe CmsBlockRenderer that renders structured content blocks using the existing design language.
 */
export function CmsBlockRenderer({
  blocks,
  isEditing,
  selectedBlockId,
  onSelectBlock,
}: {
  blocks: StructuredPageBlock[];
  isEditing?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
}) {
  if (!blocks || blocks.length === 0) return null;

  const editContext: CmsBlockEditContext = { isEditing, selectedBlockId, onSelectBlock };

  return (
    <div className="space-y-6">
      {blocks.map((block: any) => renderCmsBlock(block, editContext))}
    </div>
  );
}

/**
 * Component to inject custom JSON-LD schema from CMS SEO settings safely.
 */
export function CmsJsonLd({ schema }: { schema?: Record<string, any> | null }) {
  if (!schema) return null;
  return <JsonLd data={schema} />;
}
