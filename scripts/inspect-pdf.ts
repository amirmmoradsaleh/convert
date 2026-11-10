import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const bytes = fs.readFileSync('test_sample.pdf');
  const doc = await PDFDocument.load(bytes);
  console.log('Pages:', doc.getPageCount());
  console.log('Size:', bytes.length, 'bytes');
}

main();
