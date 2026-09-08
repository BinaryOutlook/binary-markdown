# Export subsystem validation

Updated 2026-09-09. **Implementation and engineering handback complete; ready for review.** This record supplements [the authoritative requirements](export-subsystem.md). Human product acceptance, PR merge and release are separate and have not occurred.

## Subsequent Ubuntu x86-64 cross-validation

The user requested SSH-driven testing on Ubuntu, authorized temporary user-space installations, and asked that sudo blockers be skipped. Experimental export now permits local Linux desktop VS Code alongside macOS. Workspace trust, saved-source checks, remote/web restrictions and Chromium sandboxing remain enforced. Dependency labels now reflect host eligibility, and older asynchronous probes cannot overwrite newer settings results.

The **same VSIX** passed installed native checks on Ubuntu x86-64 and macOS ARM64. It was built from `c726f240ea21643e3cd4df11c0a45ec803c03812`, with production changes through `77344ab`; subsequent commits change the harness and documentation only. Package size: **4,187,707 bytes**; SHA-256:

```text
5dcb591c64d405505bc0b3db4a28cd8f8d5f187e973af9b5d438a7da52f9a82a
```

| Check | Observed result |
| --- | --- |
| Ubuntu environment | Ubuntu 26.04 LTS, x86-64, kernel 7.0.0-30-generic; local VS Code 1.122.1, extension-host Node 22.22.1; Node 20.20.0 for development/tests |
| Installed engines | Pandoc 3.8.3 in a temporary user-space installation; installed Google Chrome 149.0.7827.53; normal browser sandbox enabled |
| Final Ubuntu units | **100/100 passed**, no skips, including all **86 export tests** with real tools and explicit VSIX inspection |
| Final native Ubuntu | **39 scenarios plus unchanged frozen inputs**, in a fresh isolated installed profile; 16 fixture/format outputs, actual Ctrl-S/native saves, settings, cancellation, failures, immutable capture and offline HTML |
| Same-package macOS regression | **86/86 export tests** and **39 native scenarios plus unchanged inputs**; VS Code 1.136.0, extension-host Node 24.18.1, Pandoc 3.8.3, Chrome 152.0.7977.65, ARM64 |
| Final Ubuntu artifact audit | All 16 outputs inspected structurally; **2,260 marker checks** accounted for: 2,252 in text and 8 expected image-alt occurrences. Original PNG/SVG bytes survive HTML/DOCX/EPUB; original raster dimensions/decoded pixels survive PDF. Eight DOCX/EPUB archives passed CRC/container checks. |
| Final PDF visual inspection | **20 representative pages** inspected across all four PDFs, including W-30 quotations on pages 3/17, code/table boundaries, diagrams, CJK text, full tall graphics and final warnings. No clipping or unreadable content observed on those pages; this is not an every-page visual certificate. |
| Pagination and appearance | Basic/fallback/pagination/W-30 PDFs: **4/3/16/54 pages**. Compact W-30 reference: **35 pages**. Controlled block movement and three light/dark theme checks passed. Fonts/layout differ from macOS; identical page counts are not required. |
| Full Ubuntu browser regression | **682 passed, 4 skipped, 4 failed** out of 690. All **27 export browser tests passed**. This full suite is not green. |
| Compile / lint | Compilation passed; lint 0 errors and 8 existing warnings |

The four broader failures are code-block indentation (`codeblock-edit-features.spec.ts:69`), list copying (`copy-paste.spec.ts:18`), Perplexity colouring (`perplexity-highlight-test.spec.ts:4`) and Mermaid cursor positioning (`special-wrapper-cursor-position.spec.ts:183`). **Each reproduced three times on the pre-Linux commit `0cd26a7` under the same Ubuntu Chrome environment**: all 12 targeted baseline runs failed. No webview/shared renderer or browser assertion changed in this Linux extension. These failures remain follow-up work; they were not disabled or counted as passes.

One earlier final-package native run stopped on a simple-toolbar keyboard-focus assertion after 30 successful scenarios. The focused UI rerun and a new complete installation both passed, without a product-code change. This remains an intermittent test observation, not a proven root-cause fix. Two abandoned browser runs used an incorrect server port or overlapped a fixture refresh; their logs are retained but excluded from the completed totals.

No privileged installation was needed: `sudo -n` was unavailable, so Node, Pandoc, Python audit libraries and unpacked Xvfb lived under the owned temporary directory. Playwright's bundled Chromium installer rejected Ubuntu 26.04; tests used the installed Chrome executable without disabling its sandbox. Native VS Code ran on an authenticated, TCP-disabled Xvfb display. This is a **local Ubuntu extension host**, even though SSH orchestrated it; `remoteName` was null in the receipt. No VS Code Remote-SSH compatibility claim follows.

