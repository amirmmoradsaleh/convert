import { test, expect } from '@playwright/test';

test.describe('Admin CMS Phase 05 — Media Library End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin before running Media Library tests
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('Test 1: Navigate to Media Library and verify UI controls', async ({ page }) => {
    await page.goto('/admin/media');
    await expect(page.locator('h1')).toHaveText(/Media Library/i);
    await expect(page.getByRole('button', { name: /Upload Asset/i })).toBeVisible();

    // Verify search and MIME filter controls
    await expect(page.locator('input[placeholder*="Search assets by filename"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('Test 2: Open and close Upload Asset Modal', async ({ page }) => {
    await page.goto('/admin/media');
    await page.getByRole('button', { name: /Upload Asset/i }).click();

    // Verify modal elements are visible
    await expect(page.getByRole('heading', { name: /Upload Media Asset/i })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeAttached();
    await expect(page.locator('input[placeholder*="Diagram explaining"]')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByRole('heading', { name: /Upload Media Asset/i })).not.toBeVisible();
  });

  test('Test 3: Verify Media Picker Modal in Blog Editor', async ({ page }) => {
    await page.goto('/admin/blog/new');
    await expect(page.locator('h1')).toHaveText(/Create New Blog Post/i);

    const testSlug = `media-picker-test-${Date.now().toString(36)}`;
    const testTitle = `Media Picker Test ${Date.now()}`;

    await page.locator('#post-title').fill(testTitle);
    await page.locator('#post-slug').fill(testSlug);
    await page.getByRole('button', { name: /Create & Open Editor/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/blog/`), { timeout: 10000 });

    // Click "Select from Media Library" button for Featured Image
    const selectMediaBtn = page.getByRole('button', { name: /Media Library/i }).first();
    await expect(selectMediaBtn).toBeVisible();
    await selectMediaBtn.click();

    // Verify Media Picker Modal opens with tabs
    await expect(page.getByText('Select Media Asset')).toBeVisible();
    await expect(page.getByRole('button', { name: /Browse Library/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload New/i })).toBeVisible();

    // Close the picker modal
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.getByText('Select Media Asset')).not.toBeVisible();
  });
});
