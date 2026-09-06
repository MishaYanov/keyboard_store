# Reactive Canvas Core Architecture

This document is the implementation map for a small, component-based frontend runtime built with TypeScript, the DOM, and Canvas 2D.

The goal is not to clone React. The goal is to build the smallest useful system with:

- fine-grained reactive state;
- component composition and predictable cleanup;
- delegated DOM events;
- scheduled and batched work;
- canvas invalidation instead of unconditional rendering;
- explicit performance budgets for mobile devices.

## Core execution model

```text
signal changes
    -> dependent effect becomes dirty
    -> scheduler batches the effect
    -> DOM binding updates directly

signal changes
    -> canvas component is invalidated
    -> scheduler requests one animation frame
    -> dirty canvas repaints once
```

There is no virtual DOM in the first version. Components create their DOM once, reactive bindings modify exact nodes, and Canvas components redraw only when required.

## Recommended source structure

```text
src/
├── app.ts
├── router.ts
├── core/                         # application-wide business logic
│   ├── auth/
│   └── payment-gateway/
├── engine/                       # reusable UI runtime
│   ├── application.ts
│   ├── application-context.ts
│   ├── bootstrap-application.ts
│   ├── index.ts
│   ├── component.ts
│   ├── component-scope.ts
│   ├── component-builder.ts
│   ├── lifecycle.ts
│   ├── scheduler.ts
│   ├── events/
│   │   ├── event-manager.ts
│   │   └── pointer-router.ts
│   ├── reactive/
│   │   ├── signal.ts
│   │   ├── effect.ts
│   │   ├── computed.ts
│   │   ├── dependency-context.ts
│   │   └── batch.ts
│   ├── rendering/
│   │   ├── dom-binding.ts
│   │   ├── canvas-component.ts
│   │   ├── canvas-viewport.ts
│   │   ├── canvas-scheduler.ts
│   │   └── render-quality.ts
│   └── diagnostics/
│       ├── invariant.ts
│       └── performance-monitor.ts
├── modules/                      # route-level feature boundaries
│   ├── about/
│   │   ├── about.wrapper.ts
│   │   ├── components/
│   │   ├── models/
│   │   └── services/
│   ├── admin/
│   ├── client/
│   ├── homepage/
│   │   ├── homepage.wrapper.ts
│   │   ├── components/
│   │   │   └── hero.component.ts
│   │   ├── models/
│   │   └── services/
│   │       └── hero.service.ts
│   └── keyboard-builder/
├── shared/
│   └── layout/
│       └── layout.component.ts
└── tests/
    └── engine/
```

`engine/` must not import from `core/`, `modules/`, `shared/`, or `router.ts`.
Application code may depend inward on the engine. Every feature module exposes
one route entry component named `*.wrapper.ts`; its `components`, `models`, and
`services` folders remain private to that feature unless intentionally shared.

## Engine files and responsibilities

