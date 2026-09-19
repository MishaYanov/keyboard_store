import type { KeyboardDesign, KeyboardSize, PhysicalLayout } from './keyboard.types';

/** Prototype USD prices in integer cents. Replace with approved catalog prices. */
export const PRICE_ADJUSTERS = {
    currency: 'USD',
    size: { '60': 8000, '65': 9000, '75': 10500, tkl: 11500, '100': 13000 } satisfies Record<KeyboardSize, number>,
    physical: { ansi: 0, iso: 500, jis: 1000 } satisfies Record<PhysicalLayout, number>,
    preset: { graphite: 0, classic: 0, 'navy-coral': 800, custom: 1200 } satisfies Record<KeyboardDesign['presetId'], number>,
    extraLanguage: 1000,
    extraCustomColor: 400,
    individualKey: 150,
} as const;
