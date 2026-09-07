# Canvas view grid

`GridComponent(context, config)` is shared UI, backed by the engine's `WebGlComponent`. The keyboard scene and column configuration belong to the keyboard-builder module.

Each column defines `id`, `label`, `area: { x, y, width, height }`, and an optional `onEnter(view)` hook. Coordinates are scene units. The scene's `paint(frame, area)` uses the current interpolated camera area to draw its content.

Selection order: fill the header cell, activate the selected tab, start the canvas movement, then call `onEnter`. The first view activates on mount. The hook receives the WebGL context, area, ID, invalidation callback, and an AbortSignal that is aborted when the next view activates or the grid unmounts.

Rapid selections cancel unfinished fills. Reduced motion skips the fill and camera animation. Arrow keys, Home, and End select columns; Enter and Space work through native buttons.

The scene owns its WebGL resources through `mount`, `paint`, and `dispose`. `mount` also runs after context restoration. This component does not implement keyboard editing or options: add those in the builder's view hooks.

Edit the builder's labels and camera areas in `src/modules/keyboard-builder/models/builder.maps.ts`; connect behavior in `engine-wrapper.component.ts`.
