import { test, expect } from '@playwright/test';

test.describe('Search, Navigation, and Breadcrumbs E2E Tests', () => {
  test('Test 1: Search reliably displays matching results, keyboard navigation, Enter, Escape, and link navigation', async ({
    page,
  }) => {
    await page.goto('/');

    const searchInput = page.getByRole('textbox', { name: /Search tools\.\.\./i });
    await expect(searchInput).toBeVisible();

    // 1. Search for "jpg" -> results appear reliably
    await searchInput.fill('jpg');
    const resultsContainer = page.getByTestId('tool-search-results');
    await expect(resultsContainer).toBeVisible();
    await expect(page.getByTestId('search-result-jpg-to-png')).toBeVisible();
    await expect(resultsContainer.getByText('JPG to PNG', { exact: true })).toBeVisible();

    // 2. Arrow keys highlight and Enter navigates
    await searchInput.press('ArrowDown');
    // Top result selected -> press Enter to navigate
    await searchInput.press('Enter');
    await expect(page).toHaveURL(/\/tools\/[a-z0-9-]+/);

    // 3. Return to homepage and test query "compress"
    await page.goto('/');
    const searchInput2 = page.getByRole('textbox', { name: /Search tools\.\.\./i });
    await searchInput2.fill('compress');
    await expect(page.getByTestId('search-result-compress-pdf')).toBeVisible();
    await expect(page.getByTestId('search-result-compress-image')).toBeVisible();

    // 4. Test clicking a specific result link navigates directly
    await page.getByTestId('search-result-compress-pdf').click();
    await expect(page).toHaveURL('/tools/compress-pdf');

    // 5. Test Escape key clears/closes search dropdown
    await page.goto('/');
    const searchInput3 = page.getByRole('textbox', { name: /Search tools\.\.\./i });
    await searchInput3.fill('merge pdf');
    await expect(page.getByTestId('search-result-merge-pdf')).toBeVisible();
    await searchInput3.press('Escape');
    await expect(page.getByTestId('tool-search-results')).not.toBeVisible();

    // 6. Test search on Image Tools hub (/image-tools)
    await page.goto('/image-tools');
    const imageSearch = page.getByRole('textbox', { name: /Search image tools\.\.\./i });
    await imageSearch.fill('webp');
    await expect(page.getByTestId('search-result-jpg-to-webp')).toBeVisible();
    await expect(page.getByTestId('search-result-webp-to-jpg')).toBeVisible();
    await page.getByTestId('search-result-jpg-to-webp').click();
    await expect(page).toHaveURL('/tools/jpg-to-webp');

    // 7. Test search on PDF Tools hub (/pdf-tools)
    await page.goto('/pdf-tools');
    const pdfSearch = page.getByRole('textbox', { name: /Search PDF tools\.\.\./i });
    await pdfSearch.fill('split');
    await expect(page.getByTestId('search-result-split-pdf')).toBeVisible();
    await page.getByTestId('search-result-split-pdf').click();
    await expect(page).toHaveURL('/tools/split-pdf');
  });

  test('Test 2: Tool Page breadcrumb, back navigation, and post-action related tools', async ({
    page,
  }) => {
    // Navigate to JPG to PNG tool
    await page.goto('/tools/jpg-to-png');

    // 1. Breadcrumb navigation
    const breadcrumbNav = page.getByRole('navigation', { name: /Breadcrumb/i });
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(breadcrumbNav.getByRole('link', { name: 'Image Tools' })).toBeVisible();
    await expect(breadcrumbNav.getByText('JPG to PNG')).toBeVisible();

    // 2. Back to tools button
    const backBtn = page.getByRole('link', { name: /Back to Image Tools/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL('/image-tools');

    // Check PDF tool breadcrumb
    await page.goto('/tools/compress-pdf');
    const pdfBreadcrumb = page.getByRole('navigation', { name: /Breadcrumb/i });
    await expect(pdfBreadcrumb.getByRole('link', { name: 'PDF Tools' })).toBeVisible();
    const pdfBackBtn = page.getByRole('link', { name: /Back to PDF Tools/i });
    await expect(pdfBackBtn).toBeVisible();
  });
});
