import { test, expect } from '@playwright/test';

test('keyboard-only panel selection, options, help and basket', async ({ page }) => {
    await page.goto('/#/builder');
    const workspace = page.getByLabel('Keyboard builder workspace', { exact: true });
    await workspace.focus();
    for (const [index, name] of ['Keyboard size', 'Physical layout', 'Languages', 'Colors', 'Style individual', 'Keyboard overview', 'Finalize'].entries()) {
        await page.keyboard.press(String(index + 1));
        await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
    await page.keyboard.press('1');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('input[name="size"][value="100"]')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('input[name="size"][value="60"]')).toBeChecked();
    await page.keyboard.press('2');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('input[name="physical"][value="iso"]')).toBeChecked();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Builder key map' })).toBeVisible();
    await page.keyboard.press('7');
    await expect(page.getByRole('tab', { name: 'Physical layout', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('complementary', { name: 'View settings' })).not.toBeVisible();
    await page.keyboard.press('7');
    await page.keyboard.press('a');
    await expect(page.getByRole('heading', { name: 'Your basket' })).toBeVisible();
    await expect(page.getByText('Basket subtotal: $85.00', { exact: true })).toBeVisible();
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/#\/checkout$/);
});

test('legend typing, native controls, shortcut opt-out and key-map button', async ({ page }) => {
    await page.goto('/#/builder');
    const workspace = page.getByLabel('Keyboard builder workspace', { exact: true });
    await workspace.focus();
    await page.keyboard.press('5');
    await page.keyboard.press('f');
    const select = page.getByRole('combobox', { name: 'Selected key', exact: true });
    await expect(select).toBeFocused();
    await select.selectOption({ index: 1 });
    const legend = page.locator('input[name="key-legend"]');
    await legend.fill('');
    await legend.pressSequentially('1234567abf?');
    await legend.press('Enter');
    await expect(legend).toHaveValue('1234567abf?');
    await expect(page.getByRole('tab', { name: 'Style individual', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await workspace.focus();
    await page.keyboard.press('a');
    await expect(page).toHaveURL(/#\/builder$/);
    await page.getByRole('checkbox', { name: 'Keyboard controls', exact: true }).uncheck();
    await workspace.focus();
    await page.keyboard.press('7');
    await expect(page.getByRole('tab', { name: 'Style individual', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Key map ?' }).click();
    await expect(page.getByRole('dialog', { name: 'Builder key map' })).toBeVisible();
    await page.getByRole('button', { name: 'Close key map' }).click();
    await expect(page.getByRole('button', { name: 'Key map ?' })).toBeFocused();
    await page.getByRole('checkbox', { name: 'Keyboard controls', exact: true }).check();
    await workspace.focus();
    await page.keyboard.press('b');
    await expect(page.getByRole('heading', { name: 'Your basket' })).toBeVisible();
});

test('Admin is absent from header but direct route still exists', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.shared-header')).toBeVisible();
    await expect(page.locator('.shared-header a[href="#/admin"]')).toHaveCount(0);
    await page.goto('/#/admin');
    await expect(page).toHaveURL(/#\/admin$/);
    await expect(page.getByRole('heading', { name: 'Store overview', exact: true })).toBeVisible();
});
