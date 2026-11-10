import { test, expect } from '@playwright/test';

test.describe('Admin CMS Phase 03 — Tools CMS End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin before running Tools CMS tests
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('Test 1: Navigate to Tools CMS and verify directory of 25 canonical tools', async ({ page }) => {
    await page.goto('/admin/tools');
    await expect(page.locator('h1')).toHaveText(/Tools CMS Directory/i);
    await expect(page.getByText('25 Canonical Tools', { exact: true })).toBeVisible();

    // Verify key canonical tools exist in directory
    await expect(page.locator('tbody tr').filter({ hasText: 'JPG to PNG' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'PNG to WebP' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'PDF to JPG' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Merge PDF' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'Reorder PDF Pages' })).toBeVisible();

    // Verify search functionality
    const searchInput = page.locator('input[placeholder*="Search by name"]');
    await searchInput.fill('merge-pdf');
    await expect(page.locator('tbody tr').filter({ hasText: 'Merge PDF' })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: 'JPG to PNG' })).not.toBeVisible();
    await searchInput.fill('');
  });

  test('Test 2: Open Tool Editor, modify H1, save draft, and verify draft isolation', async ({ page }) => {
    await page.goto('/admin/tools/png-to-jpg');
    await expect(page.locator('h1')).toContainText('PNG to JPG');

    // Fill H1 Override with a distinctive draft string
    const draftH1 = 'Lightning Fast PNG to JPG Converter (Unpublished Draft)';
    const h1Input = page.locator('#custom-h1-input');
    await h1Input.fill(draftH1);

    // Save Draft
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.getByText(/Draft content saved and revision snapshot created/i)).toBeVisible();

    // Now visit public live tool page in same browser session
    await page.goto('/tools/png-to-jpg');

    // The public page MUST STILL show the canonical H1 and NEVER the draft H1
    const publicH1 = page.locator('h1');
    await expect(publicH1).toBeVisible();
    await expect(publicH1).not.toHaveText(draftH1);
    await expect(publicH1).toHaveText(/Convert PNG to JPG/i);
  });

  test('Test 3: Preview Draft displays draft content and preview mode banner', async ({ page }) => {
    await page.goto('/admin/tools/png-to-jpg/preview');

    // Verify the preview banner
    await expect(page.getByText(/Draft Preview Mode/i)).toBeVisible();
    await expect(page.getByText(/Viewing Draft Overrides for: PNG to JPG/i)).toBeVisible();

    // Verify the draft H1 is rendered on the preview canvas
    await expect(page.locator('h1')).toContainText('Lightning Fast PNG to JPG Converter (Unpublished Draft)');

    // Verify interactive tool dropzone is present in preview
    await expect(page.locator('#png-file-input')).toBeAttached();
  });

  test('Test 4: Publish tool, verify public site renders CMS override, then unpublish', async ({ page }) => {
    await page.goto('/admin/tools/png-to-jpg');

    // Fill and save draft
    const publishedH1 = 'Lightning Fast PNG to JPG Converter (Published)';
    await page.locator('#custom-h1-input').fill(publishedH1);
    await page.getByRole('button', { name: /Save Draft/i }).click();
    await expect(page.getByText(/Draft content saved and revision snapshot created/i)).toBeVisible();

    // Click Publish
    await page.getByRole('button', { name: /^Publish$/i }).click();
    await expect(page.getByText(/is now PUBLISHED/i)).toBeVisible();

    // Visit public tool page
    await page.goto('/tools/png-to-jpg');

    // Verify public page now displays the published CMS H1
    await expect(page.locator('h1')).toHaveText(publishedH1);

    // Now return to editor and unpublish
    await page.goto('/admin/tools/png-to-jpg');
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await expect(page.getByRole('button', { name: /Unpublish/i })).toBeVisible();
    await page.getByRole('button', { name: /Unpublish/i }).click();
    await expect(page.getByText(/Tool unpublished/i)).toBeVisible();

    // Visit public tool page again
    await page.goto('/tools/png-to-jpg');

    // Public page must be back to canonical code defaults
    await expect(page.locator('h1')).not.toHaveText(publishedH1);
    await expect(page.locator('h1')).toHaveText(/Convert PNG to JPG/i);
  });

  test('Test 5: Inspect Revision History and restore historical snapshot', async ({ page }) => {
    await page.goto('/admin/tools/png-to-jpg/revisions');

    await expect(page.locator('h1')).toHaveText(/Revision History/i);
    await expect(page.getByText(/Tool: PNG to JPG/i)).toBeVisible();

    // Verify revisions exist
    const rows = page.locator('.shadow-subtle');
    await expect(rows.first()).toBeVisible();

    // Click View Snapshot
    await page.getByRole('button', { name: /View Snapshot/i }).first().click();
    await expect(page.getByText(/Content Snapshot/i)).toBeVisible();

    // Click Restore
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /Restore This Snapshot/i }).first().click();
    await expect(page.getByText(/Revision successfully restored to current draft/i)).toBeVisible();
  });
});
