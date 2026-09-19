import { signal, type ReadonlySignal } from '../../../engine';
import { KEYBOARD_OPTIONS } from '../models/keyboard-options';
import type { KeyboardDesign, KeyboardSize, PhysicalLayout, LetterLayout, LegendLanguage } from '../models/keyboard.types';
import { isKeyboardDesign } from '../models/keyboard-design.validation';
import { readLocalValue, writeLocalValue } from '../../../shared/storage/local-storage';

export const KEYBOARD_STORAGE_KEY = 'custom-keycaps:keyboard:v1';

function restoreDesign(): KeyboardDesign {
    const saved = readLocalValue(KEYBOARD_STORAGE_KEY);
    return isKeyboardDesign(saved) ? saved : structuredClone(KEYBOARD_OPTIONS.initial);
}

export class KeyboardDesignService {
    private readonly selected = signal<string | null>(null);
    public readonly selectedKey: ReadonlySignal<string | null> = this.selected;
    private readonly state = signal<KeyboardDesign>(restoreDesign());
    private readonly saved = signal(true);
    public readonly storageAvailable: ReadonlySignal<boolean> = this.saved;
    public readonly design: ReadonlySignal<KeyboardDesign> = this.state;
    private update(change: (state: KeyboardDesign) => KeyboardDesign): void {
        const next = change(this.state.get());
        this.state.set(next);
        this.saved.set(writeLocalValue(KEYBOARD_STORAGE_KEY, next));
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
        if (!/^#[0-9a-f]{6}$/i.test(color)) return;
        this.update(state => ({ ...state, customColors: { ...state.customColors, [role]: color.toLowerCase() } }));
    }
    public setKeyColor(color: string): void {
        const id = this.selected.get();
        if (!id || !/^#[0-9a-f]{6}$/i.test(color)) return;
        this.update(state => ({ ...state, keyColors: { ...state.keyColors, [id]: color.toLowerCase() } }));
    }
    public resetKeyColor(): void {
        const id = this.selected.get();
        if (!id) return;
        this.update(state => { const keyColors = { ...state.keyColors }; delete keyColors[id]; return { ...state, keyColors }; });
    }
    public resetAllColors(): void { this.update(state => ({ ...state, keyColors: {} })); }
}
