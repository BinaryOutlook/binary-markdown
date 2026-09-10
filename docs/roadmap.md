# Roadmap and scope

Binary Markdown aims to be a useful, free, open-source Markdown editor that users can build, adapt and improve. Work follows completed changes and validation rather than a fixed release calendar.

| Workstream | 0.2.0 deliverable | Later work |
| --- | --- | --- |
| Export | Saved-revision HTML/PDF/DOCX/EPUB, portable supported resources, explicit warnings, cancellation and meaningful stage progress | Unsaved export, destination/template customization, compression, richer pagination and additional Markdown syntax |
| Identity and documentation | AGPL-3.0-or-later with retained notices, supplied 01 / MD artwork, clear build/support policy and source identification | Broader guides and community contributions as features mature |
| Release automation | One identified VSIX, Ubuntu/macOS and minimum-VS-Code checks, checksums, validation evidence and a manually published release draft | Marketplace/Open VSX distribution and further validated environments |

The release workload is a frozen complex report, calibrated to approximately 30 pages under reference typography. Actual PDF page counts vary with rendering and machine fonts. This is a practical content-coverage target; the product promises useful stage updates rather than a fixed completion time. Do not remove hard fixture cases or hide warnings to achieve a smaller page count.

We would like to explore a standalone desktop app when capacity permits, with **Ubuntu first, macOS second and Windows last**. Shared editor code and Electron sources provide a starting point. A standalone release is not required for 0.2.0, and no delivery date, measured percentage of shared code or feature parity is promised. Installer dependencies and host-specific behaviour need independent work and validation.

Windows export, VS Code Remote/SSH, browser-hosted VS Code and Electron export remain outside the initial validated export scope. Running local desktop VS Code under Xvfb on an Ubuntu machine accessed by SSH tests the Ubuntu local extension host; it does not establish Remote-SSH export support.

For an implementation handoff, follow the [export FR/NFR and change rules](export-subsystem.md). Split work into small reviewable slices with acceptance evidence and focused commits. Routine implementation choices can change within the agreed contracts; update requirements and record the decision when changing saved-source behaviour, output naming, platform scope, dependencies or fidelity promises.

Work can be implemented, ready for review, accepted, merged or released. These are separate states. Passing tests does not substitute for maintainer acceptance, and a merged feature is not automatically an official release.
