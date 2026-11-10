import {
  PageSeoInput,
  StructuredPageBlock,
  CreatePageInput,
  UpdatePageInput,
  UpdateToolContentInput,
  ToolHowToStep,
  ToolFeatureItem,
  ToolFaqItem,
  UpdateSettingsInput,
  HeaderNavItem,
  FooterGroupItem,
  FooterLinkItem,
} from './types';
import { getToolBySlug } from '@/lib/tools';
import { normalizeBlock } from '@/lib/cms/blocks';
import {
  sanitizeContainerSettings,
  isSupportedContainerChildType,
  MAX_CONTAINER_DEPTH,
} from '@/lib/cms/container-contract';

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Strict regex for validating raster image data URLs (PNG, JPEG, WebP, GIF).
 * Requires exact MIME type format, optional charset, and strictly valid base64 payload.
 * Rejects SVG, HTML, scripts, deceptive MIME parameters, and malformed structures.
 */
export const RASTER_DATA_URL_REGEX =
  /^data:image\/(png|jpeg|jpg|webp|gif)(?:;charset=[a-zA-Z0-9-]+)?;base64,[a-zA-Z0-9+/=]+$/i;

/**
 * Validates URLs to prevent script injection (XSS) via javascript:, vbscript:, or data: URLs.
 * Strictly permits safe relative URLs, anchor fragments, http/https, mailto, tel, and validated raster data URLs.
 * Rejects SVG data URLs, HTML data URLs, protocol-relative //, backslash authority bypasses (/\\, /\), and dangerous schemes.
 */
export function isSafeUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (trimmed === '') return true;

  // Immediately reject backslash authority bypasses (/\\evil.com, /\evil.com, /path\evil)
  if (trimmed.includes('\\')) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  // Decode entity and control chars for scheme inspection
  const decoded = lower
    .replace(/&#x([0-9a-f]+);?/gi, (_: any, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/gi, (_: any, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '')
    .replace(/&newline;/gi, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');

  // Block dangerous schemes
  if (
    decoded.startsWith('javascript:') ||
    decoded.startsWith('vbscript:')
  ) {
    return false;
  }

  // Explicitly validate supported raster image data URLs with strict structure
  if (decoded.startsWith('data:')) {
    return RASTER_DATA_URL_REGEX.test(trimmed);
  }

  // Allow safe relative URLs (excluding protocol-relative //), #, http, https, mailto, tel
  if (
    (lower.startsWith('/') && !lower.startsWith('//')) ||
    lower.startsWith('#') ||
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return true;
  }

  // Reject malformed or unrecognized protocol strings
  return false;
}

/**
 * Strict destination validation for site navigation items.
 * Allows safe relative internal paths (e.g. '/blog', '/tools/jpg-to-png'), page fragments ('#faq'),
 * and full external URLs ('https://example.com').
 * Explicitly rejects dangerous schemes ('javascript:', 'vbscript:', 'data:', 'file:', 'blob:'),
 * protocol-relative URLs ('//example.com'), backslash authority bypasses, control characters,
 * and unadorned hostnames without scheme.
 */
export function validateNavigationDestination(destination?: string | null): {
  isValid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!destination || typeof destination !== 'string') {
    return { isValid: false, error: 'Navigation destination link is required.' };
  }
  const trimmed = destination.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Navigation destination link cannot be empty.' };
  }

  // Reject backslashes anywhere in the URL (prevents bypasses like /\evil.com, /\\evil.com, https:\\evil.com)
  if (trimmed.includes('\\')) {
    return { isValid: false, error: 'Navigation link destination is unsafe: backslashes are not allowed.' };
  }

  // Check for control characters or null bytes in raw input
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return { isValid: false, error: 'Navigation link destination contains invalid control characters.' };
  }

  // Iteratively inspect decoded representations up to 5 passes to intercept single-, double-,
  // and multiply-encoded bypasses (%252F%252F -> %2F%2F -> //, %255C -> %5C -> \, %2500 -> %00 -> \0,
  // %256A%2561... -> javascript:) while preserving legitimate percent-encoded paths (/search?q=hello%20world).
  let checkStr = trimmed;
  for (let pass = 0; pass < 5; pass++) {
    try {
      const next = decodeURIComponent(checkStr);

      if (next.includes('\\')) {
        return { isValid: false, error: 'Navigation link destination is unsafe: backslashes are not allowed.' };
      }

      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u001F\u007F-\u009F]/.test(next)) {
        return { isValid: false, error: 'Navigation link destination contains invalid control characters.' };
      }

      if (next.startsWith('//') || /^\/(?:\/|\\|%2f|%5c)/i.test(next)) {
        return { isValid: false, error: 'Navigation link destination is unsafe: protocol-relative URLs starting with "//" are not allowed.' };
      }

      const lowerNext = next.toLowerCase();
      if (
        lowerNext.startsWith('javascript:') ||
        lowerNext.startsWith('vbscript:') ||
        lowerNext.startsWith('data:') ||
        lowerNext.startsWith('file:') ||
        lowerNext.startsWith('blob:')
      ) {
        return { isValid: false, error: `Navigation link '${trimmed}' is unsafe or malformed: disallowed URL scheme.` };
      }

      if (next === checkStr) break;
      checkStr = next;
    } catch {
      return { isValid: false, error: 'Navigation link destination contains malformed URI encoding.' };
    }
  }

  const lower = trimmed.toLowerCase();

  // Decode entity and control chars for scheme inspection
  const decoded = lower
    .replace(/&#x([0-9a-f]+);?/gi, (_: any, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/gi, (_: any, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '')
    .replace(/&newline;/gi, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '');

  // Reject dangerous schemes
  if (
    decoded.startsWith('javascript:') ||
    decoded.startsWith('vbscript:') ||
    decoded.startsWith('data:') ||
    decoded.startsWith('file:') ||
    decoded.startsWith('blob:')
  ) {
    return { isValid: false, error: `Navigation link '${trimmed}' is unsafe or malformed: disallowed URL scheme.` };
  }

  // Reject protocol-relative URLs (//example.com) to avoid open redirects
  if (trimmed.startsWith('//')) {
    return { isValid: false, error: 'Navigation link destination is unsafe: protocol-relative URLs starting with "//" are not allowed.' };
  }

  // Allowed internal relative path (starts with / and followed by valid path/query/fragment)
  if (trimmed.startsWith('/')) {
    return { isValid: true, normalized: trimmed };
  }

  // Allowed anchor / fragment link on current page (starts with #)
  if (trimmed.startsWith('#')) {
    return { isValid: true, normalized: trimmed };
  }

  // Allowed external HTTPS or HTTP link
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { isValid: false, error: 'External links must use http or https protocol.' };
      }
      return { isValid: true, normalized: trimmed };
    } catch {
      return { isValid: false, error: `Navigation link '${trimmed}' is invalid or malformed.` };
    }
  }

  // Allowed mailto: or tel: links
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return { isValid: true, normalized: trimmed };
  }

  return {
    isValid: false,
    error: "Destination must be a relative path (e.g. '/blog'), anchor (e.g. '#faq'), or full URL (e.g. 'https://...').",
  };
}

