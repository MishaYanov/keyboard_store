export type BuilderCommand = { type: 'pane'; index: number } | { type: 'help' | 'focus' | 'close' | 'basket' | 'add' };

/** Kept independent of the DOM so shortcut safety can be unit tested. */
export function builderCommand(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing' | 'repeat'>, editing: boolean): BuilderCommand | null {
    if (editing || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return null;
    if (/^[1-7]$/.test(event.key)) return { type: 'pane', index: Number(event.key) - 1 };
    switch (event.key.toLowerCase()) {
        case '?': return { type: 'help' };
        case 'f': return { type: 'focus' };
        case 'escape': return { type: 'close' };
        case 'b': return { type: 'basket' };
        case 'a': return { type: 'add' };
        default: return null;
    }
}

export function isEditing(target: Element | null): boolean {
    return Boolean(target?.closest('textarea, [contenteditable]:not([contenteditable="false"]), input:not([type="radio"]):not([type="checkbox"]):not([type="button"]), select'));
}

/** Up/down changes control groups; left/right changes a radio choice through normal events. */
export function moveSidebar(panel: HTMLElement, key: string): boolean {
    const controls = Array.from(panel.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled), a[href]'))
        .filter(control => control.getClientRects().length > 0 && !control.closest('[hidden]') && control.dataset.action !== 'close');
    const focused = document.activeElement;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
        if (controls.includes(focused as HTMLElement) && !(focused instanceof HTMLInputElement && focused.type === 'radio')) return false;
        const radio = focused instanceof HTMLInputElement && focused.type === 'radio' && controls.includes(focused)
            ? focused : controls.find(control => control instanceof HTMLInputElement && control.type === 'radio' && control.checked)
                ?? controls.find(control => control instanceof HTMLInputElement && control.type === 'radio');
        if (!(radio instanceof HTMLInputElement)) return false;
        const group = controls.filter((control): control is HTMLInputElement => control instanceof HTMLInputElement && control.type === 'radio' && control.name === radio.name);
        const index = group.indexOf(radio);
        const next = group[(index + (key === 'ArrowRight' ? 1 : -1) + group.length) % group.length];
        next?.focus();
        next?.click();
        return true;
    }
    if (key !== 'ArrowUp' && key !== 'ArrowDown') return false;
    const groups = controls.filter(control => !(control instanceof HTMLInputElement) || control.type !== 'radio' || control.checked
        || !controls.some(other => other instanceof HTMLInputElement && other.type === 'radio' && other.name === control.name && other.checked)
        && controls.find(other => other instanceof HTMLInputElement && other.type === 'radio' && other.name === control.name) === control);
    if (!groups.length) return false;
    const index = groups.indexOf(focused as HTMLElement);
    groups[index < 0 ? 0 : (index + (key === 'ArrowDown' ? 1 : -1) + groups.length) % groups.length]?.focus();
    return true;
}
