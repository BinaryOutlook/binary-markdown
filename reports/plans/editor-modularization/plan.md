# Editor modularization plan

Status: original proposal, subsequently implemented locally. See the [implementation record](implementation.md) for actual sizes, checkpoints and verification.

The goal is to replace the large shared closure in `src/webview/editor.js` with cohesive modules that preserve the existing editing experience. The user has delegated behavior discovery and routine design choices. Implementation should characterize existing behavior independently rather than require the user to enumerate it.

## Source and measurement

The canonical `origin/main` was fetched before preparing this plan. Both the planning checkout and the refreshed remote reference identify commit `3bb891ea0848acb0d4fc00806e5ef292ca8793bb`. The planning branch is `feat/editor-modularization-plan`.

The original [editor source](../../../src/webview/editor.js) contains **16,647 physical lines** and 809,017 bytes. Its main keyboard listener spans lines 7,152–11,662: **4,511 lines**. Physical lines include comments, blank lines, braces and embedded SVG; they are not a count of executable statements.

The [machine-readable line map](line-map.json) assigns every original line exactly once through 100 contiguous ranges. Its source SHA-256 is `4116ea853f9c87545ded5f89a689184fac01b9fb49e866beae2a1f2ffbb15662`. Measured allocations below are exact for that source. Final file lengths are estimates, allowing for constructors, explicit dependencies, interfaces, extracted helpers and movement between neighboring owners. Branch fragments in the ledger are accounting units, not safe literal cut points.

## Proposed source layout and sizes

Paths below are relative to `src/webview/`. Existing extracted helpers and UI modules remain authoritative; these estimates account only for the original `editor.js`.

| Proposed file | Original allocated lines | Estimated final lines | Responsibility |
| --- | ---: | ---: | --- |
| `editor.js` | 555 | 600–700 | Bootstrap, host dispatch and compatibility APIs |
| `editor/core/session.js` | 364 | 400–500 | Committed source, save/sync, revisions and shared undo lifecycle |
| `editor/ui/chrome.js` | 870 | 920–1,050 | Width, sidebar, outline, status, icons and toolbar layout |
| `editor/ui/commands.js` | 796 | 840–980 | One command executor, insertion requests and shortcuts |
| `editor/ui/menus.js` | 723 | 770–900 | Command catalog, palette and insertion panel bookmarks |
| `editor/ui/search.js` | 270 | 300–370 | Search UI, worker lifecycle and replacement commands |
| `editor/selection/dom.js` | 837 | 880–1,000 | DOM caret, selection bookmarks and shared block focus transitions |
| `editor/selection/lines.js` | 471 | 500–580 | Physical line navigation and text-offset helpers |
| `editor/codec/inline.js` | 488 | 520–620 | Inline parsing, escaping and style serialization |
| `editor/codec/blocks.js` | 730 | 780–900 | Block rendering/serialization and retained-source metadata |
| `editor/blocks/render.js` | 324 | 360–440 | Live rendering, front matter/TOC and interactive setup |
| `editor/blocks/export.js` | 275 | 310–390 | Detached export preparation, queues and cancellation |
| `editor/blocks/special.js` | 508 | 550–650 | Shared math/Mermaid wrapper editing and rendering |
| `editor/blocks/code-controls.js` | 517 | 550–650 | Code view identities, controls, edit modes and language picker |
| `editor/blocks/code-content.js` | 424 | 450–550 | Code text, syntax highlighting and normalization helpers |
| `editor/blocks/tables.js` | 620 | 660–800 | Table state, mutation, alignment and resizing |
| `editor/input/dispatch.js` | 387 | 420–520 | One ordered key dispatcher plus beforeinput/input coordination |
| `editor/input/tables.js` | 495 | 530–620 | Table Enter/Tab/arrows and caret exits |
| `editor/input/block-navigation.js` | 459 | 500–620 | Code/special-block/quote key behavior and navigation |
| `editor/input/paragraph-format.js` | 396 | 430–530 | Paragraph/heading formatting keys and indentation |
| `editor/input/paragraph-delete.js` | 473 | 510–620 | Paragraph deletion and merges with neighboring structures |
| `editor/input/list-selection-delete.js` | 549 | 590–700 | Selected-list deletion and early list-boundary cases |
| `editor/input/list-backspace.js` | 691 | 730–850 | Nested-list Backspace context, state and actions |
| `editor/input/list-boundaries.js` | 715 | 760–880 | Remaining list/paragraph boundary deletion and merging |
| `editor/input/list-enter-tab.js` | 492 | 530–640 | List continuation, splitting and indentation keys |
| `editor/editing/lists.js` | 619 | 660–780 | List conversion, indent/outdent and compatible merging |
| `editor/editing/block-patterns.js` | 623 | 660–780 | Typing-triggered block conversion |
| `editor/editing/inline-format.js` | 597 | 640–740 | Inline format commands, pattern conversion and escape |
| `editor/transfer/clipboard.js` | 605 | 650–760 | Copy/cut, drag/drop, image insertion and transfer UI |
| `editor/transfer/paste.js` | 774 | 820–960 | Paste parsing and contextual insertion |
| **Total: 30 files** | **16,647** | **17,820–21,080** | Existing source plus explicit module boundaries |

