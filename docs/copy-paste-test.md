# Manual testing: code copying and outline behaviour

This document remains a manual testing fixture. Its purpose is to reproduce the behaviour that motivated [PR #8: preserve code-block newlines](https://github.com/raggbal/any-markdown/pull/8), assess why the fix is needed, and compare the original editor with the maintained build. It also covers the outline improvements introduced by [PR #9: persist outline visibility](https://github.com/raggbal/any-markdown/pull/9).

The baseline is upstream `main` at commit `8248742`; the local testing build combines both PR branches. The scenarios below remain available for future regression testing.

## Manual validation status

**Fully tested:** the copy-and-paste and outline-state behaviours covered by this document have been manually tested and confirmed working in the combined build.

| Environment | Value |
| --- | --- |
| VS Code | 1.136.0 |
| Operating system | macOS |

This confirmation applies to the behaviours documented here, before the `binary-markdown` namespace migration. The current settings below use the new names. Repeat the manual checks on version 0.1.0; the previous confirmation is not a manual sign-off of the renamed package. No terminal output or personal information is recorded.

## Automated checks after the naming migration

The Binary Markdown 0.1.0 build passed compilation, 7 outline-state unit tests, 3 registration/identity checks, and 61 targeted browser tests covering code copying, clipboard operations, outline actions, URL pasting, and the command palette. Lint completed with 10 warnings and no errors.

An isolated extension-host check on VS Code 1.136.0 / macOS also confirmed that Binary Markdown 0.1.0 and Any Markdown 0.195.392 activate together, register both command sets, keep their settings independent, and open both editors without marking the test documents as edited. Default editor associations were unchanged. This automated smoke test is separate from the manual results below.

## Previous behaviour and new features

| Area | Previous behaviour | Behaviour to verify in the new build |
| --- | --- | --- |
| Copy code | The Copy button used `textContent`, which could omit rendered line breaks and join commands together. | Commands retain their line breaks, indentation, and meaningful blank lines. |
| Initial outline visibility | A newly created editor view started with the outline open. | The initial visibility can be configured as open or closed when no saved state exists. |
| Remember outline visibility | Toggling the outline did not persist its visibility across recreated editor views. | Visibility is remembered per file in the workspace, or globally across files and workspaces. |
| Open-outline action | The toolbar's open-outline action followed the path that marked content as edited. | Opening the outline is a view-only action and does not mark the Markdown as edited. |

## How to compare

1. The renamed build has separate command, settings, and editor IDs. For a baseline comparison, open each build explicitly through Reopen Editor With. Use separate documents to avoid confusing their saved outline states.
2. Open this document with the Markdown editor and use the code block's **Copy** button, rather than selecting text manually.
3. Paste into a plain text editor first. Compare the line count and whitespace with the source.
4. Repeat after editing a code block. Record the build, reproduction steps, and actual result.

## Three simple commands

These commands list the current directory, move to its parent, and print your username. They do not modify any files. `cd ..` changes only the current terminal session's working directory.

```sh
ls
cd ..
whoami
```

Expected: three separate lines. A result such as `lscd ..whoami` means the line breaks were lost.

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
pwd

whoami
```

## Outline sidebar trial

Use the headings in this document to test the outline. Close it, switch to another document, return here, and reload the window.

- `binary-markdown.outlineDefaultOpen`: `true` starts open; `false` starts closed when no remembered state exists.
- `binary-markdown.outlineStateScope`: `file` remembers each file separately; `global` shares the last visibility across files and workspaces.
- A remembered visibility overrides the default. Use a newly named file in `file` mode to test a fresh default.

Also verify that opening the outline alone does not create an unsaved-change indicator or modify the Markdown file.

## Test observations

The following results record the confirmed manual testing of the combined build. The original behaviour is described above for context; this table does not claim a separate manual retest of the original build.

| Check | Combined build result |
| --- | --- |
| Three commands remain on separate lines | Fully tested — passed |
| Echo block produces three output lines | Fully tested — passed |
| Internal blank line survives copying | Fully tested — passed |
| Default open and default closed apply when no remembered state exists | Fully tested — passed |
| File and global outline-state scopes behave as configured | Fully tested — passed |
| Remembered visibility overrides the default | Fully tested — passed |
| Outline state survives reopening and restart | Fully tested — passed |
| Opening the outline leaves the document unmodified | Fully tested — passed |
