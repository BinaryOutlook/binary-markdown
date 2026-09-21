# DOCX reader checkpoint

Recorded 2026-09-21. This checkpoint follows [PR #73](https://github.com/BinaryOutlook/binary-markdown/pull/73), starting at its exact head `3db30fa2024bf0dbfc25b946b68afc83ed97f98d`. It retains the complete editor/export issue stack and narrows the acceptance scope for [#38](https://github.com/BinaryOutlook/binary-markdown/issues/38) and [#39](https://github.com/BinaryOutlook/binary-markdown/issues/39). No merge or release is implied.

## Accepted scope

The maintainer selected native numbered paragraphs as the DOCX representation for this version. Numbers remain optional and off by default. Code remains editable, with authored whitespace and export-time highlighting preserved.

The later [maintainer scope decision](#maintainer-scope-decision-2026-09-21) accepts the specific empty-line editing behavior as a documented reader limitation. It leaves the recorded test outcomes intact and preserves the other requirements below.

| Required for this version | Deferred from this version |
| --- | --- |
| Native paragraphs, editable code, preserved whitespace/highlighting, numbering off by default | Automatic syntax re-highlighting after editing in Word |
| One explicitly tested Word for macOS version and one named stable LibreOffice version | Additional reader/platform certification, including Word for Windows, web and mobile |
| Correct numbers, blank lines, wrapping, save/reopen and basic editing | A guarantee that copying excludes numbers in every reader |

Existing behavior: language labels and total counts describe the exported source. Totals are plain text, not reader-calculated fields; adding a paragraph in Word can update native list numbering without updating the total. Re-exporting the Markdown refreshes source-dependent metadata and highlighting. The recommended scope keeps totals static, but acceptance of that detail after reader edits is awaiting maintainer confirmation; it is not silently added to the approved deferrals. Copy behavior may be recorded, but universal number-free copying is not a blocking criterion.

## Reader evidence

The named targets are Microsoft Word for macOS **16.113.1**, build **16.113.26091740**, and stable LibreOffice **26.2.6.3**, build **8221e31b3ac356a1623c672912a3d2b492f7e3d1**, on macOS 26.5.2 ARM64. Follow the [reader procedure](../../test/native/docx-reader-checkpoint.md), keeping original exports and edited copies separate. The [interactive evidence receipt](evidence/2026-09-21-docx-reader-interactive.json) records completed cases, failed cases, artifact hashes and the supporting structural audits.

| Editing case | Word 16.113.1 | LibreOffice 26.2.6.3 |
| --- | --- | --- |
| Replace text | Pass, saved and reopened | Pass, saved and reopened |
| Enter within a line | Pass, saved and reopened | Not run |
| Enter at a line end | Pass after correction, saved and reopened | Pass after correction, saved and reopened |
| Insert a blank line | Pass, saved and reopened | Not run |
| Enter on a blank line | Failed, saved and reopened | Failed, saved and reopened |
| Delete a line | Pass, saved and reopened | Not run |
| Soft break | Pass, saved and reopened | Not run |

Each completed case used an independent synthetic input. Structural comparisons checked exact paragraph text, tabs, trailing spaces and soft breaks; independent-block text, numbering and effective formatting; and the existing static totals. Word's six passing cases preserved the intended edits and code paragraph styling. These results cover the compact editing fixture. Full interactive layout checks for all eight label/control documents, wrapping and pagination remain pending in both readers.

The desktop became available during this follow-up. LibreOffice's native file picker repeatedly stopped responding; restarting only that reader and opening the document through Finder recovered interactive access. The Mac subsequently locked again, preventing the four remaining LibreOffice editing cases. Incorrectly targeted test attempts were retained privately but excluded from acceptance evidence. A missing or blocked check is not a pass.

### Corrected line-end continuation

The original Word export switched a new paragraph to `BodyText` when Enter was pressed at the end of a numbered code line. The inserted text lost its number and code paragraph styling. This was reproduced and saved before correction. Commit `20a9915a1adf3a4967ac52d3388841dda6a25e97` changes the `SourceCode` following paragraph style to itself only when exporting numbered code. Numbering-off exports and the bundled reference templates retain their previous behavior.

The corrected export keeps the inserted paragraph in the code block and advances its native numbering. Word and stable LibreOffice both passed this operation through save, close and reopen. The real-converter regression failed before the correction and passed afterward; it also checks exact source text, independent block numbering and preservation of every other style. The GUI fixtures were generated from `c998bca` with this correction uncommitted; the evidence records that state and the compiled runtime hash rather than claiming a clean-commit fixture build.

### Observed empty-line operation

Pressing Enter on an already empty numbered paragraph ends the native list in both readers. In Word, the expected five paragraphs remain, but the blank paragraph and newly typed paragraph lose their numbers; the new text also switches from Consolas 11 pt to the theme body font at 12 pt. LibreOffice consumes the blank paragraph and creates unnumbered text, leaving four paragraphs; it retains Consolas 11 pt. Untouched source whitespace and the independent code block survive in both cases.

This behavior agrees with [LibreOffice's stop-numbering guide](https://help.libreoffice.org/latest/en-US/text/shared/guide/numbering_stop.html) and the [26.2.6.3 Return-key implementation](https://github.com/LibreOffice/core/blob/libreoffice-26.2.6.3/sw/source/uibase/docvw/edtwin.cxx#L2030-L2039). Microsoft also documents Return twice as ending a list in its [Word for Mac guide](https://support.microsoft.com/en-us/word/create-a-bulleted-or-numbered-list-in-word-for-mac); the current-version evidence here comes from the observed test. Investigation did not identify a supported, portable document-local switch that prevents this behavior.

This operation failed the original editing expectation. No hidden source characters, macros, global reader preferences or manual formatting repair were introduced to make it pass. The following decision changes its acceptance status without changing the observed result. Static total-count acceptance remains separately pending as described above.

### Maintainer scope decision: 2026-09-21

The maintainer confirmed that Binary Markdown is a Markdown viewer with an export subsystem. Markdown remains the authoritative source; DOCX export is responsible for accurate supported content, usable native structure and tested reader compatibility. Editing an exported document follows the receiving application's conventions. The maintainer accepted clear disclosure of the observed Enter-on-empty-numbered-line behavior for this version. Requiring code-editor behavior inside Word or LibreOffice is outside that scope.

This decision clarifies AC-07 in the [export contract](../../docs/export-subsystem.md#outcome-and-confirmed-scope). The alternatives considered were accepting and documenting native-list behavior or investigating a different representation to retain the original editing expectation. The selected approach retains editable native paragraphs, makes the limitation visible in [export help](../../media/export-help.md#code-line-numbers), and recommends editing Markdown and re-exporting for consistent code formatting and numbering. The reader test still records the operation and its saved/reopened result.

The failed entries above and the interactive evidence receipt retain the original observations. The receipt's pending-decision fields describe its collection state before this decision; this section records the subsequent acceptance. The empty-line operation is an accepted reader limitation, not a passed test or a completed code fix. It no longer blocks acceptance by itself. The four remaining LibreOffice editing cases, full interactive layout checks and static-total acceptance remain open. Initial source preservation, ordinary line-end continuation and the other reader requirements remain in scope. This decision does not establish merge or release readiness.

### Supporting rendering and formatting checks

The stable LibreOffice installer came from the [official distribution](https://download.documentfoundation.org/libreoffice/stable/26.2.6/mac/aarch64/LibreOffice_26.2.6_MacOS_aarch64.dmg.mirrorlist). Its published SHA-256 `94bb3248df074c225490a8a6d1d9dc87c7d6783dbb7a8e9f0d0c3d94348552af` matched the download, and local code-signature verification passed. It is separate from the development build used in the earlier integration report.

The [initial headless receipt](evidence/2026-09-21-docx-reader-checkpoint.json) remains historical evidence from the parent revision with test/documentation changes only. A fresh nine-fixture headless run after the continuation correction also passed: originals and resaved DOCX files retained exact source payloads, all 169 expected numbers in each enabled full fixture, all 143 nonblank multi-page markers, independent block restarts and controls with no numbers. The editing baseline rendered five numbers across two blocks. These unchanged-input resaves are separate from GUI editing acceptance.

An independent audit resolved document defaults, style inheritance and direct run formatting across all nine original/resaved pairs. All 33,657 code characters and 279 token-style comparisons retained their effective colors, fonts, sizes, bold and italic properties. The large fixture set contains no italic code characters, so a separate Python-comment probe covered 58 italic characters and confirmed italic rendering in both original and resaved PDFs. This does not establish byte-identical archives or universal formatting preservation: LibreOffice rewrites package structures and drops the code style's `noProof` and `wordWrap` properties.

The historical unnumbered footer case was also repeated using its original heading-free eight-block layout, totals enabled and numbering disabled. Stable LibreOffice kept `Lines: 150` on the final code page for all five label configurations: page 7 for top labels, page 6 for bottom or hidden labels. The earlier LibreOfficeDev orphan-footer observation remains historical; it did not reproduce in this stable version. Word pagination and other reader versions remain unverified.

## Validation and checkpoint use

The initial checkpoint's [Validate VSIX run](https://github.com/BinaryOutlook/binary-markdown/actions/runs/35524783492) passed the candidate build, Ubuntu, macOS, Windows, minimum VS Code and final gate. Its merge commit `27d58bcaaaf8cd10a370a8642304509ab43b474b` had the same tree as checkpoint head `c998bca9fe1e73337b4323c980d1f3fab6fb581c`. This success predates the continuation correction and is not proof of that correction.

For `20a9915`, full compilation, 296 unit checks with real converters, the explicit packaged-runtime check, lint and whitespace checks passed locally. Lint reported 11 existing warnings and no errors. The clean local VSIX has source tree `2801479f9bf30ffdfa30ad0613b1a1080cc8f223` and SHA-256 `14dedaceba1ae46876dfd7f6f1770fb4566ead9564ec92a84ddb1ae4625dea41`. The CI candidate uses merge commit `d8bbb68d6705329e18e0da8c57e8ae4406c5ae53`, whose tree is identical to `20a9915`. Its SHA-256 is `c78ebabc12523451bd8d0fbeb15469154304c2bdbaca01fbb90628a47623b45b`; checksum and clean embedded identity passed, and all 468 shipped runtime/settings/template entries match the local candidate byte for byte. Only embedded source identity and source-commit substitutions in packaged README/changelog differ. The [fresh CI run](https://github.com/BinaryOutlook/binary-markdown/actions/runs/35531205443) passed the candidate build, Ubuntu, macOS, Windows, minimum VS Code and final validation gate at the correction revision; required checks remain enabled. The local clean package passed all six installed `docx-code-numbers` scenarios in VS Code 1.138.0 on macOS ARM64, with frozen inputs unchanged. Inspection of its actual exports confirmed `BodyText` continuation with numbering off and `SourceCode` continuation in all five enabled configurations. The documentation-only evidence follow-up received separate full-file source/diff and rendered Markdown reviews, plus documentation and whitespace checks. The preview uses Markdown-it with custom CSS rather than the exact GitHub or VS Code skin. Its newer CI is not actively monitored under the documentation-only policy; the linked successful run identifies the tested functional revision.

The tested checkpoint branch is `feat/issue-39-reader-checkpoint`. Its PR targets `feat/issue-19-40-integration` for a focused checkpoint diff. The full branch includes PR #73's changes by ancestry. When reader acceptance is complete, either merge this checkpoint into PR #73 and review the updated integration PR, or retarget the latest checkpoint to `main` and review its cumulative diff. Refresh required checks and approvals for that final merge target; merging a focused checkpoint into its parent does not merge the product into `main`.

This checkpoint is not ready to declare the two-reader acceptance complete until the remaining required checks and static-total decision are resolved. The accepted empty-line limitation and deferred capabilities in the scope table do not block it. Other integration limits remain recorded in the parent report and are not silently resolved by this DOCX decision.
