# Licensing and source access

Binary Markdown has used **GNU Affero General Public License, version 3 or any later version** (`AGPL-3.0-or-later`) since the 0.2.0 transition, as stated in [LICENSE](../LICENSE) and [NOTICE](../NOTICE). New contributions use those terms unless a file explicitly states a separate license; contributors retain copyright. The policy records the maintainer's wish to keep source access and modification rights central to the project. It is not a claim that every dependency has the same license.

The first export-branch license preparation used `AGPL-3.0-only` at `f2a73a5`. The correction to the selected **or-later** policy is commit `5e65a3a`; [Decision 001](decisions/001-agpl-transition.md) records the distinction. The version-specific [0.2.0 notes](../release-notes/0.2.0.md) record that transition. The [release page](https://github.com/BinaryOutlook/binary-markdown/releases) identifies published source and artifacts; this guide describes the terms in the selected checkout.

## Cost and software freedom

**Free (cost):** Our official releases and all editor features are available at no charge. Voluntary donations or paid support do not unlock features; see the [distribution and cost policy](releases-and-support.md#distribution-and-cost).

**Free (freedom):** Users have the rights described by the [GNU/FSF Free Software Definition](https://www.gnu.org/philosophy/free-sw.en.html):

- **Freedom 0:** Run the program for any purpose.
- **Freedom 1:** Study its source and modify it to suit your needs.
- **Freedom 2:** Share copies with others.
- **Freedom 3:** Distribute your modified versions so others can benefit.

Our commitment draws on the free software philosophy articulated by [Richard Stallman](https://www.gnu.org/philosophy/free-software-even-more-important.html) and advanced by the GNU Project and the [Free Software Foundation](https://www.fsf.org/about/what-is-free-software). This is the philosophical heritage behind our emphasis on users' control of their software. Our decision to distribute at no charge is a separate project choice: [selling free software](https://www.gnu.org/philosophy/selling.en.html) is compatible with these freedoms.

## Redistribution and commercial use

You may use Binary Markdown commercially and charge for copies, modified distributions, or support under the applicable licenses. Our no-charge pricing is not an additional license condition for other distributors.

When distributing AGPL-covered versions, preserve recipients' license rights, retain required notices, and provide the corresponding source as required by AGPL sections 4–6. If you modify the program and your version supports remote interaction over a computer network, section 13 requires a prominent offer of that version's corresponding source to those remote users, at no charge. Private edits do not automatically require publication to everyone, and AGPL does not require submitting changes to this repository.

These obligations depend on the covered work and how it is distributed or used over a network. The [AGPL text](https://www.gnu.org/licenses/agpl-3.0.html) governs; this guide explains the policy and does not replace or add to the license. See also the [MIT text](https://opensource.org/license/mit) and [SPDX version-policy record](https://spdx.org/licenses/AGPL-3.0-or-later.html).

## Existing grants and dependencies

- The original Any Markdown work and prior MIT contributions keep their [retained MIT notice](../LICENSES/AnyMarkdown-MIT.txt). Previously distributed MIT versions, including v0.1.0, retain those permissions. Original history and attribution are preserved.
- The frozen `exports-v1` fixtures retain their explicit MIT grant. Archived material and separately licensed assets retain their own notices.
- Runtime packages have their own licenses. Compilation copies vendor notices; the Mermaid bundle includes `MERMAID-DEPENDENCIES.json` and `MERMAID-THIRD-PARTY-LICENSES.txt` for every included package. The Markdown block parser similarly includes `MARKDOWN-DEPENDENCIES.json` and `MARKDOWN-THIRD-PARTY-LICENSES.txt`. [Vendoring provenance](../LICENSES/README.md) explains upstream notice copies where npm archives omit them. The packaged browser-control library includes its license and NOTICE.
- Pandoc and the browser used for PDF are separate user-installed executables. Their binaries are not distributed in the VSIX. The current transition introduces no additional linking exception or sublicense for those programs or for VS Code. The source remains available independently of the host editor's distribution.
- The project-supplied 01 / MD artwork is covered by the project terms. [Branding guidance](branding.md) permits community use while distinguishing official releases and community builds.

## MIT-licensed starting points

If MIT better suits your project, you are welcome to fork [Binary Markdown v0.1.0](https://github.com/BinaryOutlook/binary-markdown/tree/v0.1.0), whose [license is MIT](https://github.com/BinaryOutlook/binary-markdown/blob/v0.1.0/LICENSE), or an MIT-licensed version of the original [Any Markdown](https://github.com/raggbal/any-markdown). Both are welcome choices, and we remain grateful to Any Markdown for the editor foundation.

Check the chosen revision's license and preserve its required copyright and permission notices, together with applicable third-party notices. Those MIT grants do not extend to later changes distributed only under AGPL.

## Matching source and user documents

Packages record their full source commit, local-change state and source URL. Published releases attach source for the validated commit, together with checksums and build identification; the repository also retains its Git history. [Building instructions](building.md) explain selecting that revision and installing its locked dependencies. A community redistribution should provide the applicable corresponding source and preserve the required notices, including its own modifications.

Using the editor or exporting does not transfer ownership of a user's Markdown, images or other assets to BinaryOutlook. The user keeps the rights they already have in that material. Code, styles, fonts or other third-party material copied into an exported file retains its own applicable terms; export does not erase those terms or claim ownership of the surrounding document.

Future licensing arrangements require the necessary rights. There is no copyright assignment or blanket alternative-license grant hidden in the contribution policy. The editor and its features remain available at no charge with the software freedoms described above.