Machine-readable package, artifact and test evidence is in [the cross-platform manifest](export-evidence/2026-09-09-ubuntu-x64.json). Raw remote logs and copied artifacts are retained locally under `.vscode-test/export-ubuntu/`; the Ubuntu test root is `/var/tmp/binary-export-x86-P7n9N06Y`. Final native reports are `native-1788894953191.json` on Ubuntu and `native-1788894778807.json` on macOS. Only the owned test windows/processes and virtual display were closed; tools, profiles and evidence remain available. No normal VS Code profile was changed. Linux DOCX/EPUB reader UI, other distributions/architectures, Windows and remote/web hosts remain unverified.

### Ubuntu reproduction notes

Use a new temporary checkout and the [native harness](../test/native/export-smoke.md), matching `.node-version`. Install dependencies without modifying the user's normal VS Code profile. A user-space Pandoc may be selected explicitly or added to the launch PATH; the recorded native run exercised automatic discovery. Supply the same environment to every harness command:

```sh
export TMPDIR=/tmp
export EXPORT_REAL_TOOLS=1
export EXPORT_PANDOC_PATH=/absolute/path/to/pandoc
export EXPORT_BROWSER_PATH=/usr/bin/google-chrome
export EXPORT_PDFTOTEXT_PATH=/usr/bin/pdftotext
export EXPORT_VSIX_PATH=dist/binary-markdown-0.1.0.vsix
npm ci --no-audit --no-fund
npm run package
node --test test/unit/*.test.js
```

For native tests, preserve `DISPLAY` and `XAUTHORITY` for the dedicated local display, use a new `--workdir`/port, install the VSIX, launch, wait for the guarded driver response, then `check` and `run --suite all`. Keep original frozen input hashes intact. Use `EXPORT_BROWSER_PATH` for the supplemental artifact scripts too. The browser regression configuration can set `use.launchOptions.executablePath` to installed Chrome and `chromiumSandbox: true`. Keep the test server on port **3000** because existing specifications contain absolute URLs; do not reuse an unrelated server. Browser installation failure is separate from successful installed-browser execution.

## Original macOS candidate and environment

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

## Original macOS verification results

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
| Consolidated native harness | Fresh isolated installation of the final VSIX: **39 scenario receipts plus unchanged frozen inputs**, covering all seven suites; same package hash as the evidence manifest |
| Packaging | Archive CRCs, required files/locales/help, isolated backend/Playwright loading and compiled-byte parity passed; native executables and development dependencies absent |

The full suite is **not green**: `test/specs/perplexity-highlight-test.spec.ts:4` retains the baseline color failure. It was reproduced before implementation; its assertions were not disabled or weakened. The browser fixture generator was corrected to preserve literal `$` replacement sequences in production JavaScript, then exact script inclusion, literal searches and focused export behavior were checked.

## Original macOS acceptance evidence

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

A separate readable reference uses A4, 16 mm margins, Helvetica/Arial 11 pt and 1.35 line height, with 10 pt tables and 9 pt code. It produces **35 pages**, within the approximate workload definition; the original macOS native captured-appearance PDF produces **51 pages** (subsequent Ubuntu: **54 pages**). No source content or fixture expectation was removed. Exact reference CSS and the reason for this distinction are in [the artifact audit](../test/native/export-artifact-audit.md).

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

- This is an unreleased local desktop VS Code MVP with recorded macOS ARM64 and Ubuntu x86-64 checks. Untested distributions/architectures, Windows, remote/web VS Code and Electron export remain deferred. The existing `0.1.0` release download does not contain this branch's changes.
- HTML/PDF preserve the current renderer: fenced `math` renders; dollar math, `[TOC]` and footnotes remain visible source with warnings. DOCX/EPUB prefer native structure/math; raw HTML may become readable source. See [packaged help](../media/export-help.md).
- Interface/status/setup labels and native settings are localized separately. Detailed resource/converter diagnostics and document fallback explanations currently remain English.
- Native binaries are user-managed. ZIP64/encrypted/multidisk converter output, unsupported image formats and SVGs requiring external dependencies are outside initial support. Compression, templates, output customization and finer pagination remain deferred.
- VS Code has no native write-failed completion event. If a native save fails after preparation, cancel the waiting export or retry saving; this clears the abandoned wait. Every later export still requires clean, matching saved content.
- The known full-suite failure and existing lint warnings remain recorded. No human acceptance, merge, Marketplace publication or release is implied by this handback.
