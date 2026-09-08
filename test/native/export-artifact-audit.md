# Native export artifact audit

Final candidate artifact audit, 2026-09-09. All 16 regenerated receipts selected by `.vscode-test/export-native/evidence/formats.json` were re-audited for installed source **`99aff55e78338671af31ac94a44058776e491ca8`**, VSIX SHA-256 **`dc5d1876917c17a09f3d795cb6debbf8c555ff3c79b9e178140c770704ba5967`**. The artifact checks below passed, including visual confirmation of corrected blockquotes and visible limitation warnings. The historical artifact defects are resolved for this candidate. This record establishes artifact evidence; the overall native workflow and target-viewer acceptance are recorded separately in [export validation](../../docs/export-validation.md).

## Reproduction

Use the receipt paths, not the basic filename or the newest-looking collision file. The audit verifies that the workspace Markdown still matches the frozen `exports-v1` manifest, records output hashes, reads package XML/media, checks every fixed code/table/scenario marker and inspects PDF images/geometry. Dependencies are Python with `pypdf` and Pillow, plus Poppler's `pdftotext`, `pdfinfo` and `pdftoppm`. The reference scripts use the repository's compiled PDF backend and vendored browser controller with an installed macOS Chrome.

```sh
python3 test/native/export-artifact-audit.py
node test/native/export-artifact-audit.reference.cjs declared
node test/native/export-artifact-audit.reference.cjs compact
node test/native/export-artifact-audit.pagination.cjs
node test/native/export-artifact-audit.themes.cjs
```

The scripts write ignored evidence under `.vscode-test/export-native/evidence/artifact-audit/`. Keep generated documents, screenshots and machine-specific receipts out of public Git history. `audit.json` records receipt-selected filenames, hashes, warning codes, media matches, marker pages and alternative text; it omits personal source paths. Re-running it against revised receipts creates a new observation set, so retain an earlier JSON if comparing runs.

## Final candidate artifacts

All 16 selected outputs corresponded to unchanged frozen source bytes. DOCX/EPUB archives passed Python ZIP CRC checks and required XML parsing. No active script elements or unsafe script-scheme links were found in the inspected HTML/EPUB content. These are static/container observations, not proof of every runtime execution boundary.

| Fixture | Native PDF pages | HTML/PDF observations | DOCX/EPUB observations |
| --- | ---: | --- | --- |
| `basic.md` | 4 | All required text markers present; original PNG embedded intact; one rendered Mermaid SVG; literal math/TOC/footnotes each disclosed in visible warnings | All text markers, original PNG and Mermaid SVG present; two native math objects in each target |
| `fallbacks.md` | 3 | Missing image, invalid diagram and literal dollar-math source visibly accounted for with warnings; original missing-image alt marker retained | Missing image, diagram, raw HTML and unsupported math accounted for in output/receipts; surrounding markers retained |
| `pagination.md` | 16 | All code/table markers retained; tall PNG retained and fitted; complete quotation visibly readable on page 3 | Full code/table content and original tall PNG retained |
| `w30-report.md` | 51 | All 24 scenario cards, 160 code lines, 96 table rows and first/last text markers retained; three rendered Mermaid SVGs and three original local assets present | Three original assets byte-identical, three generated Mermaid SVGs, two native math objects per format, editable text/table structure and footnote content present |

W-30's frozen Markdown SHA-256 remains `1db4863436896ffa05bcfcc1d413a5fc88cd1ce73ce5f1c8cd78eb37686cbe33`. See the [fixture manifest](../fixtures/exports/manifest.json) for exact original asset hashes and the [fixture README](../fixtures/exports/README.md) for provenance/reuse terms.

The native PDF producer was Skia/PDF m152, using Google Chrome **152.0.7977.65**. Pages measured **594.95996 × 841.91998 points**, consistent with A4 rounding. All PDF raster images retained their original dimensions and matched the source RGB pixel digest after decoding; container PNG encoding can differ. Available image alternative-text markers also survived in tagged PDF `/Alt` entries and HTML/DOCX/EPUB image metadata.

| Native PDF observation | Page evidence |
| --- | --- |
| W-30 oversized code, first through last line | Pages 35–39 |
| W-30 oversized table, first through last row | Pages 39–48 |
| W-30 tall graphic / final source marker | Pages 49 / 51 |
| Pagination oversized code, first through last line | Pages 3–7 |
| Pagination oversized table, first through last row | Pages 7–14 |
| Pagination tall graphic / final source marker | Pages 15 / 16 |

The tall graphic's PDF image matrix measured approximately **187.5 × 751.5 points**, with source dimensions **1200 × 4800**. All top/middle/bottom bands and side rails were visible inside the printable page. The displayed aspect ratio differed by approximately **0.2%**, consistent with the observed pixel/point rounding; no deliberate downsampling or gross distortion was observed.

Final candidate page inspection covered W-30 pages **1, 2, 7, 16, 19, 35, 39, 48, 49, 50, 51**, pagination pages **3, 7, 14, 15, 16**, and fallback pages **2, 3**. W-30 quotations were readable on pages 2 and 16; the full pagination quotation was readable on page 3. Code/table boundaries and graphics showed no clipping on these pages. Every intermediate code/table/scenario marker was additionally checked through text extraction. Raw PDF reading order was used for wrapped table-cell markers because layout-mode extraction interleaves neighbouring columns.

