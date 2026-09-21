import { test, expect, type Page } from '@playwright/test';

async function build(page: Page) {
    await page.goto('/#/builder');
    await page.getByRole('tab', { name: 'Keyboard size', exact: true }).click();
    await page.locator('input[name="size"][value="60"]').check();
    await expect(page.locator('input[name="size"][value="60"]')).toBeChecked();
    await page.getByRole('tab', { name: 'Finalize', exact: true }).click();
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your basket' })).toBeVisible();
}

test.beforeEach(async ({ request }) => {
    const response = await request.get('/api/commerce/status');
    expect(response.ok()).toBeTruthy();
    expect((await response.json()).mock, 'Refuse to run purchase tests against a real shop').toBe(true);
});

test('builder → saved basket → mock checkout → verified test order', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await build(page);
    const image = page.getByRole('img', { name: /Keyboard 1:/ });
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty('complete', true);
    await expect(page.getByText('Basket subtotal: $80.00', { exact: true })).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Keyboard 1 quantity' }).fill('2');
    await page.getByRole('spinbutton', { name: 'Keyboard 1 quantity' }).press('Tab');
    await expect(page.getByText('Basket subtotal: $160.00', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('spinbutton', { name: 'Keyboard 1 quantity' })).toHaveValue('2');
    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Mock checkout — no real payment' })).toBeVisible();
    await expect(page.getByText('Total: $160.00 USD', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Complete test order' }).click();
    await expect(page.getByRole('heading', { name: 'Test order completed' })).toBeVisible();
    expect(errors).toEqual([]);
});

test('design persists and basket removal disables checkout', async ({ page }) => {
    await build(page);
    await page.getByRole('link', { name: 'Build another keyboard' }).click();
    await page.reload();
    await page.getByRole('tab', { name: 'Keyboard size', exact: true }).click();
    await expect(page.locator('input[name="size"][value="60"]')).toBeChecked();
    await page.goto('/#/checkout');
    await page.getByRole('button', { name: 'Remove keyboard 1' }).click();
    await expect(page.getByText(/Your basket is empty/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue to secure checkout' })).toBeDisabled();
    await page.reload();
    await expect(page.getByText(/Your basket is empty/)).toBeVisible();
});

test('failed checkout preserves basket and can be retried', async ({ page }) => {
    await build(page);
    await page.route('**/api/commerce/checkout', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test provider unavailable' }) }));
    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await expect(page.getByText('Test provider unavailable', { exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Keyboard 1 quantity' })).toHaveValue('1');
    await page.unroute('**/api/commerce/checkout');
    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Mock checkout — no real payment' })).toBeVisible();
});

test('individual legend and palette affect approved checkout price', async ({ page }) => {
    await page.goto('/#/builder');
    await page.getByRole('tab', { name: 'Style individual', exact: true }).click();
    await page.getByRole('combobox', { name: 'Selected key', exact: true }).selectOption({ index: 1 });
    await page.locator('input[name="key-color"][value="#b94a48"]').check();
    await page.locator('input[name="key-legend"]').fill('Launch');
    await page.getByRole('button', { name: 'Apply text', exact: true }).click();
    await page.getByRole('tab', { name: 'Finalize', exact: true }).click();
    await page.getByRole('button', { name: 'Add to basket', exact: true }).click();
    await expect(page.getByText('Basket subtotal: $134.00', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue to secure checkout' }).click();
    await expect(page.getByText('Total: $134.00 USD', { exact: false })).toBeVisible();
});
