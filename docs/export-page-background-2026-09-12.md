# Export page background: bug report and feasibility assessment

Recorded: 2026-09-12. **Status: PDF fixes implemented on the issue #6 branch; final validation in progress.** DOCX did not exhibit the same page-background defect. The investigation below preserves the original baseline; the implementation follow-up records subsequent changes. This is not a release claim.

## Report

PDF export inherits the editor's current theme background, but the background stops at the content area. The page margins remain white, producing an unwanted white frame around dark or otherwise coloured content.

The user's affected build, operating system and PDF viewer were not supplied. The independent reproduction below uses repository revision `f84dd0d1d091824665c6f4ba52f51ec3725010be` (manifest version 0.2.0).

Suggested priority: **P2 / medium**. The defect visibly degrades exported documents with non-white themes; it does not prevent export or imply source-content loss.

### Reproduction

1. Open and save a Markdown document with ordinary text and enough content for multiple pages.
2. Select a dark or other non-white editor theme.
3. Export to PDF and inspect the A4 page edges, margins and final page.

**Reported result:** the content area has the theme background; the surrounding page margin is white.

**Expected result:** a themed PDF has a continuous theme-coloured page background, including all margins and the unused part of the final page. Text retains normal page margins.

### Requested changes

| Item | Requested behaviour | Investigation state |
| --- | --- | --- |
| PDF appearance setting | Add a setting that makes PDF export use a white background regardless of the editor theme. Text and other foreground colours must remain readable. | Feasible; proposed setting and default below. |
| PDF themed background | When the white-background option is disabled, paint the current theme background across the entire A4 page, including margins. | Reproduced; page-background proof succeeds. |
| DOCX parity check | Determine whether DOCX has the same theme/background margin defect, and scope an equivalent correction if it does. | Not reproduced; no equivalent page-background fix indicated. |

## Reproduction evidence

The current production `prepareStandaloneHtml`, `convertPdf` and `convertPandoc` functions were compiled and invoked with synthetic prepared content. The PDF case contains headings, prose, a quotation, highlighted code and a table, followed by two explicit page breaks and a short final page. The DOCX case contains ordinary Markdown structure and 40 paragraphs. Neither case contains private documents, external resources or Mermaid diagrams.

Environment: macOS 26.5.2 ARM64, Node 24.21.0, Google Chrome 153.0.8010.36, Pandoc 3.8.3 and Microsoft Word 16.112.3. Exact source/output hashes, browser-control version and observations are in the [evidence receipt](export-evidence/2026-09-12-page-background.json).

| Case | Observation | Result |
| --- | --- | --- |
| Current GitHub PDF | White margins and white unused content area on all three pages. | Reference case. |
| Current Dark PDF | White margins; content background `#1e1e1e` on all three pages. | Defect reproduced. |
| Current Night PDF | White margins; content background `#1a1b26` on all three pages. | Defect reproduced. |
| Current Sepia PDF | White margins; content background `#fbf8f1` on all three pages. | Defect reproduced. |
| Dark PDF with `@page { background: var(--bg-color); }` added to temporary HTML | All page corners, margin samples and every outermost raster-edge pixel are `#1e1e1e`; unused final-page area matches. | Feasible correction on the tested browser. |
| Dark PDF with literal `@page { background: #1e1e1e; }` | Same full-page result. | Also succeeds. |
| Dark PDF with only an `html` background, or a fixed `body::before` background with negative insets | White page margins remain. | These tested alternatives do not solve the defect. |
| Dark PDF with only `--bg-color` changed to white | White paper, but the white heading disappears and body text becomes faint. | A background-only override is insufficient. |
| DOCX from GitHub, Dark, Night and Sepia | Every uncompressed ZIP member is byte-identical across the four outputs. `word/document.xml` has no `w:background` or `w:shd` elements; the terminal marker survives. | No theme-dependent page background or content shading. |
| Dark-source DOCX in Word | Word displays a dark editing canvas, but its first and final print-preview pages are uniformly white with readable text. The preview contains three pages. | No matching margin defect in this reader check. |

