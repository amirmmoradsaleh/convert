import fs from 'fs';
import path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';

async function generatePdfFixtures() {
  const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

  // 1-page PDF
  const doc1 = await PDFDocument.create();
  const page1 = doc1.addPage([400, 600]);
  page1.drawText('Sample Page 1 of Document', { x: 50, y: 500, size: 18, color: rgb(0.1, 0.2, 0.3) });
  const bytes1 = await doc1.save();
  fs.writeFileSync(path.join(fixturesDir, 'sample-1page.pdf'), bytes1);

  // 2-page PDF
  const doc2 = await PDFDocument.create();
  for (let i = 1; i <= 2; i++) {
    const p = doc2.addPage([400, 600]);
    p.drawText(`Sample Page ${i} of Document B`, { x: 50, y: 500, size: 18, color: rgb(0.2, 0.3, 0.4) });
  }
  const bytes2 = await doc2.save();
  fs.writeFileSync(path.join(fixturesDir, 'sample-2pages.pdf'), bytes2);

  // 3-page PDF
  const doc3 = await PDFDocument.create();
  for (let i = 1; i <= 3; i++) {
    const p = doc3.addPage([400, 600]);
    p.drawText(`Sample Page ${i} of Document`, { x: 50, y: 500, size: 18, color: rgb(0.1, 0.2, 0.3) });
    p.drawText(`Page Content Block ${i}`, { x: 50, y: 450, size: 12, color: rgb(0.4, 0.4, 0.4) });
  }
  const bytes3 = await doc3.save();
  fs.writeFileSync(path.join(fixturesDir, 'sample-3pages.pdf'), bytes3);

  console.log('PDF fixtures created successfully.');
}

generatePdfFixtures();
