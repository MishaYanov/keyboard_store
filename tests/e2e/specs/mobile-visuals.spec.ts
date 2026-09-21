import { test, expect } from '@playwright/test';

test('homepage retains blur and puts mobile theme control at the right', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.locator('.homepage-panel__image').first()).toHaveCSS('filter', /blur\(4px\)/);
    await expect(page.locator('.shared-header')).toHaveCSS('backdrop-filter', /blur/);
    if (isMobile) {
        const themes = await page.locator('.shared-header__themes').first().boundingBox();
        expect(themes).not.toBeNull();
        expect(themes!.x).toBeGreaterThan(page.viewportSize()!.width * .7);
    }
    await expect(page.locator('.keycap-journey')).toBeVisible();
    const before = await page.locator('.keycap-journey').boundingBox();
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('.keycap-journey')).toHaveAttribute('data-motion', 'scroll');
    const after = await page.locator('.keycap-journey').boundingBox();
    expect(after!.y).toBe(0);
    expect(after!.height).toBe(before!.height);
});

test('builder uses readable texture fonts and balanced mobile settings', async ({ page, isMobile }) => {
    await page.addInitScript(() => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        const fonts: string[] = [];
        Object.assign(window, { drawnFonts: fonts });
        CanvasRenderingContext2D.prototype.fillText = function (...args: Parameters<typeof original>) {
            fonts.push(this.font);
            return original.apply(this, args);
        };
    });
    await page.goto('/#/builder');
    await page.getByRole('tab', { name: 'Keyboard size', exact: true }).click();
    await expect(page.locator('input[name="size"]').first()).toBeVisible();
    const fonts = await page.evaluate(() => (window as unknown as { drawnFonts: string[] }).drawnFonts);
    expect(fonts.length).toBeGreaterThan(20);
    expect(fonts.every(font => Number(font.match(/([\d.]+)px/)?.[1]) >= 12)).toBe(true);
    if (isMobile) {
        const split = await page.locator('.view-grid__body').evaluate(body => {
            const sidebar = body.querySelector<HTMLElement>('.view-grid__sidebar')!;
            return sidebar.offsetWidth / ((body as HTMLElement).clientWidth - 20);
        });
        expect(split).toBeCloseTo(.5, 1);
        const options = page.locator('.keyboard-settings__option');
        const positions = await options.evaluateAll(nodes => nodes.slice(0, 2).map(node => ({
            left: (node as HTMLElement).offsetLeft, top: (node as HTMLElement).offsetTop,
        })));
        expect(positions[0]!.top).toBe(positions[1]!.top);
        expect(positions[0]!.left).not.toBe(positions[1]!.left);
    }
});
