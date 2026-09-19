import { signal, type ReadonlySignal } from '../../../engine';
import type { KeyboardDesign } from '../../keyboard-builder/models/keyboard.types';
import { CalculatorService } from '../../keyboard-builder/services/calculator.service';
import { isRecord, normalizeKeyboardDesign } from '../../keyboard-builder/models/keyboard-design.validation';
import { readLocalValue, writeLocalValue } from '../../../shared/storage/local-storage';

export const BASKET_STORAGE_KEY = 'custom-keycaps:basket:v1';

export interface BasketItem { readonly id: string; readonly design: KeyboardDesign; readonly quantity: number; readonly snapshot: string | null }

function restoreBasket(): BasketItem[] {
    const saved = readLocalValue(BASKET_STORAGE_KEY);
    if (!Array.isArray(saved)) return [];
    const ids = new Set<string>();
    const basket: BasketItem[] = [];
    for (const item of saved) {
        if (!isRecord(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id)
            || typeof item.quantity !== 'number'
            || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
            || !(item.snapshot === null || typeof item.snapshot === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(item.snapshot))) continue;
        const design = normalizeKeyboardDesign(item.design);
        if (!design) continue;
        ids.add(item.id);
        basket.push({ id: item.id, design, quantity: item.quantity, snapshot: item.snapshot });
    }
    return basket;
}

/** Browser-persisted basket; configurations are copied when submitted. */
export class CheckoutService {
    private readonly state = signal<readonly BasketItem[]>(restoreBasket());
    private readonly saved = signal(true);
    public readonly storageAvailable: ReadonlySignal<boolean> = this.saved;
    public readonly basket: ReadonlySignal<readonly BasketItem[]> = this.state;
    public readonly calculator = new CalculatorService();

    private update(change: (items: readonly BasketItem[]) => readonly BasketItem[]): void {
        const next = change(this.state.get());
        this.state.set(next);
        this.saved.set(writeLocalValue(BASKET_STORAGE_KEY, next));
    }

    public addConfiguration(design: KeyboardDesign, snapshot: string | null = null): void {
        this.update(items => [...items, { id: crypto.randomUUID(), design: structuredClone(design), quantity: 1, snapshot }]);
    }

    public setQuantity(id: string, quantity: number): void {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return;
        this.update(items => items.map(item => item.id === id ? { ...item, quantity } : item));
    }

    public remove(id: string): void { this.update(items => items.filter(item => item.id !== id)); }
    public totalCents(): number {
        return this.basket.get().reduce((sum, item) => sum + this.calculator.calculate(item.design).totalCents * item.quantity, 0);
    }
}

export const checkoutService = new CheckoutService();
