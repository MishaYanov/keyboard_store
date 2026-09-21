import type { KeyboardDesign } from '@keycaps/domain/keyboard.types';
import { CalculatorService } from '@keycaps/domain/calculator.service';

import type { SettingsControls } from './settings-controls';

export function renderFinalize(controls: SettingsControls, design: KeyboardDesign): Node[] {
    const calculator = new CalculatorService();
    const quote = calculator.calculate(design);
    return [
        controls.builder.element('p', {}, 'Your configuration, ready to add to your basket.'),
        controls.builder.element('dl', { className: 'keyboard-settings__price' }, quote.items.flatMap(item => [
            controls.builder.element('dt', {}, `${item.label}${item.quantity !== 1 ? ` × ${item.quantity}` : ''}`),
            controls.builder.element('dd', {}, item.totalCents === 0 ? 'Included' : `${calculator.format(item.totalCents)}${item.quantity > 1 ? ` (${calculator.format(item.unitCents)} each)` : ''}`),
        ])),
        controls.builder.element('p', { attributes: { role: 'status' } }, `Subtotal: ${calculator.format(quote.totalCents)}`),
        controls.builder.element('p', {}, 'Sample prices in USD. Shipping and tax are not included.'),
        controls.button('Add to basket', 'add-to-basket'),
        controls.builder.element('a', { attributes: { href: '#/checkout' } }, 'View basket'),
    ];
}
