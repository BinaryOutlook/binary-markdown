# Code blocks, language badges and export settings

Date: 2026-09-14 (Asia/Singapore). Status: implemented locally; validation recorded below.

## Implemented behavior

DOCX exports use the bundled `media/export-reference.docx`. Code blocks have a pale background, thin border and modest insets. A declared language appears **attached below the complete code block's lower-right edge**, in a small tab with a sloped left edge, a vertical right edge, rounded bottom corners and muted, italic 9 pt text. The tab meets the code border and shares its background. Common aliases receive readable names; unfamiliar language names remain literal text. Unlabeled blocks receive the code styling without an invented language label. The original code and its highlighting attributes are retained.

The `binary-markdown.export.showCodeLanguage` boolean setting controls both DOCX and direct PDF exports and is enabled by default. It can be changed in User, Workspace or folder Settings. Disabling it removes the language badges while retaining code styling and highlighting. The controller resolves settings against the exported document and captures the value once per job; a setting changed during an export affects the next export. The description is translated in all seven manifest catalogs. This shared name replaces the temporary DOCX-only setting used during development.

The TypeScript transformation applies only to ordinary DOCX code blocks. EPUB, inline code, native math and Mermaid conversion retain their existing paths. The writer uses the trusted reference file through an absolute command-line path with the existing sandbox and isolated data directory. No additional runtime dependency is required.

The reference document retains Pandoc 3.8.3's defaults and adds the `Source Code` and `Code Language` paragraph styles and a `Code Language Badge` character style. The character style supplies the font, color and italics for the language name. A native inline Word shape supplies the tapered outline, with editable Word text inside its text box. The generated markup escapes language names; user-authored raw content retains its existing readable-source fallback. Its readable definitions and deterministic regeneration procedure are in `scripts/build-docx-reference.py`. Normal compilation and export use the checked-in asset and do not require Python.

Word's keep-with-next property keeps code associated with the footer; long code remains splittable across pages. **A long block may first move to a fresh page**, leaving space on the previous page. The LibreOffice pagination probe reproduced that tradeoff. Disabling the property used the remaining space but orphaned the language label, so the implemented styles prioritize an attached footer. Advanced pagination that attaches only the last code line would require additional document transformation.

Direct PDF uses the same language-name mapping in `src/export/code-language.ts`. In the isolated print document, the exporter reads declared languages from the renderer's code-block attributes and adds a right-aligned, italic tab below each eligible block. Labels are inserted as text, and the code nodes are moved intact. Print styles keep short blocks with their labels and permit oversized blocks to span pages. The tab uses the export theme's text and border colors and the code block's computed background color, including themes that override their base color tokens. A square lower-right code corner and a shared top seam connect the two shapes. An inline SVG supplies the decorative outline; the language itself remains selectable HTML text. HTML and EPUB output retain their existing behavior.

The image-directory control in the sidebar footer now uses an image icon. A separate gear button opens VS Code Settings filtered to `@ext:BinaryOutlook.binary-markdown`. Both controls have distinct, localized accessible labels and keyboard activation. The gear is enabled by the VS Code host; the shared Electron view retains its existing image control.

## Implementation validation

- TypeScript compilation succeeds. Lint reports no errors and nine warnings in unchanged files.
- The final unit/package run passed 115 checks with six optional converter/browser checks skipped. Separate runs passed all seven real-converter/package checks and 28 focused browser checks.
- Tests with Pandoc 3.8.3 cover footer order, aliases, unknown names, nested code, highlighting, native math, resources, fallbacks and EPUB isolation.
- Exact code comparison covers blank lines, Unicode, special characters and a 140-line block. Transformation-level checks also cover tabs and preserved attributes. Inline code keeps its character style.
- Default, enabled and disabled label settings are covered, including an actual Pandoc export with labels hidden. Controller tests verify document-scoped lookup, a setting change during export and the next export picking up the new value.
- Actual Chrome PDF tests cover visible and hidden badges, unknown language names, nested code, all 140 code-line markers, the footer on the last code page, cancellation and script isolation. Renderer-to-PDF previews cover badges on/off and the badge colors in the night theme.
- Browser tests exercise the image and settings buttons separately with pointer and keyboard activation. A production bridge/provider test verifies the exact extension settings command and that the document remains unchanged. All seven locales provide distinct control labels.
- The package gate requires a byte-identical reference asset in the VSIX. With real tools enabled it unpacks the extension into an isolated directory and runs DOCX conversion using only the packaged runtime and reference document.
- LibreOffice rendering checks cover the four-block demonstration, a 140-line block spanning pages, list and blockquote content, adjacent blocks, a long unbroken token and inline code in a table. The demonstration shows the language names below the blocks at the right edge. Adjacent unlabeled blocks have a separating border.
- The original baseline was visually inspected in Microsoft Word during reproduction. A visual check of the final implementation in Word is pending: the earlier attempt encountered a locked Mac, and the latest native automation stalled in the file chooser. No installed-VSIX UI acceptance is claimed.

