const keyboardImage = '/assets/images/keyboard.webp';
const keysImage = '/assets/images/keys.webp';
const homeImage = '/assets/images/home.webp';

import type { IHomepageContent } from './homepage.types';

import { SITE_CONTENT } from '../../../models/site.maps';

/** Edit page copy and per-instance layout settings here. No DOM nodes or component instances. */
export const HOMEPAGE_CONTENT = {
    homepage: {
        panels: [
            {
                title: 'A fit for your layout. A feel of your own.',
                paragraphs: [
                    'Start with your keyboard layout, then explore the keycap shapes, profiles, and colors that suit the way you type. A compact board and a full-size keyboard need different combinations of keys; the design starts with those differences.',
                    'Plan your set around the sizes and positions of your spacebar, modifiers, and Enter key. Layout size alone does not guarantee a fit, so check your board’s key dimensions, switch stems, and stabilizer requirements before ordering.',
                ],
                image: { src: keyboardImage, alt: '' },
                contentHeight: 'var(--homepage-panel-image-height)',
                structure: {
                    classNames: { root: 'homepage-panel first-panel', text: 'homepage-panel__text' },
                    desktop: {
                        grid: { minHeight: 'var(--homepage-panel-min-height)', columns: 'var(--layout-panel-columns)' },
                        text: { gridColumn: '2 / 7', alignSelf: 'center', zIndex: 2 },
                        content: { gridColumn: '6 / 12', alignSelf: 'center', zIndex: 1 },
                    },
                    mobile: {
                        grid: { minHeight: 'var(--homepage-panel-min-height)', columns: 'var(--layout-panel-columns)' },
                        text: { alignSelf: 'center' },
                        mask: { mode: 'theme', opacity: 0.72 },
                    },
                },
            },
            {
                title: 'Your languages. Your legends. Your placement.',
                paragraphs: [
                    'Design a keyboard that speaks your language. Plan primary and secondary legends for multilingual typing, or create labels for shortcuts and the keys you use most.',
                    'Choose where each legend belongs on the keycap instead of relying on a standard printed layout. Your design can specify custom text placement; supported characters, print areas, and production feasibility must be confirmed before an order is accepted.',
                ],
                image: { src: keysImage, alt: '' },
                contentHeight: 'var(--homepage-panel-image-height)',
                structure: {
                    classNames: { root: 'homepage-panel second-panel', text: 'homepage-panel__text' },
                    desktop: {
                        grid: { minHeight: 'var(--homepage-panel-min-height)', columns: 'var(--layout-panel-columns)' },
                        text: { gridColumn: '7 / 12', alignSelf: 'center', zIndex: 2 },
                        content: { gridColumn: '2 / 8', alignSelf: 'center', zIndex: 1 },
                    },
                    mobile: {
                        grid: { minHeight: 'var(--homepage-panel-min-height)', columns: 'var(--layout-panel-columns)' },
                        text: { alignSelf: 'center' },
                        mask: { mode: 'theme', opacity: 0.72 },
                    },
                },
            },
        ],
        sections: [
            {
                className: 'homepage-section--builder',
                eyebrow: '01 / Create',
                title: 'Build it one key at a time.',
                text: 'Shape the layout, colors, and multilingual legends in the interactive builder. Inspect the whole board, then tune individual keys before you commit to a set.',
                image: { src: homeImage, alt: 'Close-up of a black Home keycap' },
                link: { label: 'Open the builder', href: '#/builder' },
            },
            {
                className: 'homepage-section--order',
                eyebrow: '02 / Review',
                title: 'From design to basket.',
                text: 'Get a clear price breakdown for the keyboard size, layout, legends, colors, and individual key choices in your configuration.',
                link: { label: 'View your basket', href: '#/checkout' },
            },
            {
                className: 'homepage-section--account',
                eyebrow: '03 / Return',
                title: 'Keep your ideas close.',
                text: 'Your current design is saved in this browser. Account access will eventually give your designs a permanent home across devices.',
                link: { label: 'Account access', href: '#/login' },
            },
        ],
    },
    hero: {
        title: 'Your keyboard. Your character.',
        subtitle: 'Design custom keycaps around your layout, your languages, and the way you type.',
        height: '120dvh',
        header: { top: '22%', left: '10%', right: '32%' },
    },
    layout: SITE_CONTENT.layout,
} satisfies IHomepageContent;
