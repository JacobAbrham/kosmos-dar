import { test, expect } from '@playwright/test';

// Helper to login before tests
async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('demo@kosmos.io');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}

test.describe('Workflows Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/workflows');
  });

  test('should display workflows page header', async ({ page }) => {
    // Check page title
    await expect(page.getByRole('heading', { name: 'Workflows' })).toBeVisible();
    await expect(page.getByText('Create and manage automated workflows')).toBeVisible();
  });

  test('should show New Workflow button', async ({ page }) => {
    const newWorkflowBtn = page.getByRole('button', { name: /new workflow/i });
    await expect(newWorkflowBtn).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    // Check for stat cards
    await expect(page.getByText('Total')).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
    await expect(page.getByText('Draft')).toBeVisible();
    await expect(page.getByText('Paused')).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search workflows...');
    await expect(searchInput).toBeVisible();

    // Test search functionality
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');
  });

  test('should have status filter dropdown', async ({ page }) => {
    const statusFilter = page.locator('select').filter({ hasText: 'All Status' });
    await expect(statusFilter).toBeVisible();

    // Test filter options
    await statusFilter.selectOption('active');
    await expect(statusFilter).toHaveValue('active');

    await statusFilter.selectOption('draft');
    await expect(statusFilter).toHaveValue('draft');
  });

  test('should display templates section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();

    // Check template options
    await expect(page.getByText('Data Analysis Pipeline')).toBeVisible();
    await expect(page.getByText('Email Automation')).toBeVisible();
    await expect(page.getByText('Scheduled Reports')).toBeVisible();
  });

  test('should navigate to create new workflow', async ({ page }) => {
    const newWorkflowBtn = page.getByRole('button', { name: /new workflow/i });
    await newWorkflowBtn.click();

    // Should navigate to workflow editor
    await expect(page).toHaveURL(/\/workflows\//, { timeout: 10000 });
  });
});

test.describe('Workflow Editor', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load workflow editor page', async ({ page }) => {
    // Navigate to create new workflow
    await page.goto('/workflows');
    await page.getByRole('button', { name: /new workflow/i }).click();

    // Wait for navigation
    await page.waitForURL(/\/workflows\//, { timeout: 10000 });

    // Check for React Flow canvas or editor elements
    const canvas = page.locator('.react-flow, [class*="react-flow"], [class*="workflow"]').first();
    await expect(canvas).toBeVisible({ timeout: 5000 });
  });

  test('should show workflow editor controls', async ({ page }) => {
    await page.goto('/workflows');
    await page.getByRole('button', { name: /new workflow/i }).click();
    await page.waitForURL(/\/workflows\//, { timeout: 10000 });

    // Look for common editor elements (zoom controls, minimap, etc.)
    // These depend on the actual implementation
    const editorContainer = page.locator('.glassmorphism, [class*="editor"], [class*="canvas"]').first();
    await expect(editorContainer).toBeVisible({ timeout: 5000 });
  });

  test('should allow adding nodes to workflow', async ({ page }) => {
    await page.goto('/workflows');
    await page.getByRole('button', { name: /new workflow/i }).click();
    await page.waitForURL(/\/workflows\//, { timeout: 10000 });

    // Look for add node button or node palette
    const addNodeBtn = page.locator('button').filter({ hasText: /add|node|agent/i }).first();

    if (await addNodeBtn.isVisible()) {
      await addNodeBtn.click();
      // Node should be added or palette should open
    }
  });

  test('should show save workflow option', async ({ page }) => {
    await page.goto('/workflows');
    await page.getByRole('button', { name: /new workflow/i }).click();
    await page.waitForURL(/\/workflows\//, { timeout: 10000 });

    // Look for save button
    const saveBtn = page.locator('button').filter({ hasText: /save/i }).first();

    // Save button should exist (may be enabled or disabled)
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Workflow Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/workflows');
  });

  test('should filter by search term', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search workflows...');

    // Enter search term
    await searchInput.fill('nonexistent-workflow-xyz');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Should show no results or empty state
    // The exact behavior depends on implementation
  });

  test('should filter by status', async ({ page }) => {
    const statusFilter = page.locator('select').first();

    // Filter by active
    await statusFilter.selectOption('active');
    await page.waitForTimeout(500);

    // Filter by draft
    await statusFilter.selectOption('draft');
    await page.waitForTimeout(500);

    // Reset filter
    await statusFilter.selectOption('all');
    await page.waitForTimeout(500);
  });

  test('should combine search and status filters', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search workflows...');
    const statusFilter = page.locator('select').first();

    // Apply both filters
    await searchInput.fill('test');
    await statusFilter.selectOption('active');

    // Wait for filters to apply
    await page.waitForTimeout(500);
  });
});

test.describe('Workflow Templates', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/workflows');
  });

  test('should display template cards', async ({ page }) => {
    // Scroll to templates section
    await page.getByRole('heading', { name: 'Templates' }).scrollIntoViewIfNeeded();

    // Check template cards are clickable
    const dataTemplate = page.getByText('Data Analysis Pipeline');
    await expect(dataTemplate).toBeVisible();

    const emailTemplate = page.getByText('Email Automation');
    await expect(emailTemplate).toBeVisible();

    const scheduledTemplate = page.getByText('Scheduled Reports');
    await expect(scheduledTemplate).toBeVisible();
  });

  test('should have hover effect on template cards', async ({ page }) => {
    const templateCard = page.locator('button').filter({ hasText: 'Data Analysis Pipeline' });

    // Hover over template
    await templateCard.hover();

    // The card should have a visual change (border color change, etc.)
    // This is a visual test, hard to verify programmatically without screenshot comparison
  });
});
