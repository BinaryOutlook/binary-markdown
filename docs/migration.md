# Moving to Binary Markdown

Binary Markdown 0.1.0 uses a new installation identity. It does not overwrite either of the earlier packages:

| Package | Extension ID |
| --- | --- |
| Original Any Markdown | `imaken.any-markdown` |
| Early independently named test build | `BinaryOutlook.any-markdown` |
| Binary Markdown | `BinaryOutlook.binary-markdown` |

## Install and select the editor

Install the new VSIX using **Extensions → … → Install from VSIX…**. Open a document and choose **Reopen Editor With… → Binary Markdown**. Existing editor tabs may need to be closed and reopened.

The new package registers `binary-markdown.editor`, separate commands, and separate settings. It can be installed alongside Any Markdown without sharing those registrations. Its editor remains optional and does not change `workbench.editorAssociations` on installation.

If an existing association opens Any Markdown automatically, it will continue to do so. Use **Configure Default Editor… → Text Editor** to restore ordinary editing, or explicitly choose **Binary Markdown** if you want it as your default.

The early `BinaryOutlook.any-markdown` package reused the original IDs. Uninstall that obsolete test build before comparing the original with the new Binary Markdown package.

## Settings

The nine setting suffixes and meanings remain the same; only the prefix changes:

| Previous key | Binary Markdown key |
| --- | --- |
| `any-markdown.theme` | `binary-markdown.theme` |
| `any-markdown.fontSize` | `binary-markdown.fontSize` |
| `any-markdown.imageDefaultDir` | `binary-markdown.imageDefaultDir` |
| `any-markdown.forceRelativeImagePath` | `binary-markdown.forceRelativeImagePath` |
| `any-markdown.language` | `binary-markdown.language` |
| `any-markdown.toolbarMode` | `binary-markdown.toolbarMode` |
| `any-markdown.outlineStateScope` | `binary-markdown.outlineStateScope` |
| `any-markdown.outlineDefaultOpen` | `binary-markdown.outlineDefaultOpen` |
| `any-markdown.enableDebugLogging` | `binary-markdown.enableDebugLogging` |

Copy the values you want into the new settings at the same User or Workspace scope. Leave old settings in place if you still use the original extension. There is no automatic import or write-back to the old keys.

Saved outline visibility belongs to the previous extension's storage and is not automatically copied. Binary Markdown starts with its configured default until you toggle the outline. `file` remembers each document within the workspace; `global` shares the last visibility across documents and workspaces.

Custom shortcuts should target `binary-markdown.*` commands and, when applicable, `activeCustomEditorId == 'binary-markdown.editor'`. The built-in shortcuts already use the new IDs.