The two largest predicted modules are UI chrome and DOM selection. At the upper estimate, the largest source file is 1,050 lines, approximately 94% smaller than today's 16,647-line file. The entry becomes 600–700 lines, and keyboard dispatch becomes 420–520 lines rather than moving the entire 4,511-line listener into another large file. Its contextual work is distributed among named handlers.

Thirty files are appropriate to this amount of existing behavior: the original allocation averages about 555 lines per file. Avoid splitting individual helpers into dozens of tiny files or manufacturing artificial line counts. The folder groups provide a small set of navigation entry points. Cohesion and dependency clarity remain more important than hitting a numerical limit.

Use 300–900 lines as the usual module range and **1,200 lines as a review trigger**, not an automatic rejection. A module growing beyond that needs a written reason and another boundary review. Functions above roughly 200 lines also deserve review for named substeps; do not reproduce the old keyboard closure inside one long handler. These are proposed review conventions, not enforced repository limits.

Total source may grow by approximately 1,200–4,400 lines as dependencies become explicit. This is a maintainability change; reduced runtime cost or a smaller package is not assumed. The generated browser bundle can remain large because contributors edit the modules rather than that generated artifact.

## Module and state contracts

Use ordinary JavaScript factories with explicit dependencies and CommonJS exports so modules can be exercised directly in unit tests and bundled for browsers. Module evaluation must define code without attaching listeners, accessing live editor elements, starting renderers or reading host content. The bootstrap constructs services and explicitly initializes them.

- **Document session:** one authoritative owner for Markdown, dirty state, revisions, pending save, sync generation, sync timers and history. Keep `readCommittedMarkdown` distinct from `readCurrentMarkdown`: background reads must leave an active equation edit cancellable. Preserve snapshot timing, typing grouping and host acknowledgments while extracting.
- **Feature state:** code view identities and sentinels, active table/cell, search worker requests and dialog bookmarks each retain one owner. Navigation reads current state through narrow accessors. Do not copy mutable primitives into constructor arguments or expose an unrestricted shared context object.
- **Selection:** capture and restoration preserve existing DOM/text-offset semantics, focus and source selection. Shared block transitions call feature services rather than independently recreating them.
- **Codec:** block rendering already calls node serialization when recording canonical source. Keep those routines in the same `codec/blocks.js` factory, with inline conversion delegated to `codec/inline.js`. Preserve the `data-md-*` source/boundary/identity metadata and table source/state metadata. Live rendering, clipboard and detached export use these same conversion services.
- **Input:** one bootstrap-owned general editing dispatcher replaces the large keyboard listener, dispatching contextual handlers in the current order. Existing specialized feature listeners and document-level capture/shortcut scopes retain their relative order and initialize once. A result must distinguish continuing dispatch from stopping dispatch while allowing the browser default. `event.defaultPrevented` alone is insufficient: existing branches sometimes return without preventing the default. Preserve capture/bubble phases, snapshot points, propagation, timer scheduling and IME guards.
- **UI:** view-only actions retain the current selection and history and do not mark content edited or serialize presentation preferences into documents. Keep setting identifiers, defaults, translations and interface behavior stable.
- **Compatibility:** preserve `window.htmlToMarkdown`, `window.__testApi`, existing test properties and the host bridge contract. Detached export must continue to avoid installing live editor listeners.

The present bootstrap calls `init()` before some later `var` assignments and controller creation. First characterize that sequence, then make construction and initialization explicit without changing observable readiness. Do not make factory construction invoke callbacks whose owners have not been wired yet. Resolve any remaining dependency cycle at the bootstrap through named capabilities and deferred initialization rather than cyclic module imports.

## One runtime for every host

Recommend an **unminified browser IIFE bundle** emitted as `out/webview/editor.js` using the already pinned `esbuild` development dependency. Keep the source entry at `src/webview/editor.js`, importing factories from `src/webview/editor/`. Existing helper modules can be included in the entry in their current relative order while preserving their compatibility globals; host bridges and vendor loading retain their current boundaries.

