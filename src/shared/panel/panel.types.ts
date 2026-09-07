import type { ClassValue, Component } from '../../engine';

export type PanelContent = Component | Node | string | number | boolean | null | undefined | readonly PanelContent[];
export type PanelLength = string | number;

/** Numbers are pixels; strings accept CSS units, calc(), and custom properties. */
export interface IPanelPosition {
    position?: 'relative' | 'absolute' | 'sticky' | 'fixed';
    top?: PanelLength;
    right?: PanelLength;
    bottom?: PanelLength;
    left?: PanelLength;
    zIndex?: number;
    overflow?: 'visible' | 'hidden' | 'clip' | 'auto' | 'scroll';
    transform?: string;
    height?: PanelLength;
    minHeight?: PanelLength;
    padding?: PanelLength;
}

export interface IPanelArea extends IPanelPosition {
    gridArea?: string;
    gridColumn?: string;
    gridRow?: string;
    alignSelf?: string;
    justifySelf?: string;
}

export interface IPanelLayout {
    grid?: IPanelPosition & {
        columns?: string;
        rows?: string;
        areas?: string;
        gap?: PanelLength;
        alignItems?: string;
    };
    text?: IPanelArea;
    content?: IPanelArea;
}

export interface IPanelMobileLayout extends IPanelLayout {
    mask?: {
        /** theme darkens in dark mode and lightens in light mode. */
        mode?: 'darken' | 'lighten' | 'theme';
        /** Between 0 and 1. Defaults to 0.45. */
        opacity?: number;
    };
}

export interface IPanelStructure {
    /** Projected nodes are moved, not cloned. Components are owned by this panel. */
    text: PanelContent;
    content: PanelContent;
    ariaLabel?: string;
    classNames?: {
        root?: ClassValue;
        grid?: ClassValue;
        text?: ClassValue;
        content?: ClassValue;
        mask?: ClassValue;
    };
    position?: IPanelPosition;
    /** Viewport width in pixels; defaults to 768. */
    mobileBreakpoint?: number;
    desktop?: IPanelLayout;
    /** Defaults to both slots sharing one cell, with text above masked content. */
    mobile?: IPanelMobileLayout;
}
