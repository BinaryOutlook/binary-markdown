# Editor modularization implementation

Status: implementation and scoped local verification recorded below. This audit snapshot precedes branch publication and full hosted CI; it records no merge or release.

## Source and result

Implementation started from freshly fetched canonical `origin/main` at `3bb891ea0848acb0d4fc00806e5ef292ca8793bb`. The completed source extraction is committed at `169532bb1e2de3b60c74d1b4979d2f18b9899065` on `feat/editor-modularization`. A checkpoint fetch still identified the same remote main. The later security checkpoint `840742611d18b4554df3cc7363bdd0d7dc317407` adds safe host-data encoding and attribute escaping. The measured source below includes those corrections.

The original 16,647-line `editor.js` becomes a **727-line bootstrap**, with **31 source files totaling 18,047 physical lines**. The largest module is UI chrome at **1,042 lines**, about 94% smaller than the original editor file. The bootstrap is about 96% smaller. Physical lines include comments, whitespace and embedded markup; they are not executable-statement counts. [Measured hashes and counts](implementation-measurements.json) identify the actual source rather than the planning estimates.

The extra file beyond the proposed 30 is `core/host.js`, which keeps host message dispatch out of the bootstrap. The entry is slightly above its 600–700-line estimate because its explicit capability wiring remains visible. Input dispatch is 583 lines rather than its 420–520-line estimate because it also owns composition/input listeners; the key dispatcher itself is 281 lines, down from 4,511. Keeping that coordination together avoids another small event-only module. These two measured envelope exceptions retain cohesive ownership and stay below the review threshold. Every source file remains below the proposed 1,200-line review threshold, and total source falls within the estimated 17,820–21,080-line range. The generated browser bundle remains large; contributors edit the individual source modules.

| Source file, relative to `src/webview/` | Physical lines |
| --- | ---: |
| `editor.js` | 727 |
| `editor/blocks/code-content.js` | 474 |
| `editor/blocks/code-controls.js` | 585 |
| `editor/blocks/export.js` | 309 |
| `editor/blocks/render.js` | 480 |
| `editor/blocks/special.js` | 547 |
| `editor/blocks/tables.js` | 606 |
| `editor/codec/blocks.js` | 801 |
| `editor/codec/inline.js` | 524 |
| `editor/core/host.js` | 323 |
| `editor/core/session.js` | 476 |
| `editor/editing/block-patterns.js` | 580 |
| `editor/editing/inline-format.js` | 548 |
| `editor/editing/lists.js` | 604 |
| `editor/input/block-navigation.js` | 469 |
| `editor/input/dispatch.js` | 583 |
| `editor/input/list-backspace.js` | 641 |
| `editor/input/list-boundaries.js` | 660 |
| `editor/input/list-enter-tab.js` | 461 |
| `editor/input/list-selection-delete.js` | 510 |
| `editor/input/paragraph-delete.js` | 430 |
| `editor/input/paragraph-format.js` | 411 |
| `editor/input/tables.js` | 480 |
| `editor/selection/dom.js` | 808 |
| `editor/selection/lines.js` | 489 |
| `editor/transfer/clipboard.js` | 584 |
| `editor/transfer/paste.js` | 739 |
| `editor/ui/chrome.js` | 1042 |
| `editor/ui/commands.js` | 824 |
| `editor/ui/menus.js` | 864 |
| `editor/ui/search.js` | 468 |

## Preserved contracts

The [current architecture guide](../../../docs/editor-architecture.md) explains ownership and initialization. Named factory dependencies stay live, state has one owner, and idempotent initialization phases retain the original barriers and listener order. Initial rendering still precedes history and later table/menu assignments. The shared sentinel set, code view identity, table caches, retained block source and compatibility APIs remain connected to their owners.

The keyboard split preserves the original branch order. Review expanded the contextual calls back into the original dispatcher and compared its 19,493-node AST, accounting only for capability qualification, helper promotion and explicit stop results. Stops that allow the browser default are retained. Large coupled deletion/conversion branches remain characterized rather than redesigned; functions above roughly 200 lines remain candidates for a separate, behavior-tested substep review.

The existing pinned esbuild emits one unminified editor runtime for VS Code, Electron and browser fixtures. A hash receipt rejects stale inputs or overwritten output. Release planning includes the bundler as a runtime input, and visual-review product identity includes its bytes so bundler-only changes invalidate stale captures. The six host substitutions and shared helper evaluation order remain intact.

## Local checkpoints

