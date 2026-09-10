# Export subsystem validation

Updated 2026-09-10. **Implementation and engineering handback complete; ready for review.** This record supplements [the authoritative requirements](export-subsystem.md). Human product acceptance, PR merge and release are separate and have not occurred.

## Merge-blocker fixes and revalidation — 2026-09-10

The four reported browser failures are resolved, all four old skips have been reviewed, and the full suite passes on both tested platforms. The project transitioned to **AGPL-3.0-only** in the first fix commit, `f2a73a5`, retaining upstream/prior MIT notices, the frozen fixtures' explicit MIT grant and third-party licences. Both manifests/lockfile root entries, contribution guidance and distribution notices agree. The VSIX licence-text and retained-notice bytes were checked against source; dependency licences were not rewritten.

The candidate was built from **`8514de9`**. Later commit `54caee9` changes only PDF test-tool discovery. Subsequent documentation commits do not alter this runtime. The same **4,200,916-byte VSIX** was installed on both hosts:

```text
7a70aae923b0b0b9c5d8cb3f906a3a5d19c21b61cba4c4f07ab6d2f6dfcc0ed1
```

| Gate | macOS ARM64 | Ubuntu x86-64 |
| --- | --- | --- |
| Host / VS Code | macOS 26.5.2 / 1.136.0 | Ubuntu 26.04 LTS / 1.122.1 |
| Development / extension-host Node | 20.20.0 / 24.18.1 | 20.20.0 / 22.22.1 |
| Pandoc / installed Chrome | 3.8.3 / 152.0.7977.83 | 3.8.3 / 149.0.7827.53 |
| Full browser suite, no retries | **691 passed, 0 failed, 0 skipped** | **691 passed, 0 failed, 0 skipped** |
| Unit suite with real tools and VSIX | **100 passed, 0 failed, 0 skipped**, including 86 export checks | **100 passed, 0 failed, 0 skipped**, including 86 export checks |
| Installed native suite | **43 scenarios + frozen-input check** | **43 scenarios + frozen-input check** |
| Independence from development server | Additional 16 format exports + unchanged inputs with port 3000 unused | Additional 16 format exports + unchanged inputs with port 3000 unused |
| Receipt-selected artifact audit | 16 artifacts; **2,260 markers accounted for**, no unaccounted marker | 16 artifacts; **2,260 markers accounted for**, no unaccounted marker |
| PDF pages: basic / fallback / pagination / W-30 | 4 / 3 / 16 / **51** | 4 / 3 / 16 / **54** |

All 28 export browser cases passed within each full suite. Compilation, Electron type-checking and all seven frozen-input hashes passed. Lint still has **0 errors and 8 existing warnings**. Fourteen representative PDF pages were inspected across the two hosts: text, code, tables, quotations, tall graphics and warnings were readable, without observed clipping on those pages. Original media checks and DOCX/EPUB CRC/XML/container checks passed. This does not certify every PDF page or replace target-viewer UI review.

### What failed, why, and what changed

| Reported issue | Confirmed cause / correction | Commit |
| --- | --- | --- |
| List copying on Ubuntu | The test sent macOS `Meta+A` and copied an empty selection. Use the existing platform shortcut helper and assert the selected list before checking exact clipboard Markdown. | `3914cbe` |
| Perplexity keyword colouring | The standalone fixture omitted production syntax CSS. Load the shipped stylesheet and retain the keyword-versus-body colour assertion. | `3914cbe` |
| Code indentation | A centre click plus End selected the first unindented line; `textContent` also discarded `<br>` boundaries. Set and verify the intended caret, send real Enter, and assert the exact logical prefix and saved Markdown for both spaces and an actual tab. | `3914cbe` |
| Mermaid cursor | `Range.toString()` ignored `<br>` boundaries and reported column 19 for the correct column-zero caret. The replacement traverses actual line breaks, asserts the intended row as well as column, and leaves/re-enters through real UI events. | `99c222c` |
| Additional saved-content defect exposed by the stronger Mermaid test | Enter's sentinel detection also used `textContent`; Chromium's `<br>` sentinel became an extra saved blank line. Use the existing BR-aware code reader and check exact Markdown before leaving, after leaving, and after re-entry. | `99c222c` |
| Intermittent native toolbar focus | A controlled delayed-script test proves that the static English label satisfies the old readiness predicate before handlers exist. Publish readiness after initialization; reconnect to the visible webview, match mode/locale, send keydown/keyup, and wait for actual focus. Three full/Chinese → simple/English cycles pass on each native host. The precise cause of the historical single failure cannot be reconstructed with certainty. | `8514de9` |
| macOS Chrome teardown during investigation | Two exploratory runs reached their passing assertions but stalled after Chrome exited while its updater retained pipes. Three PDF/close probes and the subsequent full suites pass with Chromium's process-scoped `--disable-updater-scheduler` flag. Apply it to the PDF worker and installed-browser validation launches. It does not alter normal Chrome settings. | `5f72d1f`, `8514de9` |
| Ubuntu PDF inspection setup | One initial unit run was 99/100 because the test defaulted to `/opt/homebrew/bin/pdftotext`. Discover `pdftotext` through PATH, retaining the explicit environment override; final units pass on both hosts. | `54caee9` |

