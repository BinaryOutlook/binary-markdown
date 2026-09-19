# Export development history

Historical record · Original material updated 2026-09-10 · Separated 2026-09-14.

This page preserves the export workstream's delivery plan, working agreement, milestone reports, decisions, reconnaissance, and delegation prompt. These sections were previously part of `docs/export-subsystem.md` version 1.5. Branch names, tool versions, pending-review statements, and instructions below describe that development period. The copied prompt is historical material, not a current task.

For the maintained contract, use the [export reference](../../docs/export-subsystem.md). For new checks, use [Validate an export change](../../docs/export-verification.md). The [dated export evidence](../../reports/validation/2026-09-10-export.md) and [0.2.0 integration record](../../reports/validation/0.2.0.md) identify their own tested revisions. This reorganization does not rerun those tests or make a new release-status claim.

The original specification was introduced in commit `5488f37` on 2026-09-09 in this fork's export workstream. The commit records the file's origin; Git metadata does not establish sole manual authorship of its prose.

The original heading and introductory status are retained below for context.

## Subsequent PDF appearance decision

The 2026-09-12 PDF changes were merged into the main revision `0a7641a` used as this documentation branch's base. The following decision and updated D2 guidance come from that revision. Earlier sections below retain their original context. The maintained requirements now include FR-EXP-042–043 and AC-15; see the [PDF appearance investigation and evidence](../../reports/investigations/2026-09-12-export-page-background.md).

| Date | Decision and reason | Affected scope / evidence |
| --- | --- | --- |
| 2026-09-12 | Default PDF to white/GitHub light appearance; allow the captured theme to fill the whole page. Keep DOCX page styling after negative parity checks. | User-authorized issue #6; FR-EXP-042–043 and AC-15. The dated bug record preserves baseline evidence. |

- **D2:** split UI, coordinator/finalization and resource preparation into smaller tickets if necessary. Render all content from the captured revision, use captured effective appearance in both editing modes, and inspect representative light/dark output. Exercise collision races, fallback/warnings and cancellation through the shared path.

## Original document context

Version 1.5 · Updated 2026-09-10 · **Status: D0–D5 implemented; converging in the 0.2.0 integration candidate. The selected license policy is AGPL-3.0-or-later with retained MIT and third-party notices. Maintainer acceptance, merge to main and release remain separate.**

This is the authoritative task brief for Binary Markdown's experimental export subsystem. It consolidates the export reconnaissance, clarification answers, functional and non-functional requirements, implementation plan, and human–AI working agreement. A developer can work from this file without reconstructing the conversation. Keep subsequent scope decisions, milestone status, and evidence references here.

The planning checkout was inspected at `main`, commit `9ff6ce04fa10cc5424783b016330bc4644d3529f`; implementation began from documentation commit `5488f37`. The current implementation/evidence record is below, with supporting detail in [export-validation.md](../../reports/validation/2026-09-10-export.md). Refresh the checkout and evidence when resuming. Historical conversion probes below remain separate from current implementation, acceptance and release state.

Repository conventions: [CONTRIBUTING.md](../../CONTRIBUTING.md). This file contains the complete export contract and relevant findings from the earlier feature comparison; no separate planning document is required.

## Delivery backlog

Implementation branch: `export-subsystem`. Its opening commit established this documentation baseline; D0–D4 are now implemented with focused and integrated tests. D5 engineering handback and the subsequent regression fixes are complete; human review and product acceptance remain pending.

**Start from the reviewed integration revision.** During 0.2.0 preparation use `codex/0.2.0-integration`; after integration use `main`. Record the full commit ID. This file travels with the implementation so delegated worktrees include the handoff. Preserve unrelated changes and verify Git identity before further commits.

Milestones describe observable increments; numbered tickets are intended commit/review slices. Split a ticket if it grows across independent behaviors. Deliver settings and UI with the backend they enable.

