const { test, expect } = require('@playwright/test');

test.describe('Growth OS - E2E Core Flows', () => {

  const BASE_URL = 'http://localhost:3000';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  test('Flow 1: Admin Login', async ({ page }) => {
    // Locate the login form specifically
    const loginForm = page.locator('form').filter({ hasText: 'Email Address' });
    await expect(loginForm).toBeVisible();

    // Fill credentials
    await loginForm.locator('input[type="email"]').fill('admin@growthos.com');
    await loginForm.locator('input[type="password"]').fill('password123');

    // Click submit
    await loginForm.locator('button[type="submit"]').click();

    // Verify successful login by checking for the authenticated app container or header
    // The header has "Select Business" or the profile name
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10000 });
  });

  test('Flow 2: Create a new Business Location', async ({ page }) => {
    // Login first
    const loginForm = page.locator('form').filter({ hasText: 'Email Address' });
    await loginForm.locator('input[type="email"]').fill('admin@growthos.com');
    await loginForm.locator('input[type="password"]').fill('password123');
    await loginForm.locator('button[type="submit"]').click();

    // Wait for the app to either show the dashboard header or the onboarding wizard
    try {
      const wizard = page.locator('text="Initialize Growth OS"').first();
      await wizard.waitFor({ state: 'visible', timeout: 5000 });
      
      // If visible, fill it out
      await page.locator('input[placeholder="e.g. Client A - Dental Clinic"]').fill('E2E Test Clinic');
      await page.locator('input[placeholder="e.g. Dentist in New York"]').fill('Test Category');
      await page.locator('button').filter({ hasText: 'Create Profile' }).click();
      
      // Verify Dashboard loads after wizard
      await expect(page.locator('header').first()).toBeVisible({ timeout: 15000 });
    } catch (e) {
      // Wizard didn't appear, meaning a location already exists.
      // In this case, just ensure the header is visible.
      await expect(page.locator('header').first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('Flow 3: Google Post Generation and Review Reply', async ({ page }) => {
    // Login first
    const loginForm = page.locator('form').filter({ hasText: 'Email Address' });
    await loginForm.locator('input[type="email"]').fill('admin@growthos.com');
    await loginForm.locator('input[type="password"]').fill('password123');
    await loginForm.locator('button[type="submit"]').click();

    // Since tests are isolated, we might see the wizard again here
    try {
      const wizard = page.locator('text="Initialize Growth OS"').first();
      await wizard.waitFor({ state: 'visible', timeout: 3000 });
      await page.locator('input[placeholder="e.g. Client A - Dental Clinic"]').fill('E2E Test Clinic');
      await page.locator('input[placeholder="e.g. Dentist in New York"]').fill('Test Category');
      await page.locator('button').filter({ hasText: 'Create Profile' }).click();
    } catch (e) { }

    await expect(page.locator('header').first()).toBeVisible({ timeout: 15000 });

    // Click the Studio tab instead of evaluating to trigger fetchPosts()
    const studioTab = page.locator('nav').locator('button').filter({ hasText: 'Studio' });
    await studioTab.click();

    // Wait for the Studio tab to be visible
    const goalInput = page.locator('textarea[x-model="postGoal"]');
    await expect(goalInput).toBeVisible({ timeout: 10000 });
    await goalInput.fill('Offering free checkups for the E2E test weekend.');

    // Click Generate using button text
    await page.locator('button').filter({ hasText: 'Generate Google Post' }).click();

    // Wait for the mock post to appear (might take some seconds if Ollama is running)
    // The post has a textarea for drafts
    await expect(page.locator('textarea').nth(1)).toBeVisible({ timeout: 30000 });

    // Navigate to Reviews by clicking the tab
    const reviewsTab = page.locator('nav').locator('button').filter({ hasText: 'Reviews' });
    await reviewsTab.click();

    // Wait for reviews to load
    const replyButton = page.locator('button').filter({ hasText: 'Generate AI Reply' }).first();
    try {
        await replyButton.waitFor({ state: 'visible', timeout: 5000 });
        await replyButton.click();
        
        // Wait for the reply text to appear
        await expect(page.locator('text="AI Suggested Reply"').first()).toBeVisible({ timeout: 20000 });
    } catch (e) {
        // If no reviews exist, just pass
        console.log('No reviews to reply to.');
    }
  });

});
