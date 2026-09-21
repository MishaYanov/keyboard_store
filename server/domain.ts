import { isKeyboardDesign } from '@keycaps/domain/keyboard-design.validation';
import { keyboardGeometry } from '@keycaps/domain/keyboard-geometry';
import { keyColorId } from '@keycaps/domain/key-colors';
import { ShopifyAdapter } from '@keycaps/domain/shopify.adapter';

/** No color migration, arbitrary fields, prices, variant IDs or inactive overrides cross this boundary. */
export function validateItems(input: unknown, variants: Record<string, string>) {
    if (!input || typeof input !== 'object' || !('items' in input) || !Array.isArray(input.items)
        || input.items.length < 1 || input.items.length > 20) throw new Error('Provide between 1 and 20 keyboard configurations.');
    const adapter = new ShopifyAdapter(variants);
    return input.items.map((item: unknown) => {
        if (!item || typeof item !== 'object' || !('design' in item) || !('quantity' in item)
            || typeof item.quantity !== 'number' || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20
            || !isKeyboardDesign(item.design)) throw new Error('Invalid keyboard configuration or quantity (1–20).');
        const source = item.design;
        const active = new Set(keyboardGeometry(source).keys.map(key => keyColorId(source, key)));
        // The editor retains overrides for other layouts. Strip those from the manufacturing spec.
        const keyColors = Object.fromEntries(Object.entries(source.keyColors).filter(([key]) => active.has(key)).sort());
        const keyLegends = Object.fromEntries(Object.entries(source.keyLegends).filter(([key]) => active.has(key)).sort());
        if (Object.values(keyLegends).some(value => /[\u0000-\u001f\u007f]/.test(value))) throw new Error('Legends must not contain control characters.');
        const design = {
            size: source.size, physical: source.physical, letterLayout: source.letterLayout,
            languages: [...source.languages], primaryCorner: source.primaryCorner, presetId: source.presetId,
            customColorMode: source.customColorMode,
            customColors: { letters: source.customColors.letters, actions: source.customColors.actions, accent: source.customColors.accent },
            keyColors, keyLegends,
        };
        const pricingKey = adapter.pricingKey(design);
        const variantId = variants[pricingKey];
        if (!variantId) throw new Error(`This configuration is not offered yet (${pricingKey}).`);
        return { design, pricingKey, variantId, quantity: item.quantity };
    });
}
