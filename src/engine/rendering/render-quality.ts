export type RenderQualityLevel = 'low' | 'medium' | 'high';

export interface RenderQualityEnvironment {
    readonly devicePixelRatio: number;
    readonly reducedMotion: boolean;
    readonly viewportWidth: number;
}

export interface RenderQualityProfile {
    readonly animations: boolean;
    readonly blur: boolean;
    readonly dprCap: number;
    readonly effectiveDpr: number;
    readonly level: RenderQualityLevel;
    readonly objectBudget: number;
    readonly shadows: boolean;
    readonly targetFps: number;
}

interface RenderQualityPreset {
    readonly blur: boolean;
    readonly dprCap: number;
    readonly level: RenderQualityLevel;
    readonly objectBudget: number;
    readonly shadows: boolean;
    readonly targetFps: number;
}

const LOW_PRESET: RenderQualityPreset = {
    blur: false,
    dprCap: 1.5,
    level: 'low',
    objectBudget: 64,
    shadows: false,
    targetFps: 30,
};

const MEDIUM_PRESET: RenderQualityPreset = {
    blur: false,
    dprCap: 1.75,
    level: 'medium',
    objectBudget: 160,
    shadows: true,
    targetFps: 60,
};

const HIGH_PRESET: RenderQualityPreset = {
    blur: true,
    dprCap: 2,
    level: 'high',
    objectBudget: 320,
    shadows: true,
    targetFps: 60,
};

function normalizeDpr(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 1;
}

function selectPreset(viewportWidth: number): RenderQualityPreset {
    if (viewportWidth <= 768) {
        return LOW_PRESET;
    }

    if (viewportWidth <= 1400) {
        return MEDIUM_PRESET;
    }

    return HIGH_PRESET;
}

/**
 * Converts browser and viewport capabilities into a stable rendering budget.
 * Scenes consume this profile instead of querying window state directly.
 */
export function selectRenderQuality(
    environment: RenderQualityEnvironment,
): RenderQualityProfile {
    const width = Number.isFinite(environment.viewportWidth)
        ? Math.max(0, environment.viewportWidth)
        : 0;
    const preset = selectPreset(width);
    const reducedMotion = environment.reducedMotion;

    return {
        animations: !reducedMotion,
        blur: preset.blur && !reducedMotion,
        dprCap: preset.dprCap,
        effectiveDpr: Math.min(
            normalizeDpr(environment.devicePixelRatio),
            preset.dprCap,
        ),
        level: preset.level,
        objectBudget: reducedMotion
            ? Math.min(preset.objectBudget, LOW_PRESET.objectBudget)
            : preset.objectBudget,
        shadows: preset.shadows && !reducedMotion,
        targetFps: reducedMotion ? 0 : preset.targetFps,
    };
}
