# Binary Markdown changelog

## Unreleased

- Default PDF export to a white page with readable GitHub light appearance; disable `binary-markdown.export.pdfWhiteBackground` to retain the editor theme.
- Fill themed PDF pages through every margin and the unused final-page area while keeping the existing text margins.
- Capture export appearance before asynchronous rendering so generated diagrams follow the selected PDF appearance without changing the editor. DOCX retains its existing white-page styling.

## 0.2.0

This version combines export, license/branding/documentation alignment, and VSIX automation. The 0.1.0 prerelease predates these changes; the [validation record](docs/validation/0.2.0.md) records evidence and remaining scope. Published artifacts and their exact source are listed on [GitHub Releases](https://github.com/BinaryOutlook/binary-markdown/releases).

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

See [export setup](README.md#experimental-export), the [implementation outline](docs/export-subsystem.md), and the [validation checklist](docs/export-validation.md).

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

Manual testing of copy and outline behaviours was confirmed on **VS Code 1.136.0 / macOS** before this naming migration. The renamed build requires a new manual sign-off; see the [test record](docs/copy-paste-test.md).

After the migration, the extension and Electron sources compiled, 61 targeted browser tests and 10 unit/registration checks passed, and a native VS Code coexistence smoke test passed alongside Any Markdown 0.195.392. Lint reported 10 warnings and no errors. Desktop installers and the full browser suite were not validated for this rename.
