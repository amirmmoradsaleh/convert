import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import jpeg from 'jpeg-js';

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // 1. Photo / Image-Heavy PDF
  const doc1 = await PDFDocument.create();
  const w1 = 300, h1 = 300;
  const raw1 = new Uint8Array(w1 * h1 * 4);
  for (let i = 0; i < w1 * h1; i++) {
    const x = i % w1;
    const y = Math.floor(i / w1);
    raw1[i * 4] = Math.floor((Math.sin(x / 10) + 1) * 127);
    raw1[i * 4 + 1] = Math.floor((Math.cos(y / 10) + 1) * 127);
    raw1[i * 4 + 2] = (x * 7 + y * 13) % 256;
    raw1[i * 4 + 3] = 255;
  }
  const jpg1 = jpeg.encode({ data: raw1, width: w1, height: h1 }, 95);
  const emb1 = await doc1.embedJpg(jpg1.data);
  const p1 = doc1.addPage([500, 500]);
  p1.drawImage(emb1, { x: 50, y: 50, width: 400, height: 400 });
  const pdf1Path = path.join(process.cwd(), 'tests/fixtures/real-ui-image-heavy.pdf');
  fs.writeFileSync(pdf1Path, await doc1.save());

  console.log('\n### Table 1: Image-Heavy PDF (Multi-Tone JPEG Images)');
  const origBuffer1 = fs.readFileSync(pdf1Path);
  console.log(`Input: ${origBuffer1.length} bytes, SHA-256: ${sha256(origBuffer1)}\n`);
  console.log('| Quality | Input bytes | Output bytes | Reduction | SHA-256 |');
  console.log('|---|---:|---:|---:|---|');
  
  for (const q of [40, 50, 70, 90]) {
    await page.goto('http://localhost:3000/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    
    await page.locator('#compress-pdf-file-input').setInputFiles(pdf1Path);
    await page.waitForSelector(`text=real-ui-image-heavy.pdf`);

    await page.locator(`#compress-pdf-quality-${q}`).click();
    await page.getByRole('button', { name: /^Compress PDF$/i }).click();
    await page.waitForSelector('text=PDF compressed successfully', { timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Compressed PDF/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const downloadedBuffer = fs.readFileSync(downloadPath!);
    const hash = sha256(downloadedBuffer);
    const reduction = (((origBuffer1.length - downloadedBuffer.length) / origBuffer1.length) * 100).toFixed(1);

    console.log(`| ${q}% | ${origBuffer1.length} | ${downloadedBuffer.length} | ${reduction}% | ${hash} |`);
  }

  // 2. PNG / Flate Raster Image PDF
  const pngDoc = await PDFDocument.create();
  const pngPage = pngDoc.addPage([500, 500]);
  // Create a 200x200 PNG fixture
  const w2 = 200, h2 = 200;
  const raw2 = new Uint8Array(w2 * h2 * 4);
  for (let i = 0; i < w2 * h2; i++) {
    const x = i % w2;
    const y = Math.floor(i / w2);
    raw2[i * 4] = (x * 13) % 256;
    raw2[i * 4 + 1] = (y * 17) % 256;
    raw2[i * 4 + 2] = (x * 5 + y * 23) % 256;
    raw2[i * 4 + 3] = 255;
  }
  const jpg2 = jpeg.encode({ data: raw2, width: w2, height: h2 }, 98);
  const emb2 = await pngDoc.embedJpg(jpg2.data);
  pngPage.drawImage(emb2, { x: 50, y: 50, width: 400, height: 400 });
  const embPngPath = path.join(process.cwd(), 'tests/fixtures/real-ui-raster.pdf');
  fs.writeFileSync(embPngPath, await pngDoc.save());

  console.log('\n### Table 2: High-Resolution Raster PDF');
  const origBufferRaster = fs.readFileSync(embPngPath);
  console.log(`Input: ${origBufferRaster.length} bytes, SHA-256: ${sha256(origBufferRaster)}\n`);
  console.log('| Quality | Input bytes | Output bytes | Reduction | SHA-256 |');
  console.log('|---|---:|---:|---:|---|');

  for (const q of [40, 50, 70, 90]) {
    await page.goto('http://localhost:3000/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    
    await page.locator('#compress-pdf-file-input').setInputFiles(embPngPath);
    await page.waitForSelector(`text=real-ui-raster.pdf`);

    await page.locator(`#compress-pdf-quality-${q}`).click();
    await page.getByRole('button', { name: /^Compress PDF$/i }).click();
    await page.waitForSelector('text=PDF compressed successfully', { timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Compressed PDF/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const downloadedBuffer = fs.readFileSync(downloadPath!);
    const hash = sha256(downloadedBuffer);
    const reduction = (((origBufferRaster.length - downloadedBuffer.length) / origBufferRaster.length) * 100).toFixed(1);

    console.log(`| ${q}% | ${origBufferRaster.length} | ${downloadedBuffer.length} | ${reduction}% | ${hash} |`);
  }

  // 3. Text / Vector Document (compressible.pdf)
  const textPdfPath = path.join(process.cwd(), 'tests/fixtures/compressible.pdf');
  console.log('\n### Table 3: Text & Vector PDF (No Raster Images)');
  const origBufferText = fs.readFileSync(textPdfPath);
  console.log(`Input: ${origBufferText.length} bytes, SHA-256: ${sha256(origBufferText)}\n`);
  console.log('| Quality | Input bytes | Output bytes | Reduction | SHA-256 |');
  console.log('|---|---:|---:|---:|---|');

  for (const q of [40, 90]) {
    await page.goto('http://localhost:3000/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
    
    await page.locator('#compress-pdf-file-input').setInputFiles(textPdfPath);
    await page.waitForSelector(`text=compressible.pdf`);

    await page.locator(`#compress-pdf-quality-${q}`).click();
    await page.getByRole('button', { name: /^Compress PDF$/i }).click();
    await page.waitForSelector('text=PDF compressed successfully', { timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Compressed PDF/i }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    const downloadedBuffer = fs.readFileSync(downloadPath!);
    const hash = sha256(downloadedBuffer);
    const reduction = (((origBufferText.length - downloadedBuffer.length) / origBufferText.length) * 100).toFixed(1);

    console.log(`| ${q}% | ${origBufferText.length} | ${downloadedBuffer.length} | ${reduction}% | ${hash} |`);
  }

  await browser.close();
  if (fs.existsSync(pdf1Path)) fs.unlinkSync(pdf1Path);
  if (fs.existsSync(embPngPath)) fs.unlinkSync(embPngPath);
}

run().catch(console.error);
