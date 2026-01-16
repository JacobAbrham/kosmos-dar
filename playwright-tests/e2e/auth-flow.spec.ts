/**
 * E2E tests for authentication flow.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('user can login', async ({ page }) => {
    // Navigate to login page
    await page.click('text=Sign In');
    
    // Fill in credentials
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Verify user is logged in
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('user sees error on invalid credentials', async ({ page }) => {
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('user can logout', async ({ page }) => {
    // Login first
    await page.click('text=Sign In');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Logout
    await page.click('button:has-text("Logout")');
    
    // Verify redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});
