# Binary Markdown: project and feature comparison

Assessed commit: `9ff6ce04fa10cc5424783b016330bc4644d3529f`

Prices and product scope:

| Product / edition | Free offering | Paid offering | Environment and availability |
| --- | --- | --- | --- |
| **Binary Markdown** | Entire MIT-licensed project; no feature paywall found | None in this checkout | Optional VS Code custom editor for `.md` / `.markdown`; Electron application also has sources/build targets. Checkout documentation describes a VSIX prerelease and pending Marketplace/Open VSX publication. Distribution status was not independently audited. [Manifest](../../package.json), [README](../../README.md) |
| **Typora** | 15-day trial; no continuing free edition advertised | **US$14.99** before tax; one-time purchase, one user, up to three devices | Standalone macOS, Windows, Linux application. [Official store](https://store.typora.io/) |
| **Mark Sharp Basic** | Continuing free edition: visual Markdown rendering and basic editing | — | VS Code extension. [Marketplace](https://marketplace.visualstudio.com/items?itemName=jonathan-yeung.mark-sharp) |
| **Mark Sharp Premium** | Basic remains available without a license | **$12 advertised**, perpetual license for one user; multiple devices supported through Settings Sync | VS Code; documentation also describes use in `vscode.dev`. [Pricing](https://www.marksharp.co/), [Licensing](https://github.com/jonathanyeung/mark-sharp/blob/HEAD/licensing-and-activation.md) |

Binary Markdown support reflects the inspected code; competitor support follows official documentation, without hands-on testing. **Not documented** means support was not established. Typora's trial shares the paid feature set.

| Feature | Binary Markdown — free | Typora — paid / trial | Mark Sharp — Basic | Mark Sharp — Premium |
| --- | --- | --- | --- | --- |
| Edit directly in rendered Markdown | Yes | Yes | Yes, basic editing | Yes |
| Source editing | Internal source view and VS Code text editor | Source mode | Cursor-preserving editor switch | Same |
| Headings, emphasis, lists, checkboxes, quotes, code | Yes, common subset | Yes | Yes | Yes |
| Visual table editing | Yes: rows/columns, alignment, keyboard navigation, on-screen width adjustment | Yes | Render tables; edit source | Yes |
| Insert images by picker, paste, or drop | Yes; configurable local destination and relative paths | Yes | Enhanced insertion workflow gated | Yes |
| Mermaid diagrams | Yes; source/rendered block modes | Yes | Premium feature | Yes; templates and split editing |
| Mathematics | **Limited:** fenced `math` blocks; each nonblank line is a separate equation | MathJax; inline and display math | KaTeX | KaTeX |
| Ordinary `$…$` and `$$…$$` math | **No renderer found; probes leave literal text** | Yes; inline math is configurable | Yes | Yes |
| Multiline LaTeX environments | **Limited:** line splitting breaks the tested multiline `aligned` example | Supported in math blocks | Block math documented | Block math documented |
| Heading outline | Yes; own resizable sidebar | Yes | Yes | Yes |
| Remember outline open/closed state | Explicit per-file or global setting | Exact equivalent not assessed | Exact equivalent not assessed | Exact equivalent not assessed |
| Generated in-document contents list | **No:** command inserts `[TOC]`, which remains literal | Yes, automatically updated | Not documented | Not documented |
| YAML front matter | **No dedicated handling:** parsed as text and horizontal rules | Yes | Yes | Yes |
| Footnotes | No semantic rendering found | Yes | Basic-tier editing not clearly specified | Yes; insertion helper |
| Wikilinks | No semantic rendering found | Not established here | Documented | Documented |
| Callouts / GitHub alerts | Generic blockquote only | Yes, configurable | Documented | Documented |
| Raw HTML in Markdown | Escaped as text, except limited handling such as `<br>` | Supported | HTML blocks documented; tier details limited | HTML blocks and templates |
| Palette and keyboard operations | 21 action-palette entries; formatting shortcuts | Menus and shortcuts | Basic slash commands | Full slash commands |
| Code highlighting and copying | Built-in limited highlighter; dedicated multiline-copy regression coverage | Highlighting | Highlighting | Highlighting |
| Appearance | Seven fixed themes, font size, compact/full toolbar | CSS themes | Default light/dark | VS Code theming and fonts |
| Fold heading sections | No dedicated control found | Not assessed | Yes | Yes |
| Drag blocks to reorder | No dedicated block handles found | Not assessed | Premium feature | Yes |
| Focus/typewriter or presentation mode | No dedicated modes found | Focus and typewriter modes | Presentation mode gated | Read-only presentation mode |
| PDF / HTML export | **No built-in exporter; PDF command is a placeholder** | Both, plus image export | Not documented | Not documented |
| DOCX / EPUB and other publishing formats | No built-in exporter found | Via separately installed Pandoc | Not documented | Not documented |

Competitor evidence: [Typora features](https://typora.io/), [Markdown reference](https://support.typora.io/Markdown-Reference/), [math documentation](https://support.typora.io/Math/), [export documentation](https://support.typora.io/Export/), [editing commands](https://support.typora.io/Shortcut-Keys/); [Mark Sharp pricing and tier split](https://www.marksharp.co/), [user guide](https://github.com/jonathanyeung/mark-sharp/blob/HEAD/user-guide.md). Detailed math-engine equivalence between the competitors was not tested. Mark Sharp's table restriction is explicit; footnote and HTML editing entitlements are less explicit, so they are qualified above.

Other free alternatives provide useful context. These are additional comparisons, not components included with Binary Markdown.

| Alternative | Cost | Relevant supported features | Difference from Binary Markdown |
| --- | --- | --- | --- |
| **VS Code built-in Markdown** | Free | Source editor, synchronized preview, outline, local-link validation, link-aware rename, KaTeX math and, in the current documentation, Mermaid rendering | Strong source-oriented baseline; preview is not a general visual editor. [Official documentation](https://code.visualstudio.com/docs/languages/markdown) |
| **Markdown All in One** | Free; open source | Formatting shortcuts, list editing, table formatting, automatically updated TOC, HTML export; browser printing can produce PDF | Improves VS Code source editing rather than replacing it with a rendered editor. [Project documentation](https://github.com/yzhang-gh/vscode-markdown) |
| **Markdown Preview Enhanced** | Free; open source under the University of Illinois/NCSA license | Math, Mermaid/PlantUML and other diagrams, PDF/Pandoc export, presentations, executable code chunks; some features need external tools/configuration | Broader preview and publishing capability; still primarily a source-plus-preview workflow. [Official listing](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced) |
| **Obsidian** | Core app free; optional Sync from **US$4/month annually** or **US$5 monthly**; Publish **US$8/month annually** or **US$10 monthly** | Live Preview/source modes, visual tables, Mermaid, footnotes, wikilinks and backlinks | Stronger interconnected-note workflow in a separate application. Paid services are optional, rather than editing-feature unlocks. [Pricing](https://obsidian.md/pricing), [editing modes](https://obsidian.md/help/edit-and-read), [tables/diagrams](https://help.obsidian.md/Editing+and+formatting/Advanced+formatting+syntax), [formatting](https://obsidian.md/help/syntax), [backlinks](https://help.obsidian.md/Plugins/Backlinks) |

Key files from the traversal of **235 tracked files**: **162 current** and **73 archived**.

| Area / key files | What the implementation establishes | Important qualification |
| --- | --- | --- |
| [package.json](../../package.json) | Nine commands, nine settings, optional custom-editor registration, VS Code engine requirement `^1.85.0`, MIT license | Version `0.1.0` and `preview: true`; no `browser` entry for a web extension. Manifest links still use the older repository path. |
| [src/extension.ts](../../src/extension.ts) | Activation, editor registration, source switching, text comparison, undo/redo forwarding | PDF only shows a message; TOC only inserts a marker. Table/TOC commands here target the active text editor; visual table insertion uses the webview. |
| [src/editorProvider.ts](../../src/editorProvider.ts) | Document synchronization, file watching, image copying/path settings, link opening and host-message dispatch | External updates are applied/queued; no collaboration engine. `sendToChat` selects source lines and copies text, without calling an AI service. |
| [src/webview/editor.js](../../src/webview/editor.js) | 14,615-line shared editor: parser/serializer, DOM editing, undo, tables, code, diagrams, math, paste, palette, outline, statistics, search/replace | Handwritten parser supports a subset. It normalizes Markdown on serialization; exact source preservation and full CommonMark/GFM conformance are not established. |
| [Parser](../../src/webview/editor.js#L1319), [math](../../src/webview/editor.js#L2675), [serializer](../../src/webview/editor.js#L5343) | Direct evidence for supported notation and round-trip behavior | Reference links, footnotes, wikilinks, raw HTML and front matter do not receive the specialized treatment implied by a broad Markdown compatibility claim. |
| [src/webview/styles.css](../../src/webview/styles.css), [shared body](../../src/shared/editor-body-html.js) | Themes, toolbar, sidebar, editable body, source textarea, case/whole-word/regex search controls | Body requests browser spellchecking; dictionary behavior was not validated. Word count is whitespace-based, with character and line counts also displayed. |
| [src/webviewContent.ts](../../src/webviewContent.ts) | Injects editor, host bridge, bundled Mermaid/KaTeX/Turndown assets and content | Core libraries are local, but the VS Code page also requests Google Fonts and permits remote images; fully network-independent behavior was not established. |
| [src/shared/outline-state-store.js](../../src/shared/outline-state-store.js), [host bridge](../../src/shared/host-bridge.ts) | Separates document/UI state and host communication; stores outline visibility at file or global scope | Persistence is a VS Code host feature. |
| [src/i18n/messages.ts](../../src/i18n/messages.ts), locale files, `package.nls*.json` | Seven runtime languages and seven Settings catalogs; editor language and VS Code display language are independent | English fallback exists. Not every hard-coded label is necessarily translated. |
| [electron/src/main.ts](../../electron/src/main.ts), file manager, menus, settings, preload and HTML generator | Shared editor hosted in Electron, native file dialogs, saving, file watcher, preferences and multiple windows | Desktop must be evaluated separately. [Preload](../../electron/src/preload.ts#L12) explicitly makes outline persistence and chat handoff no-ops. |
| [electron/package.json](../../electron/package.json), [updater](../../electron/src/updater.ts), [release workflow](https://github.com/BinaryOutlook/binary-markdown/blob/9ff6ce04fa10cc5424783b016330bc4644d3529f/.github/workflows/release-electron.yml) | macOS/Windows/Linux packaging targets and GitHub release checks | Update checker opens a download page, rather than installing updates. Build targets are not proof of working installers. No PR test workflow was found in the tracked workflow directory. |
| [scripts](../../scripts), `build-locales.js`, TypeScript configs | Compile TypeScript/locales, copy shared code and vendor libraries, package a VSIX | `watch` only watches TypeScript. The 14,615-line editor JavaScript is outside the configured TypeScript lint command. |
| [test](../../test), [playwright.config.ts](../../playwright.config.ts) | Unit checks and 667 discovered browser cases across 59 files; editing, copying, lists, tables, paste, palette and round-trip scenarios | Standalone Chromium fixture, not a native VS Code/Electron end-to-end test. Some files are diagnostic tests; test count is not a coverage percentage. |
| README, editor guide, migration/test documents, website, [archive](../../archive/README.md), acknowledgments/license | Installation, usage, historical provenance and fork attribution | Archived claims are not current support commitments. Current guide also contains behavior mismatches listed below. |

Local checks and documentation discrepancies follow. Checks ran on macOS using Node.js 25.3.0; the repository's `.node-version` specifies 20.20.0. These results do not establish behavior on every supported runtime or operating system.

| Check / claim | Observed result | Meaning |
| --- | --- | --- |
| Extension compilation and localization build | Passed | Current source assembles locally. |
| Electron TypeScript check | `tsc --noEmit -p electron/tsconfig.json` passed | Type checking only; installers/native UI not exercised. |
| Configured lint | 0 errors, 10 warnings | Existing warnings remain; scope is TypeScript under `src`. |
| Unit checks | **13 passed**: outline 7, identity 3, localization 3 | Fresh results, not copied from prior release notes. |
| Full Chromium suite | **662 passed, 4 skipped, 1 failed** out of 667 cases; 5.2 minutes | The suite is not green. The failure is the Perplexity keyword-color assertion in `test/specs/perplexity-highlight-test.spec.ts`. |
| Follow-up Chromium color probe | Fixture: keyword and base text both `rgb(36, 41, 47)`. With production CSS: keyword `rgb(215, 58, 73)`, base text `rgb(26, 26, 26)` | The fixture omits production highlighting CSS. The isolated probe establishes distinct colors with the actual stylesheet; the original suite remains failing and was not modified. |
| Twelve direct parser probes | Confirmed ordinary elements plus the limitations described above | Exercised actual parser functions extracted from the source, not a replacement parser. |
| Four shared-editor/KaTeX probes | Single fenced equation rendered; two lines rendered separately; multiline `aligned` produced four errors; dollar notation produced no math elements | Used the actual editor and bundled KaTeX in a simulated DOM. This checks parsing/rendering logic, not native UI layout. The regular standalone test fixture does not load KaTeX. |
| “YAML front matter” | `---` becomes horizontal rules; metadata becomes ordinary paragraphs | No protected metadata block was found. |
| “Insert TOC” | `[TOC]` remains literal text | Outline navigation works independently; a generated contents list does not. |
| “Expand code into a separate VS Code tab” | Button toggles the block's width within the rendered editor | The guide overstates this behavior. |
| “Review/accept/dismiss external changes” | VS Code applies or queues updates; the toast is an informational message | The described confirmation workflow was not found in the inspected path. Concurrent-edit conflict safety was not validated. |

Practical positioning, inferred from the implementation and documented comparisons:

| Comparison | Assessment |
| --- | --- |
| Best current use for Binary Markdown | Free rendered editing of ordinary Markdown within a coding workspace, especially tables, code snippets and Mermaid diagrams. |
| Compared with Mark Sharp Basic | A meaningful free alternative when visual table editing and image/diagram insertion matter. |
| Compared with Mark Sharp Premium | Similar core visual editing at zero license cost, with gaps in syntax coverage, folding, block rearrangement and theme integration. |
| Compared with Typora | Useful for VS Code-centered work; substantially less complete for mathematical coursework, metadata-rich documents and publishing/export. |

**Recommended implementation order and five-star evaluation.** The ranking covers missing or incomplete capabilities, plus the reliability and distribution work needed to make them useful. It assumes the primary audience writes technical documents and study notes in VS Code. Difficulty estimates a dependable first implementation in this codebase, including editing, serialization, undo and relevant validation. Impact estimates improvement to this product; it is a judgment, not measured customer demand or a claim of market uniqueness.

| Rating | Implementation difficulty | Product impact |
| --- | --- | --- |
| ★☆☆☆☆ | Small, localized change | Minor improvement |
| ★★☆☆☆ | Bounded feature using existing structures | Useful convenience |
| ★★★☆☆ | Several interacting components or notable edge cases | Meaningful workflow improvement |
| ★★★★☆ | Substantial parser, editor, host or platform integration | Major improvement in trust, adoption or document coverage |
| ★★★★★ | Architectural work with extensive compatibility cases | Unlocks a substantially more complete workflow for the assumed audience |

Rows are ordered by recommended implementation priority, accounting for dependencies, user benefit and effort. They are not sorted by impact alone. A four-star reliability requirement can therefore precede a five-star feature. Distribution is explicitly labeled because it affects adoption without adding editing capability.

| Order | Capability / work item | Difficulty | Impact | Scope and reason for this position |
| --- | --- | --- | --- | --- |
| **1** | **Reliable saving, undo and external-change handling** | ★★★★☆ | ★★★★☆ | Verify pending edits are flushed on save/close, dirty-document conflicts are handled deliberately, and undo behaves correctly in native VS Code. Current synchronization paths need validation; this is not a claim of demonstrated data loss. Trust is a prerequisite for every feature below. |
| **2** | **Standard inline/display math and multiline LaTeX** | ★★★★☆ | ★★★★★ | Support `$…$`, `$$…$$` and whole-expression rendering with preserved source. This makes ordinary mathematical notes usable. KaTeX is already bundled, but delimiter parsing, cursor behavior, undo and serialization require editor integration. |
| **3** | **Protected YAML front matter** | ★★☆☆☆ | ★★★★☆ | Recognize the leading metadata block and preserve its exact text through visual edits and source switching. A protected source block is sufficient initially; a metadata form is unnecessary. Removes a barrier for documentation and publishing files. |
| **4** | **PDF and self-contained HTML export** | ★★★★☆ | ★★★★★ | Turn the placeholder command into a complete write-to-share workflow, including local images, math, Mermaid, styles and sensible page breaks. HTML is the first deliverable; reliable PDF generation also needs a host/export-engine decision. |
| **5** | **Footnotes and reference-style links** | ★★★★☆ | ★★★★☆ | Parse and preserve document-wide definitions, resolve references and provide navigation/editing. Broadens academic and long-form writing compatibility. More involved than replacing inline text with HTML. |
| **6** | **Generated, maintained table of contents** | ★★☆☆☆ | ★★★☆☆ | Reuse heading discovery to generate a linked contents list, update it after heading edits and serialize it predictably. Keep the existing outline as navigation. This closes a visible placeholder at relatively low cost. |
| **7** | **Marketplace / Open VSX release readiness — distribution** | ★★☆☆☆ | ★★★★☆ | Verify current listings, finish package metadata and release checks, then publish through an authorized release process if needed. Easier installation can improve adoption; availability and store acceptance are not established by this audit. |
| **8** | **GitHub alerts / callouts** | ★★☆☆☆ | ★★★☆☆ | Recognize common blockquote markers, apply clear styling and retain the original syntax on save. A bounded improvement for readable technical notes without introducing a new document model. |
| **9** | **Broader CommonMark/GFM fidelity and source preservation** | ★★★★★ | ★★★★☆ | Improve nested structures, soft breaks, escaping and preservation of unsupported constructs. The handwritten parser and serializer make this architectural work. Build it incrementally with representative documents; do not require a wholesale rewrite before shipping the earlier bounded fixes. |
| **10** | **Heading-section folding** | ★★★☆☆ | ★★★☆☆ | Collapse sections while retaining their content in serialization, search and outline navigation. Helps long documents, but does not expand the set of document formats users can edit. |
| **11** | **Cursor-preserving visual/source switching** | ★★★★☆ | ★★★☆☆ | Map positions between Markdown and rendered DOM, including tables, code and math. The current toggle has no explicit position mapping. Valuable polish, but reliable mapping is harder than a simple view toggle. |
| **12** | **VS Code theme and font integration** | ★★☆☆☆ | ★★★☆☆ | Add a host-following appearance option while keeping existing themes. Handle live changes and readable syntax/selection colors. Improves integration with the user's workspace without changing document semantics. |
| **13** | **Focus, typewriter and read-only modes** | ★★★☆☆ | ★★☆☆☆ | Begin with read-only and focus controls, then typewriter scrolling. Useful writing comfort, but lower priority than compatibility and export. Read-only mode alone would be easier than this combined scope. |
| **14** | **DOCX / EPUB export through optional Pandoc** | ★★★☆☆ | ★★★☆☆ | Detect an installed converter, pass document/assets safely and report conversion errors. Broadens publishing after PDF/HTML works. This estimate assumes an external Pandoc dependency, not building a converter or promising lossless format conversion. |
| **15** | **Drag handles for block rearrangement** | ★★★★☆ | ★★★☆☆ | Move blocks with coherent undo, selection and list/table boundaries; provide a keyboard equivalent. Helpful editing convenience, with substantial interaction edge cases in the current DOM-based editor. |
| **16** | **Wikilinks and workspace backlinks** | ★★★★☆ | ★★★☆☆ | Add link resolution and an updating workspace index. Basic wikilink rendering is smaller; backlinks require file-rename, ambiguity and indexing behavior. Prioritize higher only if interconnected notes become the product's focus. |
| **17** | **Controlled raw-HTML blocks** | ★★★☆☆ | ★★☆☆☆ | Preserve source and render a defined, sanitized subset within webview restrictions. Expands compatibility, but unrestricted HTML is outside this scope. Less important for the assumed audience than ordinary Markdown features. |
| **18** | **Standalone Electron release maturity** | ★★★★☆ | ★★☆☆☆ | Finish host feature parity and validate native save/conflict behavior, packaging and releases across target operating systems. Sources and build targets already exist. Rank higher only if a standalone Typora alternative becomes the primary strategy. |
| **19** | **Browser-hosted VS Code support (`vscode.dev`)** | ★★★★☆ | ★★☆☆☆ | Provide a browser entry and replace Node-dependent filesystem/host assumptions, including asset handling and settings persistence. Useful reach, but a separate platform effort after the desktop extension is dependable. |

**Recommended next milestone:** establish the reliability baseline, then deliver standard math, protected front matter and HTML/PDF export (rows 1–4). These address the strongest barriers to using Binary Markdown for a complete technical-writing workflow. Footnotes/reference links and a real TOC follow; distribution can be prepared alongside implementation and completed after release checks pass.

Within the math work, stop splitting fenced equations into separate lines first: that bounded correction is approximately **★★☆☆☆ difficulty / ★★★★☆ impact** for mathematical documents. It is a useful early delivery, but it does not by itself implement `$…$` or `$$…$$`. The broader row remains four-star difficulty because it includes reliable visual editing and round trips. [KaTeX's delimiter helper](https://katex.org/docs/autorender) provides rendering support, rather than this editor's complete editing model.

Before extending the test suite, repair the known fixture mismatch and load the production rendering assets, including KaTeX. Add representative native VS Code save/conflict checks and a PR test workflow; correct the documented behavior mismatches identified above. These are part of release readiness, not evidence that a new end-user feature has shipped.

The five-star impact ratings for math and export depend on the technical/study-document audience. For users who mostly edit short README files, both would be closer to three stars, and distribution, source switching and theme integration would move up. Broader parser fidelity should be improved throughout the roadmap whenever a feature touches parsing or serialization. Optional [Pandoc conversion](https://pandoc.org/MANUAL.html) can reduce implementation effort for additional formats, but its own documentation cautions that conversions need not retain all formatting details.

This is a feature and implementation assessment, not a performance benchmark, security audit, or certification of cross-platform behavior. Application code was not changed for this report.
