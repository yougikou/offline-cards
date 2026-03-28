import { test, expect } from '@playwright/test';

test.describe('SanGuoSha UI Test', () => {
  test('take screenshot of SanGuoSha game', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:8081");
    await page.waitForTimeout(1000);

    // Click local testing
    await page.getByText('本地测试').click();
    await page.waitForTimeout(500);

    // It seems "三国杀" is hard to click because it's in a horizontal scroll view. Let's just click the "三国杀" text and assume it selects it.
    await page.getByText('三国杀').click();
    await page.waitForTimeout(500);

    const sandboxBtn = page.getByRole('button', { name: '单机沙盒测试' });
    if(await sandboxBtn.isVisible()) {
        await sandboxBtn.click();
    } else {
        await page.mouse.click(200, 500);
    }
    await page.waitForTimeout(1000);

    await page.keyboard.press('.');
    await page.waitForTimeout(500);

    const selectBtn = page.getByRole('button', { name: '选择' }).first();
    if(await selectBtn.isVisible()) {
        await selectBtn.click();
    } else {
        await page.mouse.click(180, 500);
    }
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "/home/jules/verification/sgs_dashboard.png" });

    // Select Kill card
    const killCard = page.locator('div[role="button"]').filter({ hasText: '杀' }).first();
    if(await killCard.isVisible()) {
        await killCard.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "/home/jules/verification/sgs_tooltip.png" });
    }
  });
});