| Milestone | Tickets and deliverable | Dependencies | Required evidence |
| --- | --- | --- | --- |
| **D0: baseline and fixtures** | **0.1** record base, runtime and fresh checks. **0.2** establish saved/prepared/result contracts, small fixtures and fixed W-30 expectations. | None | Reproducible baseline, fixture provenance/content inventory, and recorded expected outcomes. |
| **D1: saved capture** | **1.1** complete/acknowledge save synchronization in both modes. **1.2** select the intended document and capture an immutable saved revision. | D0 | Deterministic queue/revision tests and native VS Code save-then-export evidence; AC-02. |
| **D2: complete HTML path** | **2.1** toolbar/menu and HTML job, including shared naming/progress. **2.2** portable assets, styles, math and diagrams. **2.3** early installed-VSIX HTML smoke. | D1 | Usable standalone HTML without Pandoc/additional browser, offline relocation, safe naming, warnings/cancellation; AC-01–04, AC-08–12, early AC-14. |
| **D3: Pandoc formats** | **3.1** native settings, discovery/manual path and DOCX. **3.2** EPUB with target-specific preparation. | D1; D0 contracts; reuse D2 assets | Actual Pandoc outputs, structure/media and viewer checks, dependency isolation, settings/localization; AC-04–05, AC-07–12. |
| **D4: rendered PDF** | **4.1** browser discovery/manual path and headless conversion. **4.2** simple pagination, readiness and oversized-block handling. | D2; shared settings conventions | Real PDF with inspected pages, text/links, first/last oversized content, dependency errors and cleanup; AC-05–06, AC-08–12. |
| **D5: installed handback** | **5.1** integrated acceptance and setup/limitation documentation. **5.2** final VSIX, isolated-profile checks, W-30 outputs and review record. | D1–D4 | All ACs accounted for, fresh regression results, packaged artifacts, explicit unresolved checks, and shared-build compatibility. |

D2 is the first useful end-to-end checkpoint: a user can export HTML from an installed extension. D4 is the four-format checkpoint. Share evidence and remaining work at each, then continue within authorized scope; these checkpoints are not repeated permission gates.

### Ticket boundaries and implementation notes

