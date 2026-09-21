# Review the editor and export demonstrator

Use this guide to review the development features from issues #19–#40 and investigate table source preservation. Open the [Markdown demonstrator](../../test/fixtures/manual/editor-export-demonstrator.md) in Binary Markdown; it has a separate section for every test object. Expected results are acceptance criteria, not a claim that your build or reader passed.

## Prepare an isolated review

1. Follow the [build and install guide](../building.md). Use a separate VS Code profile or the [native harness](../../test/native/export-smoke.md), and record **Binary Markdown: Copy Build Information**. A version number alone does not identify a development build.
2. Use the Node version in `.node-version`. From the repository root, run the commands below to validate and copy the fixture into ignored scratch space. Choose a fresh directory name if you already used this one. Keep its `baseline.md` unchanged.
3. Open `review.md` with Binary Markdown. Use a fresh copy for each independent trial. For a short, focused case, copy just the relevant D-section into a separate named Markdown file and make its own baseline.
4. Record editor host/version, OS, interface language, settings, and reader/version. Use English and another supported locale; test real mouse selection, keyboard navigation, window dragging at 100% and 200% zoom, and IME where available.

```sh
node scripts/validate-manual-review.cjs
mkdir .vscode-test/manual-feature-review
cp test/fixtures/manual/editor-export-demonstrator.md .vscode-test/manual-feature-review/baseline.md
cp .vscode-test/manual-feature-review/baseline.md .vscode-test/manual-feature-review/review.md
```

For the D25 image-picker trial, choose the repository's `media/icon.png` or a disposable local image. Deliberate insertion changes the source, so use a fresh copy for unchanged-source trials.

Editor checks apply to VS Code and Electron. Export checks use supported local desktop VS Code. PDF requires an installed Chrome/Chromium/Edge; DOCX and EPUB require Pandoc. Follow [export help](../../media/export-help.md). Installing converters does not enable export in an unsupported host.

## Demonstrator and manual validator

Mark each row **Pass**, **Fail**, or **Not tested** in your own review record. Keep the source and exported files alongside any failure. The [editor guide](../editor-guide.md) and [export help](../../media/export-help.md) remain the authoritative setting references.

| Section | Test object | Validate |
| --- | --- | --- |
| D19 | Quote contrast | Read nested quotes, links, and code across all seven editor themes. |
| D20 | Placement applied once | Select all eight positions once; check immediate application and reopening. |
| D21 | Distinct settings icon | Distinguish the placement gear from action overflow by pointer and keyboard. |
| D22 | Toolbar overflow | Resize with menus open; reach every action, add a row, and undo once. |
| D23 | Wide tables | Reach both ends and a very wide cell by scrolling and keyboard; surrounding prose stays put. |
| D24 | Full toolbar default | Test unset, explicit Simple, and explicit Full; settings persist without losing selection. |
| D25 | Insert | Try all eight entries, cancellation, retained selection, real image picker, and one-step undo. |
| D26 | Contextual row | Full uses a second docked row; Simple uses the primary row; non-table and Source mode remove the context. |
| D27 | Underline command | Apply and remove underline in paragraphs, bullets, nested/ordered/task lists, quotes, headers, and cells using actual selection, toolbar, shortcut, and caret typing. |
| D28 | Width modes | Test Default, Full, and 640/1200 px Custom; check shrinking, outline changes, and persistence. |
| D29 | Column alignment | Move a capped column left/center/right without changing text alignment; test a narrow pane. |
| D30 | Width guides | Hover/focus/dismiss marks; test hiding them, Full width, Source mode, and content clearance. |
| D31 | Language search | Search aliases and unmatched text; cancel or choose; only a changed language should alter its fence identifier. |
| D32 | Language order | Test Default/A–Z/Z–A with an open query; preserve code, selection, and query. |
| D33 | Equation source position | Change Above/Below during an active selection; retain edit mode, source, and preview. |
| D34 | Equation wrapping | Navigate visual rows in both positions; copying and saving preserve authored spaces and newlines. |
| D35 | Export labels | Inspect all four corners and hidden labels in PDF/DOCX, including unlabeled and long-name blocks. |
| D36 | Line totals | Check 0/1/2-line fixtures, independent label/count/number settings, and no extra count from wrapping. |
| D37 | PDF numbering | Check restarts, blank lines, wrapped continuations, and copied text in an actual PDF reader. |
| D38 | Reader contract | Record Enter, soft breaks, empty numbered lines, copy, editing, and accessibility in named DOCX readers. |
| D39 | DOCX numbering | Inspect 150 logical lines across pages; compare numbering off/on and label/count combinations. |
| D40 | Underline exports | Inspect HTML, PDF, DOCX, and EPUB for underline, combinations, literal examples, Unicode, and links. |
| D41 | Table source preservation | Compare no edit, space/Backspace, space/Undo, cell edit, and Source-mode controls; distinguish layout churn from content/alignment changes. |

For settings, menus, and cancellation, verify that a clean document stays clean. Type a distinctive word, change a display setting, then Undo: Undo should reverse typing rather than an invisible settings step. For real edits, test undo/redo, Source switching, save, close, and reopen. Compare exact code payloads, whitespace, delimiters, and table/list structure where relevant. Do not classify a visually similar result as proof of source preservation.

## Run the source validator

The script checks fixture coverage, balanced fences, and the five declared logical-line counts. It does not run the editor, validate exported binaries, or grant a manual pass.

After a trial that should leave the saved source unchanged, compare its baseline and result:

```sh
node scripts/validate-manual-review.cjs --compare .vscode-test/manual-feature-review/baseline.md .vscode-test/manual-feature-review/review.md
git diff --no-index -- .vscode-test/manual-feature-review/baseline.md .vscode-test/manual-feature-review/review.md
```

The validator exits with 0 for identical bytes, 1 for a difference or invalid fixture, and 2 for usage/read errors. It reports no document contents. The optional Git command displays differences and also exits with 1 when differences exist. Inspect those differences locally before sharing; use only synthetic content in public reports. A source difference may be an intended edit, formatting normalization, or a content defect. This tool does not decide semantic equivalence.

For D36, the closing-fence separator is not a code line. An empty block has adjacent opening and closing fences; a blank-only block contains one physically empty line. Do not trim the fixture's code tails. For D39, the source block has 150 lines including deliberate blank lines. Counts and numbering default off; test them independently from language visibility and placement.

## Record limitations and results

The reported D27 list/table underline failure needs reproduction through the actual interaction; pre-authored `<u>` rendering is a separate check. D41 is an investigation, not a promised source-preservation fix. Record both successful and failing paths rather than replacing either with a general compatibility claim.

DOCX numbering is experimental. Word and stable LibreOffice editing/copying require named-reader observations. A long unnumbered DOCX block can leave its total on the next page. PDF copying can include gutter numbers or altered whitespace. Underline appearance and spoken order require actual readers. The [integration review record](../../reports/validation/2026-09-20-editor-export-stack.md) explains the existing evidence and its boundaries.

Use this result template in your scratch review record:

```text
Section and result: D27 — Pass / Fail / Not tested
Build commit and local-change state:
Editor host, OS, locale, and relevant settings:
Reader and version, if applicable:
Exact actions:
Expected result:
Observed result:
Source comparison and retained synthetic artifacts:
```
