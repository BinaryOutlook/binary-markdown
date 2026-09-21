# Table source preservation investigation

Date: 2026-09-21. Status: observed parser/serializer limitations and browser reproduction; no table serialization fix proposed by this record. The [editor guide](../../docs/editor-guide.md#table-source-preservation) gives the current user-facing disclosure.

The reported interaction is to add a space, remove it, and save a document containing a table. Its visible content appears unchanged, but table source layout changes and produces a Git diff. This investigation separates source formatting from content and alignment compatibility. It concerns the shared editor's Markdown conversion, rather than an operating-system kernel or Git formatting preference.

## Revisions and evidence boundary

The isolated probe compared baseline `19b276f3b819b9549e3a9e06d2dc967d8187ec06` with integration `daad869cd604a824423a5eca77a5d9acb861ed5d`. It ran on macOS with Node 24.21.0 and the checkout's existing Acorn 8.15.0, JSDOM 27.4.0, and markdown-it 14.3.1 dependencies. It extracted the actual table parsing, inline parsing, and table serialization functions from each revision, rendered synthetic table rows, constructed their DOM with JSDOM, and serialized that DOM. Math scanning was disabled for these math-free cases; no interactive browser or extension host was involved.

All seven cases below produced identical results on the two revisions. This establishes that these conversion behaviors predate the #19–#40 integration. It does not establish which original upstream change introduced each behavior. The markdown-it comparison is a second local renderer observation, not an exhaustive GFM conformance test.

The isolated conversion probe did not exercise typing, Undo, host synchronization, actual file saves, exports, or screen readers. The separate Chromium trials below cover interaction and the emitted save payload. Installed VS Code/Electron file saves remain unverified in this investigation. No result here is a promise that every table format is preserved or that every source difference changes meaning.

## Browser interaction observations

Six trials used the integration revision's production editor JavaScript, shared editor markup, styles, and test host bridge with Playwright 1.58.1 and its Google Chrome for Testing 145.0.7632.6 browser on macOS ARM64 with Node 24.21.0. Each trial started with a fresh page and the same padded table plus a sentence outside it. Pointer/keyboard interaction performed the edit and save; the result was the content of the bridge's emitted save message. These observations do not establish that an installed extension wrote the same bytes to disk.

| Fresh-page trial | Save payload exactly matches original | Observed outcome |
| --- | --- | --- |
| Open and save without editing | Yes | Original table source retained. |
| Add a space to the paragraph, remove it with Backspace, then save | No | Table padding and alignment-separator spelling normalized, despite the restored paragraph text. |
| Add a space inside a cell, remove it with Backspace, then save | No | Table source normalized. |
| Add a space to the paragraph, use Undo, then save | Yes | Original source retained in this trial. |
| Switch immediately to Source, add a space and remove it with Backspace, then save | Yes | Source already matched the original before the edit and remained unchanged afterward. |
| Switch immediately to Source and save without editing | Yes | Original source retained. |

Fresh contexts matter: replacing the fixture through a test setter does not reset every edit/save state field. Only fresh-page outcomes are included above. Source mode should be entered before any visual edit when checking the source-only control. It does not recover original table formatting once visual serialization has occurred. The successful Undo trial is evidence for this specific interaction, not a promise about every undo sequence.

## Conversion observations

| Case | Observed on baseline and integration | Meaning |
| --- | --- | --- |
| Padded columns and long alignment separators | Cell padding and separator lengths are reconstructed; explicit left alignment becomes the default separator. | Source layout changes even when the tested cell text and body alignment remain the same. |
| Alternate bold and italic markers | `__bold__` becomes `**bold**`; `_italic_` becomes `*italic*`. | The tested formatting remains visible, but its source spelling changes. |
| Escaped pipes in plain and bold text | The tested pipes remain escaped in serialized Markdown and render in their original cells. | This narrow case passed; it does not cover every escape sequence. |
| Empty cell | The parser's editable placeholder becomes literal `<br>` in source. | Empty source changes to explicit HTML; appearance also depends on whether the reader permits HTML. |
| Header-only table with center/right alignment | Both alignment separators become `---`. | Alignment information is lost, beyond a padding preference. |
| Unescaped pipe inside inline code | The editor treats it as part of one cell and serializes it without escaping. | The local markdown-it table parser instead splits at that pipe. |
| Escaped pipe inside inline code | Source retains the escape, but the editor displays the backslash inside code. | The local markdown-it parser displays only the pipe, matching the GFM example. |

For example, the padded input:

```markdown
| Name       | Value     |
| :--------- | --------: |
| Alpha      | 7         |
```

serializes as:

```markdown
| Name | Value |
| --- | ---: |
| Alpha | 7 |
```

The [GFM table specification](https://github.github.com/gfm/#tables-extension-) permits differently sized cells, optional outer pipes, and tables without body rows. It specifies escaping a pipe within a cell, including inside code and other inline spans. Compare these pipe cases separately:

```markdown
| Case | Sample |
| --- | --- |
| Unescaped code pipe | `a|b` |
| Escaped code pipe | `a\|b` |
```

The first data row is accepted as one code-containing cell by the tested editor but is not portable GFM. The second retains portable source syntax in the tested round trip, while the editor's displayed code includes an extra backslash. This difference already exists on the baseline; it is not caused by the underline command.

## Why an unrelated edit can change a table

The shared [editor implementation](../../src/webview/editor.js) keeps original document text while the visual source is current. `readCommittedMarkdown` uses that original text until edits require serialization. The visual `input` handler calls `markAsEdited`, which clears `visualSourceCurrent`; deleting the just-added character does not compare the resulting DOM with the original source.

`htmlToMarkdown` serializes every top-level editor child, including untouched tables. `renderTable` trims cell text and retains parsed content and body-cell alignment without retaining the original table source. `mdProcessTable` then rebuilds row padding and separator spelling. It obtains alignment from the first body row, explaining the loss when no body row exists. The parser's empty-cell placeholder is also serialized as a line-break tag.

The save path reads this committed Markdown; visual-editor blur can also serialize and synchronize it before an explicit save. This source trace explains the browser result and why an unrelated reversible edit can trigger the conversion behavior. It does not substitute for recording actual event ordering in each installed host. Source mode reads its text directly, but switching to Source after a visual edit first captures the visual serialization.

## Reproduce and classify the report

Use a disposable copy of [D41 in the Markdown demonstrator](../../test/fixtures/manual/editor-export-demonstrator.md#d41--table-source-preservation-investigation). Follow the [manual review setup and exact source comparison](../../docs/testing/manual-feature-review.md#run-the-source-validator), recording the build, host, settings, and baseline file. Start each trial in a fresh editor context with a fresh fixture copy:

1. Open and save without an edit.
2. Add a space to the sentence outside the table, remove it with Backspace, and save.
3. Repeat inside a table cell.
4. Add a space and use Undo instead of Backspace, then save.
5. Switch immediately to Source before any visual edit, and repeat the reversible edit as a control.
6. Switch immediately to Source and save without editing.

Repeat the trials with padded columns, alternate inline markers, ordinary escaped pipes, empty cells, and a table without body rows. Use the separate pipe example above for compatibility checks. Inspect both exact source and rendered cell content/alignment; a visually similar table does not establish unchanged source. The comparison validator detects byte differences and does not decide whether they are cosmetic, semantic, or intentional.

Retain synthetic before/after files and report each interaction independently. Opening without editing, reversing by Backspace, reversing by Undo, and editing in Source mode are different cases. Do not replace an untested path with a general pass or failure.

## Bounded follow-up

First repeat the browser interactions against actual saved files in identified installed hosts. Then separately decide how to preserve unchanged blocks' original source and how deliberately edited tables should serialize. Address alignment retention, empty-cell placeholders, and code-pipe handling with their own acceptance cases. Source preservation and GFM compatibility are related requirements but cannot be established by a single whitespace-insensitive comparison.

This record adds disclosure and reproducible examples. It does not introduce a serializer rewrite, accept existing defects as a regression contract, or claim a completed compatibility fix.
