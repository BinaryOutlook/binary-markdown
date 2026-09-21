# Editor and export demonstrator

Use a disposable copy of this file with the [manual validator and review checklist](../../../docs/testing/manual-feature-review.md). Each D-number identifies the corresponding issue; D41 records the newly reported table source-preservation investigation. These are test inputs and expected behaviors, not recorded passes. Preserve meaningful blank lines, tabs, and table padding in the source.

## D19 — Blockquote contrast

Cycle through the seven editor themes. Read the normal text, nested quote, link, and inline code. All should remain legible.

> A readable quotation with **bold**, *italic*, [a link](https://example.com/), and `inline code`.
>
> > A nested quotation: café, 中文, and 123.

## D20 — One-selection table placement

Select a cell, open **Table toolbar position**, and choose each placement once. The controls should move immediately and the choice should survive reopening.

| Name | Value |
| --- | --- |
| Alpha | 10 |
| Beta | 20 |

## D21 — Table settings icon

Use the table-with-gear control for placement. In a narrow pane, use the ellipsis for additional actions. They should remain distinguishable.

| Settings target | Value |
| --- | --- |
| Select this cell | 21 |

## D22 — Table toolbar overflow

Select a cell and physically resize the window while an action menu is open. All actions should remain reachable as complete buttons or menu entries. Add a row, then undo once.

| One | Two | Three | Four | Five |
| --- | --- | --- | --- | --- |
| Apple | Banana | Cherry | Date | Elderberry |
| 1 | 2 | 3 | 4 | 5 |

## D23 — Wide-table access

Narrow the pane and use horizontal scrolling, Tab, Shift+Tab, and arrows to reach both ends. The table should scroll without shifting surrounding prose.

| First | Second | Third | Fourth | Fifth | Sixth | Seventh | Last |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FIRST-CELL | A moderately long value | Café and 中文 | Another long value | 1234567890 | More visible content | Penultimate value | LAST-CELL |
| Wide cell | ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 | C | D | E | F | G | End |

## D24 — Full and Simple formatting toolbars

Start with no stored toolbar preference, then explicitly choose Simple and Full. Select words below and try formatting, narrow-pane overflow, undo, and redo. Unset should use Full; saved choices should persist.

Format this ordinary sentence. **Bold example**, *italic example*, ~~struck example~~, and `inline code example`.

## D25 — Insert menu

Use the ordinary paragraph below as an insertion target. Try inline equation, block equation, table, code block, link, image, Mermaid, and managed TOC. Undo each insertion before the next trial. Also cancel menus and dialogs; cancellation should not change the document.

INSERT-TARGET: Select these words for a link or inline equation, or place the caret here.

The following objects provide examples to compare with your insertions. For the real image picker, choose a disposable local image or the repository's `media/icon.png`.

An inline equation: $x^2 + 1$.

$$
x^2 + y^2 = z^2
$$

```javascript
console.log('Insert example');
```

```mermaid
graph LR
    A[Start] --> B[Review] --> C[Finish]
```

## D26 — Contextual table row

Choose **Always in top bar**. In Full mode the selected table should have a second toolbar row. Select the paragraph below, then Source mode: the contextual row should disappear. Simple mode uses the primary row.

| Contextual row | Action |
| --- | --- |
| Select this table | Then select the paragraph |

OUTSIDE-TABLE: This paragraph is the non-table focus target.

## D27 — Underline editing in each context

Select only the word `target` using the mouse in each context, then click Underline. Repeat with Cmd/Ctrl+U and with underline enabled before typing. Test applying and removing underline, undo/redo, Source mode, and save/reopen. The reported list/table failure is under investigation; record the actual outcome.

Paragraph target text and <u>already underlined</u> text.

- Bullet target text and <u>already underlined</u> text.
    - Nested bullet target text.

1. Ordered target text.

- [ ] Task target text.

> Quote target text.

| Header target | Existing formatting |
| --- | --- |
| Cell target text | <u>already underlined</u> |
| **Bold target** | *Italic target* |

Literal code must stay literal: `<u>target</u>`.

Check these selections separately: select only `target` in the mixed-code bullet, then select the whole bullet. Only the ordinary-text selection should accept underline; including the code span should show a message and leave the source unchanged.

- Mixed-code target `Widget` words.
- Linked [target](https://example.com/) words.

| Link and code selection | Expected check |
| --- | --- |
| Linked [target](https://example.com/) words. | Underline the link label without changing its destination. |
| Mixed-code target `Widget` words. | Underline ordinary text separately; reject a selection containing code. |

For the linked word, select it with the mouse and press Cmd/Ctrl+U while the pointer remains over the link. Repeat with the pointer moved away, using Things, GitHub, and Perplexity themes. Check that Source contains an explicit `<u>` wrapper, then toggle again and check its removal. A theme's decorative link underline alone is not stored formatting.

## D28 — Default, Full, and Custom widths

Try Default, Full, and Custom widths of 640 and 1200 pixels. Narrow the window and open or close the outline. The column should fit the available pane without changing this paragraph, the current selection, or undo history. This longer sentence makes natural text wrapping easy to see as the available width changes.

## D29 — Column alignment

Choose a capped width and move the column left, center, and right in a wide pane. This moves the column, not the text alignment. Then choose Full width or narrow the pane: extra alignment space should disappear while your preference remains saved.

ALIGNMENT-TARGET: Select these words before changing the preference.

## D30 — Width boundary indicators

Make the pane wider than the active cap. Hover or keyboard-focus the corner marks, read their explanation, and dismiss it with Escape. Try Full width and Source mode, then disable indicators. The marks and their reserved strip should appear only where documented and never become document content.

WIDTH-GUIDE-TARGET: The indicator should not cover this text.

## D31 — Searchable code-language picker

Open the language button and search JS, C++, C#, and an unmatched name. Try keyboard selection and Escape. Only a confirmed new language should change the fence identifier; the code payload must remain intact. The second block tests preservation of a custom identifier.

```javascript
const message = 'café 中文';

console.log(message);
```

```custom_review_language
CUSTOM-LANGUAGE-PAYLOAD
```

## D32 — Language browsing order

On this block, try Default, A–Z, and Z–A. Change the order with a search open. Default browsing starts with Plain text and Markdown; searches still prioritize relevance. Changing order should preserve the query, code, and clean state.

```python
print('Language ordering target')
```

## D33 — Equation-source placement

Click the display equation, select part of its source, and switch Above/Below. Source selection, edit mode, and authored TeX should survive. The inline equation $a+b$ should remain unaffected.

$$
\begin{aligned}
a + b &= c \\
c + d &= e
\end{aligned}
$$

## D34 — Equation-source soft wrapping

Edit the long expression below in a narrow pane. Toggle wrapping in both source positions. Use arrows and Shift selection across visual rows, then copy the source. Visual wraps must not insert authored newlines. Enter adds a real newline; Shift+Enter exits the equation.

$$
\text{Long expression for visual wrapping: } a_1 + a_2 + a_3 + a_4 + a_5 + a_6 + a_7 + a_8 + a_9 + a_{10} + a_{11} + a_{12} + a_{13} + a_{14} + a_{15} + a_{16} + a_{17} + a_{18} + a_{19} + a_{20} = S
$$

## D35 — PDF and DOCX language-label corners

Export with labels at each of the four corners, then hide them. Unset placement should be top-left. Long labels must remain readable; blocks with no declared language must not receive an invented language. Check both light and themed PDF appearance.

```python
print('LABEL-CORNER-TARGET')
```

```custom_language_with_a_deliberately_long_readable_name
LONG-LABEL-TARGET
```

```
NO-LANGUAGE-TARGET
```

## D36 — Logical code-line totals

Enable totals in PDF and DOCX, independently of labels and numbering. The three cases below distinguish an empty block, one authored blank line, and a trailing blank line. The blank lines are intentional; do not let a formatter remove them.

### Empty code (0 lines)

```
```

### One blank line (1 line)

```

```

### Trailing blank line (2 lines)

```text
TRAILING-BLANK-TARGET

```

### Tabs and Unicode (4 lines)

The first code line starts with a real tab. Preserve it, the internal blank line, and the final blank line when exporting or copying.

```python
	message = "café 中文 λ"

    print(message)

```

## D37 — PDF code-line numbering

Enable numbering. The wrapped block has exactly one logical line even when it occupies multiple visual rows. Numbers should restart at 1 for the second block. Copy from the PDF and record whether gutter numbers or whitespace changes enter the clipboard.

### Wrapped code (1 line)

```javascript
const WRAP_TARGET = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty WRAP_END';
```

### Numbering restart (3 lines)

```text
RESTART-ONE

RESTART-THREE
```

## D38 — DOCX reader acceptance

This section supports the numbering investigation; it is not a separate feature switch. Export with numbering enabled. In your named Word or LibreOffice version, insert and remove lines, use Enter and Shift+Enter, edit an empty numbered line, and copy into a plain-text editor. Save and reopen. Record numbering behavior, code text, formatting, and spoken order separately. Highlighting does not recalculate after reader edits.

```python
first = 'FIRST-EDIT-TARGET'

last = 'LAST-EDIT-TARGET'
```

## D39 — DOCX numbering and pagination

Export the long block with numbering off and on, then combine labels and totals. Inspect the first, middle, and last pages. With numbering on, the logical sequence should run from 1 through 150 across page breaks. Inspect where the total lands with numbering off too; a detached footer is a known reader-dependent limitation.

### Multi-page code (150 lines)

```python
print("CODE_LINE_001")
print("CODE_LINE_002")
print("CODE_LINE_003")
print("CODE_LINE_004")
print("CODE_LINE_005")
print("CODE_LINE_006")
print("CODE_LINE_007")
print("CODE_LINE_008")
print("CODE_LINE_009")
print("CODE_LINE_010")
print("CODE_LINE_011")
print("CODE_LINE_012")
print("CODE_LINE_013")
print("CODE_LINE_014")
print("CODE_LINE_015")
print("CODE_LINE_016")
print("CODE_LINE_017")
print("CODE_LINE_018")

print("CODE_LINE_020")
print("CODE_LINE_021")
print("CODE_LINE_022")
print("CODE_LINE_023")
print("CODE_LINE_024")
print("CODE_LINE_025")
print("CODE_LINE_026")
print("CODE_LINE_027")
print("CODE_LINE_028")
print("CODE_LINE_029")
print("CODE_LINE_030")
print("CODE_LINE_031")
print("CODE_LINE_032")
print("CODE_LINE_033")
print("CODE_LINE_034")
print("CODE_LINE_035")
print("CODE_LINE_036")
print("CODE_LINE_037")

print("CODE_LINE_039")
print("CODE_LINE_040")
print("CODE_LINE_041")
print("CODE_LINE_042")
print("CODE_LINE_043")
print("CODE_LINE_044")
print("CODE_LINE_045")
print("CODE_LINE_046")
print("CODE_LINE_047")
print("CODE_LINE_048")
print("CODE_LINE_049")
print("CODE_LINE_050")
print("CODE_LINE_051")
print("CODE_LINE_052")
print("CODE_LINE_053")
print("CODE_LINE_054")
print("CODE_LINE_055")
print("CODE_LINE_056")

print("CODE_LINE_058")
print("CODE_LINE_059")
print("CODE_LINE_060")
print("CODE_LINE_061")
print("CODE_LINE_062")
print("CODE_LINE_063")
print("CODE_LINE_064")
print("CODE_LINE_065")
print("CODE_LINE_066")
print("CODE_LINE_067")
print("CODE_LINE_068")
print("CODE_LINE_069")
print("CODE_LINE_070")
print("CODE_LINE_071")
print("CODE_LINE_072")
print("CODE_LINE_073")
print("CODE_LINE_074")
print("CODE_LINE_075")

print("CODE_LINE_077")
print("CODE_LINE_078")
print("CODE_LINE_079")
print("CODE_LINE_080")
print("CODE_LINE_081")
print("CODE_LINE_082")
print("CODE_LINE_083")
print("CODE_LINE_084")
print("CODE_LINE_085")
print("CODE_LINE_086")
print("CODE_LINE_087")
print("CODE_LINE_088")
print("CODE_LINE_089")
print("CODE_LINE_090")
print("CODE_LINE_091")
print("CODE_LINE_092")
print("CODE_LINE_093")
print("CODE_LINE_094")

print("CODE_LINE_096")
print("CODE_LINE_097")
print("CODE_LINE_098")
print("CODE_LINE_099")
print("CODE_LINE_100")
print("CODE_LINE_101")
print("CODE_LINE_102")
print("CODE_LINE_103")
print("CODE_LINE_104")
print("CODE_LINE_105")
print("CODE_LINE_106")
print("CODE_LINE_107")
print("CODE_LINE_108")
print("CODE_LINE_109")
print("CODE_LINE_110")
print("CODE_LINE_111")
print("CODE_LINE_112")
print("CODE_LINE_113")

print("CODE_LINE_115")
print("CODE_LINE_116")
print("CODE_LINE_117")
print("CODE_LINE_118")
print("CODE_LINE_119")
print("CODE_LINE_120")
print("CODE_LINE_121")
print("CODE_LINE_122")
print("CODE_LINE_123")
print("CODE_LINE_124")
print("CODE_LINE_125")
print("CODE_LINE_126")
print("CODE_LINE_127")
print("CODE_LINE_128")
print("CODE_LINE_129")
print("CODE_LINE_130")
print("CODE_LINE_131")
print("CODE_LINE_132")

print("CODE_LINE_134")
print("CODE_LINE_135")
print("CODE_LINE_136")
print("CODE_LINE_137")
print("CODE_LINE_138")
print("CODE_LINE_139")
print("CODE_LINE_140")
print("CODE_LINE_141")
print("CODE_LINE_142")
print("CODE_LINE_143")
print("CODE_LINE_144")
print("CODE_LINE_145")
print("CODE_LINE_146")
print("CODE_LINE_147")
print("CODE_LINE_148")
print("CODE_LINE_149")
print("CODE_LINE_150")
```

## D40 — Underline in every export format

Export to HTML, PDF, DOCX, and EPUB, then inspect each actual reader. Verify visible underline, combined formatting, links, and Unicode. Literal examples should remain literal; compare their displayed backslashes separately because the format routes differ.

<u>Plain café 中文</u>, <u>**bold** and *italic*</u>, and [<u>linked label</u>](https://example.com/).

- <u>Underlined bullet</u>

> <u>Underlined quotation</u>

| Underlined table | Other text |
| --- | --- |
| <u>Underlined cell</u> | Unchanged |

Literal `<u>example</u>` and \<u>escaped example\</u>.

## D41 — Table source preservation investigation

For an isolated test, copy this section into a new file. Keep a baseline copy. Compare (a) open/save without an edit, (b) add a space to the sentence and remove it with Backspace, (c) repeat inside a cell, (d) add a space and Undo, and (e) repeat in Source mode. After each trial save and compare exact source. Record formatting differences separately from lost content or alignment; a byte difference alone does not establish which occurred.

SPACE-EDIT-TARGET: Add and remove a space in this sentence.

| Name       | Value     |
| :--------- | --------: |
| Alpha      | 7         |
| Beta       | 20        |

Also inspect marker normalization and an empty cell:

| Left      | Center    | Right     |
| :-------  | :-------: | -------:  |
| __bold__  | _italic_  | 7         |
| a\|b      | **c\|d**  | tail      |
| empty     |           | end       |

Finally, check alignment in a table without body rows:

| Center | Right |
| :---: | ---: |

END-OF-DEMONSTRATOR
