# Binary Markdown feature comparison and implementation priorities

Assessed checkout: `0a7641a` on `main`, manifest version `0.2.0`. Competitor documentation checked 14 September 2026. Scope: the VS Code extension, not the separate Electron application. This report assesses current source; it does not establish which build users have installed or which commits are in the latest release.

**Recommendation:** preserve front matter, fix multiline fenced math, add GitHub alerts, and make the TOC work in the editor and browser exports. Then implement standard display math before inline math. Export is already implemented and should no longer be ranked as a missing subsystem.

The assumed audience writes technical documentation and study notes in VS Code. Value and effort are engineering judgments, not measured customer demand. Competitor features follow official documentation; competitor applications were not tested hands-on.

| Product | Cost / scope |
| --- | --- |
| Binary Markdown | Free; manifest declares AGPL-3.0-or-later; no feature paywall. Local desktop extension; documentation directs installation through VSIX. |
| Mark Sharp Basic | Continuing free tier. [Official pricing](https://www.marksharp.co/) |
| Mark Sharp Premium | Advertised $12 perpetual license. [Official pricing](https://www.marksharp.co/) |
| Typora | $14.99 before tax, one-time purchase, one user/up to three devices; 15-day trial. Standalone macOS, Windows and Linux application. [Official store](https://store.typora.io/) |

“Not established” means the inspected sources do not settle support or tier entitlement. It does not mean a confirmed absence. Basic functionality in both VS Code extensions can also benefit from VS Code's file management, source search and Git tools; that is host functionality, not proof those tools operate inside each rendered editor.

| Capability | Binary Markdown now | Mark Sharp free | Mark Sharp paid | Typora |
| --- | --- | --- | --- | --- |
| Rendered Markdown editing | Yes | Basic | Yes | Yes |
| Headings, emphasis, lists, tasks, quotes | Yes; handwritten Markdown subset | Yes | Yes | Yes |
| Source view | Internal source view and native text editor | Cursor-preserving switch | Same | Source mode |
| Cursor mapping across mode changes | No explicit mapping in internal toggle | Yes | Yes | Not assessed |
| Visual table editing | Rows/columns, alignment, keyboard navigation, width controls | Rendering; edit in source | Yes | Yes |
| Image insertion | Picker, clipboard, drop; local destination and relative paths | Enhanced workflow gated | Yes | Yes |
| Code blocks | Highlighting, edit/display modes, copy control | Yes | Yes | Yes |
| Mermaid | Rendered/editable blocks | Premium feature | Yes; templates | Yes |
| Fenced `math` blocks | Yes, but renders each nonblank line independently | Standard math instead | Standard math instead | Standard math instead |
| Standard `$…$` / `$$…$$` | Not rendered by visual editor | Yes | Yes | Yes |
| Multiline equations | Tested `aligned` example fails under line splitting | Block math documented | Same | Supported |
| Heading outline | Yes; resizable; per-file/global visibility memory | Yes | Yes | Yes |
| In-document TOC | `[TOC]` literal in editor/HTML/PDF; DOCX/EPUB transformation exists | Not established | Not established | Automatic |
| YAML front matter | No protected editor block; misleading README claim | Yes | Yes | Yes |
| Footnotes | Literal syntax in editor | Exact editing entitlement unclear | Insertion helper | Yes |
| Reference-style links | Literal syntax in editor | Not established | Not established | Yes |
| GitHub alerts | Ordinary quote with visible marker | Documented; no premium label | Same | Configurable |
| Wikilinks | Literal syntax | Documented; no premium label | Same | Not established |
| HTML blocks | Mostly escaped text; limited `<br>` handling | Block support; tier details limited | Block templates | Yes |
| Action palette / shortcuts | Yes | Basic slash menu | Full menu | Menus/shortcuts |
| Word statistics / search | Words, characters, lines; own find/replace controls | Not established | Not established | Counts and search |
| Spellchecking | Browser spellcheck requested; dictionary behavior unverified | Not established | Not established | Documented |
| Themes | Seven built-in themes; font size setting | Default light/dark | VS Code theme/font integration | CSS themes |
| Heading-section folding | No dedicated implementation found | Yes | Yes | Not assessed |
| Drag blocks to reorder | No dedicated implementation found | Gated | Yes | Not assessed |
| Presentation/read-only mode | No dedicated mode found | Gated | Yes | Not assessed |
| Focus / typewriter modes | No dedicated modes found | Not established | Not established | Yes |
| HTML / PDF export | Experimental; browser needed for PDF | Not established | Not established | Yes |
| DOCX / EPUB export | Experimental; external Pandoc | Not established | Not established | Via Pandoc |
| Image export / document import | No dedicated workflow found | Not established | Not established | Image export; broader import/export |
| Export customization | Fixed destination policy/A4/16 mm PDF margins; white/theme choice | Not established | Not established | Broader export workflow |

Sources for the comparison: [Mark Sharp pricing](https://www.marksharp.co/), [Mark Sharp user guide](https://github.com/jonathanyeung/mark-sharp/blob/HEAD/user-guide.md), [Marketplace](https://marketplace.visualstudio.com/items?itemName=jonathan-yeung.mark-sharp); [Typora Markdown reference](https://support.typora.io/Markdown-Reference/), [Quick Start](https://support.typora.io/Quick-Start/), [features](https://typora.io/), [writing modes](https://support.typora.io/Focus-and-Typewriter-Mode/), [images](https://support.typora.io/Images/), [support index](https://support.typora.io/).

Implementation evidence:

| Area | Current evidence and implications |
| --- | --- |
| Registration and controls | [Manifest](../../package.json): optional `.md`/`.markdown` editor, 13 commands, seven themes, seven interface languages, image and export settings. No browser entry. |
| Parser and visual editing | [Editor](../../src/webview/editor.js): `parseMarkdownLine`, `parseInline`, `markdownToHtmlFragment`, `htmlToMarkdown`. Adding syntax must account for both parsing and saving; a renderer-only patch is insufficient. |
| Math | `renderMathBlock` splits expressions into lines before calling KaTeX. KaTeX is already a runtime dependency. Reusing it removes dependency work, but not editing/serialization work. |
| Navigation and statistics | `updateOutline` already enumerates headings, but does not provide reusable stable heading anchors. `toggleSourceMode` toggles displays without position mapping. Counts split words on whitespace. |
| Metadata and TOC | [Extension command](../../src/extension.ts) inserts `[TOC]`. Leading front matter is recognized in an export-preparation helper, not protected in the visual parser. These are separate paths. |
| Host integration | [Provider](../../src/editorProvider.ts) handles edits, external updates, assets and host communication. Existing synchronization is not a claim of collaborative editing. |
| HTML/PDF | [HTML preparation](../../src/export/html.ts), [PDF converter](../../src/export/pdf.ts), [controller](../../src/export/controller.ts): saved-revision pipeline, embedded supported resources, progress/cancellation/warnings. PDF uses a separately installed Chromium-family browser. |
| DOCX/EPUB | [Pandoc backend](../../src/export/pandoc.ts) parses source through Pandoc, transforms TOC and diagrams, and writes editable formats. Different syntax support from browser rendering is possible. No `--reference-doc` customization in this path. |
| Export support boundary | [README](../../README.md) and [roadmap](../../docs/roadmap.md): local desktop macOS/Linux; Windows, Remote-SSH, browser VS Code and Electron export outside initial validated scope. No destination dialog or unsaved export. |

Fresh bounded probes extracted the actual parser functions from the current editor source and called them in Node. They returned literal dollar math, TOC, footnotes, reference links and wikilinks; front matter became horizontal rules/paragraphs; alerts remained generic blockquotes. A fenced math block produced the expected math wrapper. The bundled KaTeX rejected all four separately rendered lines of one `aligned` expression but accepted the complete expression. These are parser/library probes, not native UI, save-round-trip, export or full regression tests. No application code was changed or full test suite rerun for this assessment.

The existing 8 September comparison is historical: its missing-export and MIT claims do not describe this checkout. The untracked DOCX investigation is not treated as an implemented reference-template feature.

| Priority | Bounded deliverable | Value / 5 | Effort / 5 | Rough focused developer days | Why this is worth doing; completion boundary |
| --- | --- | --- | --- | --- | --- |
| 1 | Protected YAML front matter | 4 | 2 | 1–3 | Both competitors support it. Preserve original leading metadata, including comments/quotes, as a dedicated editable source block. Validate unrelated edits, undo, source switching and saving without metadata alteration. Do not build a YAML form. |
| 2 | Correct multiline fenced math | 4 | 1 | 0.5–1.5 | Existing KaTeX can render whole expressions. Validate `aligned`, matrices, errors and browser exports; deliberately handle existing files that relied on independent equations per line. This alone does not add dollar syntax. |
| 3 | GitHub alerts | 3 | 2 | 1–2 | Five recognizable callout styles make READMEs and notes clearer. Preserve `[!NOTE]` etc. exactly, distinguish ordinary quotes, support multiline content, and omit decorative icons from serialization. Scope styling to editor/HTML/PDF first. |
| 4 | Working editor/HTML/PDF TOC | 4 | 2–3 | 2–4 | Reuse outline heading collection, add stable duplicate-safe anchors, update after edits, serialize back to the marker, and export navigation. Existing DOCX/EPUB TOC is a starting point, not a shared implementation. |
| 5 | Standard display math `$$…$$` | 5 | 3 | 2–4 | Makes common technical documents usable; reuse math blocks while retaining the original delimiter and full expression. Exclude fences and preserve incomplete input. Depends on whole-expression rendering. |
| 6 | Font family, line height, readable width | 3 | 1–2 | 0.5–1.5 | Existing CSS variables/layout make this a small comfort improvement. Validate persistence, long tables/code and export styling. Full VS Code color-theme integration is a separate, larger feature. |
| 7 | One bundled DOCX reference style | 3 | 2 | 1–3 | Improve repeated code-block presentation with a tested reference document. Inspect real Word/LibreOffice output, long blocks, Unicode and page breaks. Optional language-label transforms add scope. Template support can help match Typora's customization workflow, but exact competitor code styling was not benchmarked. |
| 8 | Standard inline math `$…$` | 5 | 4 | 4–8 | High value for coursework; higher interaction risk. Define escaped dollars/currency, protect code and links, retain source, and verify caret/delete/paste/undo/source-switch behavior. KaTeX auto-render alone does not solve this. |
| 9 | Focus mode | 3 | 2 | 1–2 | Fade inactive blocks using existing selection information; retain contrast, keyboard navigation and ordinary export. Typewriter scrolling is a separate extension of this work. |
| 10 | Export destination picker and page presets | 3 | 2–3 | 2–4 | Makes the existing exporter more convenient. Preserve cancellation, collision handling and saved-revision guarantees. Presets precede arbitrary CSS/templates. |
| 11 | Footnotes and reference links | 4 | 3–4 | 4–8 | Valuable academic/documentation compatibility, but needs definition resolution and preservation across edits and exports. Start with reference links if reduced scope is needed. |
| 12 | Heading folding / block movement | 3 | 3–4 | 3–7 each | Useful Mark Sharp parity; hidden content and moved nodes must survive save, search, outline and undo. Not merely CSS hiding or a drag handle. |

Effort scale: 1 = localized, 2 = bounded cross-path change, 3 = several interacting components, 4 = substantial editor behavior, 5 = architectural work. Time ranges include focused validation for the stated scope, exclude unrelated defects and release administration, and are not commitments. Do not add the ranges into a delivery promise; parser changes can overlap or expose shared problems.

The largest workflow improvement is standard math; the best immediate return is front matter plus multiline math, followed by alerts and TOC. For a README-first audience, move alerts and appearance ahead of math. For academic notes, keep math near the top and move footnotes up after standard math works.

Avoid expanding into a standalone app, browser/remote export, workspace backlinks, a new parser architecture, or a full theme marketplace solely to claim parity. Each adds substantial maintenance beyond this extension's core workflow. Improve source fidelity incrementally whenever touching parsing/serialization. Existing tests and representative native save/undo checks should guard those changes; this assessment does not establish a current data-loss defect.

Marketplace/Open VSX distribution is a separate adoption opportunity: the README still directs VSIX installation. It may deliver more reach than another minor editor feature, but it is not feature parity and requires a concrete publication/release decision.

Suggested implementation sequence: front matter → multiline math → alerts → TOC → display math → inline math. Font/width controls can fit between larger changes. This preserves the current strengths—free visual tables, images, diagrams and experimental export—while removing common reasons to switch to another editor.
