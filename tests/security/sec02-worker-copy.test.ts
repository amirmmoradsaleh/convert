import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { syncPdfWorker, computeSha256 } = require('../../scripts/copy-pdf-worker.cjs');

describe('SEC-02 — Worker Copy Integrity Guard (5 Scenarios)', () => {
  let tmpDir: string;
  let validSrcPath: string;
  let testDestPath: string;
  const sampleWorkerPayload = '/* PDF.JS WORKER SOURCE */\nconsole.log("Local PDF Worker v6.3.289");\n// 1234567890';
  const sampleSrcBuffer = Buffer.from(sampleWorkerPayload, 'utf8');

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c24-worker-copy-test-'));
    validSrcPath = path.join(tmpDir, 'source-pdf.worker.min.mjs');
    testDestPath = path.join(tmpDir, 'dest', 'pdf.worker.min.mjs');

    // Create valid mock source worker
    fs.writeFileSync(validSrcPath, sampleSrcBuffer);
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Scenario 1: Destination missing -> Copies source worker and verifies SHA-256 match', () => {
    expect(fs.existsSync(testDestPath)).toBe(false);

    const result = syncPdfWorker(validSrcPath, testDestPath);
    expect(result.copied).toBe(true);
    expect(fs.existsSync(testDestPath)).toBe(true);

    const destBuf = fs.readFileSync(testDestPath);
    expect(destBuf.equals(sampleSrcBuffer)).toBe(true);
    expect(computeSha256(testDestPath)).toBe(computeSha256(validSrcPath));
  });

  it('Scenario 2: Destination identical -> Idempotent no-op (no re-copy)', () => {
    expect(fs.existsSync(testDestPath)).toBe(true);

    const destMtimeBefore = fs.statSync(testDestPath).mtimeMs;
    const result = syncPdfWorker(validSrcPath, testDestPath);

    expect(result.copied).toBe(false);
    expect(result.reason).toBe('identical');

    const destMtimeAfter = fs.statSync(testDestPath).mtimeMs;
    expect(destMtimeAfter).toBe(destMtimeBefore);
  });

  it('Scenario 3: Destination different and smaller -> Overwrites with valid source', () => {
    // Write smaller modified destination content
    const corruptedSmall = Buffer.from('corrupted');
    expect(corruptedSmall.length).toBeLessThan(sampleSrcBuffer.length);
    fs.writeFileSync(testDestPath, corruptedSmall);

    const result = syncPdfWorker(validSrcPath, testDestPath);
    expect(result.copied).toBe(true);

    const destBuf = fs.readFileSync(testDestPath);
    expect(destBuf.equals(sampleSrcBuffer)).toBe(true);
    expect(computeSha256(testDestPath)).toBe(computeSha256(validSrcPath));
  });

  it('Scenario 4: Destination different but exactly same size -> Detects SHA-256 mismatch and overwrites', () => {
    // Construct different payload with the EXACT same byte length as sampleSrcBuffer
    const sameSizeDifferent = Buffer.alloc(sampleSrcBuffer.length, 0x41); // All 'A's
    expect(sameSizeDifferent.length).toBe(sampleSrcBuffer.length);
    expect(sameSizeDifferent.equals(sampleSrcBuffer)).toBe(false);

    fs.writeFileSync(testDestPath, sameSizeDifferent);
    expect(fs.statSync(testDestPath).size).toBe(fs.statSync(validSrcPath).size);

    const result = syncPdfWorker(validSrcPath, testDestPath);
    expect(result.copied).toBe(true);

    const destBuf = fs.readFileSync(testDestPath);
    expect(destBuf.equals(sampleSrcBuffer)).toBe(true);
    expect(computeSha256(testDestPath)).toBe(computeSha256(validSrcPath));
  });

  it('Scenario 5: Source missing -> Fails clearly with actionable error', () => {
    const missingSrcPath = path.join(tmpDir, 'non-existent-source.mjs');
    expect(fs.existsSync(missingSrcPath)).toBe(false);

    expect(() => {
      syncPdfWorker(missingSrcPath, testDestPath);
    }).toThrowError(/Source worker file not found at/);
  });
});
