export const ACCESSIBILITY_CONTENT = {
    title: 'Accessibility',
    description: 'Adjust this website to suit you. Settings are saved on this device. Browser zoom and your own assistive tools remain available.',
    colorLabel: 'Display colors',
    colorHelp: 'Display adjustments also affect the preview, but do not change your saved key colors. These are viewing preferences, not a simulation or correction of a specific color-vision condition.',
    colorModes: [{ id: 'normal', label: 'Original colors' }, { id: 'grayscale', label: 'Grayscale' }, { id: 'muted', label: 'Reduced saturation' }, { id: 'inverted', label: 'Invert colors' }],
    close: 'Close', reset: 'Reset settings', skip: 'Skip to content',
    options: [
        { id: 'contrast', label: 'Increase contrast' },
        { id: 'largeText', label: 'Larger text' },
        { id: 'spacing', label: 'Increased line spacing' },
        { id: 'links', label: 'Underline links' },
        { id: 'motion', label: 'Reduce motion (also respects device settings)' },
    ],
} as const;
export type AccessibilityOption = typeof ACCESSIBILITY_CONTENT.options[number]['id'];
export type AccessibilityPreferences = Record<AccessibilityOption, boolean> & { colorMode: typeof ACCESSIBILITY_CONTENT.colorModes[number]['id'] };
export const defaultPreferences = (): AccessibilityPreferences => ({ contrast: false, colorMode: 'normal', largeText: false, spacing: false, links: false, motion: false });
