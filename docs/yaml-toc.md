# Front matter and a TOC refreshed on save

Available in the next-version integration candidate. This is development work, not a published release.

## Front matter

Leading YAML mapping metadata is displayed in a collapsible **Front matter** panel. Expand it to edit the original source. Opening or closing the panel is view-only. The editor preserves comments, quotes, field order and indentation rather than parsing and reformatting YAML. Document line endings follow the existing host policy.

```markdown
---
title: "Project report"
tags: [project, report] # Keep this comment
---

# Introduction
```

Only a complete leading `---` block with a `---` or `...` closing delimiter is recognized. The contents must look like a YAML mapping, or be empty/comment-only. This is not a YAML validator, metadata form, tags index or publishing integration. An unfinished opening block and ordinary thematic rules remain visible source. Edit delimiters in source mode when removing or repairing front matter.

Metadata is excluded from the outline, prose statistics and visible HTML/PDF body. DOCX/EPUB retain their existing limited metadata mappings. Metadata edits participate in the document's save and undo behavior.

## Managed table of contents

Use **Binary Markdown: Insert Table of Contents**, the editor's action palette, or place `[TOC]` on its own line. The command inserts at a block boundary near the current position; an existing TOC is refreshed instead of duplicated. In source mode, insertion uses the source cursor. Save or click **↻** beside **Contents** to regenerate it.

The TOC is a snapshot between refreshes. Renaming a heading does not rebuild the list while typing. Saving refreshes it before the write. The same generator is used for the button, save preparation and export freshness checks. Repeated saves with unchanged headings do not rewrite the list.

The source contains ordinary Markdown links inside explicit boundaries:

```markdown
<!-- binary-markdown:toc:start -->
**Contents**

- [Introduction](#introduction)
  - [Scope](#scope)
- [Evaluation](#evaluation)

<!-- binary-markdown:toc:end -->
```

The marked region is generated: edit headings rather than entries, because a refresh replaces its contents. The editor hides boundary comments and adds a keyboard-accessible refresh control. Controls and markers are omitted from exports. Unmarked lists are never treated as generated TOCs. Incomplete/nested boundaries cause an explicit error instead of guessing which document content to replace.

Headings follow the visual editor's existing ATX syntax (`# Heading` through `###### Heading`). Metadata, fenced examples and the TOC itself are excluded. Nested levels are indented, duplicate headings get distinct destinations, and Unicode labels are supported. Renaming/reordering headings can change their anchors; generated links are rebuilt at the next refresh. This does not promise persistent externally published anchors or full CommonMark parsing.

Export still requires a successful save. It verifies the TOC against that saved revision and refuses a stale TOC without changing the source. This covers a save participant being skipped, an external editor leaving old entries, or another save participant changing headings afterward. The freshness guarantee concerns the captured revision; typing after capture does not change an export already in progress.

TOC labels are plain text derived from heading source. Equation notation in a label remains literal (for example, `$x^2$`) even when the heading renders as math; HTML/PDF export reports the visible literal notation with a warning.

HTML/PDF include the list and internal links. PDF page-numbered contents and sidebar bookmarks are outside this change. DOCX/EPUB keep their existing converter and strip only managed boundary comments, retaining the ordinary generated links. Other Markdown viewers display the list according to their own anchor rules.

## Validation

Source tests cover metadata preservation, ordinary rules, incomplete delimiters, fences, duplicate/Unicode anchors, idempotence and stale detection. Browser tests cover metadata/body editing, disclosure state, undo/redo, manual refresh, save-time refresh, source-mode snapshots and export destinations. Host tests exercise both save paths, stale-export refusal and active-editor command routing.

Run `npm run test:document-aux`, the normal unit suite, and `test/specs/document-aux.spec.ts` plus `test/specs/export-editor.spec.ts`. The installed extension harness adds `--suite document-aux`, with native/keyboard saves in visual/source modes and real HTML/PDF/DOCX/EPUB output. See the [branch validation receipt](validation/yaml-toc-2026-09-14.md) for observed results and limitations.
