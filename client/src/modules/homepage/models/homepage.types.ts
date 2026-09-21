import type { IPanelStructure } from '../../../shared/panel';
import type { ILayoutContent } from '../../../shared/layout/layout.types';

export interface IHomepagePanel {
    title: string;
    paragraphs: readonly string[];
    image: { src: string; alt: string };
    contentHeight: string;
    structure: Omit<IPanelStructure, 'text' | 'content'>;
}

export interface IHeroContent {
    title: string;
    subtitle: string;
    height: string;
    header: { top: string; left: string; right: string };
}

export interface IHomepageContent {
    homepage: {
        panels: readonly IHomepagePanel[];
        sections: readonly {
            className: string;
            eyebrow: string;
            title: string;
            text: string;
            image?: { src: string; alt: string };
            link: { label: string; href: string };
        }[];
    };
    hero: IHeroContent;
    layout: ILayoutContent;
}
