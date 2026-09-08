# Export subsystem validation

Updated 2026-09-09. **Implementation and engineering handback complete; ready for review.** This record supplements [the authoritative requirements](export-subsystem.md). Human product acceptance, PR merge and release are separate and have not occurred.

## Candidate and environment

The installed native candidate contains production changes through `99aff55`. Later commits add reproducible tests and documentation. Public-safe output hashes, warnings and native observations are recorded in [the evidence manifest](export-evidence/2026-09-09.json); large documents/screenshots remain in ignored `.vscode-test/export-native/evidence/` and its sibling workspace.

| Component | Observed environment |
| --- | --- |
| Host | macOS 26.5.2, build 25F84, ARM64 |
| VS Code | 1.136.0, isolated user-data and extension directories |
| Development runtime | Node 20.20.0, matching `.node-version` |
| Pandoc | 3.8.3, `/opt/homebrew/bin/pandoc` |
| PDF browser | Google Chrome 152.0.7977.65, installed application executable |
| Browser control library | Playwright Core 1.58.1, explicitly vendored with licenses; no bundled browser |
| Representative readers | Microsoft Word and Apple Books; native equations, diagram, image and text inspected |

The exported extension was loaded from an installed VSIX. A separate test-driver development extension invoked public VS Code commands and reported document state; it did not implement export. The native flows used no development web server. An isolated profile can still discover system-installed tools, so missing and explicit-invalid dependencies were tested separately.

## Verification results

| Check | Result and boundary |
| --- | --- |
| Untouched baseline at `5488f37` | 662 browser passes, 4 skips, 1 existing Perplexity-color failure; compile and existing units passed |
| Full implementation regression | 684 browser passes, 4 skips, the same Perplexity-color failure; 84 unit passes and 1 package test skipped because no VSIX was selected in that run |
| Final export suite | **74/74 passed, no skips**, with real Pandoc, installed Chrome and explicit VSIX inspection enabled |
| Subsequent focused browser checks | 23/23 passed after fixing test-harness script insertion and adding blockquote contrast coverage |
| Compile / lint | Compile passed; lint 0 errors, 8 existing warnings |
| Shared Electron build | Lockfile dependencies installed with lifecycle scripts disabled; `npm run compile --prefix electron` passed; no Electron export or installer claim |
| Frozen input integrity | All seven original input hashes verified unchanged |
| Installed output matrix | All 16 combinations of four fixed fixtures and four formats completed; exact receipt-selected artifacts audited |
| Offline HTML | All four actual HTML exports relocated into an unrelated temporary directory and opened offline: zero external requests, zero script errors, complete terminal markers, decoded embedded images and no editor controls |
| Packaging | Archive CRCs, required files/locales/help, isolated backend/Playwright loading and compiled-byte parity passed; native executables and development dependencies absent |

The full suite is **not green**: `test/specs/perplexity-highlight-test.spec.ts:4` retains the baseline color failure. It was reproduced before implementation; its assertions were not disabled or weakened. The browser fixture generator was corrected to preserve literal `$` replacement sequences in production JavaScript, then exact script inclusion, literal searches and focused export behavior were checked.

## Acceptance evidence

“Verified” below means the stated engineering observations were made on this environment. It does not mean every platform, viewer, language or Markdown construct is certified.

| Case | Evidence | Engineering state |
| --- | --- | --- |
| AC-01 | Installed simple/full toolbars put the sharing arrow immediately after VS Code; four menu entries; Arrow/ Escape focus navigation; English and Simplified Chinese runtime labels. Browser accessibility/selection checks and seven-language catalog checks pass. | Verified |
| AC-02 | Native and keyboard save followed by export passed in both visual/source modes. Dirty and untitled files rejected without autosave. Later unsaved edits remained in the editor while a completed export retained its earlier capture. Ordinary text tabs cannot export a hidden Markdown panel. Queue/RPC/provider tests cover stale revisions, closure, source/selection/undo preservation and external-file save bypass. | Verified |
| AC-03 | Four receipt-selected HTML files relocated and loaded offline; original assets, complete supported content, readable quotations and absence of editor controls confirmed. | Verified |
| AC-04 | Original image bytes/dimensions, spaced/Unicode paths and generated diagrams audited. Supported fenced math rendered with embedded KaTeX fonts offline. Literal dollar math receives an explicit renderer limitation warning. | Verified within declared syntax support |
| AC-05 | Real autodetection and explicit installed paths work. Invalid Pandoc/browser overrides remain invalid; unavailable formats disclose setup while HTML works. Path changes retain the editor instance. Machine scope and all native setting/command translations checked. | Verified |
| AC-06 | Real oversized code/table/image pages inspected; all boundary/intermediate markers retained. Controlled geometry proved a whole ordinary block moves to page two when it exceeds the remainder. GitHub, Dark and Night print quotations are readable. | Verified |
| AC-07 | Actual DOCX/EPUB ZIP/XML/media/native-math structure audited. Word and Apple Books opened representative outputs and visibly rendered text, native equations, diagram and image. | Verified representative readers |
| AC-08 | Missing resources, invalid diagrams, unsupported math/raw content and renderer syntax limits retain identifiable content and warning summaries. Missing-image alternative text is preserved. Fatal converter and write failures remain failures. | Verified |
| AC-09 | Native sibling naming, completed-byte SHA-256 suffix and identical reuse passed. Writer tests exercise numeric collisions, existing-file preservation, simultaneous claims and unwritable directories. | Verified |
| AC-10 | Native jobs showed actual stages and continuing indeterminate activity. Controlled resource/worker waits left editor controls usable and cancellation available; no percentages or duration promises added. | Verified |
| AC-11 | Native resource cancellation terminated its request; worker cancellation ended the observed process; failed worker and unwritable destination produced no success/partial artifact. Panel-disposal and finalizer tests cover remaining lifecycle boundaries. | Verified |
| AC-12 | Controlled HTTP observation saw one GET for the required image and no request for an ordinary link. Native conversion remained local. Inert renderer, active-content fixtures, blocked PDF networking and sandboxed Pandoc tests passed. | Verified tested boundaries |
| AC-13 | Frozen W-30 exported through all four native paths; complete code/table/scenario inventory, resources, warnings and representative pages inspected. Readable reference is 35 pages; native PDF is 51 pages. | Verified workload |
| AC-14 | Installed VSIX, isolated macOS VS Code, actual toolbar/commands/save flows, resolved native engines and explicit missing-dependency cases exercised. Package runtime loads independently of repository `node_modules`. | Verified |

