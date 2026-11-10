import { describe, it, expect, beforeEach } from 'vitest';
import {
  getMergedTool,
  upsertToolContent,
} from '@/lib/admin/services/tool.service';
import { getAllTools } from '@/lib/tools';
import { resetMemoryDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';

describe('Admin CMS Phase 01 — Tool Content Foundation', () => {
  const author: AdminUserSession = {
    id: 'author-1',
    email: 'admin@filetools.local',
    name: 'Admin',
    role: 'ADMIN',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  it('preserves all 25 canonical tools from lib/tools.ts as default source', async () => {
    const all = getAllTools();
    expect(all.length).toBe(25);

    const merged = await getMergedTool('jpg-to-png');
    expect(merged).not.toBeNull();
    expect(merged?.slug).toBe('jpg-to-png');
    expect(merged?.name).toBe('JPG to PNG');
  });

  it('overlays published CMS overrides onto tool content seamlessly', async () => {
    await upsertToolContent(
      'jpg-to-png',
      {
        customTitle: 'Best Free JPG to PNG Converter Online',
        customH1: 'Convert JPG to PNG in Seconds',
        customDescription: 'Fastest in-browser lossless conversion.',
        isPublished: true,
      },
      author
    );

    const merged = await getMergedTool('jpg-to-png');
    expect(merged).not.toBeNull();
    expect(merged?.title).toBe('Best Free JPG to PNG Converter Online');
    expect(merged?.h1).toBe('Convert JPG to PNG in Seconds');
    expect(merged?.description).toBe('Fastest in-browser lossless conversion.');

    // Functional code properties must remain strictly untouched
    expect(merged?.engine).toBe('image-convert');
    expect(merged?.inputFormats).toEqual(['jpg', 'jpeg']);
    expect(merged?.outputFormats).toEqual(['png']);
    expect(merged?.clientSide).toBe(true);
  });

  it('does not apply unpublished CMS overrides to public tool display', async () => {
    await upsertToolContent(
      'compress-pdf',
      {
        customTitle: 'Unpublished Draft Title for PDF Compressor',
        isPublished: false,
      },
      author
    );

    const merged = await getMergedTool('compress-pdf');
    expect(merged).not.toBeNull();
    // Must still use canonical title
    expect(merged?.title).not.toBe('Unpublished Draft Title for PDF Compressor');
  });

  it('rejects adding overrides for non-existent tools outside the 25 MVP tools', async () => {
    await expect(
      upsertToolContent(
        'non-existent-tool',
        { customTitle: 'Fake Tool' },
        author
      )
    ).rejects.toThrow(/not found in canonical tool registry/i);
  });
});
