const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Synchronizes the PDF.js worker file by verifying SHA-256 content hashes.
 * Returns an object with the operation result: { copied: boolean, reason: string, src: string, dest: string, hash: string }
 */
function syncPdfWorker(srcPath, destPath) {
  const src = srcPath || path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
  const destDir = destPath ? path.dirname(destPath) : path.join(__dirname, '..', 'public', 'vendor', 'pdfjs');
  const dest = destPath || path.join(destDir, 'pdf.worker.min.mjs');

  if (!fs.existsSync(src)) {
    const errorMsg = `[copy-pdf-worker] Error: Source worker file not found at: ${src}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.existsSync(dest)) {
    const srcHash = computeSha256(src);
    const destHash = computeSha256(dest);

    if (srcHash === destHash) {
      console.log(`[copy-pdf-worker] Worker already up-to-date at ${dest} (SHA-256 match)`);
      return { copied: false, reason: 'identical', src, dest, hash: srcHash };
    }
    console.log(`[copy-pdf-worker] Worker content mismatch (src: ${srcHash}, dest: ${destHash}). Updating...`);
  } else {
    console.log(`[copy-pdf-worker] Destination worker does not exist at ${dest}. Copying...`);
  }

  fs.copyFileSync(src, dest);
  const finalHash = computeSha256(dest);
  console.log(`[copy-pdf-worker] Successfully copied pdf.worker.min.mjs to ${dest} (SHA-256: ${finalHash})`);
  return { copied: true, reason: 'copied', src, dest, hash: finalHash };
}

function runCli() {
  try {
    syncPdfWorker();
  } catch {
    process.exit(1);
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  syncPdfWorker,
  computeSha256,
};
