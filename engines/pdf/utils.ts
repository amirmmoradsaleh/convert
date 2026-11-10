/**
 * Parses user page range strings like "1-3, 5, 8-10" into sorted unique page numbers (1-indexed).
 */
export function parsePageRangeString(rangeStr: string, maxPages: number): number[] {
  const pages = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
          pages.add(i);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= maxPages) {
        pages.add(page);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Sanitizes a PDF filename to produce a safe base name without extension.
 */
export function sanitizePdfBaseName(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  const printableChars = Array.from(nameWithoutExt)
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (code >= 32 && code < 127) || code > 159;
    })
    .join('');

  const sanitized = printableChars
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');

  return sanitized || 'document';
}

