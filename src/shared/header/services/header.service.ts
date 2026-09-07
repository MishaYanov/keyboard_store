import { signal, type ReadonlySignal } from '../../../engine';
import type { IHeaderContent } from '../../layout/layout.types';

export type Theme = 'light' | 'dark';

export class HeaderService {
    public constructor(public readonly content: IHeaderContent) {}
    private readonly menuState = signal(false);
    public readonly menuOpen: ReadonlySignal<boolean> = this.menuState;
    private readonly themeState = signal<Theme>(
        document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    );
    public readonly theme: ReadonlySignal<Theme> = this.themeState;

    public setTheme(theme: Theme): void {
        document.documentElement.dataset.theme = theme;
        this.themeState.set(theme);
    }

    public setMenuOpen(open: boolean): void {
        this.menuState.set(open);
    }
}
