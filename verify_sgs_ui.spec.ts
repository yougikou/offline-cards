import { test, expect } from '@playwright/test';

test.describe('SanGuoSha UI Verification', () => {
  test('take screenshot of SanGuoSha game', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("http://localhost:8081");
    await page.waitForTimeout(1000);

    // Enter Sandbox (assuming the lobby is loaded in English/Chinese)
    let sandboxBtn = page.getByRole('button', { name: '单机沙盒测试' });
    if(!(await sandboxBtn.isVisible())) {
       sandboxBtn = page.getByRole('button', { name: 'Local Sandbox' });
    }

    if (await sandboxBtn.isVisible()) {
        await sandboxBtn.click();
    } else {
        await page.mouse.click(200, 500); // fallback click
    }
    await page.waitForTimeout(1000);

    // Hide debug panel
    await page.keyboard.press('.');
    await page.waitForTimeout(500);

    // Select Hero to progress past the hero selection screen
    // There are 3 heroes to choose from. Let's just click the first one.
    const heroBtn = page.locator('div[role="button"]').first();
    if(await heroBtn.isVisible()) {
        await heroBtn.click();
    } else {
        await page.mouse.click(100, 400); // fallback click
    }
    await page.waitForTimeout(2000);

    // Now we should be on the main board, but maybe it's not our turn yet or we need to wait for others.
    // In sandbox, all players select a hero automatically or we switch to them.
    // The previous script failed because it stopped at the hero selection screen. Let's just take a screenshot here.
    await page.screenshot({ path: "/home/jules/verification/sgs_dashboard_new.png" });

    // Select a card if possible
    const killCard = page.locator('div[role="button"]').filter({ hasText: '杀' }).first();
    if(await killCard.isVisible()) {
        await killCard.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: "/home/jules/verification/sgs_dashboard_selected.png" });
    }

  });
});
