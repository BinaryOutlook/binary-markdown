<p align="center">
  <img src="media/icon.png" alt="Binary Markdown logo: 01 above MD" width="160" height="160">
</p>

# Binary Markdown Editor

An open-source visual Markdown editor for VS Code. Write in a rendered view, switch to source when needed, and work with tables, code, equations, and diagrams in the same document.

[Download a release](https://github.com/BinaryOutlook/binary-markdown/releases) · [Documentation](docs/README.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/BinaryOutlook/binary-markdown/issues)

Built on [Any Markdown by raggbal and contributors](https://github.com/raggbal/any-markdown), which provides the visual editor and much of its existing functionality under MIT. BinaryOutlook independently maintains Binary Markdown's changes, releases, and support. See [Acknowledgments](ACKNOWLEDGMENTS.md) for provenance.

**Development status:** the latest published baseline is [0.4.0](https://github.com/BinaryOutlook/binary-markdown/releases/tag/v0.4.0). This source also includes unreleased paragraph-rendering and table-source-formatting changes described in the [changelog](CHANGELOG.md#unreleased). Locally built packages are development snapshots; choose published packages from GitHub Releases and check their own notes.

## Install

Use local desktop VS Code **1.85.0 or later**. Validation targets Windows x86-64, macOS ARM64, and Ubuntu x86-64; each release identifies the environments actually tested. Standalone Electron installers and other editors require separate validation.

1. Download the `.vsix` and its SHA-256 checksum from [GitHub Releases](https://github.com/BinaryOutlook/binary-markdown/releases), or [build from source](docs/building.md). Follow the [checksum instructions](docs/building.md#inspect-and-install-the-output) before installing.
2. In VS Code, open **Extensions**, choose **… → Install from VSIX…**, select the package, and reload if prompted.
3. Open a Markdown file and choose **Reopen Editor With… → Binary Markdown**.

The extension ID is `BinaryOutlook.binary-markdown`. Installation leaves your default Markdown editor unchanged; use **Configure Default Editor…** if you want Binary Markdown to open every Markdown file. Updating this extension retains its identity and settings. For older Any Markdown or test-build IDs, follow the [migration guide](docs/migration.md).

## Features

- **Visual and source editing:** semantic paragraphs and lists, preserved source for unchanged blocks, links, images, blockquotes, and a navigable outline with remembered visibility.
- **Formatting and tables:** a Full or Simple toolbar, an Insert menu, HTML-backed underline, responsive table controls, horizontal scrolling for wide tables, and aligned or compact source formatting for edited tables.
- **Code and equations:** syntax highlighting, searchable language selection, accurate multiline code copying, editable KaTeX source, and Mermaid diagrams.
- **A configurable writing space:** themes, seven interface languages, full or capped column width, column alignment, and optional width guides.
- **Document structure:** protected YAML front matter and a generated table of contents refreshed on save or on request.
- **Experimental export:** local HTML, PDF, Word, and EPUB conversion, with PDF/DOCX code labels, optional line counts, and optional numbering.

These features describe the current source. The [changelog](CHANGELOG.md) separates unreleased changes from published versions. In 0.4.0, unset toolbar preferences use Full mode and unset export-label positions use top-left; explicit saved choices remain honored. Width still starts at a centered 860 px cap, and line counts and numbering remain off by default.

## Configure the editor

Open **Settings** (`Cmd+,` on macOS or `Ctrl+,` on Windows/Linux) and search for **Binary Markdown**. The [editor settings reference](docs/editor-guide.md#vs-code-settings) lists defaults and explains outline state, table controls and source formatting, layout, and equation-source options. The [language guide](docs/editor-guide.md#interface-languages) distinguishes editor language from VS Code's settings language.

## Everyday commands

With the editor focused:

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Open action palette | `Cmd+/` | `Ctrl+/` |
| Toggle source mode | `Cmd+.` | `Ctrl+.` |
| Open as text | `Cmd+Shift+.` | `Ctrl+Shift+.` |

Search for **Binary Markdown** in the Command Palette for editing, export, and **Copy Build Information** commands. The [editor guide](docs/editor-guide.md) covers keyboard operations, tables, code, equations, and images.

## Experimental export

Save a named Markdown file in a trusted local workspace, then open the sharing-arrow **Export** menu. In a narrow pane, find it under **More toolbar actions**. Export shows progress, supports cancellation, and saves beside the source without overwriting existing files.

| Format | Required tool |
| --- | --- |
| HTML | None beyond the extension |
| PDF | Chrome, Chromium, or Microsoft Edge |
| Word (.docx), EPUB | Pandoc |

Tools are user-installed. Follow [export help](media/export-help.md) for setup, executable paths, output naming, and format-specific settings, or start with the [HTML export tutorial](docs/export-tutorial.md).

Export is unavailable in Remote-SSH and other remote hosts, browser VS Code, and the standalone desktop app. DOCX numbering remains experimental: Enter on an empty numbered line can end numbering and change formatting; copying and reading order vary by reader. PDF gutters can appear in copied text. The [reader checkpoint](reports/validation/2026-09-21-docx-reader-checkpoint.md) records tested versions and remaining checks. Review the [0.4.0 known limitations](release-notes/0.4.0.md#known-limitations), including existing editor save/list limitations, before using a candidate for important documents.

## Build and contribute

Source builds, focused fixes, translations, accessibility work, and reproducible bug reports are welcome. Start with the [build guide](docs/building.md), [contributor workflow](CONTRIBUTING.md), and [validation guide](docs/testing/README.md). Use **Copy Build Information** when reporting a problem, with a small non-private example and clear reproduction steps.

The [documentation index](docs/README.md) organizes current guides. [Release notes](release-notes/README.md) describe individual versions; [reports](reports/README.md) preserve observations for specific revisions. Development builds and older commits are covered by the [support policy](docs/releases-and-support.md).

<a id="open-source-releases-and-support"></a>
<a id="project-history-and-license"></a>

## Open source and license

**Free (cost):** official releases and all editor features are available at no charge. **Free (freedom):** you may run, study, modify, and redistribute the software under the applicable licenses. This commitment draws on Richard Stallman's, the GNU Project's, and the Free Software Foundation's free software philosophy. See the [licensing guide](docs/licensing.md#cost-and-software-freedom) for the four freedoms and redistribution obligations.

Binary Markdown uses [AGPL-3.0-or-later](LICENSE). Earlier MIT grants, the [upstream MIT notice](LICENSES/AnyMarkdown-MIT.txt), and third-party terms remain intact; see [NOTICE](NOTICE). MIT-licensed starting points include [Binary Markdown v0.1.0 and Any Markdown](docs/licensing.md#mit-licensed-starting-points). The [repository transition guide](docs/repository-transition.md) preserves links to the original fork, reviews, and releases.
