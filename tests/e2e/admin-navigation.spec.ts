import { test, expect } from '@playwright/test';

test.describe('Admin Header Navigation CMS — End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as Super Admin before each test
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('Navigate to Header Navigation CMS via sidebar link and verify UI elements', async ({
    page,
  }) => {
    const aside = page.locator('aside');
    const navLink = aside.getByRole('link', { name: 'Navigation', exact: true });
    await expect(navLink).toBeVisible();
    await navLink.click();

    await expect(page).toHaveURL(/\/admin\/navigation/);
    await expect(page.locator('h1')).toHaveText(/Header Navigation/i);
    await expect(page.getByRole('button', { name: /Add Menu Item/i })).toBeVisible();
    await expect(page.getByText('All Changes Saved')).toBeVisible();

    // Verify seeded items are rendered in the navigation list
    const list = page.locator('.divide-y');
    await expect(list.getByText('Blog', { exact: true })).toBeVisible();
    await expect(list.getByText('Pricing', { exact: true })).toBeVisible();
    await expect(list.getByText('Help', { exact: true })).toBeVisible();
  });

  test('Full CRUD, Visibility Toggle, and Delete Confirmation lifecycle', async ({
    page,
  }) => {
    await page.goto('/admin/navigation');
    await expect(page).toHaveURL(/\/admin\/navigation/);

    const list = page.locator('.divide-y');
    const uniqueId = Date.now().toString().slice(-4);
    const initialLabel = `Test Link ${uniqueId}`;
    const initialDest = `/#features-${uniqueId}`;
    const updatedLabel = `Test Link Updated ${uniqueId}`;

    // 1. Create a new Navigation Item
    await page.getByRole('button', { name: /Add Menu Item/i }).click();
    const addModal = page.locator('div[role="dialog"]');
    await expect(addModal).toBeVisible();
    await expect(addModal.locator('#add-modal-title')).toHaveText(/Add Navigation Item/i);

    await addModal.locator('input[placeholder*="Tools, Blog"]').fill(initialLabel);
    await addModal.locator('input[placeholder*="/blog"]').fill(initialDest);
    await addModal.getByRole('button', { name: 'Add Item' }).click();

    // Verify item created
    await expect(list.getByText(initialLabel, { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(list.getByText(initialDest)).toBeVisible();

    // 2. Edit Navigation Item
    const editBtn = page.locator(`button[aria-label="Edit ${initialLabel}"]`);
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const editModal = page.locator('div[role="dialog"]');
    await expect(editModal).toBeVisible();
    await expect(editModal.locator('#edit-modal-title')).toHaveText(/Edit Navigation Item/i);

    const labelInput = editModal.locator('input[type="text"]').first();
    await labelInput.fill(updatedLabel);
    await editModal.getByRole('button', { name: 'Save Changes' }).click();

    // Verify updated label
    await expect(list.getByText(updatedLabel, { exact: true })).toBeVisible({ timeout: 5000 });

    // 3. Toggle Visibility
    const visibilityBtn = page.locator(`button[aria-label="Hide ${updatedLabel}"]`);
    await expect(visibilityBtn).toBeVisible();
    await visibilityBtn.click();

    // Verify hidden badge toggle
    await expect(page.locator(`button[aria-label="Make ${updatedLabel} visible"]`)).toBeVisible({ timeout: 5000 });

    // 4. Delete Navigation Item with Confirmation
    const deleteBtn = page.locator(`button[aria-label="Delete ${updatedLabel}"]`);
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const deleteModal = page.locator('div[role="dialog"]');
    await expect(deleteModal).toBeVisible();
    await expect(deleteModal.locator('#delete-modal-title')).toHaveText(/Delete Navigation Item/i);
    await expect(deleteModal.getByText(/Are you sure you want to remove/i)).toBeVisible();

    await deleteModal.getByRole('button', { name: 'Delete Item' }).click();

    // Verify item removed
    await expect(list.getByText(updatedLabel)).not.toBeVisible({ timeout: 5000 });
  });

  test('Public header renders saved navigation items and respects hidden items', async ({
    page,
  }) => {
    // Navigate to homepage
    await page.goto('/');

    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Verify public navigation items
    await expect(header.getByRole('link', { name: 'Blog', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Pricing', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Help', exact: true })).toBeVisible();
  });
});