Existing UMD helpers select their CommonJS export branch inside an esbuild wrapper. A side-effect import will therefore not recreate their browser globals. The entry must explicitly assign the returned APIs to `window.BinaryTableFormat`, `window.BinaryEditorLayout`, `window.BinaryTablePlacement` and `window.BinaryMath` before evaluating dependent UI modules. In particular, `table-toolbar.js` captures `BinaryTablePlacement` during evaluation. Preserve the present workspace UI → table format → layout → placement → table toolbar → math → editor order through explicit wiring. Keep `documentAux` and `BinaryMarkdownBlocks` at their existing outside-bundle script boundary during the first migration; moving them later requires equivalent explicit API wiring.

Require an actual startup check against the freshly emitted bundle in the production browser fixture, with the current vendor, document auxiliary and host bridge scripts. It must verify the helper APIs exist, interaction and conversion work, and readiness follows usable commands/export. Marker-count or source-text checks alone cannot establish successful bundled initialization.

The [compile chain](../../../package.json) currently copies source webview files to `out/`. Bundle after that copy, or copying the entry will overwrite the generated runtime. Source modules in nested directories must be reached through the bundle, not assumed to be copied by the current flat [copy script](../../../scripts/copy-webview.js).

The integrator owns these migrations:

| Consumer | Required change |
| --- | --- |
| [VS Code HTML generator](../../../src/webviewContent.ts) | Read the emitted runtime and remove helper concatenation already included in it |
| [Electron HTML generator](../../../electron/src/html-generator.ts) | Read the same emitted runtime in development and packaged resource layouts |
| [Electron packaging](../../../electron/package.json) | Include that actual generated runtime and retained worker/resource dependencies |
| [Browser fixture builder](../../../test/build-standalone.js) | Consume the emitted runtime and require a current compile; no silent stale-bundle fallback |
| [Direct export UI fixture](../../../test/specs/export-ui.spec.ts) | Replace direct source injection with the shared emitted runtime |
| [Package tests](../../../test/unit/export-package.test.js) | Verify required modules/runtime behavior and archive contents; migrate source-name assertions deliberately |

Preserve the six substitutions for content, translations, debug, base URI, math preference and search worker. Keep worker source escaping and content decoding semantics. Add a build check that expected substitution markers survive bundling and occur at the expected count. The first extraction must avoid minification or compile-time definitions that erase or alter those markers.

Current Electron resource filters omit two resources read by its generator. This is an observed configuration risk, not an established runtime failure. Audit the emitted resources during the loader migration and report any separate correction explicitly.

## Independently capture existing behavior

The [baseline capture record](baseline.md) identifies what was run on the unchanged source. Existing tests already cover many behavior contracts; rerunning them is useful evidence, but their assertions do not describe every possible editing sequence. Use the current implementation as a reference and extend characterization only where a new boundary creates an uncovered hazard.

For each extraction, run the same deterministic operations against the identified baseline and the extracted implementation. Compare current Markdown and serialized source where exact preservation is promised, selection/bookmarks, mode, meaningful DOM structure, undo/redo transitions, dirty state, host messages/revisions and error behavior. Control timers and asynchronous renderer promises where races matter. Compare semantic export output rather than timestamp-bearing binary files byte-for-byte.

| Behavior domain | Existing browser/source evidence | Required observation |
| --- | --- | --- |
| Paragraphs and source layout | `paragraph-semantics`, `table-source-format` | Soft wraps, hard breaks, separators and neighboring source survive edits |
| Lists and checklists | `ordered-list-preservation`, `key-operations` | Starts, nesting, continuation, deletion, indentation and checkbox state |
| Inline and fenced code | `inline-code-preservation`, `codeblock-source-switch`, `codeblock-quoted-save` | Literal/padded code, fences, trailing lines, focus and source retention |
| Tables | `table-source-format`, `table-cell-operations` | Alignment, retained source, paste, cell navigation, resize and selection |
| History and pending synchronization | `immediate-undo-redo`, `equation-background-sync` | Previous and current snapshots survive delayed sync and immediate history actions |
| Source and Split modes | `codeblock-source-switch`, `selected-ui-ux` | Latest source wins, stale callbacks stop, shared history and read-only preview |
| Selection and commands | `toolbar-discovery`, `insert-menu`, `export-ui` | Bookmarks survive focus changes; each action executes once; stale results are rejected |
| Clipboard and drop | `copy-paste`, `table-cell-operations` | Partial ranges exclude unselected source; structured paste and image insertion retain behavior |
| Equations and diagrams | `equation-compatibility`, `equation-source-wrap`, export suites | Apply/cancel, source delimiters, wrapped navigation, background reads and rendering |
| Typing and IME | `ime-misc`, equation suites | Composition guards and line-break behavior; browser simulations have a defined scope |
| Metadata, TOC and outline | `document-aux`, `outline-reading-position` | YAML/source retention, explicit refresh, reading position and view-only disclosure |
| Save, host changes and export | `export-editor`, `export-provider` units | Snapshot agreement, acknowledgments, queued changes, cancellation and live-document isolation |
| Initial setup and repeated setup | `local-links`, command/toolbar suites | Interactive elements are ready and link/action listeners remain idempotent |

