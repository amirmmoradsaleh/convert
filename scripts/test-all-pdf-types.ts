import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, PDFName, PDFRawStream, PDFOperator, PDFNumber, rgb, StandardFonts } from 'pdf-lib';
import jpeg from 'jpeg-js';
import * as pako from 'pako';

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function createFixtures() {
  const fixtureDir = path.join(process.cwd(), 'tests/fixtures/all-types');
  fs.mkdirSync(fixtureDir, { recursive: true });

  // 1. Image-heavy PDF (High Resolution JPEG)
  const doc1 = await PDFDocument.create();
  const w = 1200, h = 1200;
  const raw1 = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = Math.floor(i / w);
    raw1[i * 4] = Math.floor((Math.sin(x / 30) + 1) * 127);
    raw1[i * 4 + 1] = Math.floor((Math.cos(y / 30) + 1) * 127);
    raw1[i * 4 + 2] = (x * 11 + y * 17) % 256;
    raw1[i * 4 + 3] = 255;
  }
  const encodedJpg1 = jpeg.encode({ data: raw1, width: w, height: h }, 95);
  const img1 = await doc1.embedJpg(encodedJpg1.data);
  const page1 = doc1.addPage([600, 600]);
  page1.drawImage(img1, { x: 50, y: 50, width: 500, height: 500 });
  const path1 = path.join(fixtureDir, '1-image-heavy.pdf');
  const bytes1 = await doc1.save();
  fs.writeFileSync(path1, bytes1);

  // 2. Pure JPEG DCTDecode PDF
  const doc2 = await PDFDocument.create();
  const img2 = await doc2.embedJpg(encodedJpg1.data);
  const page2 = doc2.addPage([600, 600]);
  page2.drawImage(img2, { x: 0, y: 0, width: 600, height: 600 });
  const path2 = path.join(fixtureDir, '2-jpeg-dct.pdf');
  const bytes2 = await doc2.save();
  fs.writeFileSync(path2, bytes2);

  // 3. PNG / FlateDecode PDF
  const doc3 = await PDFDocument.create();
  const w3 = 1200, h3 = 1200;
  const rgb3 = new Uint8Array(w3 * h3 * 3);
  for (let i = 0; i < w3 * h3; i++) {
    const x = i % w3;
    const y = Math.floor(i / w3);
    rgb3[i * 3] = Math.floor((x * 255) / w3);
    rgb3[i * 3 + 1] = Math.floor((y * 255) / h3);
    rgb3[i * 3 + 2] = Math.floor(((x + y) * 128) / (w3 + h3));
  }
  const deflated3 = pako.deflate(rgb3);
  const imgDict3 = doc3.context.obj({
    Type: 'XObject',
    Subtype: 'Image',
    Width: w3,
    Height: h3,
    BitsPerComponent: 8,
    ColorSpace: 'DeviceRGB',
    Filter: 'FlateDecode',
  });
  const imgStream3 = PDFRawStream.of(imgDict3, deflated3);
  const imgRef3 = doc3.context.register(imgStream3);
  const page3 = doc3.addPage([600, 600]);
  page3.node.set(PDFName.of('Resources'), doc3.context.obj({ XObject: { Img1: imgRef3 } }));
  page3.pushOperators(
    PDFOperator.of('q' as any),
    PDFOperator.of('cm' as any, [PDFNumber.of(600), PDFNumber.of(0), PDFNumber.of(0), PDFNumber.of(600), PDFNumber.of(0), PDFNumber.of(0)]),
    PDFOperator.of('Do' as any, [PDFName.of('Img1')]),
    PDFOperator.of('Q' as any)
  );
  const path3 = path.join(fixtureDir, '3-png-flate.pdf');
  const bytes3 = await doc3.save();
  fs.writeFileSync(path3, bytes3);

  // 4. Text / Vector PDF (No raster images)
  const doc4 = await PDFDocument.create();
  const font4 = await doc4.embedFont(StandardFonts.HelveticaBold);
  const page4 = doc4.addPage([600, 800]);
  page4.drawText('Technical Document Title', { x: 50, y: 750, size: 24, font: font4, color: rgb(0.1, 0.2, 0.5) });
  for (let i = 0; i < 20; i++) {
    page4.drawText(`Paragraph line ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit.`, {
      x: 50,
      y: 700 - i * 25,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
    });
    page4.drawLine({ start: { x: 50, y: 690 - i * 25 }, end: { x: 550, y: 690 - i * 25 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  }
  // Save WITHOUT useObjectStreams so structural compression has room to pack object streams
  const path4 = path.join(fixtureDir, '4-text-vector.pdf');
  const bytes4 = await doc4.save({ useObjectStreams: false });
  fs.writeFileSync(path4, bytes4);

  // 5. Already-compressed / Small PDF
  const doc5 = await PDFDocument.create();
  const page5 = doc5.addPage([200, 200]);
  page5.drawText('Tiny PDF', { x: 20, y: 100, size: 14 });
  const path5 = path.join(fixtureDir, '5-already-compressed.pdf');
  const bytes5 = await doc5.save({ useObjectStreams: true });
  fs.writeFileSync(path5, bytes5);

  return { path1, path2, path3, path4, path5 };
}

async function runComprehensiveVerification() {
  console.log('=== STARTING COMPREHENSIVE PDF TYPES & REAL BROWSER UI VERIFICATION ===\n');

  const fixtures = await createFixtures();
  const browser = await chromium.launch({ headless: true });

  // 1. Test Image-Heavy PDF across qualities 40, 50, 70, 90 in Real UI
  console.log('--- 1. Testing Image-Heavy PDF across all Quality Tiers in Real UI ---');
  const qualities = [40, 50, 70, 90] as const;
  const table1: Array<{ quality: number; inputBytes: number; outputBytes: number; reduction: string; sha256: string }> = [];

  const input1Bytes = fs.readFileSync(fixtures.path1);
  const input1Size = input1Bytes.length;

  for (const q of qualities) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3000/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    await page.locator('#compress-pdf-file-input').setInputFiles(fixtures.path1);
    await page.getByText('1-image-heavy.pdf').waitFor({ timeout: 5000 });

    await page.locator(`#compress-pdf-quality-${q}`).click();
    await page.getByRole('button', { name: /^Compress PDF$/i }).click();

    await page.getByText('PDF compressed successfully').waitFor({ timeout: 20000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Compressed PDF/i }).click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const downloadedBytes = fs.readFileSync(downloadPath!);

    const outputSize = downloadedBytes.length;
    const outputHash = sha256(downloadedBytes);
    const reduction = (((input1Size - outputSize) / input1Size) * 100).toFixed(1) + '%';

    table1.push({
      quality: q,
      inputBytes: input1Size,
      outputBytes: outputSize,
      reduction,
      sha256: outputHash,
    });

    console.log(`Quality ${q}%: input=${input1Size}, output=${outputSize}, reduction=${reduction}, sha256=${outputHash}`);
    await context.close();
  }

  // 2. Controlled Comparison for Text/Vector PDF (Structural Optimization Only)
  console.log('\n--- 2. Controlled Comparison for Text/Vector PDF (Structural Optimization Only) ---');
  const input4Bytes = fs.readFileSync(fixtures.path4);
  const input4Size = input4Bytes.length;
  const table4: Array<{ quality: string; inputBytes: number; outputBytes: number; reduction: string; sha256: string }> = [];

  for (const q of [40, 90]) {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3000/tools/compress-pdf');
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });

    await page.locator('#compress-pdf-file-input').setInputFiles(fixtures.path4);
    await page.getByText('4-text-vector.pdf').waitFor({ timeout: 5000 });

    await page.locator(`#compress-pdf-quality-${q}`).click();
    await page.getByRole('button', { name: /^Compress PDF$/i }).click();

    await page.getByText('PDF compressed successfully').waitFor({ timeout: 20000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download Compressed PDF/i }).click();

    const download = await downloadPromise;
    const downloadPath = await download.path();
    const downloadedBytes = fs.readFileSync(downloadPath!);

    const outputSize = downloadedBytes.length;
    const outputHash = sha256(downloadedBytes);
    const reduction = (((input4Size - outputSize) / input4Size) * 100).toFixed(1) + '%';

    table4.push({
      quality: `Quality ${q}%`,
      inputBytes: input4Size,
      outputBytes: outputSize,
      reduction,
      sha256: outputHash,
    });

    console.log(`Text/Vector PDF @ Quality ${q}%: output=${outputSize} bytes (${reduction} reduction)`);
    await context.close();
  }

  // 3. Test PNG / FlateDecode PDF in Real UI
  console.log('\n--- 3. Testing PNG / FlateDecode PDF in Real UI ---');
  const input3Bytes = fs.readFileSync(fixtures.path3);
  const input3Size = input3Bytes.length;

  const context3 = await browser.newContext();
  const page3 = await context3.newPage();

  await page3.goto('http://localhost:3000/tools/compress-pdf');
  await page3.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
  await page3.locator('#compress-pdf-file-input').setInputFiles(fixtures.path3);
  await page3.getByText('3-png-flate.pdf').waitFor({ timeout: 5000 });
  await page3.locator('#compress-pdf-quality-50').click();
  await page3.getByRole('button', { name: /^Compress PDF$/i }).click();

  const successText = page3.getByText('PDF compressed successfully');
  const alreadyOptimizedText = page3.getByText('The PDF could not be reduced further');

  await Promise.race([
    successText.waitFor({ timeout: 15000 }),
    alreadyOptimizedText.waitFor({ timeout: 15000 }),
  ]);

  const isReduced3 = await successText.isVisible();
  console.log(`PNG/FlateDecode PDF @ 50%: ${isReduced3 ? 'Reduced' : 'Kept original (already optimal Flate stream)'}`);
  await context3.close();

  // 4. Test Already-compressed PDF in Real UI
  console.log('\n--- 4. Testing Already-Compressed PDF in Real UI ---');
  const context5 = await browser.newContext();
  const page5 = await context5.newPage();
  await page5.goto('http://localhost:3000/tools/compress-pdf');
  await page5.locator('[data-hydrated="true"]').waitFor({ timeout: 10000 });
  await page5.locator('#compress-pdf-file-input').setInputFiles(fixtures.path5);
  await page5.getByText('5-already-compressed.pdf').waitFor({ timeout: 5000 });
  await page5.getByRole('button', { name: /^Compress PDF$/i }).click();
  await page5.getByText('The PDF could not be reduced further').waitFor({ timeout: 10000 });
  console.log('Already-Compressed PDF correctly identified as not reducible further.');
  await context5.close();

  await browser.close();

  console.log('\n================ REQUIRED REAL UI EVIDENCE TABLE ================');
  console.table(table1);
  console.log('=================================================================\n');

  console.log('================ TEXT/VECTOR CONTROLLED COMPARISON ================');
  console.table(table4);
  console.log('===================================================================\n');
}

runComprehensiveVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
