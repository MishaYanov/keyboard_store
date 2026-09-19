/** Storage can be unavailable in private browsing or full; keep the app usable. */
export function readLocalValue(key: string): unknown {
    try {
        const value = window.localStorage.getItem(key);
        return value === null ? null : JSON.parse(value);
    } catch { return null; }
}

export function writeLocalValue(key: string, value: unknown): boolean {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch { return false; }
}
