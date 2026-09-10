# Releases, source builds and support

Binary Markdown is proudly open source. Official releases are published periodically, when a set of changes has completed release validation; we do not promise a fixed release schedule.

You are welcome to build, study, and modify the extension between releases. For development builds, we recommend starting from `main`, where changes are integrated. Other branches may contain incomplete experiments. An unreleased build has not necessarily undergone the same validation as an official release.

Bug reports from development builds are welcome—even when the affected commit is not the latest release or the current tip of `main`. Please include the full commit ID, whether you made local changes, your environment, and clear reproduction steps. This helps us check out the same revision and investigate.

We will make a reasonable effort to reproduce and diagnose reported problems. We may ask you to test a newer commit, and fixes will normally land in current development rather than being backported to every historical revision.

Access to the source is central to this project. Building your own version is an intended way to use Binary Markdown.

## Distribution and cost

The editor and all its features remain available in the free, open-source edition. Voluntary donations or paid support may sustain development; they do not unlock features. Future licensing arrangements depend on the rights the project holds and do not remove this commitment.

[GitHub Releases](https://github.com/BinaryOutlook/binary-markdown/releases) is the initial official download channel. Marketplace and Open VSX publication are future work. Source builds and VSIX installation do not require Marketplace credentials. [Build instructions](building.md) cover `main`, release tags and historical commits.

| Channel | What it means |
| --- | --- |
| Published release | Maintainer-published version with identified source, checksums and release validation. A prerelease is explicitly labelled. |
| CI candidate | An automatically packaged development snapshot with a source stamp and test results. Passing CI does not itself publish or approve a release. |
| Local/community build | A build from a selected commit, possibly modified. Identify its origin and changes; do not imply maintainer validation. |

Actions candidate artifacts expire after seven days and their usual download links require GitHub sign-in. Published release assets are the durable public download channel. Standard GitHub-hosted runners for public repositories use GitHub's free compute allowance; larger runners and storage beyond the applicable allowance can incur charges. This pipeline uses standard runners and short artifact retention. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [artifact downloads](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

## Reporting a problem

In the Command Palette, run **Binary Markdown: Copy Build Information**. Include the resulting commit, local-change status, VS Code version and host architecture in the [bug report](https://github.com/BinaryOutlook/binary-markdown/issues/new/choose). Source archives without a build stamp remain explicitly unidentified; give the best available revision and explain what is unknown.

Include expected and actual behaviour, clear steps and a small Markdown example. Export reports also need the chosen format, Pandoc/browser versions, warnings and relevant settings. Remove private text and personal paths. Testing current development can help, but it is not a condition for reporting an older affected commit. An older checkout can depend on unavailable tools; we will explain when that prevents reproduction.

## Maintainer release procedure

1. Review and merge the release changes into `main`. The **Validate VSIX** workflow builds one clean, identified package on every `main` push and tests those bytes. A pre-merge PR build has its own source identity; the resulting `main` commit must pass again.
2. Confirm **VSIX validation** passed: Ubuntu and macOS browser suites, real converters, package parity, frozen fixtures, installed-VSIX flows and artifact checks, plus installed VS Code 1.85.0 on Ubuntu. Read warnings and relevant manual acceptance evidence in the [v0.2 validation record](validation/0.2.0.md). Review representative exports in their target readers and acknowledge any disclosed limits. No skipped or failed required lane is acceptable.
3. Keep `docs/releases/<version>.md`, manifests, both lockfile root versions, license notices and branding consistent. Inspect the candidate VSIX and its checksum/source stamp. The same `BinaryOutlook.binary-markdown` identifier preserves the extension's stored settings across the 0.1-to-0.2 update.
4. On `main`, manually run **Prepare VSIX release draft**, supplying the successful **Validate VSIX** run ID. It accepts only a completed successful push run for the current `main`, downloads that exact attempt's package and evidence, verifies bytes/source, and attaches matching source plus checksums to a **draft** release. It neither rebuilds the VSIX nor publishes automatically. The workflow is available for manual dispatch after it lands on the default branch.
5. Review the draft's source commit, assets, notes and evidence. Publish the draft manually when accepted. If validation or inspection fails, fix current development and build a new candidate. Do not move a published tag or replace its artifacts; use a new version for corrections.

Expired candidates require a new full validation run, not a local substitute. Re-run all jobs rather than only failed jobs so the artifact attempt and evidence match. Concurrent runs are bounded; CI watchdogs are infrastructure safeguards, not product performance promises.

The inherited Electron auto-publisher is archived. Standalone installers require a separate validation and release decision; see the [roadmap](roadmap.md).
