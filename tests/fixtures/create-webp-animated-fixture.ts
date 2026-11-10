import fs from 'fs';
import path from 'path';

const fixturesDir = path.join(process.cwd(), 'tests/fixtures');

/**
 * Generates a minimal valid animated WebP fixture containing VP8X with animation flag and ANIM chunk.
 */
function createAnimatedWebp(): Buffer {
  const buf = Buffer.alloc(64);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(64 - 8, 4);
  buf.write('WEBP', 8);

  // VP8X Chunk (18 bytes total)
  buf.write('VP8X', 12);
  buf.writeUInt32LE(10, 16); // Chunk size = 10
  buf[20] = 0x02; // Flags: Animation bit (0x02) set
  buf[21] = 0; // Reserved
  buf[22] = 0;
  buf[23] = 0;
  // Canvas width - 1 = 1 (2px width) -> 3 bytes LE
  buf[24] = 0x01;
  buf[25] = 0x00;
  buf[26] = 0x00;
  // Canvas height - 1 = 1 (2px height) -> 3 bytes LE
  buf[27] = 0x01;
  buf[28] = 0x00;
  buf[29] = 0x00;

  // ANIM Chunk (14 bytes total)
  buf.write('ANIM', 30);
  buf.writeUInt32LE(6, 34); // Chunk size = 6
  buf.writeUInt32LE(0x00000000, 38); // BG Color
  buf.writeUInt16LE(0, 42); // Loop count (0 = infinite)

  // ANMF Chunk header
  buf.write('ANMF', 44);
  buf.writeUInt32LE(12, 48); // Chunk size

  return buf;
}

fs.writeFileSync(path.join(fixturesDir, 'animated.webp'), createAnimatedWebp());
console.log('animated.webp fixture generated.');
