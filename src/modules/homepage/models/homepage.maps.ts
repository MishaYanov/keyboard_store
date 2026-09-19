import keyboardImage from '../../../../public/assets/images/keyboard.jpg?url';
import keys from '../../../../public/assets/images/keys.jpg?url';

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
                contentHeight: '60dvh',
                structure: {
                    classNames: { root: 'homepage-panel first-panel', text: 'homepage-panel__text' },
                    desktop: {
                        grid: { minHeight: '60dvh' },
                        text: { gridColumn: '1', alignSelf: 'center' },
                        content: { gridColumn: '2' },
                    },
                    mobile: {
                        grid: { minHeight: '60dvh' },
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
                image: { src: keys, alt: '' },
                contentHeight: '60dvh',
                structure: {
                    classNames: { root: 'homepage-panel second-panel', text: 'homepage-panel__text' },
                    desktop: {
                        grid: { minHeight: '60dvh' },
                        text: { gridColumn: '2', alignSelf: 'center' },
                        content: { gridColumn: '1' },
                    },
                    mobile: {
                        grid: { minHeight: '60dvh' },
                        text: { alignSelf: 'center' },
                        mask: { mode: 'theme', opacity: 0.72 },
                    },
                },
            },
        ],
        sections: [
            { className: 'homepage-section--1', height: '50dvh', title: 'Build it one key at a time.', text: 'The interactive 3D builder is where your layout, keycap styles, colors, and legends will come together. The planned workflow lets you inspect your keyboard from different angles and refine individual keys before reviewing the complete set. The builder is currently in development.', link: { label: 'Explore the builder', href: '#/builder' } },
            { className: 'homepage-section--2', height: '50dvh', title: 'From your design to an order.', text: 'Before production, your design needs a final review of key sizes, quantities, legends, and print placement. Pricing, manufacturing availability, processing time, and delivery details must be confirmed before payment. Online ordering is not available in this prototype yet.', link: { label: 'Account access', href: '#/login' } },
            { className: 'homepage-section--3', height: '50dvh', title: 'Make room for your own ideas.', text: 'We are building a place to turn a keyboard you use every day into something that feels personal. Learn about the project and the thinking behind a more flexible keycap design experience.', link: { label: 'About the project', href: '#/about' } },
        ],
    },
    hero: {
        title: 'Your keyboard. Your character.',
        subtitle: 'Design custom keycaps around your layout, your languages, and the way you type.',
        height: '300dvh',
        header: { top: '15%', left: '10%', right: '10%' },
    },
    layout: SITE_CONTENT.layout,
} satisfies IHomepageContent;
