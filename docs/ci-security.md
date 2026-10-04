# Maintain CI safely

Binary Markdown uses standard GitHub-hosted runners to build and test contributions. Marketplace uploads remain a maintainer action outside CI. Producing a development VSIX does not authorize publication.

## Permissions and trusted automation

Build and validation jobs use `contents: read`, checkouts with `persist-credentials: false`, and no publication secrets. Avoid self-hosted runners for public contributions. Dependency installation and tests execute contributed code; a passing check is not a security certification of that code.

The [CI approval controller](../.github/workflows/approve-pr-ci.yml) keeps contributor CI automatic, including first-time fork PRs. Its elevated `actions: write` permission authorizes only a pending run of the exact expected workflow, repository, open PR, fork identity, branch and current source SHA. It never grants a PR review or merges application changes. The controller checks out `github.workflow_sha`, the trusted revision defining the workflow, and never imports or executes a contributor's revision. The [controller regression tests](../test/unit/pr-ci-approval.test.js) exercise stale revisions, wrong repositories/workflows, closed PRs, failed checks and concurrent approvals.

This controller has a narrowly scoped `dangerous-triggers` exception at its event declaration for static analysis. Both privileged triggers are necessary for the existing automatic-approval policy. Do not copy this exception to build workflows or weaken the trusted-checkout boundary. Other security audits remain enabled.

The [release workflows](releases-and-support.md#maintainer-release-procedure) request write permissions separately. Release promotion accepts only completed successful full validation of the current canonical `main`, verifies the exact artifact attempt and checksum, and requires every validation lane. Branch and fork artifacts cannot be promoted by changing their label. The automatic GitHub Releases schedule remains governed by its existing release policy; it does not upload to the VS Code Marketplace.

## Check workflow changes

From the repository root, with Node from `.node-version`, run:

```sh
npm run check:workflows
```

The command works before `npm ci`. It requires `curl` and `tar` on Linux or macOS, with x64 or arm64. Windows contributors can use WSL or inspect the Actions check. The candidate-build job runs the same command before dependency installation, so scanner failures block packaging and the required validation gate.

The script downloads the exact official actionlint and zizmor releases pinned in [workflow-tools.json](../.github/workflow-tools.json). It verifies each archive's SHA-256 before extracting or executing the binary and removes its temporary directory afterwards. Tool download errors and checksum mismatches fail the check. Downloads require networking; the audits use local files, run zizmor in offline mode, and require no GitHub token. actionlint also uses ShellCheck when it is available on the host.

[actionlint](https://github.com/rhysd/actionlint) checks workflow syntax, expressions and action inputs. [zizmor](https://docs.zizmor.sh/) checks security patterns in workflows and Dependabot configuration. Fix findings before submitting a change. An exception requires a specific location, a written trust-boundary explanation and appropriate regression coverage; avoid file-wide or global suppressions.

## Repository settings and maintenance

In **Settings → Actions → General**, maintain these settings:

| Setting | Policy |
| --- | --- |
| Default workflow token permissions | Read-only |
| Allowed external actions | `actions/checkout`, `actions/setup-node`, `actions/upload-artifact`, `actions/download-artifact` |
| Require actions pinned to a full-length commit SHA | Enabled |
| Marketplace or other publication credentials in build jobs | None |
| Main branch protection | PR required, up-to-date branch, passing `VSIX validation`, resolved conversations, admin enforcement, force pushes and deletions blocked |
| Mandatory independent reviews | Zero for the solo-maintainer workflow; the maintainer controls application merges |

The action allowlist uses repository patterns with any revision permitted; mandatory SHA pinning then requires immutable revisions. Review and approve any new external action before extending the allowlist. The allowlist governs Actions references, not arbitrary commands or npm dependencies, so source review remains necessary.

[`CODEOWNERS`](../.github/CODEOWNERS) requests maintainer attention for automation, scripts, build-information code and dependency manifests. These review requests are advisory and do not add a mandatory second reviewer.

[Dependabot](../.github/dependabot.yml) proposes grouped GitHub Actions updates monthly, with at most one open version-update PR and a seven-day release cooldown. Updates pass the normal CI and maintainer review process. Checker binary versions and hashes are maintained separately: select an official tagged release, verify its published asset digests, update the relevant entries in `workflow-tools.json`, and run workflow checks before committing.

Periodically inspect repository and environment secret names and their documented purpose without printing values. Remove credentials after confirming they are unused; rotate any credential that was exposed. Manual Marketplace uploading does not require a stored CI Marketplace token. See [GitHub's security guidance](https://docs.github.com/en/actions/reference/security/secure-use) and [Actions settings reference](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).
