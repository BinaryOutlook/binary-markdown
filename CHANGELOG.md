# Binary Markdown changelog

## Unreleased

Target version: **0.4.0**. See the [release-preparation notes](release-notes/0.4.0.md) for scope, changed defaults, and remaining acceptance work. The earlier [0.4.0 RC1](release-notes/0.4.0-rc.1.md) uses numeric package version `0.4.0`; neither that candidate nor this section establishes an official release.

### Added

- An Insert menu for equations, tables, code blocks, links, images, Mermaid, and a managed TOC.
- Source-preserving `<u>` underline in the editor and existing export formats, with documented reader compatibility limits.
- Full-width/custom-width visual editing, column alignment, and optional capped-width indicators.
- Searchable code-language selection with curated or alphabetical browsing orders.
- Above/below equation-source placement and visual soft wrapping without changing mathematical structure.
- Four-corner PDF/DOCX code-label placement, optional total authored-line counts, and optional per-line numbering.

### Changed

- Preserve unchanged tables' source formatting when editing elsewhere. New or modified tables use aligned Markdown columns by default, with Compact (Legacy) available through the [table source format setting](docs/editor-guide.md#table-source-format).
- Use Full formatting when the toolbar preference is unset, retaining explicit choices and Simple mode; place docked table controls in a contextual second row.
- Default unset PDF/DOCX label positions to top-left. Keep the initial centered 860 px editor cap and leave counts and numbering off by default.
- Check `main` daily for automatic VSIX publication after at least three days since the previous official release. Preserve manual releases, validate bot version bumps through PRs, and reuse the exact tested package and source.
- Make the README a concise installation and feature overview, consolidate settings in the editor guide, and require agents to verify current evidence rather than rely on memory.

### Fixed

- Blockquote contrast across themes and table-toolbar placement that required more than one selection.
- Confusing table settings/overflow controls, inaccessible toolbar actions during resizing, and offscreen cells in wide tables.
- Inline equation edits closing during delayed outline updates or document synchronization; edits remain open and cancellable.
- Numbered DOCX code switching to body text when Enter adds a line at the end of a nonempty code paragraph; the new paragraph retains its code style and native numbering.

### Known limitations