| Commit | Checkpoint |
| --- | --- |
| `0ae676b` | Plan, measured original line ledger and captured behavior baseline |
| `5b78582` | Shared emitted runtime, loader parity and freshness checks |
| `82fcb3e` | Selection, inline/block codecs, code content and search factories |
| `fd65a68` | Block/editing/UI methods, contextual keyboard handlers and paste |
| `169532b` | Owned state, host dispatch and original initialization phases |
| `42e84fe` | Construction purity and idempotent session/table initialization checks |
| `8964705` | Bundler-only release classification and stale visual-evidence regression checks |

## Extraction verification before the security audit

Validation used the pinned Node runtime and locked browser runner on macOS ARM. Before extraction, the [baseline](baseline.md) captured 405 passing unit tests, 19 opt-in skips and 265 focused browser cases.

- The selection/codec checkpoint passed all 1,209 browser tests with two workers and zero retries.
- The method/keyboard checkpoint passed 21 focused module checks and 93 keyboard/readiness browser cases.
- The extracted source compiles for both root and Electron. Lint exits successfully with 11 pre-existing warnings in unchanged files.
- The complete unit discovery, including the final service lifecycle checks, passed 431 tests with 19 opt-in skips (18 real-converter cases and one package opt-in case). The archive case also passed separately with the identified VSIX enabled.
- The extraction browser run passed all 1,209 tests with two workers and zero retries. Installed VS Code passed `save-correctness`, `list-code-preservation`, `paragraph-semantics`, `table-source-format` and `identity` against the identified package. These checks include exact saved bytes, clean state, shared undo, Source mode, reopening and an actual HTML export. The sentinel-owned test process was closed after the suites, with its evidence retained.
- Real Electron passed `electron-table-content.cjs`: navigation through 24 cells in both directions, arrow navigation, toolbar entry/Escape, narrow-pane behavior, retained source/undo, saving and reopening. GitHub/night captures at 100% and 200% zoom and a receipt were retained in ignored test output.

Before the security corrections and privacy rewrite, a development VSIX used package version 0.5.0 and original source identity `cffb3ab68ea42173d3b29e393e4ff0d95aa1e68e`. Its checksum is `442bd8d7998f088a0b20d3d5de279a2c869fa3042ebae7116c3377c65a241bfa`; its matching build-information sidecar reports local changes because generated test HTML and verification work were present. These native and archive observations apply to that earlier package; they do not validate the later security corrections. Archive parity and seven frozen export-fixture hashes passed. This is a local development snapshot, not a new release or release candidate.

No hosted CI, another operating system, OS IME interaction, screen-reader acceptance or export-reader visual fidelity is established by local source/browser results. Native results apply only to their recorded package and suite scope. The [sanitized verification receipt](verification-receipt.json) records the commands, counts and package identity. Raw logs and native receipts remain in ignored validation output.

The extraction documentation received separate complete raw-source/diff and rendered-preview reviews after their final edits. Paragraphs, headings, lists, tables and code fences retained their intended layout. The local Markdown renderer displayed the unchanged Mermaid diagram in the export architecture guide as a code block; graphical rendering of that diagram was not re-evaluated. Offline link/privacy and whitespace checks passed.

## Publication security audit

The audit compared the actual source and loader changes against the baseline, reviewed dependency audit results, and checked the changed public files and every unpublished commit tree. It found and fixed two injection boundaries: bundling changed the quotes around the raw document-base URI, and existing inline image parsing did not escape quotes in attributes. Both hosts and fixtures now use a shared, single-pass JSON serializer that escapes script-closing markup, preserves replacement tokens and prevents marker text inside data from being substituted again. Image attributes also escape the host base URI.

Four production-HTML browser regressions exercise both VS Code and Electron with synthetic hostile paths and image attributes, checking readiness, literal data and exact Markdown through Source switching. The Electron fixture executes the actual generator and adapts only vendor transport and CSP resource delivery for localhost. Four serializer units check exact value round trips and missing-data refusal. The corrected source passed 435 unit tests with 19 opt-in skips and 78 targeted browser checks covering security, code highlighting/copy and export. Root and Electron compilation passed; lint retained 11 existing warnings, and dependency audit reported zero vulnerabilities. An initial full run exposed overly broad quote escaping; restricting it to attribute boundaries restored code behavior. The complete browser rerun and hosted platform matrix remain pending at this snapshot. The [audit receipt](security-audit.json) identifies the corrected source and current validation results.

New report paths use a neutral name. Dates, durations and local tool fingerprints were removed from all unpublished task commit trees; macOS ARM remains the permitted environment description. Raw profiles, logs, captures and the original-history recovery ref remain local and are excluded from publication. Public attribution and inherited project history are preserved. Git and hosting services retain standard publication metadata.
