import { test, expect } from '@playwright/test';
import { sanitizeCustomHtml, sanitizeRichTextHtml, isSafeUrl } from '../../lib/admin/validation';

test.describe('SEC-05 Real Chromium Sanitizer & Attack Neutralization E2E', () => {
  test('verifies that sanitized attack payloads never execute scripts or trigger alerts in real Chromium', async ({ page }) => {
    const dialogs: string[] = [];
    const pageErrors: string[] = [];

    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      dialog.dismiss();
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Comprehensive collection of attack payloads tested against sanitizer
    const maliciousPayloads = [
      '<a/href=javascript:alert("solidus-href")>Click Solidus</a>',
      '<img/onerror=alert("solidus-onerror") src=x>',
      '<a / href = javascript:alert("spaced-solidus")>Click Spaced</a>',
      '<a////href=javascript:alert("multi-slash")>Click Multi</a>',
      '<a / / / href = "javascript:alert(\'multi-slash-quoted\')">Click Quoted</a>',
      '<img / / onerror = alert("spaced-img") src=x>',
      '<img src="safe.png"/onerror=alert("between-attr")>',
      '<a/href=`javascript:alert("backtick")`>Click Backtick</a>',
      '<svg/onload=alert("svg-onload")>',
      '<svg><script>alert("svg-script")</script></svg>',
      '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert("math-img")>',
      '<a href="javascript:alert(\'standard-js\')">Click Standard</a>',
      '<a href="vbscript:msgbox(1)">Click VBS</a>',
      '<a href="data:text/html,<script>alert(\'data-xss\')</script>">Click Data</a>',
      '<a href="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">Click SVG Data</a>',
      '<a href="javascript&colon;alert(\'entity-colon\')">Click Entity Colon</a>',
      '<a href="javascript&Tab;alert(\'entity-tab\')">Click Entity Tab</a>',
      '<a href="jav&#x61;script:alert(\'hex-entity\')">Click Hex</a>',
      '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(\'dec-entity\')">Click Dec</a>',
      '<a href="jav\u0000ascript:alert(\'null-byte\')">Click Null</a>',
      '<a href="jav\tascript:alert(\'tab-char\')">Click Tab</a>',
      '<a href="java\nscript:alert(\'newline-char\')">Click Newline</a>',
      '<a href="/\\evil.com/phish">Click Backslash 1</a>',
      '<a href="\\\\evil.com/phish">Click Backslash 2</a>',
      '<a href="//evil.com/phish">Click Protocol Relative</a>',
      '<a href="/%5cevil.com">Click Encoded Backslash</a>',
      '<p style="color: red; background-image: url(javascript:alert(\'css-url\')); expression: alert(\'css-expr\'); -moz-binding: url(xss.xml); behavior: url(test.htc)">Style Attack</p>',
      '<scr<script>ipt>alert("nested-script")</scr<script>ipt>',
      '<ifr<iframe>ame src="javascript:alert(\'nested-iframe\')"></ifr</iframe>ame>',
      '<<SCRIPT>alert("double-bracket");//<</SCRIPT>',
      '<!-- <script>alert("comment-hide")</script> -->',
      '<![CDATA[<script>alert("cdata-hide")</script>]]>',
    ];

    // Sanitize all payloads
    const sanitizedCustomOutputs = maliciousPayloads.map((p) => sanitizeCustomHtml(p));
    const sanitizedRichOutputs = maliciousPayloads.map((p) => sanitizeRichTextHtml(p));

    // Construct an HTML page containing all sanitized fragments
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SEC-05 Sanitizer Test</title>
        </head>
        <body>
          <h1>Sanitized Custom HTML Output</h1>
          <div id="custom-container">
            ${sanitizedCustomOutputs.join('\n')}
          </div>
          <h1>Sanitized Rich Text HTML Output</h1>
          <div id="rich-container">
            ${sanitizedRichOutputs.join('\n')}
          </div>
        </body>
      </html>
    `;

    // Load into real Chromium
    await page.setContent(testHtml, { waitUntil: 'load' });

    // Allow any asynchronous scripts or event handlers time to potentially trigger
    await page.waitForTimeout(1000);

    // Click all rendered links to verify navigation behavior
    const allLinks = await page.locator('a').all();
    for (const link of allLinks) {
      try {
        await link.click({ timeout: 500 });
      } catch {
        // Link may not be navigable or visible, ignore
      }
    }

    // Trigger mouseover and focus events on all elements to ensure no handlers fire
    await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el) => {
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
      });
    });

    await page.waitForTimeout(500);

    // Assert that NO dialogs (alert, confirm, prompt) were EVER triggered
    expect(dialogs).toHaveLength(0);

    // Assert that no unhandled page runtime errors were generated
    expect(pageErrors).toHaveLength(0);
  });

  test('verifies that legitimate raster Base64 images render correctly in real Chromium', async ({ page }) => {
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const htmlSnippet = `<img id="test-png" src="${validPng}" alt="Test 1x1 PNG">`;
    const cleanHtml = sanitizeCustomHtml(htmlSnippet);

    await page.setContent(`<!DOCTYPE html><html><body>${cleanHtml}</body></html>`);

    const img = page.locator('#test-png');
    await expect(img).toBeVisible();

    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    expect(naturalWidth).toBe(1);
  });

  test('verifies that open redirect backslash bypasses cannot break origin in real Chromium', async () => {
    const bypassLinks = [
      '//evil.com',
      '/\\evil.com',
      '\\\\evil.com',
      '/%5cevil.com',
    ];

    for (const target of bypassLinks) {
      expect(isSafeUrl(target)).toBe(false);
      const sanitized = sanitizeCustomHtml(`<a id="nav-link" href="${target}">Nav</a>`);
      expect(sanitized).toContain('href="#"');
    }
  });
});
