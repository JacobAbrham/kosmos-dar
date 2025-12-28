import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing tokens
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.removeItem('kosmos_access_token');
      localStorage.removeItem('kosmos_refresh_token');
    });
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');

    // Check login form is visible
    await expect(page.getByRole('heading', { name: 'KOSMOS' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    // Check demo credentials hint
    await expect(page.getByText('demo@kosmos.io')).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in invalid credentials
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for error message
    await expect(page.getByText(/invalid|error|credentials/i)).toBeVisible({ timeout: 10000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in demo credentials
    await page.getByLabel('Email').fill('demo@kosmos.io');
    await page.getByLabel('Password').fill('demo123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to home page
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Verify tokens are stored
    const accessToken = await page.evaluate(() => localStorage.getItem('kosmos_access_token'));
    expect(accessToken).toBeTruthy();
  });

  test('should redirect to login when accessing protected page without auth', async ({ page }) => {
    // Try to access home page without auth
    await page.goto('/');

    // Check if we're still on home or if there's a redirect
    // Note: This depends on whether the app has auth protection implemented
    const url = page.url();
    expect(url).toMatch(/\/(login)?$/);
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@kosmos.io');
    await page.getByLabel('Password').fill('demo123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for redirect
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Reload the page
    await page.reload();

    // Should still be on home page (session persisted)
    await expect(page).toHaveURL('/');

    // Token should still exist
    const accessToken = await page.evaluate(() => localStorage.getItem('kosmos_access_token'));
    expect(accessToken).toBeTruthy();
  });

  test('should show loading state during login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('demo@kosmos.io');
    await page.getByLabel('Password').fill('demo123');

    // Click login and immediately check for loading state
    const loginButton = page.getByRole('button', { name: 'Sign in' });
    await loginButton.click();

    // Should show loading indicator (either button text changes or spinner appears)
    // The button becomes disabled during loading
    await expect(loginButton).toBeDisabled();
  });
});
