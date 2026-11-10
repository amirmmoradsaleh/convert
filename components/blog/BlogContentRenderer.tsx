'use client';

import React from 'react';
import { isSafeUrl } from '@/lib/admin/validation';

export interface BlockHeading {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  text: string;
}

export interface BlockParagraph {
  type: 'paragraph';
  text: string;
}

export interface BlockList {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface BlockQuote {
  type: 'quote';
  text: string;
}

export interface BlockCode {
  type: 'code';
  code: string;
  lang?: string;
}

export interface BlockImage {
  type: 'image';
  src: string;
  alt: string;
}

export type BlogBlock =
  | BlockHeading
  | BlockParagraph
  | BlockList
  | BlockQuote
  | BlockCode
  | BlockImage;

/**
 * Creates a URL-friendly anchor slug from heading text.
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parses markdown body text into structured semantic blocks.
 */
export function parseMarkdownBlocks(markdown?: string | null): BlogBlock[] {
  if (!markdown || typeof markdown !== 'string') return [];

  const rawLines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlogBlock[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // 1. Skip blank lines
    if (!trimmed) {
      i++;
      continue;
    }

    // 2. Fenced code block: ```[lang]
    if (trimmed.startsWith('```')) {
      const rawLang = trimmed.slice(3).trim();
      const lang = rawLang ? rawLang.replace(/[^a-zA-Z0-9_#-]/g, '').slice(0, 30) : undefined;
      i++;
      const codeLines: string[] = [];
      while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length && rawLines[i].trim().startsWith('```')) {
        i++; // skip closing ```
      }
      blocks.push({
        type: 'code',
        code: codeLines.join('\n'),
        lang: lang || undefined,
      });
      continue;
    }

    // 3. Headings: #, ##, ###, ####
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4;
      const headingText = headingMatch[2].replace(/\s+#+\s*$/, '').trim();
      blocks.push({
        type: 'heading',
        level,
        text: headingText,
      });
      i++;
      continue;
    }

    // 4. Standalone Image: ![alt](url)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)$/);
    if (imgMatch) {
      blocks.push({
        type: 'image',
        alt: imgMatch[1].trim(),
        src: imgMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 5. Standalone HTML <img>: <img src="..." ... />
    const htmlImgMatch = trimmed.match(/^<img\s+([^>]*)\/?>$/i);
    if (htmlImgMatch) {
      const attrs = htmlImgMatch[1];
      const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
      const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
      if (srcMatch) {
        blocks.push({
          type: 'image',
          src: srcMatch[1].trim(),
          alt: altMatch ? altMatch[1].trim() : '',
        });
        i++;
        continue;
      }
    }

    // 6. Blockquote: lines starting with >
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (
        i < rawLines.length &&
        (rawLines[i].trim().startsWith('>') ||
          (rawLines[i].trim() &&
            !rawLines[i].trim().startsWith('```') &&
            !rawLines[i].trim().startsWith('#') &&
            !rawLines[i].trim().startsWith('![') &&
            !rawLines[i].trim().startsWith('<img') &&
            !rawLines[i].trim().startsWith('-') &&
            !rawLines[i].trim().startsWith('*') &&
            !/^\d+\./.test(rawLines[i].trim())))
      ) {
        const qLine = rawLines[i].trim();
        if (qLine.startsWith('>')) {
          quoteLines.push(qLine.replace(/^>\s?/, ''));
        } else {
          quoteLines.push(qLine);
        }
        i++;
      }
      blocks.push({
        type: 'quote',
        text: quoteLines.join('\n'),
      });
      continue;
    }

    // 7. Unordered List: lines starting with - or *
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length && /^[-*]\s+/.test(rawLines[i].trim())) {
        items.push(rawLines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: false,
        items,
      });
      continue;
    }

    // 8. Ordered List: lines starting with 1. 2. etc.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < rawLines.length && /^\d+\.\s+/.test(rawLines[i].trim())) {
        items.push(rawLines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({
        type: 'list',
        ordered: true,
        items,
      });
      continue;
    }

    // 9. Paragraph: group consecutive lines until a blank line or new block marker
    const paraLines: string[] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !rawLines[i].trim().startsWith('```') &&
      !rawLines[i].trim().startsWith('#') &&
      !rawLines[i].trim().startsWith('>') &&
      !/^[-*]\s+/.test(rawLines[i].trim()) &&
      !/^\d+\.\s+/.test(rawLines[i].trim()) &&
      !/^!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\)$/.test(rawLines[i].trim()) &&
      !/^<img\s+[^>]*\/?>$/i.test(rawLines[i].trim())
    ) {
      paraLines.push(rawLines[i].trim());
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: paraLines.join('\n'),
      });
    }
  }

  return blocks;
}

