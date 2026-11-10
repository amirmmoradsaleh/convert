import JSZip from 'jszip';

/**
 * Formats byte size into human-readable representation.
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Extracts clean base name and extension.
 */
export function getFileNameParts(filename: string): { name: string; extension: string } {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return { name: filename, extension: '' };
  }
  return {
    name: filename.substring(0, lastDot),
    extension: filename.substring(lastDot + 1).toLowerCase(),
  };
}

/**
 * Generates an output filename with replacement extension.
 */
export function replaceFileExtension(filename: string, newExtension: string): string {
  const { name } = getFileNameParts(filename);
  const cleanExt = newExtension.replace('.', '');
  return `${name}.${cleanExt}`;
}

/**
 * Generates a collision-free unique filename based on already used names.
 * For example: 'photo.png' -> if exists, 'photo (1).png', etc.
 */
export function generateUniqueFilename(baseFilename: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseFilename)) {
    existingNames.add(baseFilename);
    return baseFilename;
  }

  const { name, extension } = getFileNameParts(baseFilename);
  let counter = 1;
  let candidate = `${name} (${counter}).${extension}`;
  while (existingNames.has(candidate)) {
    counter++;
    candidate = `${name} (${counter}).${extension}`;
  }
  existingNames.add(candidate);
  return candidate;
}

/**
 * Creates a client-side ZIP file from an array of files/blobs using JSZip.
 */
export async function createZipBlob(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file.blob);
  }
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Standard brand prefix for all user-facing downloads.
 */
export const DOWNLOAD_PREFIX = 'Convert24 - ';

/**
 * Normalizes user-facing download filenames with the standard Convert24 brand prefix.
 * Requirements:
 * - Prefix unprefixed filenames with exactly 'Convert24 - '.
 * - Be idempotent: never add a duplicate prefix.
 * - Trim leading and trailing whitespace.
 * - Recognize an existing prefix even when surrounding whitespace or extra spacing exists.
 * - Preserve Unicode characters, punctuation, internal spaces, multiple dots, and original extension.
 * - Handle empty or missing filenames safely with documented fallback 'Convert24 - download'.
 * - Do not decode, rewrite, or normalize valid Unicode filename content unnecessarily.
 */
export function formatDownloadFilename(filename?: string | null): string {
  if (!filename || typeof filename !== 'string') {
    return `${DOWNLOAD_PREFIX}download`;
  }

  const trimmed = filename.trim();
  if (!trimmed) {
    return `${DOWNLOAD_PREFIX}download`;
  }

  // Strip any existing Convert24 prefix(es) and surrounding whitespace around the hyphen
  let remainder = trimmed;
  while (/^Convert24\s*-\s*/i.test(remainder)) {
    remainder = remainder.replace(/^Convert24\s*-\s*/i, '').trim();
  }

  if (!remainder) {
    return `${DOWNLOAD_PREFIX}download`;
  }

  return `${DOWNLOAD_PREFIX}${remainder}`;
}

/**
 * Triggers a client-side file download for an in-memory Blob.
 * Automatically formats the download filename with the standard Convert24 brand prefix.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const safeFilename = formatDownloadFilename(filename);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeFilename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
