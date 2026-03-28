import { test, expect } from '@playwright/test';

test.describe('SanGuoSha UI Test', () => {
  test('take screenshot of SanGuoSha game', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:8081");
    await page.waitForTimeout(1000);

    // Click SanGuoSha in the carousel
    const sgsBtn = page.locator('div[role="button"]').filter({ hasText: '三国杀' }).first();
    await sgsBtn.click();
    await page.waitForTimeout(500);

    // Enter Sandbox
    const sandboxBtn = page.getByRole('button', { name: '单机沙盒测试' });
    await sandboxBtn.click();
    await page.waitForTimeout(1000);

    // Hide debug panel
    await page.keyboard.press('.');

    // Select Hero
    const selectBtn = page.getByRole('button', { name: '选择' }).first();
    await selectBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "/home/jules/verification/sgs_dashboard.png" });

    // Select Kill card to show tooltip
    const killCard = page.locator('div[role="button"]').filter({ hasText: '杀' }).first();
    if(await killCard.isVisible()) {
        await killCard.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "/home/jules/verification/sgs_tooltip.png" });
    } else {
        const dodgeCard = page.locator('div[role="button"]').filter({ hasText: '闪' }).first();
        if(await dodgeCard.isVisible()) {
            await dodgeCard.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: "/home/jules/verification/sgs_tooltip.png" });
        }
    }
  });
});
