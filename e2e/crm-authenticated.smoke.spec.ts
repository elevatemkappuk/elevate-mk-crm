import { expect, test } from '@playwright/test';

import { e2eCredentialsAvailable, signIn } from './helpers/auth';

test.describe('authenticated CRM smoke tests', () => {
  test('authenticated staff can open the People directory', async ({ page }) => {
    test.skip(!e2eCredentialsAvailable(), 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run staging smoke tests.');
    await signIn(page);

    await page.getByRole('link', { name: 'People', exact: true }).click();
    await expect(page).toHaveURL(/\/people$/);
    await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'People directory' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login|access-denied/);
  });

  test('staff can create and archive an E2E Contact through the UI', async ({ page }) => {
    test.skip(!e2eCredentialsAvailable(), 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run staging smoke tests.');
    await signIn(page);

    await page.getByRole('button', { name: 'Add person', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Add person' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('radio', { name: /Contact/ }).check();

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const firstName = 'E2E';
    const lastName = `Playwright ${suffix}`;
    const email = `e2e.playwright.${suffix}@example.com`;
    await drawer.getByLabel('First name').fill(firstName);
    await drawer.getByLabel('Last name').fill(lastName);
    await drawer.getByLabel('Email').fill(email);
    await drawer.getByRole('button', { name: 'Add person', exact: true }).click();

    await expect(page).toHaveURL(/\/people\/\d+$/);
    await expect(page.getByRole('heading', { name: `${firstName} ${lastName}` })).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Archive person', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirm archive', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm archive', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Restore person', exact: true })).toBeVisible();
  });

  test('logout protects authenticated routes', async ({ page }) => {
    test.skip(!e2eCredentialsAvailable(), 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run staging smoke tests.');
    await signIn(page);

    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
