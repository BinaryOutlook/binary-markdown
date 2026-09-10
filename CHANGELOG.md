# Binary Markdown changelog

## Unreleased — experimental export subsystem

Implemented and verified on `export-subsystem` for local desktop VS Code on macOS, including installed-package, W-30 and representative Word/Apple Books checks. Human acceptance and release remain pending; these changes are not part of the existing `0.1.0` prerelease download.

- Add a sharing-arrow menu for standalone HTML, rendered PDF, Word (.docx), and EPUB.
- Require a named saved document, capture one revision per job, and preserve ongoing editing state.
- Detect installed Pandoc and Chrome/Chromium/Edge, with machine-specific executable settings and setup guidance. Native binaries remain user-installed.
- Save beside the source using collision-safe output-byte hashes, identical-file reuse and numbered suffixes.
- Add real stage reporting, cancellation, original-resolution resource preparation, explicit fallbacks and completed-artifact integrity checks.
- Freeze mixed-content, fallback, pagination and complex-report fixtures for reproducible validation.

See [export setup](README.md#experimental-export--unreleased), the [implementation outline](docs/export-subsystem.md), and the [validation checklist](docs/export-validation.md). This entry records branch work, not release acceptance.

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
