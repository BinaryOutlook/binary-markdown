# Decision 001: AGPL policy for 0.2.0

Status: implemented in the 0.2.0 release-preparation workstream; release pending.
Decision date: 2026-09-10.

The maintainer selected `AGPL-3.0-or-later` in the transition policy answers.
The first export licensing commit, `f2a73a5`, instead used `AGPL-3.0-only`.
This corrective change aligns the project notices, both manifests, both
lockfile root entries, contribution terms and package checks to the selected
policy. The earlier commit and its validation records remain historical facts.
The corrective commit is discoverable with:

```sh
git log --all --format='%H %s' --grep='align 0.2.0 licensing with the approved or-later policy'
```

The project notice explicitly permits version 3 or any later version.
The standard AGPLv3 text itself is unchanged. SPDX distinguishes these choices
through the program's license notice:
[AGPL-3.0-or-later](https://spdx.org/licenses/AGPL-3.0-or-later.html).

## Preserved boundaries

- The published `v0.1.0` source and VSIX retain their MIT terms.
- `LICENSES/AnyMarkdown-MIT.txt` retains the upstream and prior fork notices.
- Frozen `exports-v1` fixtures keep their explicit MIT grant. Archived and
  third-party material retains its own terms.
- Dependencies' license declarations are not rewritten.
- Pandoc and the PDF browser are independently installed executables. The VSIX
  contains neither executable; it includes the browser-control library and its
  notices. No new linking exception is introduced by this decision.
- The source of the extension remains available independently of VS Code's
  distribution. Build instructions identify the corresponding source revision.
- Users retain the rights they already have in their documents and assets.
  Material copied into an export retains its applicable license.

The intended first release under the aligned policy is 0.2.0. This decision
does not claim that it has been published. Release notes must identify the
actual tagged source and tested package when publication occurs.
