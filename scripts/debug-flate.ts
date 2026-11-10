import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { inflate } from 'pako';

async function debugFlate() {
  const fileBuf = fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/all-types/3-png-flate.pdf'));
  const doc = await PDFDocument.load(fileBuf);
  const context = doc.context;

  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      if (dict.lookup(PDFName.of('Subtype'))?.toString() === '/Image') {
        const rawBytes = obj.getContents();
        console.log('Image found:', {
          filter: dict.lookup(PDFName.of('Filter'))?.toString(),
          rawLength: rawBytes.length,
          width: dict.lookup(PDFName.of('Width'))?.toString(),
          height: dict.lookup(PDFName.of('Height'))?.toString(),
          cs: dict.lookup(PDFName.of('ColorSpace'))?.toString(),
        });
        const inflated = inflate(rawBytes);
        console.log('Inflated length:', inflated.length);
      }
    }
  }
}

debugFlate();

