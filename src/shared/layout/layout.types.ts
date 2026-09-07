export interface IHeaderContent {
    themes: readonly { value: 'light' | 'dark'; label: string }[];
    separator: string;
    themeLabel: string;
    menuLabel: string;
    openMenuLabel: string;
    closeMenuLabel: string;
    closeMenuText: string;
}

export interface ILayoutContent {
    header: IHeaderContent;
    footer: {
        height: string;
        title: string;
        links: readonly { label: string; href: string }[];
        disclaimers: readonly string[];
    };
}
