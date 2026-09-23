# Acknowledgments

Binary Markdown is an independently maintained project derived from [Any Markdown](https://github.com/raggbal/any-markdown), originally developed by raggbal and contributors under the MIT license. Development began in a fork and now continues in a standalone repository; the [original fork](https://github.com/BinaryOutlook/binary-markdown-fork) preserves its earlier review and release records.

The visual editor, Markdown handling, themes, translations, and desktop foundation are inherited from that project. The former icon is retained in historical revisions; the current 01 / MD icon is project-supplied (see [branding](docs/branding.md)). The original Git history and [MIT license notice](LICENSES/AnyMarkdown-MIT.txt) are retained. Binary Markdown uses [GNU AGPL version 3 or later](LICENSE); its license transition did not change earlier MIT grants or third-party terms, and the repository transition introduces no licensing change. See [NOTICE](NOTICE). The original fork baseline is upstream commit `82487429`, whose extension package was version `0.195.393`.

BinaryOutlook maintains Binary Markdown's code changes, roadmap, releases, and support. The original maintainers are not responsible for releases published as Binary Markdown. The [changelog](CHANGELOG.md) identifies changes developed here, including the code-copy and outline-state improvements proposed upstream as PRs #8 and #9.

Runtime dependencies include Turndown, turndown-plugin-gfm, Mermaid, and KaTeX. Their bundled license notices are copied into `vendor/` during compilation and included in the VSIX. Mermaid is rebuilt from the locked dependencies and includes a complete bundled package/license inventory. The browser-control library retains its Apache-2.0 license and NOTICE. See [vendor provenance](LICENSES/README.md). Any separately licensed bundled assets remain subject to their own terms.

Historical documentation and presentation assets are kept in [archive/](archive/README.md) for reference and are excluded from extension packages.

## Free software philosophy

We acknowledge [Richard Stallman](https://www.gnu.org/philosophy/free-software-even-more-important.html), the GNU Project, and the [Free Software Foundation](https://www.fsf.org/about/what-is-free-software) for the free software philosophy that informs our commitment to users' freedom to run, study, modify, and share software. The [GNU/FSF Free Software Definition](https://www.gnu.org/philosophy/free-sw.en.html) explains those freedoms. Our [licensing guide](docs/licensing.md#cost-and-software-freedom) distinguishes **free (freedom)** from our choice to offer releases **free (cost)**. This acknowledgment describes philosophical influence, not project affiliation or endorsement.
