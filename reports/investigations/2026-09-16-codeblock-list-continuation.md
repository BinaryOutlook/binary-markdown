# List continuation follow-up for issue #5

Investigated on 2026-09-16 UTC after the fence-recognition fix on `fixes/codeblock-v0.2.1`. This is an investigation, not a list-parser fix. All examples are synthetic.

## Observed boundary

The production editor script was exercised in Chromium, including its DOM-to-Markdown serializer. Each example contains two list items separated by an indented continuation block.

| Input | Top-level lists | Rendered code blocks | Code blocks inside list items | Serialized result |
| --- | ---: | ---: | ---: | --- |
| Ordered list, continuation paragraph | 2 | 0 | 0 | Paragraph loses indentation; both items use `1.` |
| Ordered list, three-space fenced code | 2 | 1 | 0 | Code survives as a top-level block; both items use `1.` |
| Unordered list, two-space fenced code | 2 | 1 | 0 | Code survives as a top-level block outside both list items |
| Ordered list starting at `10.`, four-space fenced code | 2 | 0 | 0 | Fence remains prose in preview; original numbering is lost |

For example:

````markdown
1. First

   ```
   alpha
   ```

2. Second
````

The narrower fence fix now recognizes this code, but it cannot establish that the block belongs to the first list item. Consequently, issue #1 does not resolve [issue #5](https://github.com/BinaryOutlook/binary-markdown/issues/5).

## Cause and proposed separate change

In [editor.js](../../src/webview/editor.js), the list stack records list type and a nesting level derived from two-space increments. It does not retain the content indentation implied by each marker. Blank-line lookahead accepts some following list markers and math blocks, while ordinary continuation content closes the lists. Opening a fence also closes every list.

The serializer has a second limitation: `mdProcessListItem()` collects inline content, nested lists, and math blocks, rather than preserving an ordered sequence of arbitrary child blocks. The ordered-list serializer starts its counter at one. A parser-only patch would therefore be incomplete.

A separate implementation should:

1. Track each item's marker width and content indentation. Resolve a fence's indentation relative to its owning container before applying fence rules.
2. Keep continuation paragraphs and blocks inside the correct item, including across blank lines, while preserving loose/tight and nested list structure.
3. Serialize child blocks in their original order, with valid continuation indentation and the ordered list's starting number.

Required regressions include ordered/unordered/task lists, multi-digit starts, nested mixed lists, paragraphs before and after code, tabs, blank lines, math, tables, source switching, unrelated edits followed by save/reopen, undo/redo, and existing list keyboard operations. This work needs a separate reviewed scope; widening the fence regex or globally trimming whitespace is insufficient.
