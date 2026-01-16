/**
 * E2E tests for agent interaction flow.
 */

import { test, expect } from '@playwright/test';

test.describe('Agent Interaction', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('user can select an agent', async ({ page }) => {
    // Navigate to agents page
    await page.click('text=Agents');
    
    // Select Athena agent
    await page.click('text=Athena');
    
    // Verify agent chat interface appears
    await expect(page.locator('text=Athena')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="message"]')).toBeVisible();
  });

  test('user can send message to agent', async ({ page }) => {
    await page.click('text=Agents');
    await page.click('text=Athena');
    
    // Type message
    const messageInput = page.locator('textarea[placeholder*="message"]');
    await messageInput.fill('What is the weather?');
    
    // Send message
    await page.click('button:has-text("Send")');
    
    // Verify message appears in chat
    await expect(page.locator('text=What is the weather?')).toBeVisible();
    
    // Wait for agent response (mock)
    await expect(page.locator('text=Assistant')).toBeVisible({ timeout: 5000 });
  });

  test('agent status updates correctly', async ({ page }) => {
    await page.click('text=Agents');
    await page.click('text=Athena');
    
    // Verify agent status badge
    const statusBadge = page.locator('[data-testid="agent-status"]');
    await expect(statusBadge).toBeVisible();
  });
});