| File | Logic | Purpose | Concrete implementation steps |
| --- | --- | --- | --- |
| `src/engine/reactive/dependency-context.ts` | Holds the currently executing reactive observer and records signal reads. It is the internal link between signals, computed values, and effects. | Enables automatic dependency tracking without making components manually subscribe to every value. | 1. Define an internal `ReactiveObserver` interface. 2. Store an `activeObserver`. 3. Add `trackDependency(source)` for reads. 4. Add `runWithObserver(observer, fn)` using `try/finally` so the previous observer is always restored. 5. Keep this module internal to the reactive package. |
| `src/engine/reactive/signal.ts` | Implements a writable value with `get`, `set`, and `update`. Reading tracks the current observer; writing notifies subscribers only when the value changed. | Provides the primary unit of reactive state. | 1. Define `Signal<T>` and `ReadonlySignal<T>`. 2. Store the value and a `Set` of observers. 3. Compare writes with `Object.is`. 4. Notify from a stable subscriber snapshot. 5. Return an unsubscribe function for manual subscriptions. 6. Test same-value writes and subscriber removal. |
| `src/engine/reactive/effect.ts` | Runs a function, records the signals it reads, reruns it through the scheduler, and removes old dependencies before every run. | Connects state changes to precise DOM changes, invalidation, or other side effects. | 1. Create `effect(fn, options?)`. 2. Track dependencies while `fn` runs. 3. Clean stale dependencies before rerunning. 4. Queue reruns instead of executing recursively. 5. Return a disposer. 6. Prevent execution after disposal. 7. Test conditional dependencies. |
| `src/engine/reactive/computed.ts` | Derives a cached read-only value from other reactive values and becomes dirty when a dependency changes. | Avoids duplicated derived-state logic and unnecessary recomputation. | 1. Wrap a lazy internal observer. 2. Cache its last result. 3. Mark it dirty on dependency changes. 4. Recompute only on the next read. 5. Notify consumers only when its exposed value may have changed. 6. Detect direct circular evaluation and throw a clear error. |
| `src/engine/reactive/batch.ts` | Defers reactive notifications until an outer batch finishes and deduplicates observers. Supports nested batches. | Prevents several related signal writes from causing repeated intermediate updates. | 1. Track batch depth. 2. Store pending observers in a `Set`. 3. Flush only when depth returns to zero. 4. Use `try/finally` around the callback. 5. Test nested batches and errors thrown inside a batch. |
| `src/engine/scheduler.ts` | Owns microtask work queues, deduplicates jobs, and prevents re-entrant flushes. Later it can expose normal and animation-frame lanes. | Gives all reactive updates one predictable batching boundary. | 1. Define a `ScheduledJob` function type. 2. Queue jobs in a `Set`. 3. Schedule one `queueMicrotask` per pending flush. 4. Drain from a snapshot so newly queued jobs enter the next pass. 5. Add an iteration limit to catch infinite reactive loops. 6. Expose `flushNow()` only for tests. |
| `src/engine/component-scope.ts` | Registers effects, event removers, observers, timers, animation handles, child components, and custom cleanup callbacks under one owner. | Makes unmounting reliable and prevents memory leaks. | 1. Store cleanup callbacks in reverse registration order. 2. Add `add(cleanup)` and `own(disposable)`. 3. Make `dispose()` idempotent. 4. Reject or immediately run cleanups registered after disposal. 5. Aggregate cleanup failures without skipping later cleanups. |
| `src/engine/lifecycle.ts` | Defines component states and hooks: created, mounting, mounted, unmounting, and unmounted. | Prevents illegal double mounts, updates before mount, and partial teardown. | 1. Define `ComponentStatus`. 2. Define hook types or a lifecycle interface. 3. Document legal transitions. 4. Add development assertions for invalid transitions. 5. Keep lifecycle state in the base component rather than in global state. |
| `src/engine/component.ts` | Base class that owns one root node, props, scope, children, mounting, and teardown. It creates its structure once rather than rerendering the full subtree. | Establishes the component contract used by DOM and Canvas components. | 1. Make the root `Node` generic. 2. Require `createRoot()` or receive the root in the constructor. 3. Implement guarded `mount(parent, before?)`. 4. Run `onMount()` after insertion. 5. Dispose children and scope during `unmount()`. 6. Remove the root. 7. Expose protected `attach()` and `registerCleanup()`. 8. Do not add diffing yet. |
| `src/engine/component-builder.ts` | Provides typed element creation and composition helpers such as `element('button', options, children)`. It sets properties safely and returns real DOM nodes. | Removes repetitive DOM construction while preserving direct access to native elements. | 1. Accept tag name, class names, attributes, properties, children, and optional refs. 2. Append strings as text nodes. 3. Flatten child arrays and ignore `null`/`false`. 4. Route events through `EventManager`, not direct inline handlers. 5. Treat `style`, `dataset`, properties, and attributes separately. 6. Avoid `innerHTML` by default. 7. Do not build VNodes or JSX in version 1. |
| `src/engine/rendering/dom-binding.ts` | Creates focused bindings such as `bindText`, `bindClass`, `bindAttribute`, `bindProperty`, and `bindStyle`, each backed by an effect owned by a component scope. | Updates only the exact DOM value affected by reactive state. | 1. Accept a scope and reactive getter. 2. Write only when the resulting value differs. 3. Remove nullable attributes instead of writing string `"null"`. 4. Keep previous class/style values for precise cleanup. 5. Dispose the effect with the component. 6. Add tests for booleans and null values. |
| `src/engine/events/event-manager.ts` | Uses event delegation: one root listener per event type and phase, with handlers stored by element. Resolves the propagation path and invokes matching handlers. | Avoids thousands of native listeners and centralizes event cleanup and propagation rules. | 1. Attach the manager to the application root. 2. Store handlers in `WeakMap<EventTarget, Map<string, HandlerSet>>`. 3. Lazily install one root listener for each event type and capture mode. 4. Walk `event.composedPath()` until the application root. 5. Respect capture, bubble, `once`, disabled state, and propagation cancellation. 6. Return an unsubscribe function from `on()`. 7. Remove unused root listeners when their handler count reaches zero. 8. Keep native event objects; do not invent synthetic events yet. |
| `src/engine/events/pointer-router.ts` | Normalizes pointer coordinates relative to a canvas, manages pointer capture, and performs canvas hit testing through registered interactive regions. | Lets a canvas component behave like a component surface without attaching listeners to every drawn object. | 1. Build on Pointer Events rather than separate mouse/touch code. 2. Convert client coordinates to CSS-pixel canvas coordinates. 3. Register hit-testable targets with z-order. 4. Resolve the topmost hit. 5. Track hover, press, drag, leave, and capture state. 6. Clear target state on component disposal. 7. Add keyboard equivalents at the DOM component level for accessible actions. |
| `src/engine/rendering/canvas-viewport.ts` | Observes the canvas container, calculates CSS size and backing-buffer size, caps device pixel ratio, and resets the drawing transform after resizing. | Keeps Canvas sharp while controlling memory and GPU cost, especially on mobile. | 1. Use `ResizeObserver`. 2. Store CSS width/height and effective DPR. 3. Cap desktop DPR at `2` and mobile DPR at `1.5` initially. 4. Resize only when calculated dimensions change. 5. Call `context.setTransform(dpr, 0, 0, dpr, 0, 0)`. 6. Invalidate after a real resize. 7. Disconnect the observer on disposal. |
| `src/engine/rendering/render-quality.ts` | Chooses a render profile using viewport size, DPR, reduced-motion preference, and optionally measured frame cost. | Gives canvas scenes an explicit performance budget instead of scattered mobile conditions. | 1. Define `low`, `medium`, and `high` profiles. 2. Include DPR cap, target FPS, object budget, and effects flags. 3. Make reduced motion disable nonessential animation. 4. Re-evaluate on relevant media-query changes. 5. Pass the profile to canvas components; do not let individual scene objects query global window state. |
| `src/engine/rendering/canvas-scheduler.ts` | Tracks dirty canvas components and requests at most one animation frame. Supports continuously animated canvases without forcing static canvases to run forever. | Coalesces many invalidations into one paint and stops invisible work. | 1. Keep `dirty` and `continuous` component sets. 2. `invalidate(component)` adds it to `dirty`. 3. Request one frame if none is pending. 4. Paint each dirty visible component once. 5. Requeue continuous components only when active. 6. Pause for hidden documents and off-screen canvases. 7. Optionally throttle low-quality mode to 30 FPS. |
| `src/engine/rendering/canvas-component.ts` | Extends `Component<HTMLCanvasElement>`, owns the 2D context, viewport, visibility observer, pointer router, and invalidation lifecycle. Subclasses implement `paint(frame)`. | Makes Canvas a first-class component while keeping rendering infrastructure out of scene code. | 1. Acquire a non-null 2D context in the constructor. 2. Start viewport and visibility observation on mount. 3. Register with `CanvasScheduler`. 4. Expose protected `invalidate()`. 5. Call abstract `paint({context, width, height, dpr, time, quality})`. 6. Unregister and dispose observers/events on unmount. 7. Never start a private endless RAF loop per component. |
| `src/engine/application-context.ts` | Defines the explicit shared-service contract passed from the composition root to components. | Keeps dependencies visible and prevents hidden global service singletons. | 1. Expose the root, reactive scheduler, event manager, and Canvas scheduler as readonly services. 2. Let specialized components accept structural subsets with `Pick`. 3. Keep application ownership methods out of the context. |
| `src/engine/application.ts` | Creates the root scope, scheduler, event manager, canvas scheduler, and root component. Owns startup, rollback, and shutdown. | Provides one composition root instead of hidden global singletons. | 1. Accept the root HTMLElement. 2. Construct and scope core services once. 3. Provide them through `ApplicationContext`. 4. Mount exactly one root component. 5. Make `dispose()` idempotent. 6. Roll back a failed startup completely. 7. Aggregate cleanup failures without skipping later cleanup. |
| `src/engine/bootstrap-application.ts` | Resolves a selector or root element, creates `Application`, mounts its root component, and returns the running application. | Keeps `src/app.ts` tiny while preserving direct access to the application for shutdown or hot replacement. | 1. Accept an HTMLElement or selector. 2. Throw a clear missing-root error. 3. Construct `Application`. 4. Mount through a typed root-component factory. 5. Return the application instance. |
| `src/engine/index.ts` | Re-exports the supported public runtime API while leaving dependency-tracking internals private. | Gives application components one stable import boundary and allows internal files to move later. | 1. Export application, component, reactive, event, DOM-binding, and Canvas APIs. 2. Do not export `dependency-context.ts`. 3. Keep internal core modules using direct imports to avoid barrel cycles. |
| `src/engine/diagnostics/invariant.ts` | Development-only assertions for lifecycle, ownership, invalid event roots, and disposed reactive nodes. | Makes framework bugs fail near their source instead of appearing as unrelated UI problems. | 1. Implement `invariant(condition, message)`. 2. Strip or minimize messages in production builds. 3. Use it at public core boundaries. 4. Do not use assertions for ordinary user-input validation. |
| `src/engine/diagnostics/performance-monitor.ts` | Samples frame time, paint duration, canvas pixel count, and skipped frames with near-zero work when disabled. | Shows whether the runtime meets its performance budget and helps tune mobile quality. | 1. Gate it behind a development flag. 2. Use `performance.now()`. 3. Record rolling averages rather than every sample forever. 4. Warn on repeated budget misses. 5. Never make automatic quality changes in version 1; observe first. |
| `src/shared/layout/layout.component.ts` | Abstract structural base extended by module wrappers. It creates a module shell and an inner content container for the module entry component. | Gives route modules consistent structure and styling without turning the layout into the application root. | 1. Extend the engine `Component`. 2. Accept a module name. 3. Create module-level CSS and data hooks. 4. Expose protected `mountEntry(component)`. 5. Never import a concrete module. |
| `src/modules/homepage/services/hero.service.ts` | Owns the hero input as a writable signal and exposes it as read-only state. | Keeps hero state outside its DOM component and establishes the feature service pattern. | 1. Create the signal. 2. Expose `ReadonlySignal<string>`. 3. Provide `setInput(value)`. 4. Avoid DOM dependencies. |
| `src/modules/homepage/components/hero.component.ts` | Creates an input and heading. Input events update `HeroService`; DOM bindings keep the input and `hello {value}` heading synchronized. | Proves event delegation, service state, scheduling, and precise DOM reactivity through one real feature component. | 1. Build the DOM once. 2. Bind input value and heading text to the service signal. 3. Delegate the `input` event through `EventManager`. 4. Let component scope dispose bindings and events. |
| `src/modules/homepage/homepage.wrapper.ts` | Route-level homepage entry point. Extends `LayoutComponent`, constructs homepage services and components, and mounts `HeroComponent` as its first entry. | Gives the router one stable component to load while keeping feature internals private. | 1. Extend the shared module layout. 2. Construct `HeroService`. 3. Inject it and `ApplicationContext` into `HeroComponent`. 4. Mount the hero through `mountEntry()`. |
| `src/router.ts` | Root component mapping application routes to module wrappers. Route `''` initially resolves to `HomepageWrapper`. | Separates route selection from application bootstrap, shared layout, and feature internals. | 1. Define typed routes. 2. Start at `''`. 3. Create the matching wrapper. 4. Mount the next wrapper before releasing the previous one. 5. Avoid remounting the active route. |
| `src/app.ts` | Calls `bootstrapApplication('#app', context => new Router(context))`. Contains no page rendering or feature selection logic. | Keeps the browser entry point stable while the router and modules evolve independently. | 1. Import the engine bootstrap. 2. Import the application router. 3. Bootstrap against `#app`. 4. Export the application instance for tests and controlled shutdown. |