/**
 * Tokenizes inline formatting (bold, italic, links, inline code, inline images, linebreaks)
 * into safe React nodes.
 */
export function renderInline(text: string, keyPrefix = 'inline'): React.ReactNode[] {
  if (!text) return [];

  const regex =
    /(?:(`[^`]+`)|(!\[([^\]]*)\]\(((?:[^()]|\([^()]*\))*)\))|(<img\s+[^>]*\/?>)|(\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\))|(\*\*\*([^\s*](?:[\s\S]*?[^\s*])?)\*\*\*)|(___([^\s_](?:[\s\S]*?[^\s_])?)___)|(\*\*([^\s*](?:[\s\S]*?[^\s*])?)\*\*)|(__([^\s_](?:[\s\S]*?[^\s_])?)__)|(\*([^\s*](?:[\s\S]*?[^\s*])?)\*)|(_([^\s_](?:[\s\S]*?[^\s_])?)_)|(\n))/g;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    const [
      fullMatch,
      codeMatch,           // 1
      imgMatch,            // 2
      imgAlt,              // 3
      imgSrc,              // 4
      htmlImgMatch,        // 5
      linkMatch,           // 6
      linkLabel,           // 7
      linkUrl,             // 8
      boldItalic1,         // 9
      boldItalicText1,     // 10
      boldItalic2,         // 11
      boldItalicText2,     // 12
      bold1,               // 13
      boldText1,           // 14
      bold2,               // 15
      boldText2,           // 16
      italic1,             // 17
      italicText1,         // 18
      italic2,             // 19
      italicText2,         // 20
      newlineMatch,        // 21
    ] = match;

    const nodeKey = `${keyPrefix}-${match.index}`;

    if (codeMatch) {
      const codeContent = codeMatch.slice(1, -1);
      nodes.push(
        <code
          key={nodeKey}
          className="px-1.5 py-0.5 bg-[#F1F5F9] text-[#0F172A] rounded text-sm font-mono font-medium"
        >
          {codeContent}
        </code>
      );
    } else if (imgMatch) {
      const safeSrc = isSafeUrl(imgSrc) ? imgSrc : '#';
      if (safeSrc !== '#') {
        nodes.push(
          <span key={nodeKey} className="inline-block my-2 max-w-full">
            <img
              src={safeSrc}
              alt={imgAlt || 'Article image'}
              className="rounded-xl max-w-full h-auto shadow-xs inline-block align-middle border border-[#E4E2F0]"
              loading="lazy"
            />
          </span>
        );
      }
    } else if (htmlImgMatch) {
      const srcAttr = htmlImgMatch.match(/src=["']([^"']+)["']/i);
      const altAttr = htmlImgMatch.match(/alt=["']([^"']*)["']/i);
      const safeSrc = srcAttr && isSafeUrl(srcAttr[1]) ? srcAttr[1] : '#';
      if (safeSrc !== '#') {
        nodes.push(
          <span key={nodeKey} className="inline-block my-2 max-w-full">
            <img
              src={safeSrc}
              alt={altAttr ? altAttr[1] : 'Article image'}
              className="rounded-xl max-w-full h-auto shadow-xs inline-block align-middle border border-[#E4E2F0]"
              loading="lazy"
            />
          </span>
        );
      }
    } else if (linkMatch) {
      const safeHref = isSafeUrl(linkUrl) ? linkUrl : '#';
      const isExternal = safeHref.startsWith('http://') || safeHref.startsWith('https://');
      nodes.push(
        <a
          key={nodeKey}
          href={safeHref}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-[#7C3AED] hover:text-[#6366F1] font-semibold underline underline-offset-2 transition-colors"
        >
          {renderInline(linkLabel, `${nodeKey}-link`)}
        </a>
      );
    } else if (boldItalic1 || boldItalic2) {
      const inner = boldItalicText1 || boldItalicText2 || '';
      nodes.push(
        <strong key={nodeKey} className="font-bold text-[#0F112E] italic">
          {renderInline(inner, `${nodeKey}-bi`)}
        </strong>
      );
    } else if (bold1 || bold2) {
      const inner = boldText1 || boldText2 || '';
      nodes.push(
        <strong key={nodeKey} className="font-bold text-[#0F112E]">
          {renderInline(inner, `${nodeKey}-b`)}
        </strong>
      );
    } else if (italic1 || italic2) {
      const inner = italicText1 || italicText2 || '';
      nodes.push(
        <em key={nodeKey} className="italic text-[#0F112E]">
          {renderInline(inner, `${nodeKey}-i`)}
        </em>
      );
    } else if (newlineMatch) {
      nodes.push(<br key={nodeKey} />);
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes;
}

interface BlogContentRendererProps {
  content?: string | null;
  className?: string;
}

/**
 * Universal Blog Content Renderer
 * Provides 100% parity across Admin Editor Live Preview, Admin Preview Page, and Public Article Page.
 */
export default function BlogContentRenderer({
  content,
  className = '',
}: BlogContentRendererProps) {
  const blocks = parseMarkdownBlocks(content);

  if (!blocks || blocks.length === 0) {
    return <p className="text-[#94A3B8] italic">No content available.</p>;
  }

  return (
    <div className={`blog-content-body space-y-6 text-[#0F112E] ${className}`}>
      {blocks.map((block, idx) => {
        const key = `blk-${idx}`;

        switch (block.type) {
          case 'heading': {
            const anchorId = slugifyHeading(block.text);
            if (block.level === 1) {
              return (
                <h1
                  key={key}
                  id={anchorId || undefined}
                  className="text-3xl md:text-4xl font-extrabold text-[#0F112E] mt-10 mb-4 tracking-tight leading-tight scroll-mt-20"
                >
                  {renderInline(block.text, `${key}-h1`)}
                </h1>
              );
            }
            if (block.level === 2) {
              return (
                <h2
                  key={key}
                  id={anchorId || undefined}
                  className="text-2xl md:text-3xl font-extrabold text-[#0F112E] mt-10 mb-4 tracking-tight leading-tight scroll-mt-20"
                >
                  {renderInline(block.text, `${key}-h2`)}
                </h2>
              );
            }
            if (block.level === 3) {
              return (
                <h3
                  key={key}
                  id={anchorId || undefined}
                  className="text-xl md:text-2xl font-bold text-[#0F112E] mt-8 mb-3 tracking-tight leading-snug scroll-mt-20"
                >
                  {renderInline(block.text, `${key}-h3`)}
                </h3>
              );
            }
            return (
              <h4
                key={key}
                id={anchorId || undefined}
                className="text-lg md:text-xl font-semibold text-[#0F112E] mt-6 mb-2"
              >
                {renderInline(block.text, `${key}-h4`)}
              </h4>
            );
          }

          case 'paragraph': {
            return (
              <p
                key={key}
                className="text-[#5E6488] leading-relaxed text-base md:text-lg mb-6"
              >
                {renderInline(block.text, `${key}-p`)}
              </p>
            );
          }

          case 'image': {
            const safeSrc = isSafeUrl(block.src) ? block.src : '#';
            if (safeSrc === '#') return null;

            return (
              <figure key={key} className="my-8">
                <div className="rounded-2xl overflow-hidden border border-[#E4E2F0] bg-[#FAF9FF] shadow-xs">
                  <img
                    src={safeSrc}
                    alt={block.alt || 'Article visual'}
                    className="w-full h-auto object-cover max-h-[550px] mx-auto"
                    loading="lazy"
                  />
                </div>
                {block.alt && (
                  <figcaption className="text-center text-xs text-[#5E6488] mt-2.5 italic font-medium">
                    {block.alt}
                  </figcaption>
                )}
              </figure>
            );
          }

          case 'list': {
            if (block.ordered) {
              return (
                <ol
                  key={key}
                  className="list-decimal pl-6 space-y-2.5 my-5 text-[#5E6488] text-base md:text-lg"
                >
                  {block.items.map((item, itemIdx) => (
                    <li
                      key={`${key}-li-${itemIdx}`}
                      className="leading-relaxed pl-1 marker:font-semibold marker:text-[#7C3AED]"
                    >
                      {renderInline(item, `${key}-li-${itemIdx}`)}
                    </li>
                  ))}
                </ol>
              );
            }
            return (
              <ul
                key={key}
                className="list-disc pl-6 space-y-2.5 my-5 text-[#5E6488] text-base md:text-lg"
              >
                {block.items.map((item, itemIdx) => (
                  <li
                    key={`${key}-li-${itemIdx}`}
                    className="leading-relaxed pl-1 marker:text-[#7C3AED]"
                  >
                    {renderInline(item, `${key}-li-${itemIdx}`)}
                  </li>
                ))}
              </ul>
            );
          }

          case 'quote': {
            return (
              <blockquote
                key={key}
                className="border-l-4 border-[#7C3AED] bg-[#FAF9FF] pl-5 pr-4 py-3.5 my-6 italic text-[#475569] rounded-r-xl text-base md:text-lg"
              >
                {renderInline(block.text, `${key}-quote`)}
              </blockquote>
            );
          }

          case 'code': {
            return (
              <div
                key={key}
                className="my-6 rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#0F172A] shadow-xs"
              >
                {block.lang && (
                  <div className="px-4 py-1.5 bg-[#1E293B] text-[11px] font-mono font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-[#334155]">
                    {block.lang}
                  </div>
                )}
                <pre className="p-4 overflow-x-auto text-sm font-mono text-[#F8FAFC] leading-relaxed">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
