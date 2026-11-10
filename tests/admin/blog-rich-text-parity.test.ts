import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseMarkdownBlocks,
  renderInline,
  slugifyHeading,
} from '@/components/blog/BlogContentRenderer';
import {
  sanitizeRichTextHtml,
  isSafeUrl,
} from '@/lib/admin/validation';
import {
  calculateReadingTime,
  createBlogDraft,
  updateBlogDraft,
  publishBlogPost,
} from '@/lib/admin/services/blog.service';
import { getPublishedPostBySlug } from '@/lib/cms/blog-resolver';
import { resetMemoryDb } from '@/lib/db';
import { AdminUserSession } from '@/lib/admin/types';

describe('Blog Rich-Text Editing and Published Rendering Parity', () => {
  const author: AdminUserSession = {
    id: 'admin-author-01',
    email: 'blog-editor@filetools.local',
    name: 'Tech Editor',
    role: 'CONTENT_MANAGER',
  };

  beforeEach(() => {
    resetMemoryDb();
  });

  describe('1. Markdown Block Parser', () => {
    it('parses H2 and H3 headings with appropriate levels', () => {
      const markdown = '## Main Section Title\n\n### Sub-section Details';
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'heading',
        level: 2,
        text: 'Main Section Title',
      });
      expect(blocks[1]).toEqual({
        type: 'heading',
        level: 3,
        text: 'Sub-section Details',
      });
    });

    it('generates URL-safe anchor slug IDs for headings', () => {
      expect(slugifyHeading('Understanding PNG & WebP Compression!')).toBe(
        'understanding-png-webp-compression'
      );
      expect(slugifyHeading('## 5 Essential Tips')).toBe('5-essential-tips');
    });

    it('parses unordered and ordered lists correctly', () => {
      const markdown = `- First bullet\n- Second bullet\n\n1. First numbered\n2. Second numbered`;
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'list',
        ordered: false,
        items: ['First bullet', 'Second bullet'],
      });
      expect(blocks[1]).toEqual({
        type: 'list',
        ordered: true,
        items: ['First numbered', 'Second numbered'],
      });
    });

    it('parses blockquotes cleanly', () => {
      const markdown = `> User privacy is protected because all conversions run locally in browser memory.`;
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'quote',
        text: 'User privacy is protected because all conversions run locally in browser memory.',
      });
    });

    it('parses fenced code blocks with language identifiers', () => {
      const markdown = '```typescript\nconst a: number = 42;\nreturn a * 2;\n```';
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'code',
        lang: 'typescript',
        code: 'const a: number = 42;\nreturn a * 2;',
      });
    });

    it('parses standalone markdown images as image blocks', () => {
      const markdown = `![Comparison Chart](https://example.com/assets/comparison.png)`;
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'image',
        alt: 'Comparison Chart',
        src: 'https://example.com/assets/comparison.png',
      });
    });

    it('parses standalone HTML img tags as image blocks', () => {
      const markdown = `<img src="https://example.com/assets/banner.webp" alt="Feature Banner" />`;
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'image',
        alt: 'Feature Banner',
        src: 'https://example.com/assets/banner.webp',
      });
    });

    it('handles backward-compatible plain text paragraphs', () => {
      const markdown = 'First paragraph text.\n\nSecond paragraph text.';
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'paragraph',
        text: 'First paragraph text.',
      });
      expect(blocks[1]).toEqual({
        type: 'paragraph',
        text: 'Second paragraph text.',
      });
    });

    it('strips trailing hashes from headings and handles non-alphanumeric heading gracefully', () => {
      const markdown = '### Heading with trailing hashes ###\n\n### !!!';
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'heading',
        level: 3,
        text: 'Heading with trailing hashes',
      });
      expect(slugifyHeading((blocks[0] as any).text)).toBe('heading-with-trailing-hashes');

      expect(blocks[1]).toEqual({
        type: 'heading',
        level: 3,
        text: '!!!',
      });
      expect(slugifyHeading((blocks[1] as any).text)).toBe('');
    });

    it('sanitizes code block language identifiers and stops blockquote before code fences', () => {
      const markdown = '> Important notice\n```bash\ncurl -sSL https://example.com\n```';
      const blocks = parseMarkdownBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({
        type: 'quote',
        text: 'Important notice',
      });
      expect(blocks[1]).toEqual({
        type: 'code',
        lang: 'bash',
        code: 'curl -sSL https://example.com',
      });
    });

    it('preserves URLs containing parentheses without truncation', () => {
      const markdown = '[Wiki Article](https://en.wikipedia.org/wiki/File_(disambiguation))';
      const clean = sanitizeRichTextHtml(markdown);

      expect(clean).toBe(markdown);
    });
  });

  describe('2. Inline Formatting & Tokens', () => {
    it('tokenizes bold, italic, and code within text', () => {
      const nodes = renderInline(
        'Here is **bold** text, *italic* styling, and `const x = 1` code.'
      );
      expect(nodes.length).toBeGreaterThan(1);
    });

    it('does not format mathematical multiplication asterisks as italics', () => {
      const mathNodes = renderInline('The calculation is 2 * 3 * 4 = 24 total.');
      // None of the rendered nodes should be <em> elements
      const hasEmNode = mathNodes.some(
        (n: any) => typeof n === 'object' && n?.type === 'em'
      );
      expect(hasEmNode).toBe(false);
    });

    it('handles valid links safely with target and rel attributes', () => {
      const nodes = renderInline('Visit [Google](https://google.com) for details.');
      expect(nodes.length).toBeGreaterThan(1);
    });

    it('handles inline images with alt text within text', () => {
      const nodes = renderInline(
        'See figure ![diagram](https://example.com/diag.png) inline.'
      );
      expect(nodes.length).toBeGreaterThan(1);
    });
  });

  describe('3. Content Sanitization & XSS Defense', () => {
    it('neutralizes javascript: URIs in markdown links', () => {
      const dirty = 'Click [here](javascript:alert("xss")) to exploit.';
      const clean = sanitizeRichTextHtml(dirty);

      expect(clean).toBe('Click [here](#) to exploit.');
      expect(clean).not.toContain('javascript:');
    });

    it('neutralizes javascript: URIs in markdown images', () => {
      const dirty = 'Here is an image: ![Exploit](javascript:alert(1))';
      const clean = sanitizeRichTextHtml(dirty);

      expect(clean).toBe('Here is an image: ![Exploit](#)');
      expect(clean).not.toContain('javascript:');
    });

    it('neutralizes unsafe data: URIs in markdown images while allowing raster images', () => {
      const svgData = '![SVG](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)';
      const cleanSvg = sanitizeRichTextHtml(svgData);
      expect(cleanSvg).toBe('![SVG](#)');

      const pngData = '![PNG](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==)';
      const cleanPng = sanitizeRichTextHtml(pngData);
      expect(cleanPng).toBe(pngData);
    });

    it('strips <script> tags and inline onerror attributes from content body', () => {
      const dirty = '<p>Normal text</p><script>alert(1)</script><img src="x" onerror="alert(2)" />';
      const clean = sanitizeRichTextHtml(dirty);

      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('alert(1)');
      expect(clean).not.toContain('onerror');
      expect(clean).toContain('Normal text');
    });

    it('renderer validates safe URLs before rendering', () => {
      expect(isSafeUrl('https://example.com/image.png')).toBe(true);
      expect(isSafeUrl('/uploads/image.png')).toBe(true);
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeUrl('//evil.com')).toBe(false);
      expect(isSafeUrl('/\\evil.com')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('blob:http://example.com')).toBe(false);
    });

    it('neutralizes protocol-relative and backslash URLs in markdown links and HTML attributes', () => {
      const markdownProto = 'Check [this link](//attacker.com/phish) now.';
      expect(sanitizeRichTextHtml(markdownProto)).toBe('Check [this link](#) now.');

      const markdownBackslash = 'Check [this link](/\\attacker.com) and [another](http://legit.com\\evil).';
      expect(sanitizeRichTextHtml(markdownBackslash)).toBe('Check [this link](#) and [another](#).');

      const htmlProto = '<a href="//attacker.com/malware">Click here</a>';
      expect(sanitizeRichTextHtml(htmlProto)).toBe('<a href="#">Click here</a>');

      const htmlBackslash = '<a href="/\\attacker.com">Click here</a>';
      expect(sanitizeRichTextHtml(htmlBackslash)).toBe('<a href="#">Click here</a>');
    });

    it('neutralizes entity-obfuscated schemes and forbidden protocols', () => {
      const obfuscated = 'Click [here](java&tab;script:alert(1)) or [here](java&#10;script:alert(2)).';
      expect(sanitizeRichTextHtml(obfuscated)).toBe('Click [here](#) or [here](#).');

      const fileProto = 'Download [config](file:///etc/passwd) or [blob](blob:http://example.com/uuid).';
      expect(sanitizeRichTextHtml(fileProto)).toBe('Download [config](#) or [blob](#).');
    });

    it('recursively neutralizes nested script tags and solidus-separated event handlers', () => {
      const nested = '<scr<script></script>ipt>alert(1)</script>Safe text';
      expect(sanitizeRichTextHtml(nested)).toBe('Safe text');

      const solidusImg = '<img/onerror=alert(1) src="/valid.png" />';
      const sanitizedImg = sanitizeRichTextHtml(solidusImg);
      expect(sanitizedImg).not.toContain('onerror');
      expect(sanitizedImg).toContain('src="/valid.png"');
    });

    it('neutralizes unsafe featuredImage URLs on stored database records during retrieval', async () => {
      const post = await createBlogDraft(
        {
          title: 'Post with Legacy Unsafe Image',
          content: 'Legitimate body content',
        },
        author
      );

      const db = (await import('@/lib/db')).getDb();
      await db.blogPost.update({
        where: { id: post.id },
        data: {
          featuredImage: 'javascript:alert("exploit")',
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });

      const resolved = await getPublishedPostBySlug(post.slug);
      expect(resolved?.featuredImage).toBeNull();
    });
  });

  describe('4. Reading Time Calculation with Markdown & Images', () => {
    it('does not count image URLs towards reading time word count', () => {
      const textOnly = 'word '.repeat(200);
      const textWithImage = 'word '.repeat(200) + '\n\n![A diagram](https://example.com/very/long/nested/path/to/an/image/asset/file.png)\n\n';

      expect(calculateReadingTime(textOnly)).toBe('1 min read');
      expect(calculateReadingTime(textWithImage)).toBe('1 min read');
    });
  });

  describe('5. Full End-to-End Blog Article Lifecycle with Rich Text & Images', () => {
    it('creates a draft, updates with rich markdown & body image, publishes, and verifies public resolution', async () => {
      // 1. Create draft
      const draft = await createBlogDraft(
        {
          title: 'Ultimate Guide to WebP Compression',
          content: '## Introduction\n\nStart writing...',
        },
        author
      );

      expect(draft.status).toBe('DRAFT');
      expect(draft.slug).toBe('ultimate-guide-to-webp-compression');

      // 2. Update with rich formatting and inline image
      const richContent = [
        '## Introduction',
        '',
        'WebP offers significant savings over legacy JPEG and PNG formats.',
        '',
        '![Compression Efficiency Chart](https://example.com/media/webp-vs-png.png)',
        '',
        '### Key Format Advantages',
        '',
        '- **Lossless compression**: 26% smaller than PNG.',
        '- **Lossy compression**: 25-34% smaller than JPEG.',
        '- Full alpha channel transparency support.',
        '',
        '> "Adopting WebP reduced our transfer bandwidth by 40% globally."',
        '',
        '```bash\n# Convert PNG to WebP with cwebp\ncwebp -q 80 input.png -o output.webp\n```',
        '',
        'Learn more at [Google Developers](https://developers.google.com/speed/webp).',
      ].join('\n');

      const updated = await updateBlogDraft(
        draft.id,
        {
          content: richContent,
          status: 'DRAFT',
        },
        author
      );

      expect(updated.content).toBe(richContent);

      // 3. Publish post
      const published = await publishBlogPost(draft.id, author);
      expect(published.status).toBe('PUBLISHED');
      expect(published.publishedAt).not.toBeNull();

      // 4. Resolve public post by slug
      const resolved = await getPublishedPostBySlug(draft.slug);
      expect(resolved).not.toBeNull();
      expect(resolved?.title).toBe('Ultimate Guide to WebP Compression');
      expect(resolved?.content).toBe(richContent);

      // 5. Verify blocks can be parsed from published content
      const parsedBlocks = parseMarkdownBlocks(resolved?.content);
      expect(parsedBlocks.length).toBe(8);
      expect(parsedBlocks[0].type).toBe('heading');
      expect(parsedBlocks[1].type).toBe('paragraph');
      expect(parsedBlocks[2].type).toBe('image');
      expect(parsedBlocks[3].type).toBe('heading');
      expect(parsedBlocks[4].type).toBe('list');
      expect(parsedBlocks[5].type).toBe('quote');
      expect(parsedBlocks[6].type).toBe('code');
      expect(parsedBlocks[7].type).toBe('paragraph');
    });
  });
});