## Supporting test files

| File | Logic | Purpose | Concrete implementation steps |
| --- | --- | --- | --- |
| `src/tests/engine/signal.test.ts` | Exercises reads, writes, updates, equality, and unsubscription. | Proves the state primitive before components depend on it. | Test primitive and object values, same-value writes, subscriber disposal, and mutation during notification. |
| `src/tests/engine/effect.test.ts` | Exercises dependency collection, scheduled reruns, conditional dependencies, batching, and disposal. | Prevents the hardest class of fine-grained reactivity bugs. | Use `scheduler.flushNow()`; verify one rerun for several writes and no rerun after disposal. |
| `src/tests/engine/component.test.ts` | Exercises lifecycle order, child ownership, remount policy, and cleanup. | Prevents leaked components and invalid lifecycle transitions. | Mount into a detached DOM root, unmount, then assert roots, handlers, observers, and effects are gone. |
| `src/tests/engine/event-manager.test.ts` | Exercises capture/bubble order, composed paths, once handlers, cancellation, and removal. | Verifies delegation behaves like native DOM events. | Test nested elements, handlers removed during dispatch, and events originating outside the app root. |
| `src/tests/engine/canvas-scheduler.test.ts` | Exercises invalidation deduplication, visibility pausing, continuous animation, and teardown. | Ensures canvas work stays bounded. | Mock RAF, invalidate repeatedly, verify one scheduled frame and no paint after disposal. |

