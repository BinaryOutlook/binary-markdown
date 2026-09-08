# Native export artifact audit

Initial audit, 2026-09-09. This record describes the 16 successful receipts selected by `.vscode-test/export-native/evidence/formats.json` during the first complete four-fixture native run. It **does not accept the subsystem**. It identified unreadable light-theme blockquotes and missing warnings for dollar-delimited mathematics; corrected native outputs must be inspected again. Target-viewer UI checks are owned by the integration walkthrough.

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

## Initial observed artifacts

All 16 selected outputs corresponded to unchanged frozen source bytes. DOCX/EPUB archives passed Python ZIP CRC checks and required XML parsing. No active script elements or unsafe script-scheme links were found in the inspected HTML/EPUB content. These are static/container observations, not proof of every runtime execution boundary.

| Fixture | Native PDF pages | HTML/PDF observations | DOCX/EPUB observations |
| --- | ---: | --- | --- |
| `basic.md` | 4 | All required text markers present; original PNG embedded intact; one rendered Mermaid SVG; dollar mathematics stayed literal | All text markers, original PNG and Mermaid SVG present; two native math objects in each target |
| `fallbacks.md` | 3 | Missing image and invalid diagram visibly accounted for; dollar-math source retained without its required limitation warning in this initial run | Missing image, diagram, raw HTML and unsupported math accounted for in output/receipts; surrounding markers retained |
| `pagination.md` | 16 | All code/table markers retained; tall PNG retained and fitted; quotation text extracted but was visually invisible | Full code/table content and original tall PNG retained |
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

Rendered page inspection covered W-30 pages **1, 7, 19, 35, 36, 39, 40, 48, 49, 50, 51** and pagination pages **2, 3, 7, 8, 14, 15, 16**. Code/table boundaries and graphics showed no clipping on these pages. Every intermediate code/table/scenario marker was additionally checked through text extraction. Raw PDF reading order was used for wrapped table-cell markers because layout-mode extraction interleaves neighbouring columns.

## Defects and support boundaries exposed

1. **Unreadable light-theme blockquotes.** Pagination page 3 contained selectable/extractable quotation text but printed it white on white. The exported stylesheet set `--blockquote-color: #ffffff` while the page background was white. The quote border was visible; its contents were not. This is a readability failure even though marker extraction passes. Re-export and visually inspect the corrected quotation and representative W-30 quotes.
2. **Literal dollar mathematics lacked a warning.** The existing editor renderer supports fenced `math`, while these fixed fixtures also use inline `$...$` and display `$$` syntax. Their HTML/PDF output retained literal source, including the deliberately unknown command, without a math limitation warning. The source must remain fixed; the limitation needs visible accounting and supported fenced math requires its own supplemental rendering proof. DOCX/EPUB produced native supported math and explicit unsupported-math diagnostics.
3. **TOC/footnote display differs by backend.** HTML/PDF retained literal `[TOC]` and Markdown footnote syntax, while Pandoc outputs generated document structure. Document these existing renderer limits rather than implying format parity.
4. **Missing-image fallback text differs by backend.** HTML/PDF initially used a path-based label and omitted the original missing-image alt marker. The resource was identifiable and warned; DOCX/EPUB also retained the alt wording. Available-image alt markers were preserved in all formats and are not expected as visible body text.

## Reference workload calibration

The actual native W-30 artifact was **51 pages** at captured editor appearance. A separate reference render used the same captured HTML content, frozen Markdown hash and production PDF backend. It does not replace the native receipt or assert exactly 30 pages.

| Reference | Typography/layout | Observed pages |
| --- | --- | ---: |
| Declared starting typography | A4 portrait, 16 mm margins, Helvetica/Arial 11 pt, line height 1.35; other inherited spacing retained | 40 |
| Normal report spacing | Same 11 pt body and 1.35 line height; 10 pt tables with 3 pt/5 pt cell padding; 9 pt code with 1.3 line height; auto table layout; compact paragraph/heading margins; empty editor spacer paragraphs collapsed | 35 |

The integration owner accepted the readable **35-page reference** as the approximately 30-page workload definition; the native 51-page output exercises a larger laid-out workload. No source paragraph, table row, code line, image or expectation was removed. Exact reference CSS and output/source hashes are written beside the reference PDF. Reference pages **1, 15, 29, 33, 34, 35** were rendered and inspected; the initial inherited quote-contrast defect still requires a corrected reference render.

## Controlled proof of ordinary block movement

The fixed pagination fixture kept its quotation together on page 3, but the preceding paragraph was also on that page, so it did not independently prove a move caused by insufficient remaining space. A separate controlled backend case supplies that evidence without modifying frozen input.

Measured unpaginated geometry was **700 px** for the preceding block and **350 px** for the next ordinary block. A4 with 16 mm margins provides approximately **1001.5748 px**, leaving **301.5748 px** after the first block. Thus the next block fits a complete page but exceeds the remaining space. The actual `convertPdf` output put the preceding marker on page 1 and both ordinary-block markers together on page 2. Both pages were rendered and visually inspected; no warnings occurred. This is a supplemental backend check, not a substituted native Markdown receipt.

## Supplemental light/dark print check

After the quote-style correction was compiled, a controlled document went through production `prepareStandaloneHtml` and `convertPdf` for `github`, `dark` and `night`. It contained ordinary text, a two-paragraph quotation, code and a table. All markers survived in three one-page PDFs; each page was rendered and visually inspected. Quotes, body text, code and tables were readable, and both dark themes retained their page background. No warnings occurred. Computed quote-to-background contrast ratios were approximately **14.65**, **11.25** and **10.59**, respectively. This verifies the compiled backend correction across light/dark styles; the corrected native receipt set still requires separate inspection.

Re-audit the regenerated receipt set after the fixes, record target-viewer observations and retain the distinction between artifact evidence, native user-flow evidence and final acceptance.