## Attached-tab aesthetic pass (rectangular prototype)

The previous PDF and LibreOffice previews reproduced the visual defect: the language rectangle floated below the code, and the DOCX label's right border was inset. An image-generated mockup explored a tab connected directly to the lower-right edge; it was used only as a design reference.

For DOCX, the reference styles now remove the gap between the code and language paragraphs, align the tab to the code's outer border, and shade the tab to match. This retains the existing text-border character style and editable text. For PDF, the code's bottom border supplies the tab's top edge, avoiding a doubled seam; the tab sits in normal flow below all code content.

Actual renderer-to-PDF previews checked GitHub, Night, Things and Perplexity themes plus the disabled setting. All 12 visible tabs had a measured vertical gap of 0 px, a right-edge offset of 0 px, matching code/tab background colors and italic text. Perplexity used the system font fallback during the deliberately offline preview. LibreOffice previews cover ordinary, unknown-language, nested and adjacent blocks, long-line wrapping and the 140-line stress fixture. The final code line and its language remain together on page 4 of the five-page stress document.

The local `attached-language-tabs` evidence folder contains the generated DOCX/PDF previews, print-page measurements and reproduction scripts. Native Word visual acceptance remains pending as noted above.

## Tapered-tab refinement

The final requested silhouette has only the left edge inclined. Its top stays attached to the code block, the right edge stays vertical and flush with the code border, and the two bottom corners are rounded. `src/export/language-tab.ts` defines the outline used by both backends. An image-generated mockup explored the initial symmetric trapezoid; the final implementation incorporates the subsequent request for a straight right edge.

PDF uses a decorative SVG beneath the centered italic label, measured after fonts load. DOCX uses a native inline VML shape with a Word text box, still placed by the `Code Language` paragraph style. Code text and syntax highlighting remain intact. The label character style now supplies typography instead of a rectangular border. Shape IDs are unique within each export, XML text is escaped, and the existing setting disables the whole label shape.

DOCX label width is estimated conservatively from the 9 pt font and bounded; longer names receive additional height for wrapping. Automatic shape fitting was tested and removed because LibreOffice detached the text from the outline. The final layout must be checked in a native Word reader as well as the recorded LibreOffice preview; native Word automation remains unavailable from the earlier file-chooser failure.

The final tapered-tab pass passed 115 unit/package checks and seven real converter/package checks. Twelve visible PDF tabs across four themes retained a zero vertical gap and zero right-edge offset; code and tab fills matched. LibreOffice rendering confirmed the requested straight right edge and rounded lower corners, including nested blocks and the 140-line example. A custom-label probe retained XML punctuation, Chinese text and long names through DOCX-to-PDF text extraction; glyph appearance still depends on installed fallback fonts. Evidence is in the local `trapezoid-language-tabs` folder.

The following sections retain the original reproduction and route analysis for context.

## Finding

The reported lack of a distinct code-block container is reproducible. Code is not being flattened into ordinary prose: the Markdown reader and DOCX writer preserve code blocks, their text, indentation and line breaks. Recognized languages also receive syntax highlighting. The default Word paragraph style has no background, border or padding, and there is no visible language label. Unlabeled or unsupported-language code therefore looks especially similar to surrounding text.

This is a default-presentation gap we can address through the existing Pandoc backend. It does not require replacing Pandoc or rendering code as an image.

## Reproduction and evidence

- Checkout: `main`, `f84dd0d1d091824665c6f4ba52f51ec3725010be`; package version `0.2.0`.
- Converter: locally installed Pandoc `3.8.3` on macOS.
- Recompiled TypeScript with `node node_modules/typescript/bin/tsc -p ./` before running the reproduction.
- Called the current production `convertPandoc('docx', ...)` function with a saved synthetic Markdown fixture. A local executable wrapper captured the writer arguments and intermediate JSON while forwarding the same input and arguments to Pandoc.
- Fixture: Python, an unlabeled fence, an unsupported `mydsl` fence, and JavaScript containing a long line; prose and inline code serve as controls.
- Conversion completed without warnings. The captured writer input contains four `CodeBlock` nodes, with classes `python`, none, `mydsl`, and `javascript` respectively.
- Inspected the actual generated DOCX package. All four blocks use `SourceCode` paragraphs. Python and JavaScript contain token character styles, while the other two use `VerbatimChar`.
- Reconstructed each block from Word text, break and tab elements and compared it with the captured code string. All four match exactly.
- Opened the baseline in Microsoft Word for macOS and confirmed the missing visual containers and labels. Code is monospaced; known languages have coloured tokens. The long line wraps in this example.

At the reproduction baseline, ordinary code blocks passed through unchanged in [the code-block transform](../src/export/pandoc.ts); the special code-block branch handled Mermaid. The writer received no `--reference-doc` or explicit highlighting-theme option. The styled editor HTML is not used as DOCX layout input.

