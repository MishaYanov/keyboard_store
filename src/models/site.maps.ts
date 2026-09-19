import type { ILayoutContent } from '../shared/layout/layout.types';

export interface IPageContent {
    title: string;
    paragraphs: readonly string[];
    links: readonly { label: string; href: string }[];
}

export const SITE_LINKS = [
                { label: 'Home', href: '#/' },
                { label: 'Builder', href: '#/builder' },
                { label: 'About', href: '#/about' },
                { label: 'Login', href: '#/login' },
            ];

/** Shared site copy. Homepage-specific content lives in homepage.maps.ts. */
export const SITE_CONTENT = {
    layout: {
        header: {
            links: SITE_LINKS,
            navigationLabel: 'Main navigation',
            switchToLight: 'Switch to light mode',
            switchToDark: 'Switch to dark mode',
            themes: [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }],
            separator: '|', themeLabel: 'Dark mode', menuLabel: 'Menu',
            openMenuLabel: 'Open menu', closeMenuLabel: 'Close menu', closeMenuText: '×',
        },
        footer: {
            height: '50dvh',
            title: 'Made personal, one key at a time.',
            links: SITE_LINKS,
            disclaimers: [
                'This site is a product prototype. Account access, checkout, and manufacturing services are not yet available.',
                'On-screen colors and previews are illustrative. Final materials, print details, compatibility, pricing, and delivery must be confirmed before ordering.',
                'Third-party names and trademarks belong to their respective owners. References do not imply affiliation or endorsement.',
            ],
        },
    } satisfies ILayoutContent,
    pages: {
        about: {
            title: 'A keyboard should feel like yours.',
            paragraphs: ['This project explores a more personal way to design keycaps: start with the keyboard you own, then choose the look, languages, and details that make it yours.', 'Our focus is an interactive 3D builder that brings layout planning and custom legends together. The product is still being developed, and the current site introduces the experience we are working toward.'],
            links: [{ label: 'Explore the builder', href: '#/builder' }, { label: 'Back to home', href: '#/' }],
        },
        login: {
            title: 'Your designs, in one place.',
            paragraphs: ['Account access will provide a place to return to your keycap designs and follow future orders.', 'Login and account creation are not connected yet. You do not need to enter personal information to explore the current prototype.'],
            links: [{ label: 'Explore the builder', href: '#/builder' }, { label: 'Back to home', href: '#/' }],
        },
        builder: {
            title: 'Your custom keyboard starts here.',
            paragraphs: ['The interactive WebGL builder is in development. This page will bring together keyboard layouts, keycap styles, colors, multilingual legends, and custom print placement.', 'The next step is the editing workspace: select a key, adjust its options, and inspect the complete design in 3D. Editing, saving, and ordering are not available on this page yet.'],
            links: [{ label: 'About the project', href: '#/about' }, { label: 'Back to home', href: '#/' }],
        },
        notFound: {
            title: 'Page not found', paragraphs: ['That page is not part of this site.'],
            links: [{ label: 'Back to home', href: '#/' }],
        },
    } satisfies Record<string, IPageContent>,
};