All nine PDFs have three pages and retain their page markers. Extracted word text and bounding boxes are identical to the Dark baseline across all nine cases. Page dimensions are also unchanged (approximately 595 × 842 points, the browser's A4 output). The two successful page-background variants were inspected visually alongside the baseline and the failed white-only override.

These are backend and artifact checks, with a representative Word print-preview check. They do not exercise the installed VSIX, the live editor's save/capture flow, Mermaid, all seven themes, Linux, or older supported browser versions. The proof changes only temporary HTML; no exporter source was modified. Initial setup required restoring locked dependencies after the checkout lacked `esbuild`; compilation then passed with the declared Node version. A restricted-process Chrome launch failed before conversion; the completed probe used isolated browser processes with the browser sandbox enabled.

## Cause and implementation capability

### PDF page background: small, local correction

[The shared HTML builder](../src/export/html.ts) includes the editor stylesheet and sets the document's `data-theme`. [The stylesheet](../src/webview/styles.css) applies `--bg-color` to the body. Both the HTML builder and [the PDF adapter](../src/export/pdf.ts) declare an A4 page with 16 mm margins; the adapter also requests those margins in `page.pdf()`.

The adapter already enables `printBackground` and exact print colours. Those options preserve backgrounds that are painted; they do not supply a page-level colour. The current body/canvas background stops at the page's content area in the tested browser, while the unpainted margin remains white. [Playwright's PDF API](https://playwright.dev/docs/api/class-page#page-pdf) documents the print-media and background options separately from margins.

The simplest proven approach is a PDF-specific page background:

```css
@page {
    size: A4;
    margin: 16mm;
    background: var(--bg-color);
}
```

The [CSS paged-media model](https://www.w3.org/TR/css-page-3/#page-background) defines a page background that covers the margins. The browser probe verifies that the CSS works here, including variable resolution. Retain the 16 mm content margins and the existing page-break/oversized-block handling. No new converter or PDF-processing dependency is needed for this approach.

Add the rule to the PDF adapter's print styles and resolve its colour from the job's effective export appearance. Keep the rule specific to PDF unless changing how users print standalone HTML is also deliberately scoped. Do not replace the page margins with ordinary body padding: that changes the pagination model and may lose repeated top/bottom spacing.

The successful proof is limited to Chrome 153 on macOS. Repeat the actual page-edge checks on the project's supported macOS/Linux browser lanes before treating it as a portable fix. CSS acceptance alone, a computed body background or successful PDF creation is insufficient evidence.

### White PDF setting: feasible, with colour and diagram work

Proposed setting: **`binary-markdown.export.pdfWhiteBackground`**, a boolean with a recommended default of **`true`**. The setting name and default are a proposal recorded for the next implementation, not an existing configuration option.

| Value | Intended output |
| --- | --- |
| `true` | White page and document base background, with a readable light export palette, regardless of the editor's theme. |
| `false` | Captured editor theme, with its background covering the whole PDF page. |

Use an ordinary user/workspace appearance setting, separate from machine-specific executable paths. A default of `true` changes existing PDF appearance for users who have not configured it, so document the new default and the opt-out.

The implementation should resolve the setting once when the job captures its source and carry an effective export appearance through preparation and conversion. Preserve the saved Markdown and the live editor theme. Suggested touchpoints are:

| Area | Needed change |
| --- | --- |
| [Manifest](../package.json) and `package.nls*.json` | Add the setting and descriptions in all seven supported manifest languages. |
| [Controller](../src/export/controller.ts) and [export types](../src/export/types.ts) | Capture the PDF appearance policy per job and give the HTML/PDF path a consistent resolved appearance. |
| [Host messages](../src/shared/host-bridge.ts) and [webview preparation](../src/webview/editor.js) | Pass export appearance explicitly to the offscreen preparation path, including diagram rendering. |
| [HTML preparation](../src/export/html.ts) and [PDF adapter](../src/export/pdf.ts) | Apply the light palette or captured theme consistently, then paint the entire page using the resolved base colour. |
| [Export requirements](export-subsystem.md), [help](../media/export-help.md) and [editor guide](editor-guide.md) | Record the PDF appearance exception and both setting behaviours when implemented. |

Reusing the existing GitHub light palette is a practical starting point. Whichever palette implementation is chosen, check headings, body text, links, quotations, syntax highlighting, tables, math and warning/fallback labels; theme-specific selectors contain some literal colours as well as variables. Preserve the captured font size. Code/table surfaces can retain suitable light contrast backgrounds, and source image pixels should remain intact.

Mermaid is the main reason this is more than a one-line colour override. `prepareExportDocument()` currently calls `initMermaid()`, which selects the diagram theme from the live document; the `prepareExport` message carries Markdown but no export appearance. A later white CSS override cannot reliably recolour text and fills already embedded in generated SVG. Render PDF diagrams with the effective export palette, and restore any temporary renderer configuration after completion or cancellation without visibly switching the editor theme.

Estimated scope: **low complexity for the page-margin correction; moderate for the complete white-output setting**, including colours, explicit preparation state, localization and regression evidence. Both fit the current architecture without a parser rewrite. This is a scope assessment, not a delivery-time commitment.

### DOCX: no equivalent page fix currently needed

[The Pandoc adapter](../src/export/pandoc.ts) reads captured Markdown into Pandoc's document representation and writes DOCX. It does not feed the styled HTML to the DOCX writer or map `document.theme` into page styles. Its fresh data directory also prevents a personal Pandoc `reference.docx` from being silently selected. The identical internal files and Word print previews support keeping this path unchanged for this page-background issue.

If themed DOCX pages are desired later, that is a separate styling feature. [Pandoc's reference-document mechanism](https://pandoc.org/MANUAL.html#option--reference-doc) supports DOCX styles and page properties; browser CSS is not the DOCX styling mechanism.

One boundary remains: DOCX packages prepared Mermaid SVGs and original images, which may carry their own colours. A dark diagram on white paper is distinct from a dark document background with white margins. This probe did not exercise theme-dependent diagram contrast and makes no claim about it.

## Acceptance checks for the implementation

| Check | Required evidence |
| --- | --- |
| Default white output | A fresh configuration exports white PDF paper from every built-in editor theme; headings, text and all supported content remain readable. |
| Theme opt-out | Disabling the setting retains the captured theme and paints the complete page, including every edge, corner, margin and unused last-page area. |
| Page geometry and content | A4 output and 16 mm text margins remain; first/middle/last markers, oversized code/tables/images and ordinary block movement survive. Compare rendered PDF edges and content positions, not only DOM styles. |
| Colour-sensitive content | Check syntax tokens, quotations, links, tables, KaTeX, Mermaid SVG text/fills and warning labels under both modes. Include Dark, Night, Sepia and the other built-in themes. |
| Job isolation | Change settings/theme after capture; the active job keeps its captured appearance. Export, cancellation and failure preserve source bytes and live editor appearance. |
| Format boundary | The PDF preference does not recolour HTML, DOCX or EPUB. DOCX page/style XML remains theme-independent for ordinary text; recheck a representative Word print preview. |
| Packaging and supported hosts | Settings localization, relevant host/webview tests, real PDF conversions and an installed-VSIX setting flow pass on the supported macOS/Linux lanes. |

The existing [theme audit](../test/native/export-artifact-audit.themes.cjs) checks quotation contrast and extracted markers but does not sample PDF margins. Extend that coverage with actual page-edge assertions so this defect cannot pass unnoticed again. Keep the original frozen export fixtures unchanged; add a small dedicated background case if needed.

Raw synthetic inputs, the generation/audit scripts, all nine PDFs, four DOCX files and rasterized PDF pages are retained locally under the ignored `.vscode-test/export-page-background-2026-09-12/` directory. The committed receipt contains portable hashes and observations, not private paths or generated binary documents.

## Implementation follow-up

The user authorized implementation and a reviewable PR on 2026-09-12. [Issue #6](https://github.com/BinaryOutlook/binary-markdown/issues/6) tracks the work on `codex/pdf-export-background`, which retains this report, its original evidence receipt and the roadmap update.

The PDF converter now paints `@page` with the captured theme background. The new `binary-markdown.export.pdfWhiteBackground` setting defaults to `true` and selects GitHub light appearance while keeping the captured base font size. Disabling it retains the editor theme across the page. The host sends frozen appearance to offscreen rendering, including Mermaid, and all seven native settings translations describe the behavior. Source images and explicit diagram node colours remain authored content. DOCX page styling is unchanged; regression coverage compares document, styles and settings XML across all seven editor themes.

Validation results will be recorded here before handback. The baseline measurements above are not post-fix results.
