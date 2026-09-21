import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';
import { normalizeKeyboardDesign } from '@keycaps/domain/keyboard-design.validation';
import { keyboardGeometry } from '@keycaps/domain/keyboard-geometry';
import { keyColorId } from '@keycaps/domain/key-colors';
import type { ShopifyLineInput } from '@keycaps/domain/shopify.types';

export interface ConfigurationItem { readonly id: string; readonly quantity: number; readonly design: KeyboardDesign }

/** One approved, all-inclusive Shopify variant for each priced combination. */
export class ShopifyAdapter {
    public constructor(private readonly variants: Readonly<Record<string, string>>) {}

    public pricingKey(design: KeyboardDesign): string {
        const keys = keyboardGeometry(design).keys.map(key => keyColorId(design, key));
        return [design.size, design.physical, design.presetId,
            design.presetId === 'custom' ? design.customColorMode : 0,
            design.languages.length,
            keys.filter(key => design.keyColors[key] !== undefined).length,
            keys.filter(key => design.keyLegends[key] !== undefined).length,
        ].join(':');
    }

    public toLines(items: readonly ConfigurationItem[]): ShopifyLineInput[] {
        if (!items.length || items.length > 250) throw new Error('Your basket must contain between 1 and 250 configurations.');
        return items.map(item => {
            const design = normalizeKeyboardDesign(item.design);
            if (!design || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('This keyboard configuration is invalid.');
            const key = this.pricingKey(design);
            const merchandiseId = this.variants[key];
            if (!merchandiseId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(merchandiseId)) {
                throw new Error(`This configuration is not available for purchase yet (${key}).`);
            }
            // Small attributes preserve the entire manufacturing specification without images or PII.
            const encoded = encodeURIComponent(JSON.stringify(design));
            const chunks = encoded.match(/.{1,200}/g) ?? [];
            if (chunks.length > 240) throw new Error('This configuration is too large to submit.');
            return { merchandiseId, quantity: item.quantity, attributes: [
                { key: '_configuration_id', value: item.id },
                { key: '_pricing_key', value: key },
                { key: '_design_encoding', value: 'uri-json-v1' },
                { key: '_design_chunks', value: String(chunks.length) },
                ...chunks.map((value, index) => ({ key: `_design_${index}`, value })),
            ] };
        });
    }
}
