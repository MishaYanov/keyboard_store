import assert from 'node:assert/strict';
import { KeyboardDesignService, KEYBOARD_STORAGE_KEY } from '../../client/src/modules/keyboard-builder/services/keyboard-design.service';
import { CheckoutService, BASKET_STORAGE_KEY } from '../../client/src/modules/checkout/services/checkout.service';

const values = new Map<string, string>();
let full = false;
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (full) throw new Error('Quota exceeded'); values.set(key, value); },
} } });
const design = new KeyboardDesignService();
design.setSize('65');
design.setPhysical('iso');
design.setPreset('custom');
design.setCustomColor('letters', '#263d59');
design.toggleLanguage('he');
design.selectKey('65:iso:letter:0:0');
design.setKeyColor('#d9b44a');
design.setKeyLegend('Launch 🚀');
assert.deepEqual(new KeyboardDesignService().design.get(), design.design.get());
assert.equal(new KeyboardDesignService().design.get().keyLegends['65:iso:letter:0:0'], 'Launch 🚀');
const strictDesign = design.design.get();
design.setKeyColor('#abcdef');
design.setCustomColor('letters', '#123456');
assert.deepEqual(design.design.get(), strictDesign);

const basket = new CheckoutService();
const snapshot = 'data:image/png;base64,aGVsbG8=';
basket.addConfiguration(design.design.get(), snapshot);
const id = basket.basket.get()[0]!.id;
basket.setQuantity(id, 2);
const restored = new CheckoutService();
assert.deepEqual(restored.basket.get(), basket.basket.get());
assert.equal(restored.basket.get()[0]!.snapshot, snapshot);
assert.equal(restored.totalCents(), basket.totalCents());
restored.remove(id);
assert.equal(new CheckoutService().basket.get().length, 0);

values.set(KEYBOARD_STORAGE_KEY, '{broken json');
assert.equal(new KeyboardDesignService().design.get().size, '100');
values.set(KEYBOARD_STORAGE_KEY, JSON.stringify({ ...design.design.get(), languages: ['unknown'] }));
assert.equal(new KeyboardDesignService().design.get().size, '100');
values.set(KEYBOARD_STORAGE_KEY, JSON.stringify({ ...design.design.get(), customColors: { letters: '#123456', actions: '#899096', accent: '#ee826f' }, keyColors: { legacy: '#abcdef' }, keyLegends: undefined }));
const migrated = new KeyboardDesignService().design.get();
assert.equal(Object.keys(migrated.keyLegends).length, 0);
assert.notEqual(migrated.customColors.letters, '#123456');
values.set(BASKET_STORAGE_KEY, JSON.stringify([{ id: 'bad', quantity: -1, design: {} }]));
assert.equal(new CheckoutService().basket.get().length, 0);

full = true;
assert.doesNotThrow(() => design.setSize('60'));
assert.equal(design.design.get().size, '60');
assert.equal(design.storageAvailable.get(), false);
assert.doesNotThrow(() => basket.setQuantity(id, 3));
assert.equal(basket.basket.get()[0]!.quantity, 3);
assert.equal(basket.storageAvailable.get(), false);
full = false;
basket.setQuantity(id, 4);
assert.equal(basket.storageAvailable.get(), true);
assert.equal(new CheckoutService().basket.get()[0]!.quantity, 4);
delete (globalThis as Record<string, unknown>).window;
console.log('PASS: design and snapshot restoration, basket removal, invalid data, and storage failure recovery');