## Workload and artifact inspection

The [frozen manifest](../test/fixtures/exports/manifest.json) fixes four Markdown files and three original assets. W-30 contains 12,438 whitespace-delimited words, 43 headings, 24 scenario cards, three Mermaid diagrams, 160 code lines and 96 table rows. Its SHA-256 is:

```text
1db4863436896ffa05bcfcc1d413a5fc88cd1ce73ce5f1c8cd78eb37686cbe33
```

The original synthetic report is MIT-licensed. [NIST SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final) is a complexity reference only; no third-party report text or assets were copied.

A separate readable reference uses A4, 16 mm margins, Helvetica/Arial 11 pt and 1.35 line height, with 10 pt tables and 9 pt code. It produces **35 pages**, within the approximate workload definition; the native captured-appearance PDF produces **51 pages**. No source content or fixture expectation was removed. Exact reference CSS and the reason for this distinction are in [the artifact audit](../test/native/export-artifact-audit.md).

The final W-30 audit accounts for all 289 markers in every format, including alternative-text metadata. All code lines, table rows and scenario cards survive. Original PNG/SVG bytes are retained in HTML/DOCX/EPUB; PDF raster dimensions and decoded RGB pixels match the originals. The tall graphic fits its page with only approximately 0.2% pixel/point rounding in displayed aspect ratio. Representative page inspection also caught and verified fixes for unreadable light-theme quotes and lost missing-image labels.

## Reproduction

Use Node 20.20.0. Build before running compiled-unit or native checks:

```sh
npm ci
npm run compile
npm run lint
python3 test/fixtures/exports/verify-fixtures.py
npm test
npm run package
EXPORT_REAL_TOOLS=1 EXPORT_VSIX_PATH=dist/binary-markdown-0.1.0.vsix npm run test:export
npm run test:e2e -- test/specs/export-editor.spec.ts test/specs/export-ui.spec.ts
npm ci --prefix electron --ignore-scripts --no-audit --no-fund
npm run compile --prefix electron
```

The default export test command deliberately skips real native tools and explicit package inspection. A skip is not native evidence. For the installed walkthrough, use [the isolated native harness](../test/native/export-smoke.md). For PDF/XML/media and reference reproduction, use [the artifact audit scripts](../test/native/export-artifact-audit.md); they require Python with `pypdf`/Pillow and Poppler. Test watchdogs protect the harness from hanging and are not product performance targets.

## Remaining limits and review responsibility

- This is an unreleased local macOS VS Code MVP. Other desktop hosts, remote/web VS Code and Electron export remain deferred. The existing `0.1.0` release download does not contain this branch's changes.
- HTML/PDF preserve the current renderer: fenced `math` renders; dollar math, `[TOC]` and footnotes remain visible source with warnings. DOCX/EPUB prefer native structure/math; raw HTML may become readable source. See [packaged help](../media/export-help.md).
- Interface/status/setup labels and native settings are localized separately. Detailed resource/converter diagnostics and document fallback explanations currently remain English.
- Native binaries are user-managed. ZIP64/encrypted/multidisk converter output, unsupported image formats and SVGs requiring external dependencies are outside initial support. Compression, templates, output customization and finer pagination remain deferred.
- VS Code has no native write-failed completion event. If a native save fails after preparation, cancel the waiting export or retry saving; this clears the abandoned wait. Every later export still requires clean, matching saved content.
- The known full-suite failure and existing lint warnings remain recorded. No human acceptance, merge, Marketplace publication or release is implied by this handback.
