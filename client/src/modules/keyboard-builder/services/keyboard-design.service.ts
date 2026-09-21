import { signal, type ReadonlySignal } from '../../../engine';
import { KEYBOARD_OPTIONS } from '@keycaps/domain/keyboard-options';
import type { KeyboardDesign, KeyboardSize, PhysicalLayout, LetterLayout, LegendLanguage } from '@keycaps/domain/keyboard.types';
import { normalizeKeyboardDesign } from '@keycaps/domain/keyboard-design.validation';
import { browserStorage, type JsonStorage } from '../../../shared/storage/json-storage';
import { isKeyboardColor, type KeyboardColor } from '@keycaps/domain/color-palette';

export const KEYBOARD_STORAGE_KEY = 'custom-keycaps:keyboard:v1';

function restoreDesign(storage: JsonStorage): KeyboardDesign {
    const saved = storage.read(KEYBOARD_STORAGE_KEY);
    return normalizeKeyboardDesign(saved) ?? structuredClone(KEYBOARD_OPTIONS.initial);
}

export class KeyboardDesignService {
    private readonly selected = signal<string | null>(null);
    public readonly selectedKey: ReadonlySignal<string | null> = this.selected;
    private readonly state = signal<KeyboardDesign>(structuredClone(KEYBOARD_OPTIONS.initial));
    private readonly saved = signal(true);
    public readonly storageAvailable: ReadonlySignal<boolean> = this.saved;
    public readonly design: ReadonlySignal<KeyboardDesign> = this.state;
    public constructor(private readonly storage: JsonStorage = browserStorage) {
        this.state.set(restoreDesign(storage));
    }
    private update(change: (state: KeyboardDesign) => KeyboardDesign): void {
        const next = change(this.state.get());
        this.state.set(next);
        this.saved.set(this.storage.write(KEYBOARD_STORAGE_KEY, next));
    }
    public setSize(size: KeyboardSize): void { this.selected.set(null); this.update(state => ({ ...state, size })); }
    public setPhysical(physical: PhysicalLayout): void { this.selected.set(null); this.update(state => ({ ...state, physical })); }
    public setLetterLayout(letterLayout: LetterLayout): void { this.update(state => ({ ...state, letterLayout })); }
    public setCorner(primaryCorner: KeyboardDesign['primaryCorner']): void { this.update(state => ({ ...state, primaryCorner })); }
    public toggleLanguage(language: LegendLanguage): boolean {
        const state = this.state.get();
        const selected = state.languages.includes(language);
        if ((!selected && state.languages.length >= 2) || (selected && state.languages.length === 1)) return false;
        this.update(() => ({ ...state, languages: selected ? state.languages.filter(value => value !== language) : [...state.languages, language] }));
        return true;
    }
    public swapLanguages(): void { this.update(state => ({ ...state, languages: [...state.languages].reverse() })); }
    public selectKey(id: string | null): void { this.selected.set(id); }
    public setPreset(presetId: KeyboardDesign['presetId']): void { this.update(state => ({ ...state, presetId })); }
    public setCustomMode(mode: KeyboardDesign['customColorMode']): void { this.update(state => ({ ...state, customColorMode: mode })); }
    public setCustomColor(role: keyof KeyboardDesign['customColors'], color: string): void {
        if (!isKeyboardColor(color)) return;
        this.update(state => ({ ...state, customColors: { ...state.customColors, [role]: color as KeyboardColor } }));
    }
    public setKeyColor(color: string): void {
        const id = this.selected.get();
        if (!id || !isKeyboardColor(color)) return;
        this.update(state => ({ ...state, keyColors: { ...state.keyColors, [id]: color } }));
    }
    public resetKeyColor(): void {
        const id = this.selected.get();
        if (!id) return;
        this.update(state => { const keyColors = { ...state.keyColors }; delete keyColors[id]; return { ...state, keyColors }; });
    }
    public setKeyLegend(value: string): void {
        const id = this.selected.get();
        if (!id) return;
        const legend = [...value.trim()].slice(0, 24).join('');
        this.update(state => {
            const keyLegends = { ...state.keyLegends };
            if (legend) keyLegends[id] = legend;
            else delete keyLegends[id];
            return { ...state, keyLegends };
        });
    }
    public resetKeyCustomization(): void {
        const id = this.selected.get();
        if (!id) return;
        this.update(state => {
            const keyColors = { ...state.keyColors };
            const keyLegends = { ...state.keyLegends };
            delete keyColors[id];
            delete keyLegends[id];
            return { ...state, keyColors, keyLegends };
        });
    }
    public resetAllColors(): void { this.update(state => ({ ...state, keyColors: {} })); }
}
