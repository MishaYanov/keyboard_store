let nextSelectId = 0;

/** In-document picker: unlike an OS select sheet, it inherits the builder rotation. */
export function enhanceBuilderSelect(select: HTMLSelectElement): void {
    const label = select.parentElement!;
    const title = label.firstChild?.textContent?.trim() ?? select.name;
    select.setAttribute('aria-label', title);
    const field = document.createElement('div');
    field.className = label.className;
    field.append(...Array.from(label.childNodes));
    label.replaceWith(field);
    const picker = document.createElement('div');
    picker.className = 'builder-select';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.name = select.name;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-label', title);
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.textContent = `${select.selectedOptions[0]?.textContent ?? ''} ▾`;
    const list = document.createElement('div');
    list.id = `builder-select-${++nextSelectId}`;
    list.className = 'builder-select__list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', title);
    list.hidden = true;
    trigger.setAttribute('aria-controls', list.id);
    const options = Array.from(select.options).map(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.tabIndex = -1;
        button.textContent = option.textContent;
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(option.selected));
        button.disabled = option.disabled;
        button.addEventListener('click', () => {
            select.value = option.value;
            close();
            trigger.focus({ preventScroll: true });
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return button;
    });
    const close = () => { list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
    const open = () => {
        list.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        options[Math.max(0, select.selectedIndex)]?.focus({ preventScroll: true });
    };
    trigger.addEventListener('click', () => list.hidden ? open() : close());
    picker.addEventListener('focusout', event => {
        if (!(event.relatedTarget instanceof Node) || !picker.contains(event.relatedTarget)) close();
    });
    let search = '', lastKey = 0;
    picker.addEventListener('keydown', event => {
        // Keep game shortcuts from stealing dropdown navigation and type-ahead.
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); close(); trigger.focus(); return; }
        if (event.key === 'Tab') { close(); return; }
        const enabled = options.filter(option => !option.disabled);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            if (list.hidden) { open(); return; }
            const index = enabled.indexOf(document.activeElement as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
            enabled[next]?.focus({ preventScroll: true });
            enabled[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } else if (event.key.length === 1 && event.key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (list.hidden) open();
            search = (performance.now() - lastKey > 700 ? '' : search) + event.key.toLowerCase();
            lastKey = performance.now();
            const match = enabled.find(option => option.textContent?.toLowerCase().startsWith(search));
            match?.focus({ preventScroll: true });
            match?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    });
    list.append(...options);
    picker.append(trigger, list);
    field.append(picker);
}
