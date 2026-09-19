# Manual fixture: code copying and outline state

Copy this document into a fresh test workspace and open it with Binary Markdown. Use the [contributor setup](../../../CONTRIBUTING.md#package-and-test) and record the tested source/package and observed results. These are reusable inputs, not a standing pass claim. Earlier results are in the [0.1.0 report](../../../reports/validation/0.1.0-copy-paste.md).

## How to compare

1. For a baseline comparison, use isolated profiles and explicitly choose each editor through **Reopen Editor With**. Use separate documents to avoid confusing their saved outline states.
2. Open this document with the Markdown editor and use the code block's **Copy** button, rather than selecting text manually.
3. Paste into a plain text editor first. Compare the line count and whitespace with the source.
4. Repeat after editing a code block. Record the build, reproduction steps, and actual result.

## Three simple commands

These commands print synthetic text. They do not read account information or change files.

```sh
echo alpha
echo beta
echo gamma
```

Expected: three separate lines. A result such as `echo alphaecho betaecho gamma` means the line breaks were lost.

## Predictable output

This block does not change your working directory. Run it in a macOS or Linux shell to check the output.

```sh
echo "First line"
echo "Second line"
echo "Third line"
```

Expected terminal output:

```text
First line
Second line
Third line
```

## Blank-line preservation

Copy this block into a plain text editor and check that the empty line remains.

```sh
echo before

echo after
```

## Outline sidebar trial

Use the headings in this document to test the outline. Close it, switch to another document, return here, and reload the window.

- `binary-markdown.outlineDefaultOpen`: `true` starts open; `false` starts closed when no remembered state exists.
- `binary-markdown.outlineStateScope`: `file` remembers each file separately; `global` shares the last visibility across files and workspaces.
- A remembered visibility overrides the default. Use a newly named file in `file` mode to test a fresh default.

Also verify that opening the outline alone does not create an unsaved-change indicator or modify the Markdown file.
