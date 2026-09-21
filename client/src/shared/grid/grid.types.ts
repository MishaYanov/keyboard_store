import type { WebGlFrame } from '../../engine';

export interface IGridArea { x: number; y: number; width: number; height: number }
export interface IGridViewContext {
    id: string;
    area: Readonly<IGridArea>;
    context: WebGL2RenderingContext;
    signal: AbortSignal;
    invalidate(): void;
}
export interface IGridColumn {
    id: string;
    label: string;
    area: IGridArea;
    onEnter?: (view: IGridViewContext) => void;
}
export interface IGridStructure {
    label: string;
    columns: readonly IGridColumn[];
    initialArea?: IGridArea;
    fillDuration?: number;
    moveDuration?: number;
    className?: string;
    resizablePanel?: boolean;
    /** Layout policy supplied by the feature using this generic grid. */
    layout?: {
        rotated(): boolean;
        defaultPanelWidth(width: number): number;
    };
    scene: {
        snapshot?: (context: WebGL2RenderingContext) => string;
        pointer?: (point: { x: number; y: number }) => void;
        mount(context: WebGL2RenderingContext): void;
        paint(frame: WebGlFrame, area: Readonly<IGridArea>): void;
        dispose(context: WebGL2RenderingContext): void;
    };
}
