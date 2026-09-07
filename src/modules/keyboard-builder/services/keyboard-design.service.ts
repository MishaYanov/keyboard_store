import { signal, type ReadonlySignal } from '../../../engine';
import { KEYBOARD_OPTIONS } from '../models/keyboard-options';
import type { KeyboardDesign, KeyboardSize, PhysicalLayout, LetterLayout, LegendLanguage } from '../models/keyboard.types';

export class KeyboardDesignService {
    private readonly selected = signal<string | null>(null);
    public readonly selectedKey: ReadonlySignal<string | null> = this.selected;
    private readonly state = signal<KeyboardDesign>({ ...KEYBOARD_OPTIONS.initial, languages: [...KEYBOARD_OPTIONS.initial.languages] });
    public readonly design: ReadonlySignal<KeyboardDesign> = this.state;
    public setSize(size: KeyboardSize): void { this.selected.set(null); this.state.update(state => ({ ...state, size })); }
    public setPhysical(physical: PhysicalLayout): void { this.selected.set(null); this.state.update(state => ({ ...state, physical })); }
    public setLetterLayout(letterLayout: LetterLayout): void { this.state.update(state => ({ ...state, letterLayout })); }
    public setCorner(primaryCorner: KeyboardDesign['primaryCorner']): void { this.state.update(state => ({ ...state, primaryCorner })); }
    public toggleLanguage(language: LegendLanguage): boolean {
        const state = this.state.get();
        const selected = state.languages.includes(language);
        if ((!selected && state.languages.length >= 2) || (selected && state.languages.length === 1)) return false;
        this.state.set({ ...state, languages: selected ? state.languages.filter(value => value !== language) : [...state.languages, language] });
        return true;
    }
    public swapLanguages(): void { this.state.update(state => ({ ...state, languages: [...state.languages].reverse() })); }
    public selectKey(id: string | null): void { this.selected.set(id); }
    public setPreset(presetId: KeyboardDesign['presetId']): void { this.state.update(state => ({ ...state, presetId })); }
    public setKeyColor(color: string): void {
        const id = this.selected.get();
        if (!id || !/^#[0-9a-f]{6}$/i.test(color)) return;
        this.state.update(state => ({ ...state, keyColors: { ...state.keyColors, [id]: color.toLowerCase() } }));
    }
    public resetKeyColor(): void {
        const id = this.selected.get();
        if (!id) return;
        this.state.update(state => { const keyColors = { ...state.keyColors }; delete keyColors[id]; return { ...state, keyColors }; });
    }
    public resetAllColors(): void { this.state.update(state => ({ ...state, keyColors: {} })); }
}
