# DOCX reader checkpoint

Recorded 2026-09-21. This checkpoint follows [PR #73](https://github.com/BinaryOutlook/binary-markdown/pull/73), starting at its exact head `3db30fa2024bf0dbfc25b946b68afc83ed97f98d`. It retains the complete editor/export issue stack and narrows the acceptance scope for [#38](https://github.com/BinaryOutlook/binary-markdown/issues/38) and [#39](https://github.com/BinaryOutlook/binary-markdown/issues/39). No merge or release is implied.

## Accepted scope

The maintainer selected native numbered paragraphs as the DOCX representation for this version. Numbers remain optional and off by default. Code remains editable, with authored whitespace and export-time highlighting preserved.

| Required for this version | Deferred from this version |
| --- | --- |
| Native paragraphs, editable code, preserved whitespace/highlighting, numbering off by default | Automatic syntax re-highlighting after editing in Word |
| One explicitly tested Word for macOS version and one named stable LibreOffice version | Additional reader/platform certification, including Word for Windows, web and mobile |
| Correct numbers, blank lines, wrapping, save/reopen and basic editing | A guarantee that copying excludes numbers in every reader |

Existing behavior: language labels and total counts describe the exported source. Totals are plain text, not reader-calculated fields; adding a paragraph in Word can update native list numbering without updating the total. Re-exporting the Markdown refreshes source-dependent metadata and highlighting. The recommended scope keeps totals static, but acceptance of that detail after reader edits is awaiting maintainer confirmation; it is not silently added to the approved deferrals. Copy behavior may be recorded, but universal number-free copying is not a blocking criterion.

## Reader evidence

The named targets are Microsoft Word for macOS **16.113.1**, build **16.113.26091740**, and stable LibreOffice **26.2.6** on macOS ARM64. A version being installed or named does not establish acceptance. Use the [reproducible reader procedure](../../test/native/docx-reader-checkpoint.md), keeping original exports and edited copies separate.

| Boundary | Result | What remains |
| --- | --- | --- |
| Word for macOS 16.113.1 | Installed version verified; interactive access blocked by the locked desktop | Rendering, basic edits and save/close/reopen |
| Stable LibreOffice 26.2.6.3 | Nine fixtures passed headless PDF rendering and DOCX resave, with exact code payloads and expected numbering | GUI inspection, basic edits and interactive save/close/reopen; desktop access blocked |
| Existing implementation | No functional change in this checkpoint | Reader failures, if observed, require a focused correction and fresh evidence |

LibreOffice reported build `8221e31b3ac356a1623c672912a3d2b492f7e3d1`. Its macOS ARM64 installer came from the [official stable distribution](https://download.documentfoundation.org/libreoffice/stable/26.2.6/mac/aarch64/LibreOffice_26.2.6_MacOS_aarch64.dmg.mirrorlist); the published SHA-256 `94bb3248df074c225490a8a6d1d9dc87c7d6783dbb7a8e9f0d0c3d94348552af` matched the download, and local code-signature verification passed. This is a stable release, separate from the development build used earlier.

The [headless evidence receipt](evidence/2026-09-21-docx-reader-checkpoint.json) records the exact checker, reader, inputs and output hashes. It identifies the parent source revision with local reader-tool/documentation changes; no exporter/runtime files changed. Both original and resaved DOCX files were rendered to PDF and their visible number sequences were checked.

The nine fixtures cover all four language-label corners, hidden labels, omitted/default options, numbers only, counts only and the compact editing baseline. Original and resaved DOCX payloads matched exactly, including tabs and leading/internal/trailing blank lines. Highlighted string runs remained present. Each enabled full fixture rendered 169 correct numbers and all 143 nonblank markers in its 150-line block. The default-off/counts-only controls rendered no numbers; the editing baseline rendered five numbers across two independently restarted blocks. The editing baseline was rendered and resaved without intentional edits, so it does not establish editing acceptance.

All five numbered label configurations kept the final count on the final code page. The counts-only fixture also did so in this particular layout; that observation does not resolve the older unnumbered pagination case, which used different surrounding content.

The earlier LibreOfficeDev observations remain historical evidence in the [integration report](2026-09-20-editor-export-stack.md). They do not count as stable LibreOffice or Word results. Likewise, headless rendering and DOCX conversion do not prove keyboard editing or interactive save/reopen.

## Validation and checkpoint use

The parent [Validate VSIX run](https://github.com/BinaryOutlook/binary-markdown/actions/runs/35522548461) passed the candidate build, Ubuntu, macOS, Windows, minimum VS Code and final validation gate at `3db30fa2024bf0dbfc25b946b68afc83ed97f98d`. Its success was verified before starting this follow-up. This checkpoint changes reader-test tooling and documentation, with no exporter/runtime change. Local fixture preparation and the stable-reader matrix used Node 24.21.0 and Pandoc 3.8.3 after full compilation. Generator syntax/lint, documentation links/private-data checks and whitespace checks passed. Raw Markdown/diff and rendered previews were reviewed separately; the preview renders task-list checkboxes as literal markers, without changing their structure. Parent CI is not a claim about an untested descendant. Required CI remains enabled; consult the checkpoint PR for its own run state.

This branch is `feat/issue-39-reader-checkpoint`. Its PR targets `feat/issue-19-40-integration` for a focused checkpoint diff. The full branch includes PR #73's changes by ancestry. When reader acceptance is complete, either merge this checkpoint into PR #73 and review the updated integration PR, or retarget the latest checkpoint to `main` and review its cumulative diff. Refresh required checks and approvals for that final merge target; merging a focused checkpoint into its parent does not merge the product into `main`.

This checkpoint is not ready to declare the two-reader acceptance complete until both named readers pass the required checks. Deferred capabilities in the scope table do not block it. Other integration limits remain recorded in the parent report and are not silently resolved by this DOCX decision.
