import type { IPanelStructure } from '../../../shared/panel';
import type { ILayoutContent } from '../../../shared/layout/layout.types';

export interface IHomepagePanel {
    title: string;
    paragraphs: readonly string[];
    color: string;
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
        sections: readonly { className: string; height: string; title: string; text: string; link: { label: string; href: string } }[];
    };
    hero: IHeroContent;
    layout: ILayoutContent;
}
