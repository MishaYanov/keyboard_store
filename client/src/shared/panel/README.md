# Panel

`PanelComponent` accepts one `IPanelStructure` object. It is standalone and can be mounted by any parent component. It does not add itself to a route.

```ts
import { PanelComponent, type IPanelStructure } from '../../shared/panel';

const structure: IPanelStructure = {
    text: [titleElement, subtitleElement],
    content: imageElement, // Or a new, unmounted Component instance.
    classNames: {
        root: 'product-panel',
        text: 'product-panel__copy',
        content: 'product-panel__visual',
    },
    desktop: {
        grid: { columns: '1fr 1fr', minHeight: '60dvh', gap: '2rem' },
        text: { gridColumn: '1', alignSelf: 'center', zIndex: 2 },
        content: { gridColumn: '2', left: '-2rem', zIndex: 1 },
    },
    mobile: {
        grid: { minHeight: '70dvh' },
        text: { padding: '1.5rem', alignSelf: 'end' },
        content: { gridArea: '1 / 1 / 2 / 2' },
        mask: { mode: 'darken', opacity: 0.5 },
    },
};

// Construct in the parent's constructor:
this.panel = new PanelComponent(structure);
// Mount in the parent's onMount (or onLayoutMount for LayoutComponent):
this.attach(this.panel);
```

- Default desktop: two equal columns, text left and content right.
- Default mobile: one shared cell, content behind text, and a theme-aware mask.
- `mobileBreakpoint` defaults to 768 viewport pixels. Mobile and desktop configs are independent; omitted properties use their respective defaults.
- `position`, `top`, `right`, `bottom`, `left`, `transform`, `overflow`, and `zIndex` work on the panel (`position` config), grid, or either area. Numbers for lengths become pixels; strings accept CSS units.
- Overlap areas with matching `gridRow`/`gridColumn` or `gridArea`, negative offsets, or absolute positioning. Give the grid a height/minHeight if both areas are absolutely positioned.
- Named areas are supported: `grid: { areas: '"copy visual"' }`, `text: { gridArea: 'copy' }`, `content: { gridArea: 'visual' }`.
- Mobile always raises text above content, even if its configured z-index is lower. Desktop honors both values directly.
- Mobile mask modes: `darken` (black), `lighten` (white), or `theme` (theme token with black fallback). Opacity ranges from 0 to 1; zero disables the visual effect. It does not intercept input.
- Use text-area custom classes to choose readable text colors for your selected mask. Projected media keeps its own sizing and styling.
- Slots accept strings, numbers, DOM nodes, components, and nested arrays. Null/undefined/booleans render nothing. DOM nodes are moved, never cloned; listeners and identity survive breakpoint changes. Do not project the same node twice.
- Projected components must be unmounted instances. The panel mounts and owns them, then unmounts them with itself. Do not attach them separately to another parent.
- Custom classes are available on `root`, `grid`, `text`, `content`, and `mask`. Built-in classes use `panel__*`. CSS is scoped so projected component internals remain independent.
- Layout configuration is applied as CSS custom properties; ordinary styling stays in `panel.css`. The config is read at construction/mount and is not a reactive update API.

Browser verification fixture: `/tests/panel.html` on the Vite dev server.
