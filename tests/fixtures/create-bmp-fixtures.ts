import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

function createBmpBuffer(width: number, height: number, bpp: 24 | 32, isTopDown = false, isCoreHeader = false): Buffer {
  if (isCoreHeader) {
    // 14 byte file header + 12 byte BITMAPCOREHEADER = 26 bytes header
    const rowStride = Math.floor((width * (bpp / 8) + 3) / 4) * 4;
    const pixelDataSize = rowStride * height;
    const totalSize = 26 + pixelDataSize;
    const buf = Buffer.alloc(totalSize);

    // File Header
    buf.write('BM', 0);
    buf.writeUInt32LE(totalSize, 2);
    buf.writeUInt32LE(0, 6);
    buf.writeUInt32LE(26, 10); // Offset to pixel data

    // BITMAPCOREHEADER
    buf.writeUInt32LE(12, 14); // Header size
    buf.writeUInt16LE(width, 18);
    buf.writeUInt16LE(height, 20);
    buf.writeUInt16LE(1, 22); // Planes
    buf.writeUInt16LE(bpp, 24);

    // Fill pixel data
    for (let i = 26; i < totalSize; i++) {
      buf[i] = (i * 17) % 256;
    }

    return buf;
  }

  // Standard BITMAPINFOHEADER (40 bytes)
  const headerSize = 40;
  const rowStride = Math.floor((width * (bpp / 8) + 3) / 4) * 4;
  const pixelDataSize = rowStride * height;
  const totalSize = 14 + headerSize + pixelDataSize;
  const buf = Buffer.alloc(totalSize);

  // BMP File Header
  buf.write('BM', 0);
  buf.writeUInt32LE(totalSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(14 + headerSize, 10); // Offset to pixel data: 54

  // BITMAPINFOHEADER
  buf.writeUInt32LE(headerSize, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(isTopDown ? -height : height, 22);
  buf.writeUInt16LE(1, 26); // Planes
  buf.writeUInt16LE(bpp, 28);
  buf.writeUInt32LE(0, 30); // BI_RGB compression
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835, 38); // 72 DPI
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  // Fill pixel data
  let offset = 54;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (bpp === 24) {
        buf[offset++] = (x * 60) % 256; // B
        buf[offset++] = (y * 60) % 256; // G
        buf[offset++] = 255;           // R
      } else {
        buf[offset++] = (x * 60) % 256; // B
        buf[offset++] = (y * 60) % 256; // G
        buf[offset++] = 255;           // R
        buf[offset++] = 200;           // A
      }
    }
    // Pad row
    while (offset % 4 !== (54 % 4)) {
      if (offset < totalSize) buf[offset++] = 0;
      else break;
    }
  }

  return buf;
}

export function generateAllBmpFixtures() {
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  // 1. Standard bottom-up 24-bit BMP (4x4)
  fs.writeFileSync(path.join(fixturesDir, 'sample-24bit.bmp'), createBmpBuffer(4, 4, 24, false));

  // 2. Top-down 24-bit BMP (4x4)
  fs.writeFileSync(path.join(fixturesDir, 'sample-topdown.bmp'), createBmpBuffer(4, 4, 24, true));

  // 3. 32-bit RGBA BMP (4x4)
  fs.writeFileSync(path.join(fixturesDir, 'sample-32bit.bmp'), createBmpBuffer(4, 4, 32, false));

  // 4. Core header BMP (2x2)
  fs.writeFileSync(path.join(fixturesDir, 'sample-coreheader.bmp'), createBmpBuffer(2, 2, 24, false, true));

  // 5. Corrupted BMP (BM signature with truncated/garbage bytes)
  const corrupted = Buffer.from([0x42, 0x4d, 0x10, 0x00, 0x00, 0x00, 0xff, 0xff]);
  fs.writeFileSync(path.join(fixturesDir, 'corrupted.bmp'), corrupted);

  // 6. Oversized dimensions BMP (10000 x 10000)
  const oversized = Buffer.alloc(54);
  oversized.write('BM', 0);
  oversized.writeUInt32LE(54, 2);
  oversized.writeUInt32LE(54, 10);
  oversized.writeUInt32LE(40, 14);
  oversized.writeInt32LE(10000, 18);
  oversized.writeInt32LE(10000, 22);
  oversized.writeUInt16LE(1, 26);
  oversized.writeUInt16LE(24, 28);
  fs.writeFileSync(path.join(fixturesDir, 'oversized-dim.bmp'), oversized);
}

generateAllBmpFixtures();
