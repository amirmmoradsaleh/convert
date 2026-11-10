import { loadPdfDocument, extractPdfText } from '../engines/pdf/loader';
import { PDFDocument, StandardFonts } from 'pdf-lib';

async function main() {
  console.log('=== Node 20 Direct loader.ts Verification ===');
  console.log('Node runtime version:', process.version);

  // 1. Generate a real multi-page PDF with distinct, identifiable text on each page
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page1 = pdfDoc.addPage([500, 700]);
  page1.drawText('Convert24 Multi-Page Verification Page 1 - Alpha Content', {
    x: 50,
    y: 650,
    size: 14,
    font,
  });

  const page2 = pdfDoc.addPage([500, 700]);
  page2.drawText('Convert24 Multi-Page Verification Page 2 - Beta Content', {
    x: 50,
    y: 650,
    size: 14,
    font,
  });

  const page3 = pdfDoc.addPage([500, 700]);
  page3.drawText('Convert24 Multi-Page Verification Page 3 - Gamma Content', {
    x: 50,
    y: 650,
    size: 14,
    font,
  });

  const pdfBytes = await pdfDoc.save();
  console.log(`Generated real PDF: 3 pages, ${pdfBytes.length} bytes`);

  // 2. Process using actual API exported by engines/pdf/loader.ts
  const loaded = await loadPdfDocument(new Uint8Array(pdfBytes));
  console.log(`[loader.ts] Detected total page count: ${loaded.pageCount}`);

  if (loaded.pageCount !== 3) {
    throw new Error(`Expected 3 pages, got ${loaded.pageCount}`);
  }

  // 3. Extract identifiable text using loader.ts extractPdfText API
  const textPage1 = await extractPdfText(loaded, 1);
  const textPage2 = await extractPdfText(loaded, 2);
  const textPage3 = await extractPdfText(loaded, 3);

  console.log(`[loader.ts] Page 1 extracted text: "${textPage1}"`);
  console.log(`[loader.ts] Page 2 extracted text: "${textPage2}"`);
  console.log(`[loader.ts] Page 3 extracted text: "${textPage3}"`);

  if (
    !textPage1.includes('Alpha Content') ||
    !textPage2.includes('Beta Content') ||
    !textPage3.includes('Gamma Content')
  ) {
    throw new Error('Identifiable text mismatch across pages!');
  }

  console.log('SUCCESS: engines/pdf/loader.ts loaded and processed multi-page PDF on Node 20!');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