DOCX numbering remains experimental. Enter on an empty numbered line and static totals after reader edits still require acceptance. The [reader checkpoint](reports/validation/2026-09-21-docx-reader-checkpoint.md) records the named Word/LibreOffice results and remaining checks. Historical DOCX pagination observations, PDF gutter-copying behavior, and existing editor concerns are documented in the [0.4.0 notes](release-notes/0.4.0.md#known-limitations). Earlier validation applies only to its recorded source and artifacts.

## 0.3.0

Preserve code-block content through source switching and quoted saves, add configurable table controls, and improve document navigation. See the [release notes](release-notes/0.3.0.md) for details and known limitations.

- Preserve pending edits when switching modes, render indented code fences, restore inactive highlighting, and keep quoted code readable.
- Add automatic and configurable table-toolbar placement, with a compact menu for narrow panes.
- Track the reading position in the outline, offer a configurable highlight color, and add a code-block delete control with Undo support.
- Resolve local file and folder links, show destinations on hover, and offer to copy unavailable targets.
- Share Windows browser capability checks across editors and preserve distinct executable paths.

## 0.2.1

Integrate editor and export improvements with Windows validation. See the [version notes](release-notes/0.2.1.md) for platform scope and known limitations.

- Edit inline and display equations while preserving their source delimiters; render multiline expressions and retain native math in DOCX/EPUB.
- Preserve YAML front matter in a collapsible source editor and refresh managed tables of contents on save, with linked heading destinations in exports.
- Style editable DOCX code blocks and add optional language tabs to DOCX/PDF exports, with a dedicated extension settings shortcut.
- Add an export tutorial and separate the export contract, architecture, verification guide and development history.
- Enable local Windows exports and require the same packaged VSIX to pass Windows, macOS, Ubuntu and minimum-VS-Code validation.
- Preserve edits made after a save when file-watcher notifications arrive late, and serialize webview replacements during rapid settings changes.
- Keep maintained guides in `docs/`, dated evidence in `reports/`, version notes in `release-notes/`, and completed plans in `archive/`; screen public documentation and check local links.
- Default PDF export to a white page with readable GitHub light appearance; disable `binary-markdown.export.pdfWhiteBackground` to retain the editor theme.
- Fill themed PDF pages through every margin and the unused final-page area while keeping the existing text margins.
- Capture export appearance before asynchronous rendering so generated diagrams follow the selected PDF appearance without changing the editor. DOCX retains its existing white-page styling.

## 0.2.0

This version combines export, license/branding/documentation alignment, and VSIX automation. The 0.1.0 prerelease predates these changes; the [validation record](reports/validation/0.2.0.md) records evidence and remaining scope. Published artifacts and their exact source are listed on [GitHub Releases](https://github.com/BinaryOutlook/binary-markdown/releases).

- Add a sharing-arrow menu for standalone HTML, rendered PDF, Word (.docx), and EPUB.
- Explain unsupported hosts before format selection, disable all export formats in remote windows, and keep tool-installation advice specific to supported hosts. Remote-SSH export remains deferred.
- Require a named saved document, capture one revision per job, and preserve ongoing editing state.
- Detect installed Pandoc and Chrome/Chromium/Edge, with machine-specific executable settings and setup guidance. Native binaries remain user-installed.
- Save beside the source using collision-safe output-byte hashes, identical-file reuse and numbered suffixes.
- Add real stage reporting, cancellation, original-resolution resource preparation, explicit fallbacks and completed-artifact integrity checks.
- Freeze mixed-content, fallback, pagination and complex-report fixtures for reproducible validation.
- Adopt AGPL-3.0-or-later, preserving earlier MIT grants and third-party notices; install the supplied 01 / MD artwork.
- Display the supplied logo centered above the README title.
- Stamp source identity and expose **Copy Build Information**, with clear source-build and older-commit support policies.
- Validate one VSIX across Ubuntu/macOS and minimum VS Code, then prepare a maintainer-reviewed release draft with matching source and checksums.
- Move builds to Node 24 LTS, resolve dependency advisories and bundle Mermaid from audited dependencies with complete notices.
- Preserve the extension identity and settings when updating from 0.1.0; defer standalone installers and Marketplace/Open VSX publication.

See [export setup](README.md#experimental-export), the [implementation outline](docs/export-subsystem.md), and the [validation checklist](reports/validation/2026-09-10-export.md).

## 0.1.0 — GitHub prerelease

First independently versioned Binary Markdown build, based on Any Markdown's upstream `main` at `82487429` (package version `0.195.393`). Most editor functionality is inherited from that project.

### Fixes and features

- Preserve newlines and meaningful whitespace when copying code blocks. Proposed upstream in [PR #8](https://github.com/raggbal/any-markdown/pull/8).
- Remember outline visibility per file or globally, with a configurable initial state. Opening the outline no longer marks content as edited. Proposed upstream in [PR #9](https://github.com/raggbal/any-markdown/pull/9).

### Independent identity

- Use `BinaryOutlook.binary-markdown` with display name **Binary Markdown Editor**.
- Move commands and settings to `binary-markdown.*` and the custom editor to `binary-markdown.editor`.
- Keep the custom editor optional; leave existing Markdown editor associations unchanged.
- Use separate Binary Markdown desktop identity and point desktop update checks to this fork.
- Rewrite active documentation and preserve the original presentation and release notes in the [archive](archive/README.md).

This is a separate installation from both the upstream extension and early `BinaryOutlook.any-markdown` test builds. Existing preferences and outline state are not automatically migrated. See [migration instructions](docs/migration.md).

Manual testing of copy and outline behaviours was confirmed on **VS Code 1.136.0 / macOS** before this naming migration. The renamed build requires a new manual sign-off; see the [test record](reports/validation/0.1.0-copy-paste.md).

After the migration, the extension and Electron sources compiled, 61 targeted browser tests and 10 unit/registration checks passed, and a native VS Code coexistence smoke test passed alongside Any Markdown 0.195.392. Lint reported 10 warnings and no errors. Desktop installers and the full browser suite were not validated for this rename.
