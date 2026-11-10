import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import jpeg from 'jpeg-js';

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function runRealUiVerification() {
  console.log('--- STARTING REAL UI VERIFICATION VIA PLAYWRIGHT ---');

  // 1. Create a high-res image PDF fixture for testing
  const testFixturePath = path.join(process.cwd(), 'tests/fixtures/real-ui-test.pdf');
  const doc = await PDFDocument.create();
  const w = 1200, h = 1200;
  const raw = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = Math.floor(i / w);
    raw[i * 4] = Math.floor((Math.sin(x / 20) + 1) * 127);
    raw[i * 4 + 1] = Math.floor((Math.cos(y / 20) + 1) * 127);
    raw[i * 4 + 2] = (x * 7 + y * 13) % 256;
    raw[i * 4 + 3] = 255;
  }
  const encodedJpg = jpeg.encode({ data: raw, width: w, height: h }, 95);
  const embeddedImg = await doc.embedJpg(encodedJpg.data);
  const page = doc.addPage([600, 600]);
  page.drawImage(embeddedImg, { x: 50, y: 50, width: 500, height: 500 });
  const inputBytes = await doc.save();
  fs.mkdirSync(path.dirname(testFixturePath), { recursive: true });
  fs.writeFileSync(testFixturePath, inputBytes);

  const inputSize = inputBytes.length;
  const inputHash = sha256(Buffer.from(inputBytes));
  console.log(`Input PDF: size=${inputSize} bytes, sha256=${inputHash}`);

  const browser = await chromium.launch({ headless: true });

  const qualities = [40, 50, 70, 90] as const;
  const results: Array<{
    quality: number;
    inputBytes: number;
    outputBytes: number;
    reduction: string;
    sha256: string;
  }> = [];

  for (const q of qualities) {
    console.log(`\nTesting Quality ${q}% through browser UI...`);
    const context = await browser.newContext();
    const pageUi = await context.newPage();

    await pageUi.goto('http://localhost:3000/tools/compress-pdf');
    await pageUi.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    const fileInput = pageUi.locator('#compress-pdf-file-input');
    await fileInput.setInputFiles(testFixturePath);

    await pageUi.getByText('real-ui-test.pdf').waitFor({ timeout: 5000 });

    // Select quality radio button
    const qualityRadio = pageUi.locator(`#compress-pdf-quality-${q}`);
    await qualityRadio.click();

    // Click compress button
    const compressBtn = pageUi.getByRole('button', { name: /^Compress PDF$/i });
    await compressBtn.click();

    // Wait for success message
    await pageUi.getByText('PDF compressed successfully').waitFor({ timeout: 20000 });

    // Trigger download
    const downloadPromise = pageUi.waitForEvent('download');
    const downloadBtn = pageUi.getByRole('button', { name: /Download Compressed PDF/i });
    await downloadBtn.click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) {
      await context.close();
      throw new Error(`Download failed for quality ${q}%`);
    }

    const downloadedBytes = fs.readFileSync(downloadPath);
    const outputSize = downloadedBytes.length;
    const outputHash = sha256(downloadedBytes);
    const reductionPercent = (((inputSize - outputSize) / inputSize) * 100).toFixed(1) + '%';

    results.push({
      quality: q,
      inputBytes: inputSize,
      outputBytes: outputSize,
      reduction: reductionPercent,
      sha256: outputHash,
    });

    console.log(`Quality ${q}% Result: ${outputSize} bytes (${reductionPercent} reduction), hash=${outputHash}`);
    await context.close();
  }

  await browser.close();

  console.log('\n================ REAL BROWSER UI DOWNLOAD RESULTS ================');
  console.table(results);
  console.log('==================================================================\n');

  // Verify monotonic progression
  const sizes = results.map((r) => r.outputBytes);
  const hashes = results.map((r) => r.sha256);
  const uniqueHashes = new Set(hashes);

  if (uniqueHashes.size !== qualities.length) {
    console.error('ERROR: Output files are identical across quality tiers!');
    process.exit(1);
  }

  if (!(sizes[0] < sizes[1] && sizes[1] < sizes[2] && sizes[2] < sizes[3])) {
    console.error('ERROR: Output sizes are not strictly increasing with quality level!');
    process.exit(1);
  }

  console.log('SUCCESS: All downloaded files are unique and monotonically scale with quality setting!');
}

runRealUiVerification().catch((err) => {
  console.error('Real UI verification failed:', err);
  process.exit(1);
});
