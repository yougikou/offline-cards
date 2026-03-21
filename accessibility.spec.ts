import { test, expect } from '@playwright/test';

test.describe('Accessibility Semantics', () => {
  test('main actions have role=button in Lobby', async ({ page }) => {
    await page.goto('/');

    // Playwright locator `getByRole` automatically looks for semantic roles in the accessibility tree

    // Wait for language switcher
    const langSwitcher = page.getByRole('button', { name: /🌐.*/ }).first();
    await expect(langSwitcher).toBeVisible();

    // Wait for game items
    const gameItemUno = page.getByRole('button', { name: '🃏 基础 UNO 2-8P Family' });
    await expect(gameItemUno).toBeVisible();

    const gameItemZheng = page.getByRole('button', { name: '♠️ 争上游 2-4P Strategy' });
    await expect(gameItemZheng).toBeVisible();

    // Wait for action buttons (Create Room, Sandbox)
    const createBtn = page.getByRole('button', { name: '创建房间' });
    await expect(createBtn).toBeVisible();

    const sandboxBtn = page.getByRole('button', { name: '单机沙盒测试' });
    await expect(sandboxBtn).toBeVisible();
  });

  test('sandbox scene elements have role=button', async ({ page }) => {
    await page.goto('/');

    // Enter sandbox mode
    const sandboxBtn = page.getByRole('button', { name: '单机沙盒测试' });
    await sandboxBtn.click();

    // Ensure we are in sandbox
    const settingsIcon = page.getByRole('button', { name: '⚙️' });
    await expect(settingsIcon).toBeVisible();

    // Verify FABs
    const drawBtn = page.getByRole('button', { name: '抽牌' });
    await expect(drawBtn).toBeVisible();

    const playBtn = page.getByRole('button', { name: '出选中的牌' });
    await expect(playBtn).toBeVisible();

    // Hide boardgame.io debug panel before clicking cards to avoid interception
    await page.keyboard.press('.');

    // We have to wait for cards to be rendered
    await page.waitForTimeout(1000);

    // Select the first unplayed card in the hand
    // Since it's UnoLite, there are multiple cards.
    // The touchable is a parent of the card visual.
    // Actually React Native Web's TouchableWithoutFeedback translates to an element with role="button" inside the View hierarchy.
    // Just check if we have more than a few buttons, which implies cards are recognized.
    // 1 (Settings) + 2 (FABs) + other buttons like Dismiss tutorial = 4. More than 4 means cards are buttons.
    const buttonRoles = page.locator('[role="button"]');

    expect(await buttonRoles.count()).toBeGreaterThan(4);
  });
});
