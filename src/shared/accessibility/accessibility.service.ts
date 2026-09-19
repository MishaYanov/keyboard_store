import { ACCESSIBILITY_CONTENT, defaultPreferences, type AccessibilityPreferences } from './accessibility.models';

const STORAGE_KEY = 'keycaps-accessibility';
export function reducedMotion(): boolean {
    return document.documentElement.dataset.a11yMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class AccessibilityService {
    public preferences: AccessibilityPreferences = defaultPreferences();

    public constructor() {
        try {
            const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (stored && typeof stored === 'object') {
                const mode = (stored as Record<string, unknown>).colorMode;
                if (ACCESSIBILITY_CONTENT.colorModes.some(item => item.id === mode)) this.preferences.colorMode = mode as AccessibilityPreferences['colorMode'];
                for (const { id } of ACCESSIBILITY_CONTENT.options) {
                    if (id in stored && typeof (stored as Record<string, unknown>)[id] === 'boolean') {
                        this.preferences[id] = (stored as AccessibilityPreferences)[id];
                    }
                }
            }
        } catch { /* Storage may be unavailable or contain an older value. */ }
        this.apply();
    }

    public apply(): void {
        document.documentElement.dataset.a11yColors = this.preferences.colorMode;
        for (const { id } of ACCESSIBILITY_CONTENT.options) {
            const attribute = `a11y${id[0]!.toUpperCase()}${id.slice(1)}`;
            document.documentElement.dataset[attribute] = String(this.preferences[id]);
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences)); } catch { /* In-memory settings still work. */ }
        window.dispatchEvent(new Event('accessibilitychange'));
    }
}
