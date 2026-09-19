# Keyboard builder

## Editing content

- `models/builder.maps.ts`: page introduction, view columns, and initial camera areas.
- `models/settings.maps.ts`: settings headings, buttons, instructions, and formatted labels.
- `models/keyboard-options.ts`: available layouts, sizes, languages, legend corners, and initial design.
- `models/color-presets.ts`: preset names, descriptions, and palette colors.
- `models/keyboard.types.ts`: design data types.

## Responsibilities

`EngineWrapperComponent` coordinates the grid, input events, service, and preview refreshes.
`KeyboardSettingsView` renders a state snapshot into the settings panel and restores focus after updates. Its individual methods render presets, individual key styling, and languages. It does not mutate design state or register events.
`KeyboardDesignService` owns design changes and selection constraints.
The scene, geometry, and key-color helpers handle preview rendering, key positions, hit testing, and color resolution.

Keep editable copy and option data in models. Keep DOM structure in views, state changes in the service, and rendering calculations in the preview helpers.
