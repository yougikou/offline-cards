import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Uno UI Test', () => {
  test('take screenshot of UNO game', async ({ page }) => {
    // 1. Arrange: Go to the local server.
    await page.goto("http://localhost:8081");

    // Enter sandbox mode
    const sandboxBtn = page.getByRole('button', { name: '单机沙盒测试' });
    await sandboxBtn.click();

    // Verify FABs
    const drawBtn = page.getByRole('button', { name: '抽牌' });
    await expect(drawBtn).toBeVisible();

    // Hide boardgame.io debug panel before clicking cards to avoid interception
    await page.keyboard.press('.');

    // Wait for game to render
    await page.waitForTimeout(2000);

    // 4. Screenshot: Capture the final result for visual verification.
    await page.screenshot({ path: "/home/jules/verification/uno_cards.png" });
  });
});
