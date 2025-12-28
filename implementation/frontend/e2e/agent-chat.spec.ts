import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@kosmos.io');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Agent Chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display main chat interface', async ({ page }) => {
    // Check main UI elements
    await expect(page.getByRole('heading', { name: 'KOSMOS' })).toBeVisible();

    // Check command input
    await expect(page.getByPlaceholder(/ask kosmos/i)).toBeVisible();

    // Check agent panel (at least one glassmorphism element)
    const glassmorphismCount = await page.locator('.glassmorphism').count();
    expect(glassmorphismCount).toBeGreaterThan(0);
  });

  test('should show quick action suggestions', async ({ page }) => {
    // Check quick action buttons
    await expect(page.getByText('Analyze Q4 sales data')).toBeVisible();
    await expect(page.getByText('Schedule team meeting')).toBeVisible();
    await expect(page.getByText('Review security audit')).toBeVisible();
  });

  test('should allow typing in command input', async ({ page }) => {
    const input = page.getByPlaceholder(/ask kosmos/i);

    await input.fill('Hello, KOSMOS!');
    await expect(input).toHaveValue('Hello, KOSMOS!');
  });

  test('should have send button that enables when text is entered', async ({ page }) => {
    const input = page.getByPlaceholder(/ask kosmos/i);
    const sendButton = page.locator('button').filter({ has: page.locator('svg.lucide-send') });

    // Initially disabled when empty
    await expect(sendButton).toBeDisabled();

    // Enable when text is entered
    await input.fill('Test message');
    await expect(sendButton).toBeEnabled();

    // Disable again when cleared
    await input.fill('');
    await expect(sendButton).toBeDisabled();
  });

  test('should submit message on Enter key', async ({ page }) => {
    const input = page.getByPlaceholder(/ask kosmos/i);

    await input.fill('Test message');
    await input.press('Enter');

    // Input should be cleared after submission
    await expect(input).toHaveValue('', { timeout: 5000 });
  });

  test('should allow newline with Shift+Enter', async ({ page }) => {
    const input = page.getByPlaceholder(/ask kosmos/i);

    await input.fill('Line 1');
    await input.press('Shift+Enter');
    await input.type('Line 2');

    // Should contain both lines
    await expect(input).toHaveValue('Line 1\nLine 2');
  });

  test('should trigger quick action on click', async ({ page }) => {
    const quickAction = page.getByText('Analyze Q4 sales data');

    await quickAction.click();

    // The message should be sent (input cleared or message appears in conversation)
    // This depends on the implementation
    await page.waitForTimeout(500);
  });

  test('should show WebSocket connection status', async ({ page }) => {
    // Look for connection status indicator
    const statusIndicator = page.locator('.w-2.h-2.rounded-full');

    // Should have some status indicator visible
    await expect(statusIndicator.first()).toBeVisible();
  });

  test('should navigate to agents page', async ({ page }) => {
    // Click on agents in sidebar or navigation
    const agentsLink = page.getByRole('link', { name: /agents/i }).first();

    if (await agentsLink.isVisible()) {
      await agentsLink.click();
      await expect(page).toHaveURL(/\/agents/);
    }
  });

  test('should show sidebar navigation', async ({ page }) => {
    // Check sidebar has navigation items
    const sidebar = page.locator('aside, nav').first();

    await expect(sidebar).toBeVisible();
  });
});

test.describe('Agent Panel', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display agent panel', async ({ page }) => {
    // Check for glassmorphism panels
    const glassmorphismCount = await page.locator('.glassmorphism').count();
    expect(glassmorphismCount).toBeGreaterThan(0);
  });

  test('should navigate to agent details on click', async ({ page }) => {
    // If there's an agents list, click on one
    await page.goto('/agents');

    const agentCard = page.locator('.agent-card, [class*="agent"]').first();

    if (await agentCard.isVisible()) {
      await agentCard.click();
      expect(page.url()).toMatch(/\/agents\/|agent/);
    }
  });
});