- **D0:** preserve the selected [fixture set](../../test/fixtures/exports/README.md), its provenance and frozen manifest. W-30 is selected and calibrated; subsequent artifact inspection must use those inputs without silently revising their expected content.
- **D1:** test pending webview changes, queued host edits, save followed immediately by export, both editor modes, document switching and stale/closed-document responses. Preserve source, selection and undo state. Export itself must not trigger saving.
- **D2:** split UI, coordinator/finalization and resource preparation into smaller tickets if necessary. Render all content from the captured revision, use current appearance in both modes, and inspect representative light/dark output. Exercise collision races, fallback/warnings and cancellation through the shared path.
- **D3:** add every new native settings translation and runtime message where appropriate. Test usable discovery, explicit invalid paths, missing Pandoc, spaces/Unicode, real conversions and unsupported content. Do not claim Word/EPUB fidelity from exit status alone.
- **D4:** use the prepared HTML from D2. Remove editor overflow restrictions and apply print rules. `break-inside: avoid` alone cannot keep a block larger than a page intact; oversized content needs splitting/scaling and visual evidence. See [CSS fragmentation](https://www.w3.org/TR/css-break-3/#unforced-breaks).
- **D5:** include the JavaScript actually needed at runtime in the VSIX. Stop development servers and record resolved external tools; a fresh VS Code profile can still discover developer-installed executables. Prove missing-dependency behavior separately.

Keep one integration owner for commands, host bridges, settings and packaging. The implementation has used bounded parallel slices for rendering, backends and fixtures; subsequent work should preserve those ownership boundaries. Each contributor supplies evidence for their path, and the integration owner verifies the combined branch.

## Verification and handback

Use layered evidence: focused unit/contract tests for state and naming; production-renderer tests for preparation; real backend conversions for format behavior; native installed-VSIX checks for host integration. A standalone browser fixture cannot prove that VS Code saved the intended revision.

Current repository commands are listed below; consult [CONTRIBUTING.md](../../CONTRIBUTING.md) and package scripts for changes when resuming. Use the repository's declared Node version. Run `npm ci` when preparing the implementation environment.

```sh
npm run compile
npm run lint
npm run test:outline-state
npm run test:identity
npm run test:localization
python3 test/fixtures/exports/verify-fixtures.py
npm run test:export
npm run test:e2e -- test/specs/export-editor.spec.ts test/specs/export-ui.spec.ts
npm run test:e2e -- test/specs/codeblock-copy.spec.ts test/specs/sidebar-state.spec.ts test/specs/copy-paste.spec.ts
EXPORT_REAL_TOOLS=1 npm test
npm run package
```

Focused export tests are integrated into the normal test entry points. Real installed-tool tests require `EXPORT_REAL_TOOLS=1`; the separate package-content check requires `EXPORT_VSIX_PATH` pointing to the freshly built VSIX. Compile regenerates and copies the production webview/shared/vendor resources; TypeScript watch alone is insufficient for every asset change. If shared editor/resources change, prepare the Electron development dependencies and run `npm run compile --prefix electron` as a compatibility check. This does not certify Electron export.

Install the actual VSIX using separate `--user-data-dir` and `--extensions-dir` directories, without replacing the user's normal profile. Use the current package artifact/version, open export fixtures, and exercise the toolbar/save/export flow independently of the browser regression server. Declare the tested OS/architecture, VS Code version, extension-host runtime, Pandoc/browser versions and resolved paths. Compare the same package hash across hosts. Do not infer other distributions, Intel/ARM equivalence, remote-host support or viewer compatibility from one host. Ubuntu may use an isolated Xvfb display with an ordinary user and the browser's normal sandbox. Skip blocked privileged setup and record that boundary.

Required evidence includes source/asset hashes, expected-versus-observed text/structure, images/diagrams, PDF page inspection, DOCX/EPUB container checks and representative target-viewer rendering. Test errors and cancellation as well as successful conversion. An unavailable required tool/viewer or native-host check is **unverified/blocked**, not a passing skipped test. Separate baseline failures from introduced regressions; never disable an assertion or generate its expected answer from the implementation merely to obtain green results.

### Definition of ready for review

The implementer supplies:

1. Base/head revisions and a scoped diff, with D0–D5 and AC-01–14 statuses linked to actual evidence.
2. A reproducibly built VSIX with size/hash, environment/dependency inventory and an installed-profile walkthrough.
3. Representative HTML, PDF, DOCX and EPUB outputs, plus W-30 input provenance, inventory and verification results. Keep large generated artifacts out of Git unless deliberately chosen.
4. User setup instructions, the format-support matrix, experimental limitations, warnings/fallback examples and actionable remaining blockers.
5. Fresh regression results and explicit skipped/unverified checks, including target viewers/platforms and Electron build compatibility where affected.

All MVP requirements must be verified, or a material exception must be explicitly agreed and recorded, before describing the MVP as complete. A review-ready branch is not automatically human-accepted, merged or released. Remote PR creation, merging and marketplace publication follow the authorization given for the later implementation task.

## Agile and human-AI working agreement

Use short feedback cycles: choose one observable behavior, state its acceptance case, implement the smallest useful change, inspect the diff, verify, and update the backlog from evidence. AI can accelerate implementation and exploration; the requirement, evidence and review still need clear ownership.

The human owns product scope, acceptable visible compromises and release acceptance. The implementer owns code organization, routine library choices within supported runtimes, tests, debugging, integration and evidence. A reviewer, when assigned, should inspect changes and reproduce important cases; another model agreeing with a summary is not independent execution evidence.

### Flexibility and escalation

| Change | How to proceed |
| --- | --- |
| Exact SVG path, spacing, wording, internal module names, compatible library version, fixture reference or default page settings | Implement autonomously within the requirements; record decisions when they affect later work. |
| Ticket split, reversible refactoring, dependency order adjustment, or a newly discovered regression in this feature | Update the local backlog, preserve acceptance coverage, implement and verify. |
| Renderer/backend uncertainty | Use a bounded spike with a specific question and observable result. Record findings, choose a compatible approach and continue. A standalone probe does not finish the integrated feature. |
| Changing formats, supported host, saved-only behavior, naming, resource policy, fidelity promises, mandatory native dependencies or an acceptance criterion | Present the concrete conflict, evidence, alternatives and recommendation; record the user's decision before changing that contract. Continue unaffected work. |
| Required host/tool/viewer unavailable | Record the precise missing evidence and what can still be verified. Do not claim the missing check passed. |
| Publishing, merging, installing outside the authorized environment or other external action | Follow the implementation task's existing authorization; seek permission only if still required. |

Do not turn routine implementation choices into repeated product questions. Existing user authorization persists. If a requirement proves infeasible, explain the failing case and attempted resolution; do not silently relax the requirement, delete a fixture, or redefine success. Requirements may evolve through recorded decisions.

For an ad hoc request, record: requested behavior, affected FR/NFR/AC IDs, effect on current work, verification needed, and whether it belongs in the MVP or deferred scope. After the decision, update the affected requirement, acceptance case, ticket and support matrix together. Keep stable IDs; if retiring one, mark it superseded and retain its history rather than reusing the number.

### Resumable status record

Update this table at each milestone or meaningful interruption. Distinguish implemented/tested work from completed acceptance, and identify remaining observations explicitly. Track human acceptance, merge and release separately. Supporting receipts and the per-AC checklist belong in [export-validation.md](../../reports/validation/2026-09-10-export.md); this document retains the authoritative requirements and decisions.

| Milestone | Current state | Evidence / next action |
| --- | --- | --- |
| D0 | Implemented; tested | Started at `5488f37` under Node 20.20.0. Untouched baseline reproduced 662 browser passes, 4 skips and the existing Perplexity-color failure. Contracts, frozen `exports-v1` fixtures and 35-page W-30 reference calibration are recorded; preserve the manifest during acceptance. |
| D1 | Implemented; tested | Ordered edit/save barriers, mode-correct acknowledgement and immutable saved snapshots have queue, provider, controller and renderer tests. The installed walkthrough passed four mode/save-entry combinations. Native document-selection, dirty/untitled, later-edit capture and failure/cancellation checks passed under D5. |
| D2 | Implemented; tested | Four-format toolbar/status UI, standalone HTML, portable resources, inert preparation, shared naming and cleanup are implemented. Native HTML artifacts and offline/rendering checks exist. All four actual HTML outputs passed relocation/offline checks; corrected native blockquotes and fallback labels were re-inspected. |
| D3 | Implemented; tested | Installed-tool detection/manual paths and Pandoc DOCX/EPUB adapters pass real conversions plus structure/media/native-math checks. Representative Microsoft Word and Apple Books UI inspection is recorded; this does not certify every construct or viewer. |
| D4 | Implemented; tested | Installed browser PDF conversion, offline preparation, readiness, fragmentation/scaling and cancellation are implemented and tested. Native W-30 PDFs are 51 pages in the original macOS record and 54 pages in the subsequent Ubuntu record; complete content and representative pagination inspection remain the fidelity criteria. |
| D5 | Engineering handback complete; ready for review | All 16 native fixture outputs and four immediate-save combinations passed. Native dependency, naming, dirty/untitled, wrong-tab, immutable-capture, cancellation and failure cases passed; corrected artifacts and offline HTML were re-audited. AC-01–14 are accounted for in the validation record. The latest native harness passed 43 scenarios plus unchanged frozen inputs on each tested host. Human acceptance, merge and release remain unrecorded. |

The original macOS full regression run recorded **684 browser tests passed, 4 skipped and the unchanged Perplexity-color failure**, plus **84 unit tests passed and 1 package test skipped** without `EXPORT_VSIX_PATH`. Compile passed; lint reported 0 errors and 8 existing warnings. After the test-harness script-preservation fix and additional blockquote coverage, **23 focused export browser tests passed**. These runs establish the stated test evidence, not a green full-suite result or blanket acceptance of AC-01–14. The final explicit export run passed **74/74 with no skips**, including real Pandoc, installed Chrome and packaged-runtime checks. See [export-validation.md](../../reports/validation/2026-09-10-export.md) for package/native receipts and limitations.

Export-branch handback before v0.2 convergence (2026-09-10): the reported regression blockers are resolved. The same AGPL VSIX from `8514de9` passed 43 native scenarios plus unchanged inputs on each host, with an additional 16-format run after the development server stopped. Both macOS ARM64 and Ubuntu x86-64 full browser suites passed **691/691 with no failures, skips or retries**, and both unit suites passed **100/100**, including real engines and packaged-runtime checks. Each host's 16 artifacts passed 2,260 marker checks; fourteen PDF pages were inspected across the hosts. The last code-adjacent commit, `54caee9`, only makes the PDF test inspection tool portable. See [the current validation record](../../reports/validation/2026-09-10-export.md#merge-blocker-fixes-and-revalidation--2026-09-10) and [dated evidence](../../reports/validation/evidence/2026-09-10-merge-readiness.json) for hashes, diagnosis, skip disposition and remaining viewer/platform limits. That receipt did not establish hosted CI, acceptance, merge or release. The combined 0.2.0 package, corrected license policy, dependency updates and new CI have their own [validation record](../../reports/validation/0.2.0.md).

For later work, leave the current ticket, files/commit, checks run and outcomes, next action, and any blocker here. Link detailed logs/artifacts as evidence when needed; keep the task's requirements and decisions in this file. No second competing specification or separate mandatory status document is needed.

### Decision log

| Date | Decision and reason | Affected scope / evidence |
| --- | --- | --- |
| 2026-09-09 | Consolidated the agreed four-format, local macOS VS Code MVP into one authoritative handoff. Preserved all 41 FRs, 15 NFRs and 14 ACs. | User clarification answers and consolidation request; the initial documentation milestone preceded implementation. |
| 2026-09-09 | Separate rendered HTML/PDF from Pandoc DOCX/EPUB, sharing capture/resources/finalization. | Supports the different fidelity priorities; D0–D4 must verify the integrated design. |
| 2026-09-09 | Use installed external tools with detection/manual paths; defer bundling/downloaders and typeset PDF. | Confirmed dependency scope; historical size/probe evidence below explains the tradeoff. |
| 2026-09-09 | Use automatic sibling filenames with hashes of completed output bytes, identical-file reuse and numbered collision handling. | Confirmed follow-up decisions; FR-EXP-027–032 and FR-EXP-041, AC-09. |
| 2026-09-09 | Freeze an original synthetic W-30 report and assets, using a public report only as a complexity reference. Record 35-page reference calibration separately from the original macOS 51-page export layout; subsequent Ubuntu output is 54 pages. | Within the agreed workload/layout flexibility; NFR-EXP-015 and AC-13. Input hashes and content obligations remain unchanged; see the fixture manifest and validation record. |
| 2026-09-09 | Preserve the existing displayed renderer: HTML/PDF retain dollar math, `[TOC]` and footnotes as visible source with explicit warnings; fenced math renders. Pandoc retains its supported native-math route for DOCX/EPUB. | Implements the agreed first-version rendering boundary; NFR-EXP-014 and AC-03–04, AC-07–08. Supplementary fenced-math coverage adds evidence without altering frozen fixture bytes or claiming new editor syntax support. |
| 2026-09-09 | Render export diagrams with strict Mermaid settings and text SVG labels; capture assets before Pandoc sandboxed conversion. | Within-scope portability/execution safeguards; NFR-EXP-011–014 and AC-04, AC-07, AC-12. Interactive HTML labels are deliberately excluded from static export. |
| 2026-09-09 | Track native save completion, bypass stale webview capture for external-file synchronization, and retain the strict read-only export gate. | Source integrity and AC-02/AC-11. VS Code has no native write-failed event: cancellation, a later save or panel closure releases an abandoned native wait; subsequent exports still require clean, matching saved content. |
| 2026-09-09 | Extend the experimental host gate to local Linux and cross-validate the same VSIX on Ubuntu x86-64 and macOS ARM64. Keep remote/web/Windows hosts rejected and the Chromium sandbox enabled. | Explicit subsequent user request for SSH-based Ubuntu testing, temporary installations and skipping sudo blockers; NFR-EXP-008 and AC-14 amended above. Exact evidence and remaining limits are in the validation record. |
| 2026-09-09 | Only the newest dependency-status refresh may update the menu; disposal invalidates pending results. | Review reproduced older successful probes replacing a newer invalid-path result. Regression tests cover overlapping refresh and disposal; per-job tool validation remains independent. |
| 2026-09-10 | Transition to AGPL-3.0-only in a separate first commit while retaining upstream/prior MIT and third-party notices. | Explicit user direction for future commits; `f2a73a5`. Licence/package metadata and shipped notice bytes verified; frozen MIT fixture bytes preserved. |
| 2026-09-10 | Correct the four reported browser tests, restore three skips and replace absent sample fixtures with an independently authored pair. Fix the BR sentinel content bug, explicit export UI readiness and Chrome worker cleanup exposed by these checks. | User-authorized merge-blocker remediation; `3914cbe` through `54caee9`. No FR/NFR/AC scope changed. Full suites, same-package native runs and artifact checks are recorded in the current validation section. |
| 2026-09-10 | Converge export, release identity, documentation and VSIX automation in an isolated integration branch; align the license to the selected AGPL-3.0-or-later policy. | Maintainer-authorized 0.2.0 integration. Preserve export FR/NFR and frozen inputs; see [Decision 001](../../docs/decisions/001-agpl-transition.md) and the [combined validation record](../../reports/validation/0.2.0.md). Final main PR and release publication remain review boundaries. |

Append later decisions with date, reason, alternatives where relevant, affected IDs, user authorization or within-scope rationale, and evidence/commit. Rejected implementation experiments need only a short note when the lesson affects future work.

## Reconnaissance and remaining risks

This section preserves useful findings from the **2026-09-08** exploration. These are dated observations and engineering judgments, not a current certification of the feature or external products. Verify dependency compatibility and primary documentation before selecting versions.

### Feasibility and rival approaches

| Approach | What the reconnaissance established | Consequence for this task |
| --- | --- | --- |
| Typora | Built-in HTML/PDF export and optional Pandoc-based additional formats, using a native Pandoc document representation to align conversions with its parser, plus format-specific limitations. [Export](https://support.typora.io/Export/), [Pandoc setup](https://support.typora.io/Install-and-Use-Pandoc/) | Integration needs preparation and explicit target support; attaching Pandoc alone does not supply full visual parity. |
| Markdown Preview Enhanced | Chrome export supports installed-browser discovery and a manual path. [Chrome export documentation](https://github.com/shd101wyy/markdown-preview-enhanced/blob/master/docs/puppeteer.md) | External-browser detection is a practical extension delivery route. |
| Zettlr | Bundles Pandoc, uses additional engines for its typeset PDF route, and also offers Simple PDF through an HTML/browser-style route. [PDF engines](https://docs.zettlr.com/en/export/pdf-engine.html), [Simple PDF](https://docs.zettlr.com/en/export/#special-formats-textbundle-textpack-and-simple-pdf) | Simple rendered PDF and publishing-oriented PDF can remain separate capabilities. |

These documentation checks were not side-by-side fidelity tests. The bounded MVP was assessed at roughly **3/5 engineering difficulty**; broad Typora-level formats, themes, platforms and pagination are a substantially larger compatibility effort. This is a scope judgment, not a delivery-time estimate.

Start Binary Markdown's Pandoc route with a tested Markdown reader and a small adaptation layer. An editor-to-Pandoc AST bridge is a later option if the application adopts a shared document model; it is not a prerequisite for this MVP.

The export subsystem primarily addresses the comparison's HTML/PDF export and Pandoc-integration gaps. Export-specific handling of math, metadata, footnotes, TOCs or alerts does not automatically fix the editor's corresponding behavior. Browser-only VS Code remains outside this MVP.

### Historical probes

| Probe | Observed result | Limit of the evidence |
| --- | --- | --- |
| Pandoc 3.8.3 on macOS ARM64 | HTML, DOCX, EPUB, ODT, PPTX, LaTeX, Typst source and RST conversions exited successfully. DOCX contained three Office Math objects, footnotes, links, an image and a TOC field; HTML/EPUB contained MathML and image content. | Container inspection and conversion success do not prove rendering in native target viewers. Only HTML/PDF/DOCX/EPUB are MVP formats. |
| Markdown-reader behavior | `commonmark_x+tex_math_gfm-smart` was a useful tested candidate for fenced math and avoiding smart punctuation substitutions. Mermaid remained code without preparation; `[TOC]` and editor directives could leak into output. Raw HTML content could disappear from DOCX despite exit success; RTF/plain text warned of math fallback. | Reader flags are a candidate to validate against the fixture matrix, not a frozen dialect or minimum Pandoc-version promise. See the [Pandoc manual](https://pandoc.org/MANUAL.html). |
| Pandoc PDF | Default PDF conversion failed with exit 47 because `pdflatex` was absent. | Pandoc alone is not a PDF engine. No relevant engine found on PATH did not prove none existed elsewhere. Typeset PDF is deferred. |
| Existing renderer | Six simple JSDOM round trips passed; one multiline aligned-math case produced four KaTeX errors. | These were narrow probes, not a native editing/source-preservation certificate or a fix for current renderer limitations. |
| Browser PDF | Playwright 1.58.1 with Chromium 145.0.7632.6 produced a two-page A4 PDF from synthetic prepared HTML with two KaTeX equations, a Mermaid SVG, fonts, a table and links. The PDF had extractable text and three link annotations; both pages were inspected. | This used an already installed development browser and prepared HTML, not an installed VSIX or the complete Markdown pipeline. W-30, CJK, long tables and broad theme coverage were not established. |
| Regression baseline | The comparison recorded compile/Electron type-check success, lint with 0 errors/10 warnings, 13 unit tests passed, and Playwright **662 passed, 4 skipped, 1 failed** out of 667. The failing Perplexity-color fixture appeared to omit production CSS. | Historical only. The audit used Node 25.3.0 while the repository declared 20.20.0. Reproduce under the declared runtime; do not assume the failure is resolved or discard it. |

The browser probe produced HTML of 382,100 bytes and PDF of 88,810 bytes. These observations show feasibility for a small prepared document; they are not performance targets or evidence that packaging, native save capture, and full export integration are finished.

### Dependency size tradeoff

Local measurements used regular-file totals and a ZIP DEFLATE-6 experiment. They are historical estimates, not installer measurements or package-size limits.

| Component measured | Uncompressed | Compressed |
| --- | --- | --- |
| Existing VSIX | — | 1.58 MiB |
| Full `playwright-core` 1.58.1 tree | 8.88 MiB | 2.33 MiB |
| Chromium headless shell, build 1208 | 187.10 MiB | 85.17 MiB |
| Local Homebrew Pandoc executable | 258.11 MiB | 51.83 MiB |

The Pandoc executable measurement does not establish a portable redistributable bundle or include a PDF engine. Native bundling is feasible in principle but adds architecture, packaging, updates and licensing work. The user selected detection/manual paths for the MVP. Browser-control libraries and native browser delivery are separate choices; review [Playwright browsers](https://playwright.dev/docs/browsers), [Puppeteer installation](https://pptr.dev/guides/installation), and [Pandoc installation](https://pandoc.org/installing.html) when implementing.

### Risks to resolve through the milestones

| Risk | Why it matters | Resolution / completion gate |
| --- | --- | --- |
| Stale saved revision | Delayed webview synchronization plus the host edit queue can leave save/export agreement uncertain. | Save/snapshot barriers and four native save combinations are tested. Native document-selection and failure/cancellation cases passed; repeat relevant cases when their implementation changes. |
| Missing packaged runtime | `node_modules` remains excluded; required runtime code must be shipped explicitly. | Vendor packaging and isolated native exports are implemented. Tie final package-content checks and installed-profile receipts to the exact handback VSIX. |
| Markdown interpretation differences | Editor semantics, Pandoc readers and raw HTML handling differ. | Existing renderer for HTML/PDF, explicit target preparation and fixed support fixtures; no mandatory parser rewrite. |
| Incomplete assets or rendering readiness | Fonts, remote resources, async diagrams and target-specific image support can produce missing content. | Shared asset inventory/readiness and explicit fallbacks; offline and target-viewer checks. |
| Pagination and oversized blocks | A short successful PDF does not cover long code/tables or large graphics. | D4 first/last content checks and page inspection, with W-30 integration at D5. |
| Browser/library/host incompatibility | Development Node and browser caches can hide extension-host incompatibility or missing dependencies. | Pin compatible versions and test their resolved executables inside the installed extension. |
| Settings/shared-build side effects | Existing config handlers can rebuild webviews; extension/Electron compilation and assets are separate. | Update only relevant services and verify both affected builds. |

Source agreement, complete resource preparation, package contents and format fidelity remain the important acceptance boundaries even after successful native exports. Preserve the modest layout scope and rerun affected checks for subsequent changes.

## Delegation prompt

Use the following when assigning implementation in a new branch/worktree. Adjust the environment or publication boundary only if explicitly intended.

```text
Implement the export MVP specified in docs/export-subsystem.md.

Read the repository's applicable instructions and CONTRIBUTING.md. Treat the
FRs, NFRs, confirmed scope, naming rules and acceptance criteria in that document
as the current contract. Pin the starting revision from codex/0.2.0-integration
during release preparation, or main after integration. Use an isolated feature
worktree and focused commits. Read the resumable status, reports/validation/0.2.0.md
and the dated reports/validation/2026-09-10-export.md first: D0–D4 are implemented
and tested; D5 engineering handback is complete and human acceptance is pending. Preserve the frozen fixtures,
refresh evidence affected by new changes, and complete remaining native edge,
artifact/viewer and package checks as small, reviewable increments.

Resolve routine implementation choices autonomously within the agreed scope.
Use checkpoints for evidence and feedback. Record material proposed contract
changes before applying them, and continue unaffected work when blocked.
Preserve unrelated changes and verify Git identity before scoped commits.

Keep milestone status, decisions, evidence references and the next action in
docs/export-subsystem.md so another session can resume. Do not weaken tests
or redefine fixture expectations to fit an implementation. Distinguish
historical probes, mocked checks, real conversions and native installed tests.

Return a review-ready diff, VSIX, four-format sample outputs, acceptance matrix,
setup/limitation documentation and explicit unresolved checks. Do not claim
human acceptance, merge or release from test completion. Remote publication,
merging and marketplace release require separate authorization unless already
provided in this task.
```