/**
 * Validates a navigation item label.
 * Strips HTML tags and enforces non-empty string under 60 characters.
 */
export function validateNavigationLabel(label?: string | null): {
  isValid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!label || typeof label !== 'string') {
    return { isValid: false, error: 'Navigation item label is required.' };
  }
  const stripped = label.replace(/<[^>]*>/g, '').trim();
  if (!stripped) {
    return { isValid: false, error: 'Navigation item label cannot be empty.' };
  }
  if (stripped.length > 60) {
    return { isValid: false, error: 'Navigation item label cannot exceed 60 characters.' };
  }
  return { isValid: true, normalized: stripped };
}

export interface NavigationItemValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  sanitized?: HeaderNavItem;
}

/**
 * Validates and sanitizes a complete navigation item input object.
 */
export function validateNavigationItem(input: any): NavigationItemValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: [{ field: 'root', message: 'Navigation item must be an object.' }] };
  }

  const labelResult = validateNavigationLabel(input.label);
  if (!labelResult.isValid) {
    errors.push({ field: 'label', message: labelResult.error! });
  }

  const rawDest = input.destination !== undefined ? input.destination : input.href;
  const destResult = validateNavigationDestination(rawDest);
  if (!destResult.isValid) {
    errors.push({ field: 'href', message: destResult.error! });
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const normalizedDest = destResult.normalized!;
  const isExternal = Boolean(
    input.isExternal ||
    input.openNewTab ||
    normalizedDest.startsWith('http://') ||
    normalizedDest.startsWith('https://')
  );

  const sanitized: HeaderNavItem = {
    id: typeof input.id === 'string' && input.id.trim() ? input.id.trim() : `nav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    label: labelResult.normalized!,
    href: normalizedDest,
    order: typeof input.order === 'number' && !isNaN(input.order) ? input.order : 0,
    visible: input.visible !== false,
    openNewTab: Boolean(input.openNewTab),
    isExternal,
  };

  return { isValid: true, errors: [], sanitized };
}

/**
 * Sanitizes rich text HTML by removing malicious tags, attributes, event handlers, and javascript URLs.
 */
export function sanitizeRichTextHtml(rawHtml?: string | null): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let sanitized = rawHtml;

  // 1. Recursively remove paired dangerous tags and their content until fixed point
  let prev: string;
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/<\s*(script|iframe|object|embed|applet|style|form|input|button)[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  } while (sanitized !== prev);

  // 1b. Remove any remaining unclosed or orphaned dangerous tags
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/<\s*(script|iframe|object|embed|applet|style|form|input|button)\b[^>]*\/?>/gi, '');
    sanitized = sanitized.replace(/<\s*\/\s*(script|iframe|object|embed|applet|style|form|input|button)\s*>/gi, '');
  } while (sanitized !== prev);

  // 2. Remove inline event handlers (onload, onerror, onclick, onmouseover, etc.)
  // Handles whitespace and solidus (/) attribute delimiters, e.g. <img/onerror=alert(1)>
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/(?:[\s/]+)on[a-zA-Z0-9_-]+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, ' ');
    sanitized = sanitized.replace(/(?:[\s/]+)on[a-zA-Z0-9_-]+\s*(?=[>/\s])/gi, ' ');
  } while (sanitized !== prev);

  // 3. Remove dangerous URL schemes in attributes (quoted, unquoted, entity-encoded, solidus-separated)
  sanitized = sanitized.replace(
    /(?:[\s/]+)(href|src|cite|poster|background|action|formaction)\s*=\s*(?:(["'])([\s\S]*?)\2|([^\s>]+))/gi,
    (match, attr, _quote, quotedVal, unquotedVal) => {
      const urlValue = (quotedVal !== undefined ? quotedVal : (unquotedVal || '')).trim();
      if (!isSafeUrl(urlValue)) {
        return ` ${attr}="#"`;
      }
      return match;
    }
  );

  // 4. Remove dangerous URL schemes in markdown links and images: [label](url) and ![alt](url)
  sanitized = sanitized.replace(
    /(!?\[[^\]\r\n]*\])\(((?:[^()\r\n]|\((?:[^()\r\n]|\([^()\r\n]*\))*\))*)\)/g,
    (match, label, rawUrl) => {
      const urlValue = rawUrl.trim();
      if (!isSafeUrl(urlValue)) {
        return `${label}(#)`;
      }
      return match;
    }
  );

  return sanitized;
}

/**
 * Comprehensive HTML sanitizer for Custom HTML CMS blocks.
 * Protects against XSS, DOM-based attacks, malicious embeds, and script injections
 * while preserving safe layout structures, tables, headings, paragraphs, lists, links, images, and semantic tags.
 *
 * Deterministic: Produces character-for-character identical output across SSR (Node.js) and CSR (Browser),
 * preventing React hydration mismatches. Document-level elements (<title>, <head>, <html>, <body>, <meta>, <!doctype>)
 * are safely handled or stripped so only safe body fragments are rendered.
 */
