import { test, expect } from '@playwright/test';

test('SanGuoSha UI Translation Verification', async ({ page }) => {
  await page.goto('http://localhost:8081/');

  await expect(page.getByText('Offline Cards')).toBeVisible();

  // Try clicking language selector
  await page.getByRole('button', { name: /🌐.*/ }).first().click();
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await page.waitForTimeout(500);

  // Click SanGuoSha mode
  await page.locator('text=三国杀').first().click();

  // Click Sandbox
  await page.getByRole('button', { name: '单机沙盒测试' }).click();

  // Dismiss debug panel
  await page.keyboard.press('.');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/home/jules/verification/sgs-zh.png', fullPage: true });

  // Switch to English
  await page.goto('http://localhost:8081/');
  await page.getByRole('button', { name: /🌐.*/ }).first().click();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.waitForTimeout(500);

  // Click SanGuoSha mode
  await page.locator('text=SanGuoSha').first().click();

  await page.getByRole('button', { name: 'Enter Local Sandbox' }).click();

  await page.keyboard.press('.');
  await page.waitForTimeout(2000);

  await page.screenshot({ path: '/home/jules/verification/sgs-en.png', fullPage: true });
});