# Acknowledgments

Binary Markdown is an independently maintained fork of [Any Markdown](https://github.com/raggbal/any-markdown), originally developed by raggbal and contributors under the MIT license.

The visual editor, Markdown handling, themes, translations, and desktop foundation are inherited from that project. The former icon is retained in historical revisions; the current 01 / MD icon is project-supplied (see [branding](docs/branding.md)). The original Git history and [MIT license notice](LICENSES/AnyMarkdown-MIT.txt) are retained. This fork now uses [GNU AGPL version 3 or later](LICENSE); the transition does not change earlier MIT grants or third-party terms. See [NOTICE](NOTICE). The baseline for this fork is upstream commit `82487429`, whose extension package was version `0.195.393`.

BinaryOutlook maintains this fork's code changes, roadmap, releases, and support. The original maintainers are not responsible for releases published as Binary Markdown. The [changelog](CHANGELOG.md) identifies changes developed here, including the code-copy and outline-state improvements proposed upstream as PRs #8 and #9.

Runtime dependencies include Turndown, turndown-plugin-gfm, Mermaid, and KaTeX. Their bundled license notices are copied into `vendor/` during compilation and included in the VSIX. Mermaid is rebuilt from the locked dependencies and includes a complete bundled package/license inventory. The browser-control library retains its Apache-2.0 license and NOTICE. See [vendor provenance](LICENSES/README.md). Any separately licensed bundled assets remain subject to their own terms.

Historical documentation and presentation assets are kept in [archive/](archive/README.md) for reference and are excluded from extension packages.
