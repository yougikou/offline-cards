import { test, expect } from '@playwright/test';

test('SanGuoSha UI Verification', async ({ page }) => {
  // Set viewport to a typical mobile size (portrait)
  await page.setViewportSize({ width: 375, height: 812 });

  await page.goto('http://localhost:8081/');

  await expect(page.getByText('Offline Cards')).toBeVisible();

  // Switch to English language
  await page.getByRole('button', { name: /🌐.*/ }).first().click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForTimeout(500);

  // Click SanGuoSha mode
  await page.locator('text=SanGuoSha').first().click();

  await page.getByRole('button', { name: 'Enter Local Sandbox' }).click();

  // Dismiss tutorial (might be missing if already dismissed via local storage in previous test, so we ignore failures)
  const dismissBtn = page.getByRole('button', { name: 'Dismiss', exact: true });
  try {
    await dismissBtn.waitFor({ state: 'visible', timeout: 3000 });
    await dismissBtn.click();
  } catch (e) {}

  // Dismiss boardgame.io debug panel by pressing period
  await page.keyboard.press('.');

  // Give some time for rendering
  await page.waitForTimeout(1000);

  // Attempt to select a Kill card and take a screenshot
  const killText = page.getByText('Kill', { exact: true });
  if (await killText.count() > 0) {
    await killText.first().click();
    await page.waitForTimeout(500); // Wait for animations
    await page.screenshot({ path: '/home/jules/verification/sgs-kill-selected.png' });
  } else {
    // Just take a screenshot of the table if no kill is available
    await page.screenshot({ path: '/home/jules/verification/sgs-table.png' });
  }
});