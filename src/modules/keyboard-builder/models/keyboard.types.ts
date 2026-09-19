export type KeyboardSize = '100' | 'tkl' | '75' | '65' | '60';
export type PhysicalLayout = 'ansi' | 'iso' | 'jis';
export type LetterLayout = 'qwerty' | 'qwertz' | 'azerty';
export type LegendLanguage = 'en' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'nl' | 'he' | 'ar' | 'ru';
import type { KeyboardColor } from './color-palette';
export interface KeyboardDesign {
    size: KeyboardSize;
    physical: PhysicalLayout;
    letterLayout: LetterLayout;
    languages: readonly LegendLanguage[];
    primaryCorner: 'top-left' | 'top-right';
    presetId: 'graphite' | 'classic' | 'navy-coral' | 'custom';
    customColorMode: 1 | 2 | 3;
    customColors: { letters: KeyboardColor; actions: KeyboardColor; accent: KeyboardColor };
    keyColors: Readonly<Record<string, KeyboardColor>>;
    keyLegends: Readonly<Record<string, string>>;
}
