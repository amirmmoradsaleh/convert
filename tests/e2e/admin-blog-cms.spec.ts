import { test, expect } from '@playwright/test';

test.describe('Admin CMS Phase 04 — Blog CMS End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin before running Blog CMS tests
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('Test 1: Navigate to Blog Management directory and verify initial UI', async ({ page }) => {
    await page.goto('/admin/blog');
    await expect(page.locator('h1')).toHaveText(/Blog CMS Directory/i);
    await expect(page.getByRole('link', { name: /Create New Post/i })).toBeVisible();

    // Verify search and filter controls are visible
    await expect(page.locator('input[placeholder*="Search posts by title"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('Test 2: Create a new draft article and verify draft isolation', async ({ page }) => {
    await page.goto('/admin/blog/new');
    await expect(page.locator('h1')).toHaveText(/Create New Blog Post/i);

    const testSlug = `e2e-test-draft-${Date.now().toString(36)}`;
    const testTitle = `E2E Test Draft Article ${Date.now()}`;

    // Fill Title and Slug
    await page.locator('#post-title').fill(testTitle);
    await page.locator('#post-slug').fill(testSlug);

    // Submit form
    await page.getByRole('button', { name: /Create & Open Editor/i }).click();

    // Verify redirected to editor
    await expect(page).toHaveURL(new RegExp(`/admin/blog/`), { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(testTitle);

    // Draft Isolation: Visit public post URL — must return 404
    const response = await page.goto(`/blog/${testSlug}`);
    expect(response?.status()).toBe(404);
  });

  test('Test 3: Preview Draft displays draft banner and post details', async ({ page }) => {
    // Navigate to blog directory
    await page.goto('/admin/blog');

    // Create a new post specifically for preview test
    await page.getByRole('link', { name: /Create New Post/i }).click();
    const testSlug = `preview-test-${Date.now().toString(36)}`;
    const testTitle = `Preview Mode Test Post ${Date.now()}`;

    await page.locator('#post-title').fill(testTitle);
    await page.locator('#post-slug').fill(testSlug);
    await page.getByRole('button', { name: /Create & Open Editor/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/blog/`), { timeout: 10000 });

    // Click Preview button
    await page.getByRole('link', { name: /Preview/i }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/blog/.+/preview`), { timeout: 10000 });

    // Verify preview banner and title
    await expect(page.getByText(/Draft Preview Mode/i)).toBeVisible();
    await expect(page.locator('h1')).toHaveText(testTitle);
  });

  test('Test 4: Publish post, verify public site renders it, then unpublish', async ({ page }) => {
    // Handle browser confirm dialogs for publish/unpublish
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/admin/blog/new');
    const pubSlug = `published-e2e-${Date.now().toString(36)}`;
    const pubTitle = `Published Guide E2E ${Date.now()}`;

    await page.locator('#post-title').fill(pubTitle);
    await page.locator('#post-slug').fill(pubSlug);
    await page.getByRole('button', { name: /Create & Open Editor/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/blog/`), { timeout: 10000 });
    await expect(page.locator('#post-title')).toHaveValue(pubTitle, { timeout: 10000 });

    // Click Publish button and wait for response
    const [publishRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/publish') && r.status() === 200),
      page.getByRole('button', { name: 'Publish', exact: true }).click(),
    ]);
    const pubData = await publishRes.json();
    const publishedSlug = pubData.post.slug;

    // Verify button text changed to Unpublish
    await expect(page.getByRole('button', { name: /Unpublish/i })).toBeVisible({ timeout: 10000 });

    // Public URL must now return 200 and display the title
    const res = await page.goto(`/blog/${publishedSlug}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(pubTitle);

    // Unpublish post
    await page.goto('/admin/blog');
    const searchInput = page.locator('input[placeholder*="Search posts by title"]');
    await searchInput.fill(pubTitle);
    const postRow = page.locator('tbody tr').filter({ hasText: pubTitle });
    await expect(postRow).toBeVisible();

    // Click unpublish button in table row and wait for API response
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/unpublish') && r.status() === 200),
      postRow.getByRole('button', { name: /Unpublish/i }).click(),
    ]);

    // After unpublishing, public URL should return 404
    const unpubRes = await page.goto(`/blog/${publishedSlug}`);
    expect(unpubRes?.status()).toBe(404);
  });

  test('Test 5: Rich text formatting and body image rendering parity across editor, preview, and published article', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/admin/blog/new');
    const slug = `rich-test-${Date.now().toString(36)}`;
    const title = `Rich Content Parity Test ${Date.now()}`;

    await page.locator('#post-title').fill(title);
    await page.locator('#post-slug').fill(slug);
    await page.getByRole('button', { name: /Create & Open Editor/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/blog/`), { timeout: 10000 });
    await expect(page.locator('#post-title')).toHaveValue(title, { timeout: 10000 });

    const richMarkdown = [
      '## Architecture Overview',
      '',
      'Convert24 executes all transformations client-side with **zero server uploads**.',
      '',
      '![System Diagram](https://example.com/system-architecture.png)',
      '',
      '### Key Strengths',
      '',
      '- Blazing fast local execution',
      '- Total confidentiality for sensitive docs',
      '',
      '> "Privacy by design is a core principle of Convert24."',
    ].join('\n');

    // Fill content
    await page.locator('#post-markdown-editor').fill(richMarkdown);

    // Save draft
    const [saveRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/admin/blog/') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save Draft/i }).click(),
    ]);
    expect(saveRes.status()).toBe(200);

    // 1. Check Editor Live Preview tab
    await page.getByRole('button', { name: 'Live Preview', exact: true }).click();
    await expect(page.locator('h2', { hasText: 'Architecture Overview' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Key Strengths' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'zero server uploads' })).toBeVisible();
    await expect(page.locator('blockquote')).toContainText('Privacy by design is a core principle');
    await expect(page.locator('img[alt="System Diagram"]')).toBeVisible();

    // 2. Check Admin Preview Page
    await page.getByRole('link', { name: 'Preview', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/blog/.+/preview`), { timeout: 10000 });
    await expect(page.locator('h2', { hasText: 'Architecture Overview' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Key Strengths' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'zero server uploads' })).toBeVisible();
    await expect(page.locator('blockquote')).toContainText('Privacy by design is a core principle');
    await expect(page.locator('img[alt="System Diagram"]')).toBeVisible();

    // 3. Publish and Check Public Article Page
    await page.goBack();
    const [publishRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/publish') && r.status() === 200),
      page.getByRole('button', { name: 'Publish', exact: true }).click(),
    ]);
    expect(publishRes.status()).toBe(200);

    const publicRes = await page.goto(`/blog/${slug}`);
    expect(publicRes?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(title);
    await expect(page.locator('h2', { hasText: 'Architecture Overview' })).toBeVisible();
    await expect(page.locator('h3', { hasText: 'Key Strengths' })).toBeVisible();
    await expect(page.locator('strong', { hasText: 'zero server uploads' })).toBeVisible();
    await expect(page.locator('blockquote')).toContainText('Privacy by design is a core principle');
    await expect(page.locator('img[alt="System Diagram"]')).toBeVisible();

    // Cleanup: Unpublish
    await page.goto('/admin/blog');
    const searchInput = page.locator('input[placeholder*="Search posts by title"]');
    await searchInput.fill(title);
    const postRow = page.locator('tbody tr').filter({ hasText: title });
    await expect(postRow).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/unpublish') && r.status() === 200),
      postRow.getByRole('button', { name: /Unpublish/i }).click(),
    ]);
  });

  test('Test 6: Verify dangerous script tags and javascript: links are neutralized in published blog post', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.goto('/admin/blog/new');
    const slug = `security-test-${Date.now().toString(36)}`;
    const title = `Security Neutralization Test ${Date.now()}`;

    await page.locator('#post-title').fill(title);
    await page.locator('#post-slug').fill(slug);
    await page.getByRole('button', { name: /Create & Open Editor/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/blog/`), { timeout: 10000 });

    const maliciousMarkdown = [
      '## Security Heading',
      '',
      '<script>window.__xss_ran = true;</script>',
      '',
      'Click [here](javascript:alert("pwned")) for exploit.',
      '',
      'Click [protocol relative](//attacker.com) for exploit.',
    ].join('\n');

    await page.locator('#post-markdown-editor').fill(maliciousMarkdown);

    // Save draft
    const [saveRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/admin/blog/') && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save Draft/i }).click(),
    ]);
    expect(saveRes.status()).toBe(200);

    // Publish
    const [publishRes] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/publish') && r.status() === 200),
      page.getByRole('button', { name: 'Publish', exact: true }).click(),
    ]);
    expect(publishRes.status()).toBe(200);

    // Navigate to published post
    await page.goto(`/blog/${slug}`);
    await expect(page.locator('h1')).toHaveText(title);

    // Verify script did NOT execute
    const xssRan = await page.evaluate(() => (window as unknown as { __xss_ran?: boolean }).__xss_ran);
    expect(xssRan).toBeUndefined();

    // Verify link href is '#' and not 'javascript:' or '//attacker.com'
    const exploitLink = page.locator('a', { hasText: 'here' });
    await expect(exploitLink).toHaveAttribute('href', '#');

    const protoLink = page.locator('a', { hasText: 'protocol relative' });
    await expect(protoLink).toHaveAttribute('href', '#');

    // Cleanup: Unpublish
    await page.goto('/admin/blog');
    const searchInput = page.locator('input[placeholder*="Search posts by title"]');
    await searchInput.fill(title);
    const postRow = page.locator('tbody tr').filter({ hasText: title });
    await expect(postRow).toBeVisible();
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/unpublish') && r.status() === 200),
      postRow.getByRole('button', { name: /Unpublish/i }).click(),
    ]);
  });
});
