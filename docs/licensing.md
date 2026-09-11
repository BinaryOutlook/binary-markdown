# Licensing and source access

The 0.2.0 source uses **GNU Affero General Public License, version 3 or any later version** (`AGPL-3.0-or-later`), as stated in [LICENSE](../LICENSE) and [NOTICE](../NOTICE). New contributions use those terms unless a file explicitly states a separate license; contributors retain copyright. The policy records the maintainer's wish to keep source access and modification rights central to the project. It is not a claim that every dependency has the same license.

The first export-branch license preparation used `AGPL-3.0-only` at `f2a73a5`. The correction to the selected **or-later** policy is commit `5e65a3a`; [Decision 001](decisions/001-agpl-transition.md) records the distinction. Version 0.2.0 is the intended first release with the corrected policy. Until its release is published, this describes the candidate source and does not announce a release.

## Existing grants and dependencies

- The original Any Markdown work and prior MIT contributions keep their [retained MIT notice](../LICENSES/AnyMarkdown-MIT.txt). Previously distributed MIT versions, including v0.1.0, retain those permissions. Original history and attribution are preserved.
- The frozen `exports-v1` fixtures retain their explicit MIT grant. Archived material and separately licensed assets retain their own notices.
- Runtime packages have their own licenses. Compilation copies vendor notices; the Mermaid bundle includes `MERMAID-DEPENDENCIES.json` and `MERMAID-THIRD-PARTY-LICENSES.txt` for every included package. [Vendoring provenance](../LICENSES/README.md) explains upstream notice copies where npm archives omit them. The packaged browser-control library includes its license and NOTICE.
- Pandoc and the browser used for PDF are separate user-installed executables. Their binaries are not distributed in the VSIX. The current transition introduces no additional linking exception or sublicense for those programs or for VS Code. The source remains available independently of the host editor's distribution.
- The project-supplied 01 / MD artwork is covered by the project terms. [Branding guidance](branding.md) permits community use while distinguishing official releases and community builds.

AGPL permits commercial activity under its conditions and does not require submitting a contribution to this repository. Applicable distribution and network-use obligations depend on the covered work and the terms in the license. Read the [AGPL text](https://www.gnu.org/licenses/agpl-3.0.html), [MIT text](https://opensource.org/license/mit), and [SPDX version-policy record](https://spdx.org/licenses/AGPL-3.0-or-later.html) rather than treating this guide as a replacement license.

## Matching source and user documents

Packages record their full source commit, local-change state and source URL. Published releases attach source for the validated commit, together with checksums and build identification; the repository also retains its Git history. [Building instructions](building.md) explain selecting that revision and installing its locked dependencies. A community redistribution should provide the applicable corresponding source and preserve the required notices, including its own modifications.

Using the editor or exporting does not transfer ownership of a user's Markdown, images or other assets to BinaryOutlook. The user keeps the rights they already have in that material. Code, styles, fonts or other third-party material copied into an exported file retains its own applicable terms; export does not erase those terms or claim ownership of the surrounding document.

Future licensing arrangements require the necessary rights. There is no copyright assignment or blanket alternative-license grant hidden in the contribution policy. The editor and its features remain available in the free, open-source edition; optional donations or paid support do not unlock features.
