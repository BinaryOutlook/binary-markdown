# Editor and export issue-stack integration review

Recorded 2026-09-20; final functional CI verified 2026-09-21. **Development review only: all 22 requested issues were attempted and published as draft PRs.** Ten additional correction PRs remain explicit in the dependency chain. No PR was merged, no release was published, and no worktree was deleted during this batch.

The freshly fetched baseline is `19b276f3b819b9549e3a9e06d2dc967d8187ec06`. The functional stack ends at `057c1a8b9bb090ddfebd8e579ee428b4ed7cff66` ([PR #72](https://github.com/BinaryOutlook/binary-markdown/pull/72)). The integration branch, `feat/issue-19-40-integration`, starts from that exact head; its additional changes reconcile documentation and record review evidence. The [sanitized snapshot](evidence/2026-09-20-issue-stack.json) records every PR's full head, parent branch and exact base commit, plus the identified functional development package.

The maintainer authorized tested parent PR heads as provisional dependency baselines before human review. This is not an accepted technical freeze, issue completion or permission to merge. In particular, #38's reader matrix and DOCX representation remain proposals. Review the focused PRs in sequence, then the combined integration diff against `main`; do not treat either path as already approved.

**Follow-up, 2026-09-21:** the maintainer accepted native paragraphs and a bounded Word for macOS/stable LibreOffice scope. The [reader checkpoint](2026-09-21-docx-reader-checkpoint.md) records that decision and subsequent evidence. The proposal and pending items below describe the original batch; the follow-up supersedes its DOCX scope decisions without changing its historical test results.

## Sequential issue-to-PR map

Within a row, review the original PR before its corrections. Each subsequent PR targets the preceding branch. All 32 recorded PR heads were verified open/draft, in the intended linear chain, and contained in the final functional head. The order explains implementation dependencies; independent issues can still be accepted separately.

| Order | Issue | PRs in dependency order | Why this position |
| --- | --- | --- | --- |
| 1 | [#19 — Quote contrast](https://github.com/BinaryOutlook/binary-markdown/issues/19) | [#41](https://github.com/BinaryOutlook/binary-markdown/pull/41), [#42](https://github.com/BinaryOutlook/binary-markdown/pull/42) | Establish readable themes before adding more visible controls. |
| 2 | [#20 — One-change table placement](https://github.com/BinaryOutlook/binary-markdown/issues/20) | [#43](https://github.com/BinaryOutlook/binary-markdown/pull/43), [#44](https://github.com/BinaryOutlook/binary-markdown/pull/44) | Stabilize placement state before changing its controls and layout. |
| 3 | [#21 — Table settings icon](https://github.com/BinaryOutlook/binary-markdown/issues/21) | [#45](https://github.com/BinaryOutlook/binary-markdown/pull/45) | Separate settings from the overflow affordance introduced next. |
| 4 | [#22 — Table-toolbar overflow](https://github.com/BinaryOutlook/binary-markdown/issues/22) | [#46](https://github.com/BinaryOutlook/binary-markdown/pull/46), [#47](https://github.com/BinaryOutlook/binary-markdown/pull/47) | Keep actions reachable before composing more toolbar rows. |
| 5 | [#23 — Wide table scrolling](https://github.com/BinaryOutlook/binary-markdown/issues/23) | [#48](https://github.com/BinaryOutlook/binary-markdown/pull/48), [#49](https://github.com/BinaryOutlook/binary-markdown/pull/49) | Protect cell access independently of toolbar overflow. |
| 6 | [#38 — DOCX numbering investigation](https://github.com/BinaryOutlook/binary-markdown/issues/38) | [#50](https://github.com/BinaryOutlook/binary-markdown/pull/50) | Investigate the highest-risk representation before building export metadata. |
| 7 | [#24 — Visible standard formatting](https://github.com/BinaryOutlook/binary-markdown/issues/24) | [#51](https://github.com/BinaryOutlook/binary-markdown/pull/51), [#52](https://github.com/BinaryOutlook/binary-markdown/pull/52) | Settle Full/Simple behavior before adding contextual rows and Insert. |
| 8 | [#26 — Contextual table row](https://github.com/BinaryOutlook/binary-markdown/issues/26) | [#53](https://github.com/BinaryOutlook/binary-markdown/pull/53) | Establish the two-row layout before expanding the primary controls. |
| 9 | [#25 — Insert dropdown](https://github.com/BinaryOutlook/binary-markdown/issues/25) | [#54](https://github.com/BinaryOutlook/binary-markdown/pull/54), [#55](https://github.com/BinaryOutlook/binary-markdown/pull/55) | Build on the established toolbar and selection-preservation behavior. |
| 10 | [#27 — Underline editing](https://github.com/BinaryOutlook/binary-markdown/issues/27) | [#56](https://github.com/BinaryOutlook/binary-markdown/pull/56) | Settle the stored representation and round trips before export support. |
| 11 | [#40 — Underline exports](https://github.com/BinaryOutlook/binary-markdown/issues/40) | [#57](https://github.com/BinaryOutlook/binary-markdown/pull/57) | Carry the agreed editor representation through all existing formats. |
| 12 | [#28 — Full/custom width](https://github.com/BinaryOutlook/binary-markdown/issues/28) | [#58](https://github.com/BinaryOutlook/binary-markdown/pull/58), [#59](https://github.com/BinaryOutlook/binary-markdown/pull/59) | Define column geometry before adding alignment and boundary marks. |
| 13 | [#29 — Column alignment](https://github.com/BinaryOutlook/binary-markdown/issues/29) | [#60](https://github.com/BinaryOutlook/binary-markdown/pull/60) | Position the constrained column using the shared width model. |
| 14 | [#30 — Width indicators](https://github.com/BinaryOutlook/binary-markdown/issues/30) | [#61](https://github.com/BinaryOutlook/binary-markdown/pull/61) | Explain the measured cap and alignment without modifying content. |
| 15 | [#31 — Searchable language picker](https://github.com/BinaryOutlook/binary-markdown/issues/31) | [#62](https://github.com/BinaryOutlook/binary-markdown/pull/62), [#63](https://github.com/BinaryOutlook/binary-markdown/pull/63), [#64](https://github.com/BinaryOutlook/binary-markdown/pull/64) | Establish accessible search, selection and translations before ordering. |
| 16 | [#32 — Language ordering](https://github.com/BinaryOutlook/binary-markdown/issues/32) | [#65](https://github.com/BinaryOutlook/binary-markdown/pull/65) | Apply curated/alphabetical order as a separate preference on the picker. |
| 17 | [#33 — Equation-source placement](https://github.com/BinaryOutlook/binary-markdown/issues/33) | [#66](https://github.com/BinaryOutlook/binary-markdown/pull/66), [#67](https://github.com/BinaryOutlook/binary-markdown/pull/67) | Settle preview/source geometry before adding wrapping and caret movement. |
| 18 | [#34 — Equation-source wrapping](https://github.com/BinaryOutlook/binary-markdown/issues/34) | [#68](https://github.com/BinaryOutlook/binary-markdown/pull/68) | Handle visual lines while preserving the placement and source contracts. |
| 19 | [#35 — Export language-label positions](https://github.com/BinaryOutlook/binary-markdown/issues/35) | [#69](https://github.com/BinaryOutlook/binary-markdown/pull/69) | Establish metadata placement before adding counts and gutters. |
| 20 | [#36 — Total code-line counts](https://github.com/BinaryOutlook/binary-markdown/issues/36) | [#70](https://github.com/BinaryOutlook/binary-markdown/pull/70) | Define and test the shared logical-line model for both numbering backends. |
| 21 | [#37 — PDF line numbering](https://github.com/BinaryOutlook/binary-markdown/issues/37) | [#71](https://github.com/BinaryOutlook/binary-markdown/pull/71) | Exercise that model in the browser export route and add the optional setting. |
| 22 | [#39 — DOCX line numbering](https://github.com/BinaryOutlook/binary-markdown/issues/39) | [#72](https://github.com/BinaryOutlook/binary-markdown/pull/72) | Reuse the shared model/setting and the investigated native representation. |

## Scope and deliberate defaults

Shared editor work covers VS Code and Electron. Export work stays in the existing local desktop VS Code host. The maintained [editor guide](../../docs/editor-guide.md) and [export help](../../media/export-help.md) describe the resulting controls and settings.

- Full formatting is the default, including existing installations with no saved preference. Explicit Simple/Full choices remain intact. Insert is available in both modes.
- The visual column keeps its 860 CSS-pixel centered default; Full and Custom widths, left/right alignment and hideable capped-width marks are optional. Source mode and export paper layout keep their separate behavior.
- Language browsing uses a handcrafted default with Plain text/Markdown first. A–Z/Z–A are alternatives; queries rank exact/prefix/substring matches before the browsing-order tie break.
- Equation source defaults to above the preview with wrapping off. Changing either preference affects presentation, not authored TeX.
- PDF/DOCX language labels default to top-left for unset settings, including existing installations. All four corners are selectable. Total counts and per-line numbering are independently optional and default off.
- The proposed line contract preserves authored whitespace: an empty fenced block has zero lines, one authored blank line has one, internal/trailing blank lines count, fence-separating newlines do not, and visual wrapping adds no numbers. The final acceptance of that empty/blank distinction remains with the maintainer.

## Validation evidence and limits

Local evidence uses Node 24.21.0 on macOS ARM64. The installed-host checks used VS Code 1.138.0; selected earlier checks also used VS Code 1.85.0. Electron checks used 28.3.3. Reader/converter observations used Pandoc 3.8.3, Chrome 153.0.8010.48, Poppler and LibreOfficeDev 26.8.0.0.alpha0 (build `2c87e51eeaa2b413ff4ae097b2705eea1995d8e5`). These versions describe observations, not an expanded support commitment.

| Boundary | Recorded result | Practical limit |
| --- | --- | --- |
| Compilation, dependencies and lint | Root and Electron builds passed; new dependency audit had zero findings; lint had zero errors and 11 inherited warnings | Compilation does not prove installed UI behavior |
| Full editor browser regression | 1,078 Chromium checks passed with two workers and no retries on the final functional sources | The earlier stale-fixture run was invalid and discarded after fixing the host-only vendor exclusion |
| Real converters and package | All 296 unit/real-converter/package checks passed with no skips; real conversion tests compare logical code payloads and metadata | Converter structure alone does not establish reader editing, copying or accessibility |
| Installed #39 VSIX | Six actual DOCX exports passed: unset default, four label corners, hidden label; source/editor/settings and frozen fixtures preserved | Local macOS installed extension; no claim of OS-pointer or screen-reader coverage |
| Shared editor hosts | Issue-specific installed VS Code and Electron Preferences/resize/save/reopen checks are recorded in their PRs | The final export-only issue did not repeat every earlier Electron scenario; OS menus, native pickers and IME remain distinct manual boundaries |
| PDF numbering | Shared blank/tab/Unicode/wrapping/multi-page fixtures and independent metadata combinations passed; a single logical line spanning pages kept one number | Poppler can include gutter numbers and group columns; exact source copying and spoken order remain unverified |
| DOCX numbering | All five label configurations retained eight exact fixture payloads and 169 numbers through LibreOfficeDev rendering and a DOCX save round trip; all 143 nonblank pagination markers appeared once | Six representative first/last-page captures were inspected; stable LibreOffice, Word and interactive edits/copy remain unverified |

The local functional package came from clean source `057c1a8b9bb090ddfebd8e579ee428b4ed7cff66`, tree `1d7e6e2be6bb8495166cd242d1b9de0cc64f5f58`. Its SHA-256 is `d0e02c5a665f1859b622d9ac8012bd06dc497c576fd520af114901dec0c9a4c5`. The final integration development package has its own source stamp/checksum and is identified in the integration PR; it is not byte-identical to the functional package and is not a release artifact.

Hosted CI is a separate record. [#36's run](https://github.com/BinaryOutlook/binary-markdown/actions/runs/35514625597) and [#37's run](https://github.com/BinaryOutlook/binary-markdown/actions/runs/35515088936) passed. [#39's final functional run](https://github.com/BinaryOutlook/binary-markdown/actions/runs/35518653002) passed candidate build, macOS, Windows, Ubuntu, minimum VS Code and the final validation gate at head `057c1a8b9bb090ddfebd8e579ee428b4ed7cff66`. The integration-only documentation changes have their own CI state; consult the integration PR without inferring that state from the functional pass. Documentation-only follow-ups after a full green functional run receive local documentation/whitespace/render checks without actively waiting for a new full CI run. Required CI remains enabled.

Earlier failures are retained in the focused PRs, rather than relabeled as successes. Corrections address observed test-readiness, fixture-geometry, clipboard and translation defects. Separate historical minimum-Linux cancellation/save timeouts, Windows process-inventory cleanup timeouts, and a canceled macOS run do not have established universal causes. Later green descendants validate their own tested revisions; they do not retroactively make those earlier heads green.

## Remaining acceptance items

1. **DOCX design and readers (#38/#39):** accept or revise the native-paragraph representation and name the target reader/version matrix. Verify Enter, soft breaks, continued numbering, tabs, syntax colors, copy/paste and screen-reader order. Exported highlighting remains static after reader edits.
2. **Unnumbered DOCX pagination (#36):** in the observed LibreOffice development build, the total for a 150-line unnumbered block can appear alone on the following page. Numbered #39 fixtures kept their total with the final code page; that does not resolve the unnumbered path or establish other readers' behavior.
3. **PDF extraction/copy (#37):** visible gutter numbers can enter extracted text, sometimes in a separate column. Interactive selection/copy requires target-reader review; there is no promise of exact source recovery from a PDF.
4. **Underline readers (#40):** paired `<u>` round trips and conversion structures passed; interactive Word/EPUB reader behavior remains unverified. One observed PDF text extractor omitted Chinese glyphs even though DOCX retained the source; font/reader appearance requires inspection.
5. **Native interaction/accessibility:** installed DOM and owned-keyboard automation does not prove OS-pointer hit testing, OS-menu activation, native file pickers, real IME candidate selection or spoken screen-reader behavior. Electron automated resizing is separate from dragging an actual VS Code window.
6. **Existing editor limits:** rapid equation Redo before the existing background synchronization completes remains a baseline limitation; synchronized undo/redo passed. Save-overlap behavior tracked in #11 and broader parser/round-trip work in #16 were outside this batch. Theme-specific code-token contrast is separate from the blockquote fix.

## Maintainer review checklist

Use an isolated profile/workspace and synthetic files. Follow [build/install instructions](../../docs/building.md) and the [native harness guide](../../test/native/export-smoke.md); verify **Copy Build Information** against the chosen package sidecar first. Keep actual source and exported files for comparison.

- [ ] Review each issue's focused PR and corrections using the table, then inspect the integration diff. Confirm explicit settings remain honored and decide the unset Full-toolbar/top-left-label defaults.
- [ ] In both editor hosts, resize narrow/wide panes with the outline open/closed at 100% and 200% zoom. Check complete toolbar buttons, overflow, one-change placement, contextual rows and every table cell; test native pointer and keyboard use.
- [ ] Exercise Insert, underline, language search/order, widths/alignment/marks and equation placement/wrapping. Check cancellation, selection, undo/redo, Source mode, save/reopen and an active equation during live settings changes. Include English and another supported locale.
- [ ] Accept the logical-line contract and DOCX representation/reader matrix. In each named reader, inspect all label corners, hidden labels, counts/numbers independently, blank/empty blocks, tabs/Unicode and multi-page code. Edit and copy the results, then compare saved content.
- [ ] Inspect the known unnumbered DOCX footer case and PDF copied/extracted numbering; decide remediation or an explicit accepted limitation. Review underline in Word and an actual EPUB reader.
- [ ] Check spoken accessibility, OS menus/pickers and real IME behavior. Record missing observations separately from failures. Review required CI for the actual head before any merge; use the release gates separately before publishing.

The batch ends at published drafts and an identified development build for review. Human acceptance, integration merge and release publication remain separate actions.