export function sanitizeCustomHtml(rawHtml?: string | null): string {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  let sanitized = rawHtml;

  // 1. Strip document-level metadata and DOCTYPE tags completely
  // These belong only in the root HTML document (<head>), never in CMS body fragments.
  // When parsed in browsers, <title> or <head> tags are moved by DOMParser into document.head,
  // causing client-rendered body HTML to differ from server-rendered body HTML (hydration mismatch).
  sanitized = sanitized.replace(/<!doctype[^>]*>/gi, '');
  sanitized = sanitized.replace(/<\s*title\b[^>]*>[\s\S]*?<\s*\/\s*title\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*title\b[^>]*\/?>/gi, '');
  sanitized = sanitized.replace(/<\s*head\b[^>]*>[\s\S]*?<\s*\/\s*head\s*>/gi, '');
  sanitized = sanitized.replace(/<\s*head\b[^>]*\/?>/gi, '');

  // Strip document wrapper tags (html, body) while preserving their inner content
  sanitized = sanitized.replace(/<\s*\/?\s*(html|body)\b[^>]*>/gi, '');

  // 2. Recursive removal of dangerous elements and tags until fixed point
  // Eliminates nested evasion attempts such as <scr<script>ipt> or <iframe src=...
  const dangerousTags = [
    'script',
    'iframe',
    'frame',
    'frameset',
    'object',
    'embed',
    'applet',
    'style',
    'link',
    'meta',
    'base',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'svg',
    'math',
    'template',
    'dialog',
  ];

  const tagPattern = new RegExp(
    `<\\s*(${dangerousTags.join('|')})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`,
    'gi'
  );
  const selfClosingPattern = new RegExp(
    `<\\s*(${dangerousTags.join('|')})\\b[^>]*\\/?>`,
    'gi'
  );

  let prev: string;
  do {
    prev = sanitized;
    sanitized = sanitized.replace(tagPattern, '');
    sanitized = sanitized.replace(selfClosingPattern, '');
  } while (sanitized !== prev);

  // 3. Strip CDATA sections and HTML comments to prevent comment-hiding attacks
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/gi, '');
    sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '');
  } while (sanitized !== prev);

  // 4. Recursive removal of inline event handlers (on* attributes like onerror, onload, onclick, ontoggle)
  // Handles quoted, unquoted, whitespace-separated, solidus-separated (/), and newline variations
  do {
    prev = sanitized;
    sanitized = sanitized.replace(/(?:[\s/]+)on[a-zA-Z0-9_-]+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, ' ');
    sanitized = sanitized.replace(/(?:[\s/]+)on[a-zA-Z0-9_-]+\s*(?=[>/\s])/gi, ' ');
  } while (sanitized !== prev);

  // 5. Sanitize dangerous URL schemes in attributes (href, src, cite, poster, background, action, formaction)
  // Strips javascript:, vbscript:, and unsafe data: (including entity-encoded, unquoted, and solidus-separated variations)
  sanitized = sanitized.replace(
    /(?:[\s/]+)(href|src|cite|poster|background|action|formaction)\s*=\s*(?:(["'])([\s\S]*?)\2|([^\s>]+))/gi,
    (match, attr, _quote, quotedVal, unquotedVal) => {
      const urlValue = quotedVal !== undefined ? quotedVal : (unquotedVal || '');
      // Decode HTML entities and strip whitespace/control chars for safe comparison
      const decoded = urlValue
        .replace(/&#x([0-9a-f]+);?/gi, (_: any, hex: string) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);?/gi, (_: any, dec: string) => String.fromCharCode(parseInt(dec, 10)))
        .replace(/&colon;/gi, ':')
        .replace(/&tab;/gi, '')
        .replace(/&newline;/gi, '')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '')
        .toLowerCase();

      const isDangerousData =
        decoded.startsWith('data:') &&
        !RASTER_DATA_URL_REGEX.test(urlValue.trim());

      if (
        decoded.startsWith('javascript:') ||
        decoded.startsWith('vbscript:') ||
        isDangerousData
      ) {
        return ` ${attr}="#"`;
      }
      return match;
    }
  );

  // 6. Sanitize style attributes (remove expression(), url(), -moz-binding, @import, behavior)
  sanitized = sanitized.replace(
    /\s+style\s*=\s*(["'])([\s\S]*?)\1/gi,
    (match, quote, styleContent) => {
      const cleanStyle = styleContent
        .replace(/expression\s*\([^)]*\)/gi, '')
        .replace(/url\s*\(\s*["']?\s*javascript:[^)]*\)/gi, '')
        .replace(/url\s*\([^)]*\)/gi, 'none')
        .replace(/@import\s+[^;]+;/gi, '')
        .replace(/-moz-binding\s*:[^;]+;/gi, '')
        .replace(/behavior\s*:[^;]+;/gi, '');

      return ` style=${quote}${cleanStyle}${quote}`;
    }
  );

  // 7. Ensure target="_blank" links have rel="noopener noreferrer" deterministically
  sanitized = sanitized.replace(
    /<a\b([^>]*\btarget\s*=\s*["']_blank["'][^>]*)>/gi,
    (match, attrs) => {
      if (!/rel\s*=/i.test(attrs)) {
        return `<a${attrs} rel="noopener noreferrer">`;
      }
      return match;
    }
  );

  return sanitized.trim();
}

/**
 * Extracts <style> tag contents from HTML and returns cleaned HTML and combined CSS.
 * Allows editors to paste HTML containing <style> tags without breaking the layout
 * or losing styles, separating them into scoped CSS.
 */
export function extractStylesFromHtml(rawHtml?: string | null): { html: string; extractedCss: string } {
  if (!rawHtml || typeof rawHtml !== 'string') return { html: '', extractedCss: '' };

  const extractedStyles: string[] = [];
  const cleanHtml = rawHtml.replace(/<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi, (_, cssContent) => {
    if (cssContent && cssContent.trim()) {
      extractedStyles.push(cssContent.trim());
    }
    return '';
  });

  return {
    html: cleanHtml.trim(),
    extractedCss: extractedStyles.join('\n\n'),
  };
}

/**
 * Helper to scope a CSS selector string to a specific container ID or class.
 */
function scopeCssSelector(selector: string, scopePrefix: string): string {
  const parts: string[] = [];
  let current = '';
  let parenDepth = 0;

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (char === '(') parenDepth++;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);

    if (char === ',' && parenDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }

  const scopedParts = parts.map((part) => {
    const trimmed = part.trim();
    if (!trimmed) return '';

    // If selector targets :root, html, or body, redirect to scopePrefix
    if (/^(:root|html|body)\b/i.test(trimmed)) {
      return trimmed.replace(/^(:root|html|body)\b/i, scopePrefix);
    }

    // If already starts with the scope prefix, do not duplicate
    if (trimmed.startsWith(scopePrefix)) {
      return trimmed;
    }

    // Otherwise, prefix selector with scopePrefix
    return `${scopePrefix} ${trimmed}`;
  });

  return scopedParts.filter(Boolean).join(', ');
}

/**
 * Sanitizes and scopes custom CSS to a block ID container (e.g. #custom-html-blk-123).
 * Prevents styles from leaking to header, footer, editor, or neighboring blocks.
 * Neutralizes @import, external url() tracking, expressions, and angle brackets.
 */
export function scopeAndSanitizeCss(rawCss?: string | null, scopeId?: string): string {
  if (!rawCss || typeof rawCss !== 'string') return '';
  const scopePrefix = scopeId ? (scopeId.startsWith('#') ? scopeId : `#${scopeId}`) : '.custom-html-block';

  // 1. Sanitize raw CSS
  let sanitized = rawCss;

  // Remove HTML comments <!-- ... --> and CDATA
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/gi, '');
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '');

  // Remove any tag-like sequences < ... > and standalone angle brackets
  sanitized = sanitized.replace(/<[^>]*>/gi, '');
  sanitized = sanitized.replace(/[<>]/g, '');

  // Remove @import to prevent unauthorized external CSS loading
  sanitized = sanitized.replace(/@import\s+[^;]+;/gi, '');

  // Remove expressions and legacy script injections
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/-moz-binding\s*:[^;]+;/gi, '');
  sanitized = sanitized.replace(/behavior\s*:[^;]+;/gi, '');

  // Remove/neutralize url() functions to prevent external asset tracking or javascript: injection
  sanitized = sanitized.replace(/url\s*\([^)]*\)/gi, 'none');

  // 2. Parse and scope selectors
  let result = '';
  let i = 0;
  const len = sanitized.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && /\s/.test(sanitized[i])) i++;
    if (i >= len) break;

    // Read until '{'
    const openBrace = sanitized.indexOf('{', i);
    if (openBrace === -1) {
      break;
    }

    const header = sanitized.substring(i, openBrace).trim();
    i = openBrace + 1;

    if (header.startsWith('@media') || header.startsWith('@supports')) {
      // Find matching closing brace for this at-rule block
      let depth = 1;
      const atRuleBodyStart = i;
      while (i < len && depth > 0) {
        if (sanitized[i] === '{') depth++;
        else if (sanitized[i] === '}') depth--;
        i++;
      }
      const atRuleBody = sanitized.substring(atRuleBodyStart, i - 1);
      const scopedInner = scopeAndSanitizeCss(atRuleBody, scopeId);
      if (scopedInner.trim()) {
        result += `${header} {\n  ${scopedInner.replace(/\n/g, '\n  ')}\n}\n`;
      }
    } else if (header.startsWith('@keyframes') || header.startsWith('@-webkit-keyframes')) {
      // Keyframe animations: preserve keyframe stops as-is
      let depth = 1;
      const kfBodyStart = i;
      while (i < len && depth > 0) {
        if (sanitized[i] === '{') depth++;
        else if (sanitized[i] === '}') depth--;
        i++;
      }
      const kfBody = sanitized.substring(kfBodyStart, i - 1);
      result += `${header} {\n  ${kfBody.trim()}\n}\n`;
    } else {
      // Regular CSS rule
      const closeBrace = sanitized.indexOf('}', i);
      if (closeBrace === -1) break;
      const declarations = sanitized.substring(i, closeBrace).trim();
      i = closeBrace + 1;

      if (header && declarations) {
        const scopedHeader = scopeCssSelector(header, scopePrefix);
        result += `${scopedHeader} {\n  ${declarations}\n}\n`;
      }
    }
  }

  return result.trim();
}


