import type { KeyboardDesign } from '../models/keyboard.types';
import { PRICE_ADJUSTERS as prices } from '../models/pricing.constants';
import { KEYBOARD_OPTIONS } from '../models/keyboard-options';
import { COLOR_PRESETS } from '../models/color-presets';
import { keyboardGeometry } from '../components/keyboard-interactive-engine/keyboard-geometry';
import { keyColorId } from '../components/keyboard-interactive-engine/key-colors';

export interface PriceItem { label: string; quantity: number; unitCents: number; totalCents: number }
export interface KeyboardQuote { items: PriceItem[]; totalCents: number }

export class CalculatorService {
    public calculate(design: KeyboardDesign): KeyboardQuote {
        const keys = keyboardGeometry(design).keys;
        const customized = keys.filter(key => design.keyColors[keyColorId(design, key)] !== undefined).length;
        const customLegends = keys.filter(key => design.keyLegends[keyColorId(design, key)] !== undefined).length;
        const items: PriceItem[] = [];
        const add = (label: string, quantity: number, unitCents: number) => {
            items.push({ label, quantity, unitCents, totalCents: quantity * unitCents });
        };
        add(`${KEYBOARD_OPTIONS.sizes.find(option => option.id === design.size)!.label} · ${keys.length} keys`, 1, prices.size[design.size]);
        add(`${design.physical.toUpperCase()} physical layout`, 1, prices.physical[design.physical]);
        add(`${design.letterLayout.toUpperCase()} letter arrangement`, 1, 0);
        design.languages.forEach((language, index) => add(`${KEYBOARD_OPTIONS.languages.find(option => option.id === language)!.label} legends`, 1, index === 0 ? 0 : prices.extraLanguage));
        add(`Primary legends: ${design.primaryCorner.replaceAll('-', ' ')}`, 1, 0);
        add(`${COLOR_PRESETS.find(preset => preset.id === design.presetId)!.label} palette`, 1, prices.preset[design.presetId]);
        if (design.presetId === 'custom') {
            add('Additional custom palette colors', design.customColorMode - 1, prices.extraCustomColor);
        }
        add('Individually colored keys', customized, prices.individualKey);
        add('Custom printed legends', customLegends, prices.customLegend);
        return { items, totalCents: items.reduce((sum, item) => sum + item.totalCents, 0) };
    }

    public format(cents: number): string {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: prices.currency }).format(cents / 100);
    }
}