The updater switch is documented in [Chromium's upstream change](https://chromium.googlesource.com/chromium/src/+/e5ca8c2b4b9cbee1040bfc3d12cd3d20f99786cc). This explains the supported process flag; the local diagnosis and verification are recorded separately in the retained logs. Failed, cancelled or teardown-stalled exploratory runs are excluded from the completed totals above.

### Disposition of the four skipped tests

Commit `04b0927` restores the two ordinary-code navigation tests with adjacent paragraphs and explicit caret positions. Their original Markdown inserted empty intervening paragraphs, so one arrow press did not exercise the stated transition. The real click-away display-mode test also passes and is enabled again; the historical blanket claim that Playwright cannot test it has been removed.

The fourth skip referenced absent `samples/b.md` and `samples/b2.md`. It is replaced by [a committed original fixture pair](../test/fixtures/roundtrip/README.md), with an independently authored expectation covering complete text, nesting, code indentation and blank lines. The comparison no longer collapses whitespace. This is explicit replacement coverage, not a reconstruction or a claim to have recovered the missing samples. The full suite now has no skips.

### Reproduction, evidence and review boundary

Use Node 20.20.0, `npm ci`, `npm run compile`, `npm run test:build`, then run the full browser suite with `CI=1`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` pointing to installed Chrome, and `npx playwright test --workers=2 --retries=0`. Run `EXPORT_REAL_TOOLS=1 EXPORT_VSIX_PATH=/path/to/the/candidate.vsix node --test test/unit/*.test.js` with Pandoc and Poppler on PATH. `EXPORT_PDFTOTEXT_PATH` remains available for a manual inspection-tool path. Use the [native harness](../test/native/export-smoke.md) with a fresh profile and the same VSIX bytes. Watchdog durations are test infrastructure, not product performance requirements.

The [machine-readable revalidation manifest](export-evidence/2026-09-10-merge-readiness.json) records package/runtime hashes, completed reports, artifact hashes and the exact inspected PDF pages. Raw macOS records are under `.vscode-test/failure-analysis-2026-09-10/` and `.vscode-test/export-merge-mac/`. Ubuntu used a new `merge-fixes-2026-09-10` checkout beneath the previously owned temporary root, and its evidence is also retained locally. Only token-matched native profiles and the owned authenticated Xvfb display were closed; normal profiles and frozen inputs were preserved. Port closure was verified. No sudo was needed.

**The reported test blockers are cleared.** The PR has no configured GitHub CI checks, so these are local/SSH execution receipts rather than a required hosted-CI status. Human product acceptance, merge and release remain pending. Linux DOCX/EPUB reader UI, fresh post-fix Word/Books UI checks, other distributions/architectures, Windows, remote/web VS Code and Electron export remain unverified or outside scope. Current container/content checks passed; earlier target-viewer observations remain dated. Existing renderer limitations and the historical 35-page compact W-30 reference remain as documented below.

## Historical Ubuntu x86-64 cross-validation — 2026-09-09

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

The four broader failures are code-block indentation (`codeblock-edit-features.spec.ts:69`), list copying (`copy-paste.spec.ts:18`), Perplexity colouring (`perplexity-highlight-test.spec.ts:4`) and Mermaid cursor positioning (`special-wrapper-cursor-position.spec.ts:183`). **Each reproduced three times on the pre-Linux commit `0cd26a7` under the same Ubuntu Chrome environment**: all 12 targeted baseline runs failed. No webview/shared renderer or browser assertion changed in this Linux extension. These historical failures were not disabled or counted as passes. Their subsequent corrections and fresh results are recorded in the 2026-09-10 section above.

One earlier final-package native run stopped on a simple-toolbar keyboard-focus assertion after 30 successful scenarios. The focused UI rerun and a new complete installation both passed, without a product-code change. At that point it was an intermittent test observation, not a proven root-cause fix; see the subsequent controlled readiness regression above. Two abandoned browser runs used an incorrect server port or overlapped a fixture refresh; their logs are retained but excluded from the completed totals.

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

That historical full suite was **not green**: `test/specs/perplexity-highlight-test.spec.ts:4` retained the baseline color failure, corrected in the 2026-09-10 revalidation above. It was reproduced before implementation; its assertions were not disabled or weakened. The browser fixture generator was corrected to preserve literal `$` replacement sequences in production JavaScript, then exact script inclusion, literal searches and focused export behavior were checked.

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
- The historical full-suite failures remain documented alongside their fixes; eight existing lint warnings remain. No human acceptance, merge, Marketplace publication or release is implied by this handback.