Before affected extraction waves, add these three focused captures:

1. Production `renderLoaded` / `renderProbe` / `renderReady` handshake with delayed module initialization. Readiness must mean commands, conversion and export are usable; stale generations must not report current readiness.
2. Repeated render, Source and Split transitions followed by one keyboard or command action. Check one mutation, one expected history step and the expected host notifications; link idempotence alone does not cover general initialization.
3. Controlled out-of-order live Mermaid success/error results after a newer edit or document replacement. Verify an old result cannot replace the latest render or disturb its selection/source.

Existing tests already cover retained-source identity after identical-table deletion/cloning and stale insertion-dialog results. Reuse those checks rather than add tests that merely mirror the new module layout.

Known baseline failures must be recorded before extraction and distinguished from newly introduced failures. Behavior preservation does not mean declaring an existing bug correct forever: propose intentional fixes separately so they do not obscure the refactor's equivalence evidence.

## Delivery waves and delegation

The main thread owns this cross-cutting refactor. Cavecrew builders are appropriate for individual, already located extraction tasks; the whole 30-file change exceeds their surgical-edit contract.

| Wave | Work | Exit evidence |
| --- | --- | --- |
| 0 | Baseline capture, line map, contracts and uncovered initialization/race captures | Identified source, executable checks and recorded failures/skips |
| 1 | Shared runtime bundle and all loader/package migrations while retaining editor algorithms | Both hosts and fixtures load the same runtime; markers, resources, API and readiness checks |
| 2 | Inline/line helpers, code content and view/UI controllers | Focused behavior checks, no new dirty state or history from view actions |
| 3 | Table/code/special-block controllers, live rendering and codec factories | Round trips, source metadata, feature navigation, rendering and detached exports |
| 4 | List operations, conversion, clipboard and paste | Structural editing, exact source contracts, history and contextual transfer checks |
| 5 | Ordered keyboard dispatch and contextual handlers, one branch family per integrated change | Handler precedence, default/propagation, IME, immediate history and repeated-initialization checks |
| 6 | Final session/host wiring cleanup and architecture audit | Single state owners, small entry, no circular imports, all compatibility APIs retained |
| 7 | Full regression and freshly packaged host verification | Complete browser suite plus installed save/reopen and export results for the exact package |

Each builder owns one new module and, when needed, one focused test file. The integrator alone edits `editor.js`, build scripts, shared loader wiring and package configuration. A builder receives exact source symbols/ranges, required inputs/outputs, mutable-state owner, side effects, ordering constraints and executable acceptance checks. Its compressed output reports sites and verification; a re-read alone is not behavior validation.

Parallel work is limited to independent modules whose contracts have already been settled. Complete one integration and its checks before integrating a dependent extraction. Cavecrew reviewers audit the actual integrated diff for behavior, dependency, initialization and packaging problems; architecture decisions remain with the integrator.

## Verification and completion criteria

Use the Node version from `.node-version` and the [build guide](../../../docs/building.md). After each meaningful integration, perform full compilation and relevant units plus the affected browser suites. Run the full browser suite after parser/serializer changes and at the final integrated revision, with `CI=1` and zero retries. See the [testing guide](../../../docs/testing/README.md) for scope and commands.

Before claiming preserved host persistence, package and reinstall the exact revision in the [isolated native harness](../../../test/native/export-smoke.md). Run `save-correctness`, `list-code-preservation`, `paragraph-semantics`, `table-source-format`, code/equation/selection suites and export checks as applicable to each change. Both VS Code and Electron must exercise the emitted runtime. Packaged source saving, generated artifacts and actual output-reader appearance are separate observations.

The refactor is complete when all original responsibility groups have clear owners, the source entry and dispatcher meet their planned size envelope, no replacement giant closure or unrestricted state bag has been created, initialization and asynchronous lifecycles are explicit, source/settings/selection/history/save/export contracts pass, and all required integration checks identify the same source and package. Every exception or remaining acceptance limit must be recorded.

Real OS IME candidate selection, screen readers and other host/platform behavior cannot be established by simulated browser events alone. Existing native and CI platform gates remain required. This plan does not select a release version, merge a branch or publish a release.
