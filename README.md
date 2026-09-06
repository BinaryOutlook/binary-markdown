# Binary Markdown Editor

An open-source visual Markdown editor for VS Code, independently maintained by BinaryOutlook. Edit Markdown in a rendered view, switch to source when needed, copy multiline code accurately, and keep the outline the way you prefer.

Binary Markdown builds on [Any Markdown by raggbal and contributors](https://github.com/raggbal/any-markdown), licensed under MIT. The visual editor and most existing features come from that project. BinaryOutlook maintains this fork's changes, releases, and support. See [Acknowledgments](ACKNOWLEDGMENTS.md) and the [changelog](CHANGELOG.md) for provenance.

## Install a test build

Version **0.1.0** is the first Binary Markdown [GitHub prerelease](https://github.com/BinaryOutlook/any-markdown/releases/tag/v0.1.0). Marketplace and Open VSX publication are pending.

1. Download [binary-markdown-0.1.0.vsix](https://github.com/BinaryOutlook/any-markdown/releases/download/v0.1.0/binary-markdown-0.1.0.vsix), or build it from source below. A SHA-256 checksum is included on the release page.
2. In VS Code, open **Extensions**, select **… → Install from VSIX…**, and choose the file.
3. Open a Markdown document and select **Reopen Editor With… → Binary Markdown**.

The extension is optional: installing it does not change your default Markdown editor. You can choose **Configure Default Editor…** yourself if you prefer to use it for every Markdown document.

The extension ID is `BinaryOutlook.binary-markdown`. It has separate commands, settings, and editor registration from Any Markdown. Read the [migration guide](docs/migration.md) if you used an earlier test build.

The same VSIX can be installed in editors that support VS Code extensions, subject to their API compatibility. Current manual validation covers VS Code **1.136.0 on macOS** before the naming migration; the renamed build and other environments need further manual testing.

## Features

Inherited from Any Markdown:

- Visual editing and a source-mode toggle for `.md` and `.markdown` files.
- Headings and outline navigation; bold, italic, strikethrough, lists, task lists, and blockquotes.
- Tables, links, images, code blocks with syntax highlighting, and YAML front matter.
- Mermaid diagrams and KaTeX expressions in fenced `mermaid` and `math` blocks.
- An action palette, keyboard shortcuts, multiple themes, and seven interface languages.
- Synchronization with external file changes, including changes made by coding tools.

Changes developed in this fork:

- Code-block copying preserves rendered line breaks, indentation, and meaningful blank lines.
- Outline visibility can be remembered per file or globally, with a configurable initial state.
- Opening the outline does not mark the Markdown document as edited.
- Independent Binary Markdown names and identifiers throughout the extension and desktop sources.

The first two changes were also proposed upstream as [PR #8](https://github.com/raggbal/any-markdown/pull/8) and [PR #9](https://github.com/raggbal/any-markdown/pull/9). This fork's release decisions are independent of those PRs.

## Configure the editor

Open **Settings** (`Cmd+,` on macOS or `Ctrl+,` on Windows/Linux) and search for **Binary Markdown**. Settings can be applied at User or Workspace scope.

| Setting | Default | Purpose |
| --- | --- | --- |
| `binary-markdown.outlineDefaultOpen` | `true` | Start with the outline open when no remembered state exists. |
| `binary-markdown.outlineStateScope` | `file` | Remember each file separately, or choose `global` to share visibility across files and workspaces. |
| `binary-markdown.toolbarMode` | `simple` | Use the compact toolbar or choose `full`. |
| `binary-markdown.theme` | `things` | Choose `github`, `sepia`, `night`, `dark`, `minimal`, `perplexity`, or `things`. |
| `binary-markdown.fontSize` | `16` | Editor font size in pixels. |
| `binary-markdown.language` | `default` | Follow VS Code's language, or select a supported language. |
| `binary-markdown.imageDefaultDir` | `""` | Image save directory; empty means the document's directory. |
| `binary-markdown.forceRelativeImagePath` | `false` | Prefer relative Markdown image paths when an absolute image directory is configured. |
| `binary-markdown.enableDebugLogging` | `false` | Enable diagnostic logging when investigating an issue. |

To start new files with a closed outline:

```json
{
  "binary-markdown.outlineDefaultOpen": false,
  "binary-markdown.outlineStateScope": "file"
}
```

A remembered visibility overrides the initial default. Changing the default does not erase previously saved outline states. These settings control the editor's outline, not VS Code's Explorer sidebar.

## Everyday commands

Search for **Binary Markdown** in the Command Palette. Commands include opening the editor, switching source mode, opening as text, comparing as text, inserting tables or a table of contents, and undo/redo.

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Open action palette | `Cmd+/` | `Ctrl+/` |
| Toggle source mode | `Cmd+.` | `Ctrl+.` |
| Open as text | `Cmd+Shift+.` | `Ctrl+Shift+.` |

PDF export remains an inherited placeholder; it is not an implemented export feature. The [editor guide](docs/editor-guide.md) covers formatting, keyboard operations, and images.

## Build and contribute

To build the source used for this release:

```sh
git clone --branch v0.1.0 https://github.com/BinaryOutlook/any-markdown binary-markdown
cd binary-markdown
npm ci
npm run compile
npm run package
```

The repository currently retains its original GitHub path; the project and package name are Binary Markdown. `npm run package` compiles the extension and writes `dist/binary-markdown-0.1.0.vsix`. No Marketplace credentials are needed to build or share that file. The packaging tool version is pinned in the lockfile.

Run `npm test` for the automated suites. See [CONTRIBUTING.md](CONTRIBUTING.md) for focused tests and [the manual fixture](docs/copy-paste-test.md) for the copy and outline scenarios.

Bug reports, documentation, translations, compatibility testing, and focused PRs are welcome in [this fork's issue tracker](https://github.com/BinaryOutlook/any-markdown/issues). Avoid including personal paths, usernames, or private documents in reports.

## Project history and license

The [reference archive](archive/README.md) preserves superseded README, website, screenshots, and upstream release notes for historical reference. Archived instructions describe the original project and should not be used to install this fork.

Binary Markdown remains [MIT licensed](LICENSE). Original copyright and license notices are preserved. Third-party library notices are included in packaged builds. The Electron desktop sources are retained under the Binary Markdown name; desktop installers and their compatibility are a separate release effort.