The generated default `SourceCode` style inherits from `Normal`, links to `VerbatimChar`, and has no paragraph border or shading. The inherited character style specifies Consolas, 11 pt. Its `wordWrap="off"` property is **not evidence that all wrapping is disabled**: WordprocessingML uses that value to permit character-level line breaking. The prototype retains it.

## Routes compared

| Route | Result | Cost and tradeoff |
| --- | --- | --- |
| Set a Pandoc highlighting theme, such as `tango` | Tested: adds a pale background to the `SourceCode` style in this fixture, including the unlabeled block; preserves text and highlighting | Smallest change. Does not add a language label, border or controlled inset. |
| Bundle a DOCX reference document and add labels to the existing intermediate JSON | Tested prototype: shaded, bordered code paragraphs, inset text and a separate label for each declared language; code remains editable | Recommended. Uses Pandoc's supported customization mechanism and existing application transformation code. Requires packaging the reference document and regression coverage. |
| Build a table or custom OpenXML wrapper around every block | Could produce a more elaborate card with a header row and cell padding | More layout and pagination complexity, especially inside lists/tables. Direct XML manipulation adds maintenance work. Not prototyped. |
| Render code to images | Could closely reproduce the editor appearance | Sacrifices editable, selectable code and complicates multipage blocks. Poor default for an editable DOCX. Not prototyped. |

A Lua filter can implement labels too, but the application already transforms the Pandoc JSON in TypeScript. Extending that transformation avoids introducing another filter runtime or a second transformation layer. Changing webview CSS alone cannot style this DOCX backend.

## Selected implementation route

1. Include a small, trusted reference document, for example `media/export-reference.docx`, defining the `Source Code` and `Code Language` paragraph styles. Use a pale neutral background, a thin border and modest insets, with monospaced code text. Keep code formatting independent of the editor's theme.
2. Pass its absolute path with `--reference-doc` only when writing DOCX. Preserve the isolated data directory and `--sandbox`; the prototype verified that the explicit reference document works with both.
3. Extend the existing JSON transformation to insert a styled language-label paragraph immediately after ordinary code blocks with a declared language, aligned right as requested. Keep the original `CodeBlock` and attributes intact so Pandoc continues to highlight and preserve the code itself.
4. Map common aliases to readable labels, retain unfamiliar declared language names as plain text, and leave unlabeled blocks without a guessed language. Exclude non-language control classes. Keep the code associated with its following footer.
5. Preserve Mermaid conversion, math handling, raw-content fallbacks and inline-code behavior. Apply container styling to unlabeled code as well as recognized languages. Allow long code blocks to split across pages.

The prototype adds `Python`, `mydsl` and `JavaScript` labels and a bordered background to all four code blocks. Its input JSON retains every original code block and attribute exactly. Its output DOCX retains every code string exactly. No code screenshots or added hard line breaks are used.

The reference document in this experiment was generated with a local Python inspection script. That script is an investigation tool; the proposed extension would ship the reference asset and continue to run in TypeScript/Pandoc, without a Python runtime dependency.

## Original prototype validation and follow-up scope

The standalone prototype and theme-only alternative were inspected as DOCX XML and rendered through LibreOffice. The final preview uses installed Word fonts, including Consolas, after correcting font substitution in the local rendering environment. The baseline was also visually inspected in Microsoft Word. Visual acceptance of the styled prototype in Word remains pending; this is not a claim of installed-VSIX end-to-end validation.

The implementation checks above extend the original tests to code presentation, labels, exact code text and reference-asset packaging. Final Word visual acceptance remains a follow-up. The Markdown reader's existing table support is unchanged: inline code in pipe-table cells is covered, while more complex block content in tables requires separate source-format validation.

Local investigation artifacts include `repro.md`, `reproduce.cjs`, the actual `writer-input.json` and `writer-args.json`, `reproduction.json`, `prototype.py`, `code-reference.docx`, `comparison.json`, and baseline/theme-only/prototype DOCX files with PDF previews. They are kept outside the repository's product files.

## Sources

- [Pandoc reference documents](https://pandoc.org/MANUAL.html#option--reference-doc): supported DOCX style customization.
- [Pandoc syntax highlighting](https://pandoc.org/MANUAL.html#syntax-highlighting): supported languages and DOCX highlighting.
- [Pandoc 3.8.3 DOCX writer](https://github.com/jgm/pandoc/blob/3.8.3/src/Text/Pandoc/Writers/Docx.hs#L574-L613): default `SourceCode` style, theme background, and preservation of an existing reference style.
- [Microsoft WordprocessingML WordWrap documentation](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.wordwrap?view=openxml-3.0.1): character-level versus word-level wrapping.
- [Microsoft VML TextBox element](https://learn.microsoft.com/en-us/windows/win32/vml/msdn-online-vml-textbox-element): text inside the native Word shape.
- [Microsoft VML shape element](https://learn.microsoft.com/en-us/windows/win32/vml/shape-element--vml): custom outline, fill and stroke properties.