/**
 * Sanitizes custom CSS to prevent style tag escaping, script injection, and expression attacks.
 */
export function sanitizeCustomCss(rawCss?: string | null): string {
  if (!rawCss || typeof rawCss !== 'string') return '';

  let sanitized = rawCss;

  // 1. Remove HTML comments <!-- ... --> and CDATA sections
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/gi, '');
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '');

  // 2. Remove any tag-like sequences < ... > regardless of whitespace or tag name (handles </style>, </StYlE>, <svg/onload=...>)
  sanitized = sanitized.replace(/<[^>]*>/gi, '');

  // 3. Remove remaining standalone < or > angle brackets to prevent tag reconstruction
  sanitized = sanitized.replace(/[<>]/g, '');

  // 4. Remove legacy IE expression() calls and javascript: URLs in CSS
  sanitized = sanitized.replace(/expression\s*\([^)]*\)/gi, '');
  sanitized = sanitized.replace(/url\s*\(\s*["']?\s*javascript:[^)]*\)/gi, 'url()');

  // 5. Remove @import rules to prevent unauthorized external CSS loading
  sanitized = sanitized.replace(/@import\s+[^;]+;/gi, '');

  return sanitized.trim();
}

/**
 * Validates JSON-LD input ensuring it is parseable JSON and contains no executable code or injection.
 */
export function validateJsonLd(rawJson: unknown): { isValid: boolean; error?: string; parsed?: Record<string, any> } {
  if (!rawJson) return { isValid: true, parsed: undefined };

  let parsed: Record<string, any>;
  if (typeof rawJson === 'string') {
    const trimmed = rawJson.trim();
    if (!trimmed) return { isValid: true, parsed: undefined };

    // Check for obvious script injection attempts
    if (/<script/i.test(trimmed) || /javascript:/i.test(trimmed)) {
      return { isValid: false, error: 'JSON-LD cannot contain script tags or javascript: schemes.' };
    }

    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { isValid: false, error: 'Malformed JSON syntax in structured data.' };
    }
  } else if (typeof rawJson === 'object' && rawJson !== null) {
    parsed = rawJson as Record<string, any>;
    const stringified = JSON.stringify(parsed);
    if (/<script/i.test(stringified) || /javascript:/i.test(stringified)) {
      return { isValid: false, error: 'JSON-LD cannot contain script tags or javascript: schemes.' };
    }
  } else {
    return { isValid: false, error: 'JSON-LD must be an object or valid JSON string.' };
  }

  return { isValid: true, parsed };
}

/**
 * Validates SEO metadata fields and produces errors (blocking) and warnings (informational).
 */
export function validateSeo(seo?: PageSeoInput | null): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!seo) {
    return { isValid: true, errors, warnings };
  }

  // SEO Title checks
  if (seo.seoTitle) {
    const titleLen = seo.seoTitle.trim().length;
    if (titleLen < 10) {
      warnings.push({
        field: 'seoTitle',
        message: 'SEO title is shorter than 10 characters. Consider making it more descriptive.',
      });
    } else if (titleLen > 70) {
      warnings.push({
        field: 'seoTitle',
        message: 'SEO title exceeds 70 characters and may be truncated by search engines.',
      });
    }
  } else {
    warnings.push({
      field: 'seoTitle',
      message: 'No custom SEO title configured; default site title will be used.',
    });
  }

  // Meta Description checks
  if (seo.metaDescription) {
    const descLen = seo.metaDescription.trim().length;
    if (descLen < 50) {
      warnings.push({
        field: 'metaDescription',
        message: 'Meta description is under 50 characters. Aim for 50-160 characters.',
      });
    } else if (descLen > 160) {
      warnings.push({
        field: 'metaDescription',
        message: 'Meta description exceeds 160 characters and may be clipped in search snippets.',
      });
    }
  } else {
    warnings.push({
      field: 'metaDescription',
      message: 'No meta description configured; a generic fallback will be used.',
    });
  }

  // Canonical URL check
  if (seo.canonicalUrl) {
    if (!isSafeUrl(seo.canonicalUrl)) {
      errors.push({
        field: 'canonicalUrl',
        message: 'Canonical URL must be a valid http, https, or relative URL.',
      });
    }
  }

  // Open Graph & Twitter image URLs
  if (seo.ogImage && !isSafeUrl(seo.ogImage)) {
    errors.push({ field: 'ogImage', message: 'OG Image URL must be a valid, safe URL.' });
  }
  if (seo.twitterImage && !isSafeUrl(seo.twitterImage)) {
    errors.push({ field: 'twitterImage', message: 'Twitter Image URL must be a valid, safe URL.' });
  }

  // JSON-LD validation
  if (seo.schemaJson) {
    const jsonLdCheck = validateJsonLd(seo.schemaJson);
    if (!jsonLdCheck.isValid && jsonLdCheck.error) {
      errors.push({ field: 'schemaJson', message: jsonLdCheck.error });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates a structured block and sanitizes text/HTML fields.
 */
export function validateAndSanitizeBlock(block: any, currentDepth = 0): {
  isValid: boolean;
  block?: any;
  sanitizedBlock?: any;
  error?: string;
  errors: string[];
} {
  const fail = (msg: string) => ({ isValid: false, error: msg, errors: [msg] });

  if (!block || typeof block !== 'object') {
    return fail('Block must be an object.');
  }

  // Normalize block into standard UniversalContentBlock structure with legacy root fields
  const normalized = normalizeBlock(block, 0, currentDepth);
  const type = normalized.type;
  const content = normalized.content || {};

  // Check CTA/Link/Image URL safety
  if (type === 'cta' || type === 'link') {
    const href = String(content.href || normalized.href || '').trim();
    if (href && !isSafeUrl(href)) {
      return fail(`Unsafe URL detected in ${type}: ${href}`);
    }
    content.href = href || '#';

    // Also check secondaryHref on cta
    if (type === 'cta') {
      const secondaryHref = String(content.secondaryHref || normalized.secondaryHref || '').trim();
      if (secondaryHref && !isSafeUrl(secondaryHref)) {
        return fail(`Unsafe secondary URL detected in cta: ${secondaryHref}`);
      }
      if (secondaryHref) {
        content.secondaryHref = secondaryHref;
      }
    }
  }

  if (type === 'pricing') {
    const buttonHref = String(content.buttonHref || normalized.buttonHref || '').trim();
    if (buttonHref && !isSafeUrl(buttonHref)) {
      return fail(`Unsafe button URL detected in pricing: ${buttonHref}`);
    }
    if (buttonHref) content.buttonHref = buttonHref;
  }

  if (type === 'popular_tools') {
    const exploreHref = String(content.exploreHref || normalized.exploreHref || '').trim();
    if (exploreHref && !isSafeUrl(exploreHref)) {
      return fail(`Unsafe explore URL detected in popular_tools: ${exploreHref}`);
    }
    if (exploreHref) content.exploreHref = exploreHref;
  }

  if (type === 'hubs') {
    const imageHubHref = String(content.imageHubHref || normalized.imageHubHref || '').trim();
    if (imageHubHref && !isSafeUrl(imageHubHref)) {
      return fail(`Unsafe image hub URL detected in hubs: ${imageHubHref}`);
    }
    const pdfHubHref = String(content.pdfHubHref || normalized.pdfHubHref || '').trim();
    if (pdfHubHref && !isSafeUrl(pdfHubHref)) {
      return fail(`Unsafe PDF hub URL detected in hubs: ${pdfHubHref}`);
    }
  }

  if (type === 'image') {
    const src = String(content.src || normalized.src || '').trim();
    if (src && !isSafeUrl(src)) {
      return fail(`Unsafe Image URL detected: ${src}`);
    }
    content.src = src || '';
  }

  // HTML Sanitization for rich text and intro
  if ((type === 'rich_text' || type === 'intro') && (content.html !== undefined || normalized.html !== undefined)) {
    content.html = sanitizeRichTextHtml(content.html || normalized.html || '');
  }

  // Custom HTML block validation
  if (type === 'custom_html') {
    if (content.html !== undefined && typeof content.html !== 'string') {
      return fail('Custom HTML content must be a string.');
    }
    let rawHtml = String(content.html !== undefined ? content.html : (normalized.html || ''));
    let rawCss = String(content.css !== undefined ? content.css : (normalized.css || ''));

    // If HTML contains <style> tags, extract them into rawCss so they are scoped and preserved
    if (/<style\b/i.test(rawHtml)) {
      const extracted = extractStylesFromHtml(rawHtml);
      rawHtml = extracted.html;
      if (extracted.extractedCss) {
        rawCss = rawCss ? `${rawCss}\n\n${extracted.extractedCss}` : extracted.extractedCss;
      }
    }

    if (rawHtml.length > 200000) {
      return fail('Custom HTML exceeds maximum allowed length of 200,000 characters (200KB).');
    }
    if (rawCss.length > 50000) {
      return fail('Custom CSS exceeds maximum allowed length of 50,000 characters.');
    }

    content.html = sanitizeCustomHtml(rawHtml);
    content.css = rawCss ? scopeAndSanitizeCss(rawCss, `custom-html-${normalized.id}`) : '';
    if (content.caption || normalized.caption) {
      content.caption = String(content.caption || normalized.caption || '').replace(/<[^>]*>/g, '').trim();
    }
  }

  // Container block validation & recursive child validation
  if (type === 'container') {
    if (currentDepth > MAX_CONTAINER_DEPTH) {
      return fail(`Container nesting depth cannot exceed ${MAX_CONTAINER_DEPTH}.`);
    }

    normalized.settings = sanitizeContainerSettings(normalized.settings || content.settings);
    content.settings = { ...normalized.settings };

    const rawChildBlocks = Array.isArray(block.content?.blocks)
      ? block.content.blocks
      : Array.isArray(block.content?.children)
      ? block.content.children
      : Array.isArray(block.blocks)
      ? block.blocks
      : Array.isArray(block.children)
      ? block.children
      : Array.isArray(content.blocks)
      ? content.blocks
      : Array.isArray(normalized.blocks)
      ? normalized.blocks
      : [];

    const sanitizedChildBlocks: any[] = [];
    for (let i = 0; i < rawChildBlocks.length; i++) {
      const child = rawChildBlocks[i];
      if (!child || typeof child !== 'object') {
        return fail(`Invalid child block [${i}] in container.`);
      }
      const childType = String(child.type || '').toLowerCase();
      const support = isSupportedContainerChildType(childType, currentDepth + 1);
      if (!support.supported) {
        return fail(`Invalid child block [${i}] in container: ${support.reason || 'Unsupported child block type.'}`);
      }

      const childRes = validateAndSanitizeBlock(child, currentDepth + 1);
      if (!childRes.isValid || !childRes.block) {
        return fail(`Error in container child block [${i}]: ${childRes.error || 'Invalid child block structure.'}`);
      }
      sanitizedChildBlocks.push(childRes.block);
    }

    content.blocks = sanitizedChildBlocks;
    normalized.blocks = sanitizedChildBlocks;
    normalized.children = sanitizedChildBlocks;
  }

  // Sync content back to root properties for backward-compatible rendering
  for (const [key, value] of Object.entries(content)) {
    normalized[key] = value;
  }

  return {
    isValid: true,
    block: normalized,
    sanitizedBlock: normalized,
    errors: [],
  };
}

/**
 * Validates page input (create or update) and sanitizes blocks.
 */
export function validatePagePayload(
  input: CreatePageInput | UpdatePageInput
): {
  isValid: boolean;
  sanitizedBlocks: StructuredPageBlock[];
  report: ValidationReport;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const sanitizedBlocks: StructuredPageBlock[] = [];

  // Slug check if present
  if ('slug' in input && input.slug !== undefined) {
    const slug = input.slug.trim();
    if (!slug) {
      errors.push({ field: 'slug', message: 'URL slug cannot be empty.' });
    } else if (!/^[a-z0-9-_]+$/i.test(slug)) {
      errors.push({
        field: 'slug',
        message: 'URL slug must only contain letters, numbers, hyphens, and underscores.',
      });
    }
  }

  // Name check if present
  if (input.name !== undefined && !input.name.trim()) {
    errors.push({ field: 'name', message: 'Page name cannot be empty.' });
  }

  // Blocks check
  if (input.blocks && Array.isArray(input.blocks)) {
    for (let i = 0; i < input.blocks.length; i++) {
      const b = input.blocks[i];
      const validated = validateAndSanitizeBlock(b);
      if (!validated.isValid || !validated.block) {
        errors.push({
          field: `blocks[${i}]`,
          message: validated.error || 'Invalid block structure.',
        });
      } else {
        sanitizedBlocks.push(validated.block);
      }
    }
  }

  // SEO check
  const seoReport = validateSeo(input.seo);
  errors.push(...seoReport.errors);
  warnings.push(...seoReport.warnings);

  // Custom CSS sanitization
  if (input.customCss !== undefined && input.customCss !== null) {
    input.customCss = sanitizeCustomCss(input.customCss);
  }

  return {
    isValid: errors.length === 0,
    sanitizedBlocks,
    report: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

/**
 * Validates tool content and SEO input, checking limits, formatting, and canonical references.
 */
export function validateToolPayload(
  slug: string,
  input: UpdateToolContentInput
): {
  isValid: boolean;
  sanitized: {
    customTitle?: string | null;
    customH1?: string | null;
    customIntro?: string | null;
    customDescription?: string | null;
    customValueProp?: string | null;
    customHowTo?: ToolHowToStep[] | null;
    customFeatures?: ToolFeatureItem[] | null;
    customFaq?: ToolFaqItem[] | null;
    customRelatedTools?: string[] | null;
    blocks?: any[] | null;
  };
  report: ValidationReport;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 1. Slug check against canonical registry
  const canonical = getToolBySlug(slug);
  if (!canonical) {
    errors.push({ field: 'slug', message: `Tool with slug '${slug}' not found in canonical registry.` });
  }

  // 2. Length limits on basic content fields
  if (input.customTitle && input.customTitle.length > 200) {
    errors.push({ field: 'customTitle', message: 'Title exceeds maximum length of 200 characters.' });
  }
  if (input.customH1 && input.customH1.length > 200) {
    errors.push({ field: 'customH1', message: 'H1 exceeds maximum length of 200 characters.' });
  }
  if (input.customDescription && input.customDescription.length > 1000) {
    errors.push({ field: 'customDescription', message: 'Description exceeds maximum length of 1000 characters.' });
  }
  if (input.customIntro && input.customIntro.length > 3000) {
    errors.push({ field: 'customIntro', message: 'Intro exceeds maximum length of 3000 characters.' });
  }
  if (input.customValueProp && input.customValueProp.length > 1000) {
    errors.push({ field: 'customValueProp', message: 'Value proposition exceeds maximum length of 1000 characters.' });
  }

  // 3. How-to steps validation
  let sanitizedHowTo: ToolHowToStep[] | null = null;
  if (input.customHowTo !== undefined && input.customHowTo !== null) {
    if (!Array.isArray(input.customHowTo)) {
      errors.push({ field: 'customHowTo', message: 'How-to must be an array of steps.' });
    } else {
      sanitizedHowTo = [];
      for (let i = 0; i < input.customHowTo.length; i++) {
        const step = input.customHowTo[i];
        if (!step || typeof step !== 'object') {
          errors.push({ field: `customHowTo[${i}]`, message: 'Step must be an object with title and description.' });
          continue;
        }
        const title = String(step.title || '').trim();
        const description = String(step.description || '').trim();
        if (!title) {
          errors.push({ field: `customHowTo[${i}].title`, message: 'Step title is required.' });
        }
        if (!description) {
          errors.push({ field: `customHowTo[${i}].description`, message: 'Step description is required.' });
        }
        sanitizedHowTo.push({ title, description });
      }
    }
  }

  // 4. Features validation
  let sanitizedFeatures: ToolFeatureItem[] | null = null;
  if (input.customFeatures !== undefined && input.customFeatures !== null) {
    if (!Array.isArray(input.customFeatures)) {
      errors.push({ field: 'customFeatures', message: 'Features must be an array of items.' });
    } else {
      sanitizedFeatures = [];
      for (let i = 0; i < input.customFeatures.length; i++) {
        const feat = input.customFeatures[i];
        if (!feat || typeof feat !== 'object') {
          errors.push({ field: `customFeatures[${i}]`, message: 'Feature must be an object with title and description.' });
          continue;
        }
        const title = String(feat.title || '').trim();
        const description = String(feat.description || '').trim();
        if (!title) {
          errors.push({ field: `customFeatures[${i}].title`, message: 'Feature title is required.' });
        }
        if (!description) {
          errors.push({ field: `customFeatures[${i}].description`, message: 'Feature description is required.' });
        }
        sanitizedFeatures.push({ title, description });
      }
    }
  }

  // 5. FAQ validation
  let sanitizedFaq: ToolFaqItem[] | null = null;
  if (input.customFaq !== undefined && input.customFaq !== null) {
    if (!Array.isArray(input.customFaq)) {
      errors.push({ field: 'customFaq', message: 'FAQ must be an array of questions and answers.' });
    } else {
      sanitizedFaq = [];
      const seenQuestions = new Set<string>();
      for (let i = 0; i < input.customFaq.length; i++) {
        const item = input.customFaq[i];
        if (!item || typeof item !== 'object') {
          errors.push({ field: `customFaq[${i}]`, message: 'FAQ item must be an object.' });
          continue;
        }
        const question = String(item.question || '').trim();
        const answer = String(item.answer || '').trim();
        if (!question) {
          errors.push({ field: `customFaq[${i}].question`, message: 'FAQ question is required.' });
        }
        if (!answer) {
          errors.push({ field: `customFaq[${i}].answer`, message: 'FAQ answer is required.' });
        }
        const normQ = question.toLowerCase();
        if (seenQuestions.has(normQ)) {
          warnings.push({ field: `customFaq[${i}]`, message: `Duplicate question: "${question}"` });
        } else {
          seenQuestions.add(normQ);
        }
        sanitizedFaq.push({ question, answer });
      }
    }
  }

  // 6. Related Tools validation: only canonical slugs, no self-reference, no duplicates
  let sanitizedRelatedTools: string[] | null = null;
  if (input.customRelatedTools !== undefined && input.customRelatedTools !== null) {
    if (!Array.isArray(input.customRelatedTools)) {
      errors.push({ field: 'customRelatedTools', message: 'Related tools must be an array of slugs.' });
    } else {
      sanitizedRelatedTools = [];
      const seenSlugs = new Set<string>();
      for (let i = 0; i < input.customRelatedTools.length; i++) {
        const relSlug = String(input.customRelatedTools[i] || '').trim();
        if (!relSlug) continue;
        if (relSlug === slug) {
          errors.push({ field: `customRelatedTools[${i}]`, message: 'Tool cannot reference itself as a related tool.' });
          continue;
        }
        if (!getToolBySlug(relSlug)) {
          errors.push({ field: `customRelatedTools[${i}]`, message: `'${relSlug}' is not one of the 25 canonical tools.` });
          continue;
        }
        if (seenSlugs.has(relSlug)) {
          warnings.push({ field: `customRelatedTools[${i}]`, message: `Duplicate related tool '${relSlug}' ignored.` });
        } else {
          seenSlugs.add(relSlug);
          sanitizedRelatedTools.push(relSlug);
        }
      }
    }
  }

  // 7. SEO validation
  if (input.seo) {
    const seoReport = validateSeo(input.seo);
    errors.push(...seoReport.errors);
    warnings.push(...seoReport.warnings);

    if (input.seo.canonicalUrl) {
      const cUrl = input.seo.canonicalUrl.trim();
      if (!isSafeUrl(cUrl)) {
        errors.push({ field: 'seo.canonicalUrl', message: 'Canonical URL contains an unsafe scheme.' });
      }
    }
  }

  // 8. Content Blocks validation
  let sanitizedBlocks: any[] | null = null;
  if (input.blocks !== undefined && input.blocks !== null) {
    if (!Array.isArray(input.blocks)) {
      errors.push({ field: 'blocks', message: 'Blocks must be an array.' });
    } else {
      sanitizedBlocks = [];
      for (let i = 0; i < input.blocks.length; i++) {
        const b = input.blocks[i];
        const validated = validateAndSanitizeBlock(b);
        if (!validated.isValid) {
          errors.push({ field: `blocks[${i}]`, message: validated.error || 'Invalid block structure.' });
        } else {
          sanitizedBlocks.push(validated.block);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized: {
      customTitle: input.customTitle ? input.customTitle.trim() : input.customTitle,
      customH1: input.customH1 ? input.customH1.trim() : input.customH1,
      customIntro: input.customIntro ? input.customIntro.trim() : input.customIntro,
      customDescription: input.customDescription ? input.customDescription.trim() : input.customDescription,
      customValueProp: input.customValueProp ? input.customValueProp.trim() : input.customValueProp,
      customHowTo: sanitizedHowTo,
      customFeatures: sanitizedFeatures,
      customFaq: sanitizedFaq,
      customRelatedTools: sanitizedRelatedTools,
      blocks: sanitizedBlocks,
    },
    report: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

/**
 * Validates Blog Post creation and update payloads.
 * Strips malicious scripts/iframes, checks safe URLs, and validates SEO.
 */
export function validateBlogPostPayload(input: {
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content?: string;
  featuredImage?: string | null;
  featuredImageAlt?: string | null;
  status?: string;
  scheduledFor?: string | Date | null;
  seo?: PageSeoInput;
}): {
  isValid: boolean;
  sanitized: {
    title: string;
    slug?: string;
    excerpt?: string | null;
    content: string;
    featuredImage?: string | null;
    featuredImageAlt?: string | null;
  };
  report: ValidationReport;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // 1. Title validation
  const title = (input.title || '').trim();
  if (!title) {
    errors.push({ field: 'title', message: 'Blog post title is required.' });
  } else if (title.length > 200) {
    errors.push({ field: 'title', message: 'Title cannot exceed 200 characters.' });
  }

  // 2. Slug validation
  let slug: string | undefined = undefined;
  if (input.slug !== undefined) {
    const rawSlug = input.slug.trim();
    if (!rawSlug && title) {
      slug = title.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    } else {
      slug = rawSlug.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
    if (slug.length > 120) {
      errors.push({ field: 'slug', message: 'Slug cannot exceed 120 characters.' });
    }
  }

  // 3. Excerpt validation
  let excerpt: string | null = null;
  if (input.excerpt) {
    excerpt = input.excerpt.trim();
    if (excerpt.length > 500) {
      warnings.push({ field: 'excerpt', message: 'Excerpt is longer than recommended 500 characters.' });
    }
  }

  // 4. Content sanitization
  const rawContent = input.content || '';
  const sanitizedContent = sanitizeRichTextHtml(rawContent);

  // 5. Featured Image URL safety
  let featuredImage: string | null = null;
  if (input.featuredImage) {
    const imgUrl = input.featuredImage.trim();
    if (imgUrl) {
      if (!isSafeUrl(imgUrl)) {
        errors.push({ field: 'featuredImage', message: 'Featured image URL contains an unsafe scheme.' });
      } else {
        featuredImage = imgUrl;
      }
    }
  }

  const featuredImageAlt = input.featuredImageAlt ? input.featuredImageAlt.trim().slice(0, 200) : null;

  // 6. Scheduled Date validation
  if (input.scheduledFor) {
    const d = new Date(input.scheduledFor);
    if (isNaN(d.getTime())) {
      errors.push({ field: 'scheduledFor', message: 'Scheduled date is invalid.' });
    }
  }

  // 7. SEO validation
  if (input.seo) {
    const seoReport = validateSeo(input.seo);
    errors.push(...seoReport.errors);
    warnings.push(...seoReport.warnings);

    if (input.seo.canonicalUrl && !isSafeUrl(input.seo.canonicalUrl.trim())) {
      errors.push({ field: 'seo.canonicalUrl', message: 'Canonical URL contains an unsafe scheme.' });
    }
  }

  return {
    isValid: errors.length === 0,
    sanitized: {
      title,
      slug,
      excerpt,
      content: sanitizedContent,
      featuredImage,
      featuredImageAlt,
    },
    report: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

/**
 * Validates Category creation and update payloads.
 */
export function validateCategoryPayload(input: { name?: string; slug?: string; description?: string | null }): {
  isValid: boolean;
  sanitized: { name: string; slug: string; description?: string | null };
  report: ValidationReport;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const name = (input.name || '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Category name is required.' });
  } else if (name.length > 100) {
    errors.push({ field: 'name', message: 'Category name cannot exceed 100 characters.' });
  }

  let slug = (input.slug || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug && name) {
    slug = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
  if (!slug) {
    errors.push({ field: 'slug', message: 'Category slug is required.' });
  }

  return {
    isValid: errors.length === 0,
    sanitized: {
      name,
      slug,
      description: input.description ? input.description.trim() : null,
    },
    report: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

/**
 * Validates Tag creation and update payloads.
 */
export function validateTagPayload(input: { name?: string; slug?: string }): {
  isValid: boolean;
  sanitized: { name: string; slug: string };
  report: ValidationReport;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const name = (input.name || '').trim();
  if (!name) {
    errors.push({ field: 'name', message: 'Tag name is required.' });
  } else if (name.length > 50) {
    errors.push({ field: 'name', message: 'Tag name cannot exceed 50 characters.' });
  }

  let slug = (input.slug || '').trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug && name) {
    slug = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
  if (!slug) {
    errors.push({ field: 'slug', message: 'Tag slug is required.' });
  }

  return {
    isValid: errors.length === 0,
    sanitized: {
      name,
      slug,
    },
    report: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

/**
 * Validates and sanitizes site settings, including Header and Footer configuration.
 */
export function validateSettingsPayload(input: any): {
  isValid: boolean;
  sanitized: UpdateSettingsInput;
  report: ValidationReport;
} {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const sanitized: UpdateSettingsInput = {};

  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      sanitized: {},
      report: {
        isValid: false,
        errors: [{ field: 'settings', message: 'Settings payload must be an object.' }],
        warnings: [],
      },
    };
  }

  // Site name
  if (input.siteName !== undefined) {
    const raw = String(input.siteName).replace(/<[^>]*>/g, '').trim();
    if (raw.length > 100) {
      errors.push({ field: 'siteName', message: 'Site name cannot exceed 100 characters.' });
    }
    sanitized.siteName = raw;
  }

  // Site URL
  if (input.siteUrl !== undefined) {
    const raw = String(input.siteUrl).trim();
    if (raw && !isSafeUrl(raw)) {
      errors.push({ field: 'siteUrl', message: 'Site URL must be a valid, safe URL (http/https).' });
    }
    sanitized.siteUrl = raw;
  }

  // Site Logo
  if (input.siteLogo !== undefined) {
    if (input.siteLogo === null || input.siteLogo === '') {
      sanitized.siteLogo = null;
    } else {
      const raw = String(input.siteLogo).trim();
      if (!isSafeUrl(raw)) {
        errors.push({ field: 'siteLogo', message: 'Site logo URL is invalid or unsafe.' });
      }
      sanitized.siteLogo = raw;
    }
  }

  // Header Tagline
  if (input.headerTagline !== undefined) {
    if (input.headerTagline === null || input.headerTagline === '') {
      sanitized.headerTagline = null;
    } else {
      const raw = String(input.headerTagline).replace(/<[^>]*>/g, '').trim();
      if (raw.length > 200) {
        errors.push({ field: 'headerTagline', message: 'Header tagline cannot exceed 200 characters.' });
      }
      sanitized.headerTagline = raw;
    }
  }

  // Header CTA
  if (input.headerCtaLabel !== undefined) {
    sanitized.headerCtaLabel = input.headerCtaLabel ? String(input.headerCtaLabel).replace(/<[^>]*>/g, '').trim() : null;
  }
  if (input.headerCtaLink !== undefined) {
    const raw = input.headerCtaLink ? String(input.headerCtaLink).trim() : '';
    if (raw && !isSafeUrl(raw)) {
      errors.push({ field: 'headerCtaLink', message: 'Header CTA link is invalid or unsafe.' });
    }
    sanitized.headerCtaLink = raw || null;
  }
  if (input.headerCtaVisible !== undefined) {
    sanitized.headerCtaVisible = Boolean(input.headerCtaVisible);
  }

  // Header Navigation Items
  if (input.headerNav !== undefined) {
    if (!Array.isArray(input.headerNav)) {
      errors.push({ field: 'headerNav', message: 'Header navigation must be an array.' });
    } else {
      const navItems: HeaderNavItem[] = [];
      for (let i = 0; i < input.headerNav.length; i++) {
        const item = input.headerNav[i];
        if (!item || typeof item !== 'object') continue;
        const navValidation = validateNavigationItem(item);
        if (!navValidation.isValid) {
          for (const err of navValidation.errors) {
            errors.push({ field: `headerNav[${i}].${err.field}`, message: err.message });
          }
        } else if (navValidation.sanitized) {
          navItems.push({
            ...navValidation.sanitized,
            order: typeof item.order === 'number' ? item.order : i,
          });
        }
      }
      sanitized.headerNav = navItems;
    }
  }

  // Footer Description
  if (input.footerDescription !== undefined) {
    sanitized.footerDescription = input.footerDescription ? String(input.footerDescription).replace(/<[^>]*>/g, '').trim() : null;
  }

  // Copyright Text
  if (input.copyrightText !== undefined) {
    sanitized.copyrightText = input.copyrightText ? String(input.copyrightText).replace(/<[^>]*>/g, '').trim() : null;
  }

  // Trust Text
  if (input.trustText !== undefined) {
    sanitized.trustText = input.trustText ? String(input.trustText).replace(/<[^>]*>/g, '').trim() : null;
  }

  // Footer Groups
  if (input.footerGroups !== undefined) {
    if (!Array.isArray(input.footerGroups)) {
      errors.push({ field: 'footerGroups', message: 'Footer groups must be an array.' });
    } else {
      const groups: FooterGroupItem[] = [];
      for (let gIdx = 0; gIdx < input.footerGroups.length; gIdx++) {
        const group = input.footerGroups[gIdx];
        if (!group || typeof group !== 'object') continue;
        const title = String(group.title || '').replace(/<[^>]*>/g, '').trim();
        if (!title) {
          errors.push({ field: `footerGroups[${gIdx}].title`, message: 'Footer group title is required.' });
        }

        const links: FooterLinkItem[] = [];
        if (Array.isArray(group.links)) {
          for (let lIdx = 0; lIdx < group.links.length; lIdx++) {
            const link = group.links[lIdx];
            if (!link || typeof link !== 'object') continue;
            const lLabel = String(link.label || '').replace(/<[^>]*>/g, '').trim();
            const lHref = String(link.href || '').trim();

            if (!lLabel) {
              errors.push({ field: `footerGroups[${gIdx}].links[${lIdx}].label`, message: 'Link label is required.' });
            }
            if (!lHref) {
              errors.push({ field: `footerGroups[${gIdx}].links[${lIdx}].href`, message: 'Link href is required.' });
            } else if (!isSafeUrl(lHref)) {
              errors.push({ field: `footerGroups[${gIdx}].links[${lIdx}].href`, message: `Footer link '${lHref}' is unsafe or malformed.` });
            }

            links.push({
              label: lLabel,
              href: lHref,
              openNewTab: Boolean(link.openNewTab),
            });
          }
        }

        groups.push({ title, links });
      }
      sanitized.footerGroups = groups;
    }
  }

  // Social Links
  if (input.socialLinks !== undefined) {
    if (input.socialLinks === null) {
      sanitized.socialLinks = null;
    } else if (typeof input.socialLinks === 'object') {
      const cleanedLinks: Record<string, string> = {};
      for (const [platform, rawUrl] of Object.entries(input.socialLinks)) {
        if (!rawUrl || typeof rawUrl !== 'string') continue;
        const trimmed = rawUrl.trim();
        if (trimmed) {
          if (!isSafeUrl(trimmed)) {
            errors.push({ field: `socialLinks.${platform}`, message: `Social link for '${platform}' is unsafe.` });
          } else {
            cleanedLinks[platform] = trimmed;
          }
        }
      }
      sanitized.socialLinks = cleanedLinks;
    }
  }

  // SEO fields
  if (input.defaultSeoTitle !== undefined) {
    sanitized.defaultSeoTitle = input.defaultSeoTitle ? String(input.defaultSeoTitle).replace(/<[^>]*>/g, '').trim() : null;
  }
  if (input.defaultMetaDescription !== undefined) {
    sanitized.defaultMetaDescription = input.defaultMetaDescription ? String(input.defaultMetaDescription).replace(/<[^>]*>/g, '').trim() : null;
  }
  if (input.defaultOgImage !== undefined) {
    const raw = input.defaultOgImage ? String(input.defaultOgImage).trim() : '';
    if (raw && !isSafeUrl(raw)) {
      errors.push({ field: 'defaultOgImage', message: 'OG image URL is invalid or unsafe.' });
    }
    sanitized.defaultOgImage = raw || null;
  }
  if (input.defaultTwitterImage !== undefined) {
    const raw = input.defaultTwitterImage ? String(input.defaultTwitterImage).trim() : '';
    if (raw && !isSafeUrl(raw)) {
      errors.push({ field: 'defaultTwitterImage', message: 'Twitter image URL is invalid or unsafe.' });
    }
    sanitized.defaultTwitterImage = raw || null;
  }
  if (input.googleAnalyticsId !== undefined) {
    sanitized.googleAnalyticsId = input.googleAnalyticsId ? String(input.googleAnalyticsId).replace(/<[^>]*>/g, '').trim() : null;
  }
  if (input.googleAdSenseId !== undefined) {
    sanitized.googleAdSenseId = input.googleAdSenseId ? String(input.googleAdSenseId).replace(/<[^>]*>/g, '').trim() : null;
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    report: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };
}

