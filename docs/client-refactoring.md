# Client refactoring boundaries

The application creates its basket and commerce services in `core/app-services.ts`.
The router passes those dependencies to builder and checkout wrappers; neither
feature imports a global commerce singleton. `BasketStore` and `CommerceGateway`
describe only the operations these features consume.

## Responsibilities

- `BuilderController` coordinates design submission, basket writes and navigation.
  The component retains DOM events, preview capture and focus management.
- Basket and design services accept `JsonStorage`. Browser storage is the default;
  tests can inject isolated in-memory storage without replacing browser globals.
- The shared grid accepts a layout policy. It does not read builder CSS variables
  or define its own builder breakpoint. The builder adapter reads CSS flags, so
  layout and pointer mapping use the same orientation decision.
- HTTP remains generic. Endpoint adapters validate unknown JSON with Zod before
  storing it in reactive state. TypeScript interfaces alone are not validation.
- Account/admin gateways default to live mode. Explicit `demo` construction is
  available for previews; a failed live request never becomes demo success.

## Checkout retry semantics

The same serialized design/quantity payload reuses its attempt key after an
uncertain failure. UI reset and route changes do not discard that key. Changed
payloads generate a new key. An explicit **Start a new checkout attempt** action
abandons the current key, for expired or definitively failed attempts.

Keys currently live in the application instance: a full reload creates a new
attempt. This is not payment deduplication across browser sessions. Backend
verification and provider payment controls remain authoritative. Retrying does
not automatically recreate an attempt that the server reports as failed/pending;
the user can choose the explicit new-attempt action.

## Completed cleanup

No DI framework or extra inheritance hierarchy was added. Component lifecycle,
reactive scheduling, geometry and pricing remain intact.

- `JourneySimulation` owns frame calculation, inertia, hovering, trails and landing
  state. Inputs are numbers and bounds, so it runs without DOM or WebGL. The
  component owns browser events, measurement, lifecycle and drawing.
- Transform and silhouette math are independent pure helpers. Rendering resources
  remain in `KeycapRenderer`.
- Each complex builder pane has a renderer (languages, presets, individual keys,
  finalize). `SettingsControls` provides common widgets. `KeyboardSettingsView`
  dispatches through a registry and owns focus restoration and select enhancement.
- Removed the unused direct Shopify provider, its browser configuration and legacy
  interface after checking imports. The active server-mediated integration remains.

Regression checks include uncertain checkout retries, malformed responses,
live/demo separation, injected storage/controller behavior, and existing
desktop/mobile/WebKit builder and checkout flows.
Animation unit tests cover hero placement, static mode, manual landing, switch
presses, lateral motion, bounded trails and zero velocity at final touch.
