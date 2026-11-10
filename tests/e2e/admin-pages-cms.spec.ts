import { test, expect } from '@playwright/test';

test.describe('Admin CMS Phase 02 — Pages CMS End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Admin before running CMS tests
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('Test 1: Navigate to Pages CMS and verify list of manageable pages', async ({ page }) => {
    await page.goto('/admin/pages');
    await expect(page.locator('h1')).toHaveText(/Pages CMS/i);

    // Verify key core public pages exist in the table
    await expect(page.getByRole('cell', { name: 'Home Page' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'About Us' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Contact Us' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Terms of Service' })).toBeVisible();

    // Verify action links exist in rows
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(firstRow.getByRole('link', { name: 'Preview' })).toBeVisible();
    await expect(firstRow.getByRole('link', { name: 'Revisions' })).toBeVisible();
  });

  test('Test 2: Open Page Editor, modify content block, and save draft', async ({ page }) => {
    await page.goto('/admin/pages');

    // Click Edit on About Us row
    const aboutRow = page.locator('tbody tr').filter({ hasText: 'About Us' });
    await aboutRow.getByRole('link', { name: 'Edit' }).click();

    await expect(page).toHaveURL(/\/admin\/pages\/page-about/);
    await expect(page.locator('h1')).toContainText('About Us');

    // Verify Content Blocks tab is active
    await expect(page.getByRole('button', { name: /Structured Content Blocks/i })).toBeVisible();

    // Find the first heading input and modify it
    const headingInput = page.locator('input[placeholder="Heading title..."]').first();
    await expect(headingInput).toBeVisible();
    await headingInput.fill('About FileTools – Free Privacy Utilities');

    // Save draft
    await page.getByRole('button', { name: /Save Draft/i }).click();

    // Verify confirmation notice
    await expect(page.getByText(/Draft updated and new revision snapshot created/i)).toBeVisible();
  });

  test('Test 3: Preview Draft displays draft content and preview mode banner', async ({ page }) => {
    await page.goto('/admin/pages/page-about/preview');

    await expect(page.getByText(/Admin Preview Mode/i)).toBeVisible();
    await expect(page.getByText(/Viewing Draft Content for/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Editor/i })).toBeVisible();
  });

  test('Test 4: Inspect Revision History and verify snapshots', async ({ page }) => {
    await page.goto('/admin/pages/page-about/revisions');

    await expect(page.locator('h1')).toHaveText(/Revision History/i);
    await expect(page.getByText(/Audited snapshots for/i)).toBeVisible();

    // At least one revision snapshot exists
    const inspectButton = page.getByRole('button', { name: /Inspect/i }).first();
    await expect(inspectButton).toBeVisible();
    await inspectButton.click();

    // Verify content blocks snapshot details appear
    await expect(page.getByText(/Content Blocks Snapshot/i)).toBeVisible();
  });
});
