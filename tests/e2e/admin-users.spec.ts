import { test, expect } from '@playwright/test';

test.describe('Admin CMS Phase 06A — User Management & Security End-to-End Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Super Admin
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });

  test('Test 1: Navigate to Users Management from sidebar and verify UI elements', async ({ page }) => {
    const aside = page.locator('aside');
    await expect(aside.getByRole('link', { name: 'Users', exact: true })).toBeVisible();

    await aside.getByRole('link', { name: 'Users', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users/);

    await expect(page.locator('h1')).toContainText('User Management');
    await expect(page.getByRole('button', { name: /Add Administrator/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Search by name or email/i)).toBeVisible();
    await expect(page.getByRole('table').getByText('admin@filetools.local')).toBeVisible();
  });

  test('Test 2: Create a new user with custom password and verify in list', async ({ page }) => {
    await page.goto('/admin/users');

    await page.getByRole('button', { name: /Add Administrator/i }).click();

    // Fill form inside modal with timestamped unique name and email
    const uniqueId = Date.now();
    const uniqueName = `E2E Editor ${uniqueId}`;
    const uniqueEmail = `test-editor-${uniqueId}@filetools.local`;

    await page.getByPlaceholder('e.g. Jane Doe').fill(uniqueName);
    await page.getByPlaceholder('jane@filetools.local').fill(uniqueEmail);
    await page.locator('form').getByRole('combobox').selectOption('EDITOR');
    await page.getByPlaceholder('Minimum 8 characters').fill('EditorPassword123!');

    await page.getByRole('button', { name: 'Create User' }).click();

    // Verify success banner & presence in table
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 5000 });
    const createdRow = page.locator('tr', { hasText: uniqueEmail });
    await expect(createdRow.getByText(uniqueName)).toBeVisible();
    await expect(createdRow.getByText(uniqueEmail)).toBeVisible();
  });

  test('Test 3: Edit user details and change role', async ({ page }) => {
    await page.goto('/admin/users');

    // Create user first
    const uniqueId = Date.now();
    const uniqueEmail = `test-role-${uniqueId}@filetools.local`;
    const origName = `Original Name ${uniqueId}`;
    const updatedName = `Updated Manager ${uniqueId}`;

    await page.getByRole('button', { name: /Add Administrator/i }).click();
    await page.getByPlaceholder('e.g. Jane Doe').fill(origName);
    await page.getByPlaceholder('jane@filetools.local').fill(uniqueEmail);
    await page.locator('form').getByRole('combobox').selectOption('EDITOR');
    await page.getByPlaceholder('Minimum 8 characters').fill('RolePassword123!');
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 5000 });

    // Click edit button for this user
    const row = page.locator('tr', { hasText: uniqueEmail });
    await row.getByTitle('Edit User').click();

    // Change name and role
    await page.locator(`input[value="${origName}"]`).fill(updatedName);
    await page.locator('form').getByRole('combobox').selectOption('CONTENT_MANAGER');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 });
    const updatedRow = page.locator('tr', { hasText: uniqueEmail });
    await expect(updatedRow.getByText(updatedName)).toBeVisible();
    await expect(updatedRow.getByText('Content Manager', { exact: true })).toBeVisible();
  });

  test('Test 4: Deactivate and Reactivate user', async ({ page }) => {
    await page.goto('/admin/users');

    const uniqueEmail = `test-toggle-${Date.now()}@filetools.local`;
    await page.getByRole('button', { name: /Add Administrator/i }).click();
    await page.getByPlaceholder('e.g. Jane Doe').fill('Toggle User');
    await page.getByPlaceholder('jane@filetools.local').fill(uniqueEmail);
    await page.getByPlaceholder('Minimum 8 characters').fill('TogglePassword123!');
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 5000 });

    const row = page.locator('tr', { hasText: uniqueEmail });

    // Click deactivate button
    await row.getByTitle('Deactivate User').click();
    await expect(page.getByText(/Deactivate Administrator\?/i)).toBeVisible();
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click();

    // Verify marked as Deactivated
    await expect(page.getByText(/deactivated successfully/i)).toBeVisible({ timeout: 5000 });
    const deactivatedRow = page.locator('tr', { hasText: uniqueEmail });
    await expect(deactivatedRow.getByText('Deactivated')).toBeVisible();

    // Reactivate
    await deactivatedRow.getByTitle('Activate User').click();
    await expect(page.getByText(/Activate Administrator\?/i)).toBeVisible();
    await page.getByRole('button', { name: 'Activate', exact: true }).click();

    await expect(page.getByText(/activated successfully/i)).toBeVisible({ timeout: 5000 });
    const activeRow = page.locator('tr', { hasText: uniqueEmail });
    await expect(activeRow.getByText('Active')).toBeVisible();
  });

  test('Test 5: Generate single-use password reset link', async ({ page }) => {
    await page.goto('/admin/users');

    const uniqueEmail = `test-reset-${Date.now()}@filetools.local`;
    await page.getByRole('button', { name: /Add Administrator/i }).click();
    await page.getByPlaceholder('e.g. Jane Doe').fill('Reset User');
    await page.getByPlaceholder('jane@filetools.local').fill(uniqueEmail);
    await page.getByPlaceholder('Minimum 8 characters').fill('ResetPassword123!');
    await page.getByRole('button', { name: 'Create User' }).click();
    await expect(page.getByText(/created successfully/i)).toBeVisible({ timeout: 5000 });

    const row = page.locator('tr', { hasText: uniqueEmail });
    await row.getByTitle('Generate Password Reset Link').click();

    await expect(page.getByText(/Password Reset Link/i)).toBeVisible();
    await expect(page.getByText(/expires in 1 hour/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy/i })).toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();
  });
});
