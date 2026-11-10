import { test, expect } from '@playwright/test';

test.describe('Tool Discovery UX & Information Architecture E2E', () => {
  test('Test 1: Homepage Tool Discovery, Search, and Hub Navigation', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Primary Discovery Prompt
    await expect(page.getByRole('heading', { name: /What do you want to do\?/i })).toBeVisible();

    // 2. Verify Search Input
    const searchInput = page.getByRole('textbox', { name: /Search tools\.\.\./i });
    await expect(searchInput).toBeVisible();

    // 3. Test Search matching "compress pdf"
    await searchInput.fill('compress pdf');
    await expect(page.getByText(/Found 1 matching tool/i)).toBeVisible();
    const compressPdfLink = page.getByRole('link', { name: /Compress PDF/i }).first();
    await expect(compressPdfLink).toBeVisible();

    // 4. Test Search Empty State
    await searchInput.fill('xyzunmatchedquery123');
    await expect(page.getByText(/No tools found/i)).toBeVisible();

    // Clear search
    await page.getByLabel('Clear search query').click();
    await expect(page.getByText(/No tools found/i)).not.toBeVisible();

    // 5. Verify Popular Tools (Curated subset)
    await expect(page.getByRole('heading', { name: /^Popular tools$/i })).toBeVisible();
    await expect(page.getByText('Frequently used converters and optimizers.')).toBeVisible();

    // 6. Verify Explore All Tools Hub Cards
    await expect(page.getByRole('heading', { name: /^Explore all tools$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Image Tools Hub/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /PDF Tools Hub/i })).toBeVisible();

    // Click Explore image tools CTA
    const imageHubBtn = page.getByRole('link', { name: /Explore image tools/i });
    await expect(imageHubBtn).toBeVisible();
    await imageHubBtn.click();
    await expect(page).toHaveURL('/image-tools');
  });

  test('Test 2: Image Tools Hub Structure & Categorization', async ({ page }) => {
    await page.goto('/image-tools');

    await expect(page.getByRole('heading', { name: /Image Tools/i, level: 1 })).toBeVisible();
    await expect(page.getByText('What do you want to do?')).toBeVisible();

    // Verify Search
    const searchInput = page.getByRole('textbox', { name: /Search image tools\.\.\./i });
    await expect(searchInput).toBeVisible();

    // Verify 4 Categorized Sections
    await expect(page.getByRole('heading', { name: /^Convert$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Compress$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Edit$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Create$/i })).toBeVisible();

    // Verify Canonical tool cards in Convert section
    await expect(page.getByRole('link', { name: /JPG to PNG/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /PNG to JPG/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Compress Image/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Resize Image/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Image to PDF/i }).first()).toBeVisible();
  });

  test('Test 3: PDF Tools Hub Structure & Categorization', async ({ page }) => {
    await page.goto('/pdf-tools');

    await expect(page.getByRole('heading', { name: /PDF Tools/i, level: 1 })).toBeVisible();
    await expect(page.getByText('What do you want to do?')).toBeVisible();

    // Verify Search
    const searchInput = page.getByRole('textbox', { name: /Search PDF tools\.\.\./i });
    await expect(searchInput).toBeVisible();

    // Verify 4 Categorized Sections
    await expect(page.getByRole('heading', { name: /^Convert$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Organize$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Optimize$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Create$/i })).toBeVisible();

    // Verify Canonical tools
    await expect(page.getByRole('link', { name: /PDF to JPG/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Merge PDF/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Compress PDF/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Image to PDF/i }).first()).toBeVisible();
  });

  test('Test 4: Individual Tool Page Landing Page Structure & Related Tools', async ({ page }) => {
    await page.goto('/tools/compress-pdf');

    // 1. Verify H1 & Short description
    await expect(page.locator('h1')).toHaveText(/Compress PDF Files/i);

    // 2. Verify Functional Tool UI is immediately accessible at top
    await expect(page.getByText('Choose a PDF file to compress')).toBeVisible();

    // 3. Verify Trust / Benefit Row
    await expect(page.getByText('Fast & Local')).toBeVisible();
    await expect(page.getByText('100% Free', { exact: true })).toBeVisible();
    await expect(page.getByText('No Signup')).toBeVisible();
    await expect(page.getByText('Client-Side Privacy')).toBeVisible();

    // 4. Verify How to Use
    await expect(page.getByRole('heading', { name: /How to Use Compress PDF/i })).toBeVisible();

    // 5. Verify Related Tools
    await expect(page.getByRole('heading', { name: /^Related Tools$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Merge PDF/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Split PDF/i }).first()).toBeVisible();
  });

  test('Test 5: Responsive Mobile Viewport (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Homepage on mobile
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /What do you want to do\?/i })).toBeVisible();
    const searchInput = page.getByRole('textbox', { name: /Search tools\.\.\./i });
    await expect(searchInput).toBeVisible();

    // Ensure no horizontal scrollbar on body
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Tool Hub on mobile
    await page.goto('/image-tools');
    await expect(page.getByRole('heading', { name: /Image Tools/i, level: 1 })).toBeVisible();
    const imageScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const imageClientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(imageScrollWidth).toBeLessThanOrEqual(imageClientWidth + 2);
  });
});