## Implementation phases

| Phase | Build | Exit condition |
| --- | --- | --- |
| 1. Scheduler and signals | `scheduler.ts`, `dependency-context.ts`, `signal.ts`, `effect.ts`, `batch.ts` | Multiple state writes produce one correct effect rerun; disposed effects never run. |
| 2. Component ownership | `component-scope.ts`, `lifecycle.ts`, `component.ts` | A parent can mount and unmount children repeatedly with zero leaked effects or cleanup callbacks. |
| 3. DOM construction and binding | `component-builder.ts`, `dom-binding.ts` | A signal updates a text node, class, and attribute without rebuilding the component subtree. |
| 4. Delegated events | `event-manager.ts` | One root click listener serves many buttons and all handlers disappear when their components unmount. |
| 5. Canvas foundation | `render-quality.ts`, `canvas-viewport.ts`, `canvas-scheduler.ts`, `canvas-component.ts` | Many invalidations in one tick cause one correctly sized paint; hidden or off-screen canvases stop. |
| 6. Canvas interaction | `pointer-router.ts` | Pointer input reaches the topmost canvas target using coordinates in CSS pixels and cleans up correctly. |
| 7. First application flow | `app.ts`, `router.ts`, `homepage.wrapper.ts`, `layout.component.ts`, `hero.component.ts`, `hero.service.ts` | Route `''` mounts the homepage wrapper and changing the hero input updates the existing `<h1>` through a service signal. |
| 8. Diagnostics and hardening | diagnostics and all core tests | Lifecycle mistakes fail clearly and the demo stays within the chosen desktop/mobile frame budgets. |