The audit checks **6 basic, 9 fallback, 261 pagination and 289 W-30 markers per format**. Every marker appears either in document text or, for the intentionally alt-only tall-graphic marker, image alternative text. Both deliberately unavailable-image markers now appear as visible HTML/PDF fallback text. Thus an alt-only available-image marker reported under `missing_text_markers` is accounted for by `markers_present_in_image_alternatives`; it is not an omission.

## Historical defects resolved and remaining support boundaries

1. **Resolved: unreadable light-theme blockquotes.** The initial pagination PDF printed selectable quotation text white on white. The export stylesheet now uses the theme text colour for quotations. Final native pagination page 3 and both W-30 quotations were rendered and visually checked as readable. Text extraction alone would have missed the original failure.
2. **Resolved warning gap; dollar-math support remains limited.** The existing editor renderer supports fenced `math`; the frozen fixtures also use inline `$...$` and display `$$` syntax. HTML/PDF retain that source, including the deliberately unknown command, and now disclose it through `renderer-math-source` in the receipt and visible document warning summary. DOCX/EPUB still produce two native supported math objects for basic/W-30 and explicit unsupported-math diagnostics. Supported fenced-math coverage belongs to the separate `renderer-native-math.md` supplemental test; the frozen inputs were not changed to make this audit pass.
3. **Disclosed backend difference: TOC/footnotes.** HTML/PDF retain literal `[TOC]` and Markdown footnote syntax. Final basic/W-30 receipts include `renderer-toc-source` and `renderer-footnote-source`, and both warning messages were confirmed in exported content. Pandoc outputs preserve document/footnote structure. This is a declared renderer boundary, not a claim of format parity.
4. **Resolved: missing-image alt wording.** Final HTML/PDF fallback labels preserve the original alt marker together with the resource reference, matching the content retained by DOCX/EPUB. Available-image alt markers survive in all four formats as image metadata and need not appear as visible body text.

## Reference workload calibration

The actual native W-30 artifact was **51 pages** at captured editor appearance. A separate reference render used the same captured HTML content, frozen Markdown hash and production PDF backend. It does not replace the native receipt or assert exactly 30 pages.

| Reference | Typography/layout | Observed pages |
| --- | --- | ---: |
| Declared starting typography, initial calibration | A4 portrait, 16 mm margins, Helvetica/Arial 11 pt, line height 1.35; other inherited spacing retained | 40 |
| Normal report spacing, regenerated final candidate | Same 11 pt body and 1.35 line height; 10 pt tables with 3 pt/5 pt cell padding; 9 pt code with 1.3 line height; auto table layout; compact paragraph/heading margins; empty editor spacer paragraphs collapsed | 35 |

The integration owner accepted the readable **35-page reference** as the approximately 30-page workload definition; the native 51-page output exercises a larger laid-out workload. No source paragraph, table row, code line, image or expectation was removed. The final reference was regenerated from receipt-selected `w30-report_53be4876.html`, SHA-256 `712b7c0bdb13cff5e4752953df7a94b1bc2393833d9de5f355c3c65653be4876`. Its PDF SHA-256 is `d8881dae37ff926612e54ee6e805d657ea5cc829c8c2e0760cfe352e824707a1`. Exact reference CSS is recorded beside the PDF. Final reference pages **2, 11, 29, 33, 34, 35** were rendered and inspected; both quotations, code/table boundaries and the final warnings were readable.

## Controlled proof of ordinary block movement

The fixed pagination fixture kept its quotation together on page 3, but the preceding paragraph was also on that page, so it did not independently prove a move caused by insufficient remaining space. A separate controlled backend case supplies that evidence without modifying frozen input.

Measured unpaginated geometry was **700 px** for the preceding block and **350 px** for the next ordinary block. A4 with 16 mm margins provides approximately **1001.5748 px**, leaving **301.5748 px** after the first block. Thus the next block fits a complete page but exceeds the remaining space. The actual `convertPdf` output put the preceding marker on page 1 and both ordinary-block markers together on page 2. Both pages were rendered and visually inspected; no warnings occurred. This is a supplemental backend check, not a substituted native Markdown receipt.

## Supplemental light/dark print check

After the quote-style correction was compiled, a controlled document went through production `prepareStandaloneHtml` and `convertPdf` for `github`, `dark` and `night`. It contained ordinary text, a two-paragraph quotation, code and a table. All markers survived in three one-page PDFs; each page was rendered and visually inspected. Quotes, body text, code and tables were readable, and both dark themes retained their page background. No warnings occurred. Computed quote-to-background contrast ratios were approximately **14.65**, **11.25** and **10.59**, respectively. This provides supplemental light/dark coverage alongside the final native quotation checks above.

The final receipt-selected artifact audit is complete with no unresolved finding from this audit. Retain the distinction between these artifact observations, native user-flow evidence and overall acceptance. Future changes to source, renderer, runtime or output bytes require the relevant checks to be repeated against their own receipts.
