import { test, expect } from '@playwright/test';

test('verify SanGuoSha layout', async ({ page }) => {
  await page.goto('http://localhost:8081');

  // Need to make sure app is loaded
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

  await page.waitForTimeout(500);

    await page.waitForTimeout(1000);

    // Hide debug panel
    await page.keyboard.press('.');
    await page.waitForTimeout(500);

    // Select the game "SanGuoSha" using robust selectors before sandbox start
    // wait for it
    // Wait, the sandbox is already started in this script. We need to select SanGuoSha mode.
    // Let's use the game mode button if visible.
    const sgsModeBtn = page.getByRole('button', { name: '三国杀' });
    if(await sgsModeBtn.isVisible()) {
        await sgsModeBtn.click();
        await page.waitForTimeout(1000);
        // Start again
        const startBtn = page.getByRole('button', { name: '再开一局' });
        if(await startBtn.isVisible()){
            await startBtn.click();
            await page.waitForTimeout(2000);
        }
    }

    // Wait for the modal/game over to appear (since it's a sandbox, we might be starting fresh or not)
    // Actually, to make sure we are in SanGuoSha mode, let's just click the SanGuoSha button in the modal if it's there
    await page.mouse.click(20, 20); // Open modal? No, it's top right.
    await page.mouse.click(800, 20); // Try top right corner

    await page.waitForTimeout(1000);
    // Click san guo sha
    const sgsModalBtn = page.getByRole('button', { name: 'SanGuoSha' });
    if(await sgsModalBtn.isVisible()){
        await sgsModalBtn.click();
        await page.waitForTimeout(1000);
        // reset
        const resetBtn = page.getByRole('button', { name: '再开一局' });
        if(await resetBtn.isVisible()){
            await resetBtn.click();
            await page.waitForTimeout(1000);
        } else {
             const resetEnBtn = page.getByRole('button', { name: 'Reset Game' });
             if(await resetEnBtn.isVisible()){
                 await resetEnBtn.click();
                 await page.waitForTimeout(1000);
             }
        }
    }

    // Select Hero to progress past the hero selection screen
    const heroBtn = page.locator('div[role="button"]').first();
    if(await heroBtn.isVisible()) {
        await heroBtn.click();
    } else {
        await page.mouse.click(100, 400); // fallback click
    }
    await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: '/home/jules/verification/sgs_layout.png' });
});