import { ToolError } from '../../shared/errors';
import type { SvgValidationResult } from './svg-types';

export const SVG_LIMITS = {
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  MAX_BATCH_FILES: 20,
  MAX_RASTER_DIMENSION: 8192, // 8192 px max width/height
  DEFAULT_DIMENSION: 800,
};

/**
 * Parses length strings into pixels.
 * Supports: px, pt, in, cm, mm, or unitless numbers.
 * Returns null if length cannot be resolved to a fixed pixel value (e.g. %, em, auto, invalid).
 */
export function parseLengthToPixels(val: string | null | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim().toLowerCase();
  if (!trimmed || trimmed === 'auto' || trimmed === 'inherit' || trimmed.endsWith('%')) {
    return null;
  }

  // Check unitless or px
  const numMatch = trimmed.match(/^([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)(px|pt|in|cm|mm)?$/);
  if (!numMatch) return null;

  const num = parseFloat(numMatch[1]);
  if (!Number.isFinite(num) || num <= 0) return null;

  const unit = numMatch[2] || 'px';
  switch (unit) {
    case 'px':
      return num;
    case 'pt':
      return num * 1.333333; // 1pt = 1/72 in = 96/72 px
    case 'in':
      return num * 96;
    case 'cm':
      return num * 37.795275; // 96 / 2.54
    case 'mm':
      return num * 3.779528;
    default:
      return num;
  }
}

/**
 * Validates and parses the viewBox attribute into 4 numeric components.
 * Format: "minX minY width height" or "minX, minY, width, height"
 */
export function parseViewBox(viewBoxStr: string | null | undefined): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} | null {
  if (!viewBoxStr) return null;
  const trimmed = viewBoxStr.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .split(/[\s,]+/)
    .map((p) => parseFloat(p))
    .filter((n) => Number.isFinite(n));

  if (parts.length !== 4) return null;

  const [minX, minY, width, height] = parts;
  if (width <= 0 || height <= 0 || !Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return { minX, minY, width, height };
}

/**
 * Security scanner for SVG string content.
 * Checks for prohibited active elements, event handlers, javascript: URIs,
 * external network references, foreignObjects, external stylesheets, and DOCTYPE entities.
 */
export function scanSvgSecurity(svgText: string): { safe: boolean; reason?: string } {
  // 1. DOCTYPE entity expansion / system entity check
  if (/<!ENTITY\s+[^>]*SYSTEM/i.test(svgText) || /<!ENTITY\s+[^>]*PUBLIC/i.test(svgText)) {
    return { safe: false, reason: 'External entity declarations in DOCTYPE are not permitted.' };
  }

  // 2. Prohibited elements: <script>, <foreignObject>, <object>, <iframe>, <embed>, <applet>, <base>
  const prohibitedTagRegex = /<\s*\/?\s*(?:[a-zA-Z0-9_-]+:)?(?:script|foreignobject|object|iframe|embed|applet|base)\b/i;
  if (prohibitedTagRegex.test(svgText)) {
    return { safe: false, reason: 'Prohibited tag detected (e.g. script, foreignObject, iframe, object).' };
  }

  // 3. Inline event handler attributes (any attribute beginning with 'on' like onload, onclick, onerror, etc.)
  // Matches: \bon[a-zA-Z0-9_-]+\s*=
  const eventHandlerRegex = /\b(on[a-zA-Z0-9_-]+)\s*=/i;
  if (eventHandlerRegex.test(svgText)) {
    return { safe: false, reason: 'Inline event handlers (onload, onclick, etc.) are prohibited.' };
  }

  // 4. javascript: URLs
  // Handles: href="javascript:...", xlink:href="javascript:...", src="javascript:..."
  const jsUrlRegex = /(?:href|src|xlink:href|action|data)\s*=\s*["']?\s*javascript\s*:/i;
  if (jsUrlRegex.test(svgText)) {
    return { safe: false, reason: 'javascript: URIs are prohibited.' };
  }

  // 5. Unsafe data: URLs used as scripts or HTML
  const unsafeDataUrlRegex = /(?:href|src|xlink:href)\s*=\s*["']?\s*data:(?:text\/(?:html|javascript)|application\/(?:javascript|x-javascript))/i;
  if (unsafeDataUrlRegex.test(svgText)) {
    return { safe: false, reason: 'Unsafe executable data: URIs are prohibited.' };
  }

  // 6. External resource references (http://, https://, //)
  // Check in href, xlink:href, src, <link>, <use>, <image>, and CSS @import / url()
  const externalRefRegex = /(?:href|src|xlink:href)\s*=\s*["']?\s*(?:https?:|\/\/)[^"'\s>]+/i;
  if (externalRefRegex.test(svgText)) {
    return { safe: false, reason: 'External resource references (http/https) are prohibited.' };
  }

  // Check CSS @import or url(http...) in <style> or style attributes
  const externalCssRegex = /(?:@import\s+(?:url\s*\()?["']?\s*(?:https?:|\/\/)|url\s*\(\s*["']?\s*(?:https?:|\/\/))/i;
  if (externalCssRegex.test(svgText)) {
    return { safe: false, reason: 'External CSS @import or external url() references are prohibited.' };
  }

  return { safe: true };
}

/**
 * Validates XML structure, verifies SVG root tag, extracts dimensions & viewBox,
 * and performs strict security inspection.
 */
export function validateSvgContent(svgText: string): SvgValidationResult {
  const trimmed = svgText.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
    };
  }

  // Security scan first
  const secScan = scanSvgSecurity(trimmed);
  if (!secScan.safe) {
    return {
      valid: false,
      error: new ToolError(
        'UNSUPPORTED_FORMAT',
        'This SVG contains unsupported or unsafe content.'
      ),
    };
  }

  let widthAttr: string | null;
  let heightAttr: string | null;
  let viewBoxAttr: string | null;
  let xmlnsAttr: string | null;

  // Browser DOMParser validation if available
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, 'image/svg+xml');

      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
        };
      }

      const root = doc.documentElement;
      const rootTagName = root.tagName.toLowerCase();
      if (rootTagName !== 'svg' && rootTagName !== 'svg:svg') {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
        };
      }

      // Check namespace if present
      xmlnsAttr = root.getAttribute('xmlns');
      if (xmlnsAttr && xmlnsAttr !== 'http://www.w3.org/2000/svg' && !xmlnsAttr.includes('svg')) {
        return {
          valid: false,
          error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
        };
      }

      widthAttr = root.getAttribute('width');
      heightAttr = root.getAttribute('height');
      viewBoxAttr = root.getAttribute('viewBox') || root.getAttribute('viewbox');

      // Security check on parsed DOM tree elements & attributes
      const allElements = doc.querySelectorAll('*');
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const tag = el.tagName.toLowerCase();
        if (
          tag === 'script' ||
          tag.endsWith(':script') ||
          tag === 'foreignobject' ||
          tag.endsWith(':foreignobject') ||
          tag === 'object' ||
          tag === 'iframe' ||
          tag === 'embed'
        ) {
          return {
            valid: false,
            error: new ToolError('UNSUPPORTED_FORMAT', 'This SVG contains unsupported or unsafe content.'),
          };
        }

        // Check attributes on every element
        for (let j = 0; j < el.attributes.length; j++) {
          const attr = el.attributes[j];
          const attrName = attr.name.toLowerCase();
          const attrVal = attr.value.toLowerCase().trim();

          if (attrName.startsWith('on')) {
            return {
              valid: false,
              error: new ToolError('UNSUPPORTED_FORMAT', 'This SVG contains unsupported or unsafe content.'),
            };
          }

          if (attrVal.startsWith('javascript:')) {
            return {
              valid: false,
              error: new ToolError('UNSUPPORTED_FORMAT', 'This SVG contains unsupported or unsafe content.'),
            };
          }

          if (
            (attrName === 'href' || attrName === 'xlink:href' || attrName === 'src') &&
            (attrVal.startsWith('http://') || attrVal.startsWith('https://') || attrVal.startsWith('//'))
          ) {
            return {
              valid: false,
              error: new ToolError('UNSUPPORTED_FORMAT', 'This SVG contains unsupported or unsafe content.'),
            };
          }
        }
      }
    } catch {
      return {
        valid: false,
        error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
      };
    }
  } else {
    // Node.js / Headless environment regex parser
    // Check root SVG opening tag
    const svgTagMatch = trimmed.match(/<svg\b([^>]*)>/i);
    if (!svgTagMatch) {
      return {
        valid: false,
        error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
      };
    }

    // Check that there's a closing </svg>
    if (!/<\/svg\s*>/i.test(trimmed)) {
      return {
        valid: false,
        error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
      };
    }

    // Check for malformed tags (e.g. unclosed '<' before next '<' or '>' without matching '<')
    if (/<[^>]*</.test(trimmed) || /<[^>]*$/.test(trimmed)) {
      return {
        valid: false,
        error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
      };
    }

    const attrsString = svgTagMatch[1];
    const widthMatch = attrsString.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
    const heightMatch = attrsString.match(/\bheight\s*=\s*["']([^"']+)["']/i);
    const viewBoxMatch = attrsString.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    const xmlnsMatch = attrsString.match(/\bxmlns\s*=\s*["']([^"']+)["']/i);

    widthAttr = widthMatch ? widthMatch[1] : null;
    heightAttr = heightMatch ? heightMatch[1] : null;
    viewBoxAttr = viewBoxMatch ? viewBoxMatch[1] : null;
    xmlnsAttr = xmlnsMatch ? xmlnsMatch[1] : null;

    if (xmlnsAttr && xmlnsAttr !== 'http://www.w3.org/2000/svg' && !xmlnsAttr.includes('svg')) {
      return {
        valid: false,
        error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
      };
    }
  }

  // Parse viewBox if specified
  let parsedViewBox: { minX: number; minY: number; width: number; height: number } | null = null;
  if (viewBoxAttr) {
    parsedViewBox = parseViewBox(viewBoxAttr);
    if (!parsedViewBox) {
      return {
        valid: false,
        error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
      };
    }
  }

  // Determine pixel dimensions using the intrinsic sizing rules:
  // Rule 1: If valid width and height resolve to pixel dimensions, use them.
  // Rule 2: If width/height are absent but viewBox exists, derive from viewBox.
  // Rule 3: If one dimension exists and viewBox exists, derive missing dimension preserving aspect ratio.
  // Rule 4: If no usable intrinsic dimensions exist, use sensible default (800x800).
  const parsedW = parseLengthToPixels(widthAttr);
  const parsedH = parseLengthToPixels(heightAttr);

  let finalWidth: number;
  let finalHeight: number;

  if (parsedW && parsedH) {
    finalWidth = Math.round(parsedW);
    finalHeight = Math.round(parsedH);
  } else if (parsedW && parsedViewBox) {
    finalWidth = Math.round(parsedW);
    finalHeight = Math.round(parsedW * (parsedViewBox.height / parsedViewBox.width));
  } else if (parsedH && parsedViewBox) {
    finalHeight = Math.round(parsedH);
    finalWidth = Math.round(parsedH * (parsedViewBox.width / parsedViewBox.height));
  } else if (parsedViewBox) {
    finalWidth = Math.round(parsedViewBox.width);
    finalHeight = Math.round(parsedViewBox.height);
  } else if (parsedW) {
    finalWidth = Math.round(parsedW);
    finalHeight = Math.round(parsedW);
  } else if (parsedH) {
    finalWidth = Math.round(parsedH);
    finalHeight = Math.round(parsedH);
  } else {
    finalWidth = SVG_LIMITS.DEFAULT_DIMENSION;
    finalHeight = SVG_LIMITS.DEFAULT_DIMENSION;
  }

  // Safeguard dimension minimum
  if (finalWidth <= 0) finalWidth = SVG_LIMITS.DEFAULT_DIMENSION;
  if (finalHeight <= 0) finalHeight = SVG_LIMITS.DEFAULT_DIMENSION;

  // Maximum dimension limit protection (Max 8192px)
  if (finalWidth > SVG_LIMITS.MAX_RASTER_DIMENSION || finalHeight > SVG_LIMITS.MAX_RASTER_DIMENSION) {
    return {
      valid: false,
      error: new ToolError(
        'BROWSER_MEMORY_ERROR',
        'This SVG is too large to rasterize in your browser.'
      ),
    };
  }

  return {
    valid: true,
    dimensions: {
      width: finalWidth,
      height: finalHeight,
      viewBox: parsedViewBox || undefined,
    },
    svgText: trimmed,
  };
}

/**
 * Validates an SVG File:
 * 1. File size (<= 50MB)
 * 2. Extension / MIME
 * 3. Text content reading
 * 4. Structural XML + Security scan + Dimensions
 */
export async function validateSvgFile(file: File): Promise<SvgValidationResult> {
  // 1. Size validation
  if (file.size > SVG_LIMITS.MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: new ToolError('FILE_TOO_LARGE', 'This file is too large. Maximum size is 50 MB.'),
    };
  }

  // 2. Extension check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'svg') {
    return {
      valid: false,
      error: new ToolError('UNSUPPORTED_FORMAT', 'Only SVG files are supported.'),
    };
  }

  // 3. Reject known non-SVG conflicting binary formats (PDF, PNG, JPG, ZIP)
  const conflictingMimes = [
    'image/png',
    'application/pdf',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'application/zip',
  ];
  if (file.type && conflictingMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
    };
  }

  // 4. Read text content & validate
  try {
    const text = await file.text();
    return validateSvgContent(text);
  } catch {
    return {
      valid: false,
      error: new ToolError('INVALID_FILE', 'This file is not a valid SVG image.'),
    };
  }
}
