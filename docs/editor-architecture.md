# Editor architecture

The visual editor is assembled by [editor.js](../src/webview/editor.js) from CommonJS factories under `src/webview/editor/`. The same compiled browser runtime serves VS Code, Electron and browser fixtures. The module split changes source organization while retaining the existing commands, settings, document format and host messages.

## Find the owner

| Area | Entry points | Responsibility |
| --- | --- | --- |
| Session and host | [Session](../src/webview/editor/core/session.js), [host](../src/webview/editor/core/host.js) | Markdown, dirty state, revisions, save/sync timers, history and host dispatch |
| Conversion | [Inline codec](../src/webview/editor/codec/inline.js), [block codec](../src/webview/editor/codec/blocks.js) | Parsing, retained-source metadata, table caches, serialization and clipboard fragments |
| Block services | [Rendering](../src/webview/editor/blocks/render.js), [export](../src/webview/editor/blocks/export.js), [special blocks](../src/webview/editor/blocks/special.js), [tables](../src/webview/editor/blocks/tables.js) | Live rendering, detached export, math/Mermaid editing and table state |
| Code blocks | [Content](../src/webview/editor/blocks/code-content.js), [controls](../src/webview/editor/blocks/code-controls.js) | Shared sentinel set, highlighting, view identities, wrapping and language picker |
| Selection | [DOM selection](../src/webview/editor/selection/dom.js), [line navigation](../src/webview/editor/selection/lines.js) | Caret placement, bookmarks, offsets and block transitions |
| Keyboard input | [Dispatch](../src/webview/editor/input/dispatch.js) and contextual files in `editor/input/` | Ordered Enter, Tab, arrow and deletion handling; input/composition coordination |
| Editing commands | [Lists](../src/webview/editor/editing/lists.js), [block patterns](../src/webview/editor/editing/block-patterns.js), [inline formatting](../src/webview/editor/editing/inline-format.js) | Structure conversion, typing patterns and inline mutations |
| Interface | [Chrome](../src/webview/editor/ui/chrome.js), [commands](../src/webview/editor/ui/commands.js), [menus](../src/webview/editor/ui/menus.js), [search](../src/webview/editor/ui/search.js) | Layout, modes, outline, command execution, bookmarks and search worker lifecycle |
| Transfer | [Clipboard](../src/webview/editor/transfer/clipboard.js), [paste](../src/webview/editor/transfer/paste.js) | Copy/cut, drag/drop, image insertion and contextual paste |

Factories receive named capabilities. Mutable cross-module values use live getters and, where required, setters. Feature state has one owner; avoid copying a mutable primitive into another controller or replacing these ports with an unrestricted context object. Existing shared parser, document helpers, host adapters and vendor renderers retain their established boundaries.

## Construction and initialization

Module evaluation and service construction define methods without reading editor dependencies or installing listeners. The bootstrap connects services through lazy getters, then invokes explicit initialization phases in the original order. Each phase runs once. State declarations and listener setup that were separated in the original closure remain separated here.

The important barriers are:

1. Configure the browser helpers, initial state, width controls, source modes, selection and codecs.
2. Decode the host content and render the initial document.
3. Construct history, then initialize renderer flags, code controls, table controls and general input listeners.
4. Initialize toolbar bookmarks, menus, sidebar/mode wiring and shortcuts.
5. Register host messages, transfer handlers and focus synchronization.
6. Initialize search, workspace UI and the compatibility/test APIs.

Initial rendering deliberately precedes history and some later controller assignments. Do not move all initialization before the first render merely because the factories now exist earlier. Methods may be available before their phase has assigned state; preserve the existing guarded behavior at that boundary. The phase names are internal implementation details, not host message APIs.

## Preserve editing contracts

`readCommittedMarkdown()` leaves an active equation edit cancellable. `readCurrentMarkdown()` commits that edit before reading. Background synchronization and captured export eligibility must use the appropriate read. The session owns the shared undo manager and preserves snapshot timing, typing grouping, revisions and native-save acknowledgments.

The block codec owns both rendering and serialization because rendering records canonical source using those serialization routines. Preserve `data-md-*` identity, boundary and retained-source metadata, as well as table source/state caches. Live rendering, copy/paste and detached export call the same codec. Detached export must not install live editor listeners or allocate live source identities.

Keyboard dispatch calls contextual handlers in the established order. A handler returning `true` stops dispatch; `false` continues. A stop can intentionally allow the browser default, so `event.defaultPrevented` is insufficient as a dispatch result. Table handling precedes generic block navigation, and table Tab navigation precedes the editing snapshot. Keep IME guards, selection capture points, propagation and timer scheduling in order.

View-only actions retain content, selection and history. Code view preferences remain outside document snapshots. Search owns its worker generation and rejects stale replies. Math/Mermaid rendering retains version guards so old asynchronous results cannot replace a newer preview or document.

The bootstrap preserves `window.htmlToMarkdown`, `window.__testApi` and the existing legacy test properties. Changes to these compatibility hooks require checking their Electron and test callers.

## Build and verify

From the repository root, use Node from `.node-version`, install the locked dependencies, and run:

```sh
npm ci
npm run compile
npm run test:unit
npm run test:build
CI=1 npx playwright test --workers=2 --retries=0
```

Compilation copies webview assets and then [bundles the editor](../scripts/bundle-editor.cjs) as an unminified IIFE at `out/webview/editor.js`. The adjacent `editor.bundle.json` records each input hash and the runtime hash. Fixture generation refuses missing, stale or overwritten output; rerun full compilation after changing an imported source file. Running `copy-webview.js` alone after bundling overwrites the runtime with the source entry and is not a valid build.

VS Code and Electron load the emitted runtime rather than concatenating the source files. The six host substitutions remain in the runtime exactly once. Shared helper globals are installed before dependent UI modules evaluate. Host adapters, document helpers and vendors retain their existing load boundaries.

Use the [build guide](building.md) for packaging, and the [testing guide](testing/README.md) for installed save/reopen and export checks. Browser fixtures are generated output; preserve unrelated edits when restoring the tracked standalone HTML after a test run.

Keep modules cohesive. Roughly 300–900 physical lines is a useful working range, with 1,200 lines prompting another boundary review. Review functions above roughly 200 lines for named substeps; tightly coupled deletion branches retain their characterized order in this extraction. Generated bundle size does not determine the size of editable source modules. The [implementation record](../reports/plans/editor-modularization/implementation.md) records measured sizes and validation for this refactor.