## Version 1 public API target

The exact names can change, but the first usable API should remain this small:

```ts
const count = signal(0);
const doubled = computed(() => count.get() * 2);

class CounterComponent extends Component<HTMLDivElement> {
    protected onMount(): void {
        const value = document.createElement('span');
        const button = document.createElement('button');

        button.textContent = 'Increment';
        this.root.append(value, button);

        bindText(this.scope, value, () => `Count: ${doubled.get()}`);

        this.events.on(this.scope, button, 'click', () => {
            count.update(current => current + 1);
        });
    }
}
```

For Canvas, a state change should only invalidate the surface:

```ts
class CounterCanvas extends CanvasComponent {
    protected onCanvasMount(): void {
        this.scope.add(
            effect(() => {
                count.get();
                this.invalidate();
            })
        );
    }

    protected paint(frame: CanvasFrame): void {
        frame.context.fillText(
            String(count.get()),
            frame.width / 2,
            frame.height / 2,
        );
    }
}
```

## Important architectural rules

1. **Do not rerender complete DOM components for ordinary state changes.** Bind the affected node or property.
2. **Do not create one animation loop per canvas.** Use one shared canvas scheduler per application.
3. **Do not attach one native listener per component handler.** Delegate from the application root when the event supports delegation.
4. **Every side effect must have an owner.** Effects, observers, events, timers, and child components belong to a `ComponentScope`.
5. **All coordinates inside canvas scene logic use CSS pixels.** Backing-buffer pixels and DPR remain viewport concerns.
6. **Signals contain state, not DOM nodes or drawing contexts.** Platform objects stay inside components and renderers.
7. **Avoid global service singletons.** Pass a stable `AppContext` from `Application` so multiple app roots and tests remain possible.
8. **Measure before adding complex optimization.** Dirty rendering, batching, delegation, DPR caps, and visibility pausing are enough for version 1.

## Deliberately postponed

These features are useful later, but adding them before the core is proven would hide design mistakes:

- virtual DOM and reconciliation;
- JSX and a custom JSX transform;
- keyed list diffing;
- server-side rendering and hydration;
- router and navigation guards;
- dependency-injection container;
- global state store beyond signals;
- worker/offscreen-canvas rendering;
- custom bundler;
- animation timeline system;
- gesture recognizer;
- production devtools.

## First vertical proof

Before building the actual website, create one disposable test component containing:

1. A counter signal.
2. A computed label.
3. A DOM text binding.
4. A button using delegated click handling.
5. A canvas child that draws the counter value.
6. A mount/unmount button outside the test component.

The proof is complete when repeated mount/unmount cycles leave no active effects, event handlers, observers, or animation frames, and each counter update produces one DOM update plus at most one canvas paint per frame.

That small test validates the architecture more effectively than beginning with a full hero section.
