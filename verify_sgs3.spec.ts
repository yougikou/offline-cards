import { test, expect } from '@playwright/test';

test.describe('SanGuoSha UI Test', () => {
  test('take screenshot of SanGuoSha game', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("http://localhost:8081");

    await page.waitForTimeout(2000);

    // Use absolute position clicking since i18n is flaky in PW scripts
    // SanGuoSha is the last card in the carousel, so we might need to click Next or swipe
    // Or we just rely on getByText
    const sgsText = page.getByText('三国杀').first();
    const sgsEnText = page.getByText('SanGuoSha').first();
    if (await sgsText.isVisible()) {
        await sgsText.click();
    } else if (await sgsEnText.isVisible()) {
        await sgsEnText.click();
    } else {
        // Just click around x=100 y=500 and hope we hit a card
        await page.mouse.click(200, 500);
        await page.waitForTimeout(1000);
        await page.mouse.click(200, 500);
    }

    await page.waitForTimeout(1000);
    await page.mouse.click(200, 300); // Click sandbox maybe?
    await page.waitForTimeout(1000);
    await page.mouse.click(180, 500); // Click select hero maybe?
    await page.waitForTimeout(3000);

    // Let's just make sure we capture *something* on screen to verify rendering doesn't crash
    await page.screenshot({ path: "/home/jules/verification/sgs_dashboard.png" });

  });
});