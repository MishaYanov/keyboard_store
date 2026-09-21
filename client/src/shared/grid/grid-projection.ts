import type { IGridArea } from './grid.types';

export function fitGridArea(area: Readonly<IGridArea>, width: number, height: number): IGridArea {
    const aspect = width / Math.max(height, 1);
    const fittedWidth = Math.max(area.width, area.height * aspect);
    const fittedHeight = Math.max(area.height, area.width / aspect);
    return { x: area.x - (fittedWidth - area.width) / 2, y: area.y - (fittedHeight - area.height) / 2, width: fittedWidth, height: fittedHeight };
}
