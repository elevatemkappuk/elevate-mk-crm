import { test, expect } from '@playwright/test';
import { e2eCredentialsAvailable, signIn } from './helpers/auth';

test('staff can sign in and reach the Dashboard', async ({ page }) => {
  test.skip(!e2eCredentialsAvailable(), 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run the smoke test.');
  await signIn(page);

  // The CRM's canonical post-login landing route is People; Dashboard is an
  // authenticated workspace route reached from the shell navigation.
  await expect(page).toHaveURL(/\/people$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Community growth' })).toBeVisible();
});
