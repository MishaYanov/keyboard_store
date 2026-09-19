export const KEYBOARD_COLOR_PALETTE = [
    { id: 'black', label: 'Black', value: '#1b1b1d' },
    { id: 'charcoal', label: 'Charcoal', value: '#34363a' },
    { id: 'gray', label: 'Gray', value: '#6f7378' },
    { id: 'warm-gray', label: 'Warm gray', value: '#b8b5ad' },
    { id: 'ivory', label: 'Ivory', value: '#e8e2d6' },
    { id: 'white', label: 'White', value: '#f5f5f2' },
    { id: 'navy', label: 'Navy', value: '#263d59' },
    { id: 'blue', label: 'Blue', value: '#3b6ea8' },
    { id: 'teal', label: 'Teal', value: '#2d7d78' },
    { id: 'green', label: 'Green', value: '#5e7d4a' },
    { id: 'yellow', label: 'Yellow', value: '#d9b44a' },
    { id: 'red', label: 'Red', value: '#b94a48' },
] as const;

export type KeyboardColor = typeof KEYBOARD_COLOR_PALETTE[number]['value'];

export function isKeyboardColor(value: unknown): value is KeyboardColor {
    return typeof value === 'string' && KEYBOARD_COLOR_PALETTE.some(color => color.value === value);
}

export function closestKeyboardColor(value: string): KeyboardColor {
    if (isKeyboardColor(value)) return value.toLowerCase() as KeyboardColor;
    if (!/^#[0-9a-f]{6}$/i.test(value)) return KEYBOARD_COLOR_PALETTE[0].value;
    const rgb = [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16));
    return KEYBOARD_COLOR_PALETTE.reduce((closest, candidate) => {
        const candidateRgb = [1, 3, 5].map(index => Number.parseInt(candidate.value.slice(index, index + 2), 16));
        const distance = candidateRgb.reduce((sum, channel, index) => sum + (channel - rgb[index]!) ** 2, 0);
        return distance < closest.distance ? { value: candidate.value, distance } : closest;
    }, { value: KEYBOARD_COLOR_PALETTE[0].value as KeyboardColor, distance: Number.POSITIVE_INFINITY }).value;
}
