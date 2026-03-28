import { test, expect } from '@playwright/test';

test.describe('Sandbox Routing Tests', () => {
  test('Selecting SanGuoSha should load SanGuoSha sandbox, not Uno', async ({ page }) => {
    // 1. Setup viewport and navigate
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:8081");

    // Give time for initial render
    await page.waitForTimeout(1000);

    // 2. Select the '三国杀' (SanGuoSha) game from the library
    const sgsCard = page.locator('text=三国杀').first();
    await sgsCard.click();

    // Ensure state propagates
    await page.waitForTimeout(500);

    // 3. Enter the local sandbox mode
    const sandboxBtn = page.locator('text=单机沙盒测试').first();
    await sandboxBtn.click();

    // Wait for boardgame.io client and GameBoard to initialize
    await page.waitForTimeout(2000);

    // Hide boardgame.io debug panel to prevent false positive text matches
    await page.keyboard.press('.');
    await page.waitForTimeout(500);

    // 4. Assert that SanGuoSha specific UI IS visible
    // In SanGuoSha, the "请选择您的武将" (Select Your Hero) screen should appear on sandbox load
    const sgsHeroSelectionText = await page.locator('text=请选择您的武将').isVisible();
    const sgsHeroSelectionTextEn = await page.locator('text=Select Your Hero').isVisible();
    expect(sgsHeroSelectionText || sgsHeroSelectionTextEn).toBe(true);

    // 5. Assert that UNO specific UI is NOT visible
    // In UnoLite, the text "牌库" (Deck count) is uniquely rendered.
    // Using exact text matches for labels to avoid matching JSON keys in the DOM
    const unoDeckText = await page.getByText('牌库：', { exact: false }).isVisible();
    const unoDeckTextEn = await page.getByText('Deck: ', { exact: false }).isVisible();
    expect(unoDeckText).toBe(false);
    expect(unoDeckTextEn).toBe(false);
  });
});
