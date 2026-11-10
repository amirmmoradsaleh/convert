import { test, expect } from '@playwright/test';

test.describe('Admin CMS Phase 01 — End-to-End Tests', () => {
  test('Test 1: Unauthenticated request to /admin/dashboard redirects to /admin/login', async ({
    page,
  }) => {
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('h1')).toHaveText(/FileTools CMS/i);
    await expect(page.locator('#admin-email')).toBeVisible();
    await expect(page.locator('#admin-password')).toBeVisible();
  });

  test('Test 2: Invalid credentials display clear error message', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('WrongPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();

    const alert = page.locator('#login-error-alert');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toHaveText(/Invalid email or password/i);
  });

  test('Test 3: Valid admin login succeeds and provides access to dashboard and navigation', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await page.locator('#admin-email').fill('admin@filetools.local');
    await page.locator('#admin-password').fill('AdminPassword123!');
    await page.getByRole('button', { name: /Sign in to Dashboard/i }).click();

    // Verify redirected to dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toHaveText(/Overview/i);

    // Verify dashboard statistics cards
    await expect(page.getByText('Published Pages')).toBeVisible();
    await expect(page.getByText('Draft Pages')).toBeVisible();
    await expect(page.getByText('Available Tools')).toBeVisible();

    const aside = page.locator('aside');

    // Verify sidebar navigation links
    await expect(aside.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Pages', exact: true })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Tools', exact: true })).toBeVisible();
    await expect(aside.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();

    // Verify left sidebar is fixed positioned
    const asidePosition = await aside.evaluate((el) => window.getComputedStyle(el).position);
    expect(asidePosition).toBe('fixed');

    // Navigate to Pages CMS
    await aside.getByRole('link', { name: 'Pages', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pages/);
    await expect(page.locator('h1')).toHaveText(/Pages CMS/i);
    await expect(page.getByText('Homepage', { exact: true })).toBeVisible();

    // Navigate to Tools CMS
    await aside.getByRole('link', { name: 'Tools', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/tools/);
    await expect(page.locator('h1')).toHaveText(/Tools CMS (Foundation|Directory)/i);
    await expect(page.locator('table').getByText('JPG to PNG', { exact: true })).toBeVisible();

    // Navigate to Settings
    await aside.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/settings/);
    await expect(page.locator('h1')).toHaveText(/Global Settings/i);

    // Logout
    await page.getByRole('button', { name: /Logout/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10000 });

    // Verify subsequent access is blocked
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
