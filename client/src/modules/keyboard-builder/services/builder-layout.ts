import type { IGridStructure } from '../../../shared/grid/grid.types';

/** CSS owns viewport matching; JS consumes its resolved feature policy. */
export function builderLayout(element: HTMLElement): NonNullable<IGridStructure['layout']> {
    const flag = (name: string) => getComputedStyle(element).getPropertyValue(name).trim() === '1';
    return {
        rotated: () => flag('--builder-rotated'),
        defaultPanelWidth: width => flag('--builder-compact') ? (width - 20) * .5 : Math.min(352, width * .5),
    };
}
