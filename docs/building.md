# Build Binary Markdown from source

Building your own version is an intended way to use the extension. For everyday development start from `main`; feature branches can contain unfinished experiments. A locally built package is a development build unless it is the maintainer's validated, published release.

## Download an automated development build

The **Validate VSIX** workflow packages the latest pushed commit on every branch in this repository and also validates pull requests. You can test an unreleased revision without compiling it locally:

1. Sign in to GitHub and open [Actions → Validate VSIX](https://github.com/BinaryOutlook/binary-markdown/actions/workflows/ci-vsix.yml). Select the latest run for the intended branch or PR and inspect its source commit and overall status.
2. Open the run summary's development-package download link. Branch pushes produce a checked development package without the PR validation matrix. For full runs, **Packaged — validation pending** means packaging succeeded while the four native lanes and nine browser shards are still running. **VSIX validation passed** confirms every check required by that run’s [validation scope](testing/README.md#ci-scope-and-required-validation); documentation-only PRs have a clearly identified fast path and do not establish full release validation. A failed, cancelled or incomplete run is not validated, even when its package can be downloaded.
3. Extract the artifact ZIP and retain the VSIX, `.vsix.sha256` and `.vsix.build-info.json` together. From the extracted directory, run `shasum -a 256 --check ./*.vsix.sha256` on macOS or `sha256sum --check ./*.vsix.sha256` on Linux. Follow the [installation instructions](#inspect-and-install-the-output).
4. After installation and reload, run **Binary Markdown: Copy Build Information**. Compare the package version, full source commit, CI build number, run ID and attempt with the downloaded sidecar and run summary. Include these fields in bug reports.

Each push builds its tip, rather than a separate package for every commit in that push. Newer pushes cancel superseded runs on the same ref; already completed downloads remain until their seven-day expiry. PR runs use a separate ref and normally package GitHub's test merge commit, which can differ from the contributor's branch tip. The source stamp records the actual checked-out commit and tree. CI run numbers identify workflow builds; rerun attempts distinguish repeated runs of the same build. These fields do not change the manifest version or enable automatic updates from GitHub downloads.

Development VSIX filenames identify the build without changing the extension's numeric version. For example, `binary-markdown-0.4.1-dev-main-build125-attempt1.vsix` is a development package from `main`; `binary-markdown-0.4.1-dev-pr98-build126-attempt1.vsix` comes from PR #98. A rerun keeps its build number and changes the attempt. Feature branch labels use lowercase filename-safe characters and at most 48 characters; the complete original ref remains in build information. Build numbers belong to this workflow across all branches, so a branch's numbers can have gaps. The Actions ZIP bundle retains its full-commit-and-attempt name, while the VSIX and both sidecars inside use the readable filename.

Branch automation is available once that branch contains the workflow changes. New branches from updated `main` inherit them; older branches need to incorporate them. Fork contributions are built through PR CI in this repository. A fork's own push builds depend on its owner enabling Actions there. Build jobs have read-only repository access and no publication credentials; see [CI security](ci-security.md).

Artifacts expire after seven days and normal downloads require GitHub sign-in. Download a new build or use the source procedure below when the artifact has expired; a historical PR test merge may no longer be fetchable. Local rebuilds can produce different bytes. Re-run all jobs when replacing a CI candidate so its package and validation evidence identify the same attempt. Official release promotion remains restricted to validated current `main` under the [release policy](releases-and-support.md#maintainer-release-procedure). Promotion restores the canonical release filenames and updates the sidecars without changing or rebuilding the tested VSIX bytes. Local source builds retain the canonical filenames described below.

## Select and build a revision

Install Git and the Node.js version recorded in the selected checkout's `.node-version` (currently Node 24 LTS). npm is included with Node. Pandoc and a browser are needed for their export formats and full validation, but neither is required merely to package the extension.

```sh
git clone https://github.com/BinaryOutlook/binary-markdown.git
cd binary-markdown
git switch main
cat .node-version
node --version
npm ci
npm run package
```

For a historical commit or a published release, select it before installing dependencies:

```sh
git checkout --detach COMMIT_ID_OR_RELEASE_TAG
cat .node-version
npm ci
npm run package
```

Replace `COMMIT_ID_OR_RELEASE_TAG` with a real full commit ID or tag, and use that revision's build instructions and runtime. Earlier revisions can require older tools; current build instructions do not promise compatibility for every historical checkout.

The lockfile pins dependency versions. Compilation includes TypeScript, translations, shared/webview assets, and vendors. Mermaid is bundled from the installed, audited dependency graph with the complete bundled license inventory; its upstream prebuilt minified file is not used. Browser control is bundled without a native browser. No Marketplace credentials are needed.

## Inspect and install the output

Local `npm run package` writes three files to `dist/`: `<name>-<version>.vsix`, the matching `.vsix.sha256`, and `.vsix.build-info.json`. Read the version from the selected checkout, then verify from inside `dist` so the checksum's filename resolves correctly:

```sh
binary_version=$(node -p 'require("./package.json").version')
cd dist
shasum -a 256 --check "binary-markdown-$binary_version.vsix.sha256"
cd ..
```

On Linux, `sha256sum --check` is an equivalent command. A digest checks bytes, not publisher identity; obtain release artifacts and checksums from the same official release. The source stamp records commit, tree, local modifications and build runtime. Actions-built packages also record their workflow build number, run ID, attempt, ref and run URL; local or older packages explicitly report absent CI identity. **Binary Markdown: Copy Build Information** adds the running VS Code version and host architecture. An unidentified source archive reports unknown fields rather than inventing a Git revision. An archive builder may supply `BINARY_MARKDOWN_SOURCE_COMMIT` with the full source SHA, which is labelled as provided, not a verified clean checkout.

Install through **Extensions → … → Install from VSIX…**, reload if prompted, then choose **Reopen Editor With… → Binary Markdown**. Local builds use `BinaryOutlook.binary-markdown`, so installing one replaces that ID's current version. Preserve the ID for routine builds. To return to an official version, install its published VSIX. Version 0.2 keeps 0.1's settings, commands and outline storage keys; migration from older Any Markdown IDs is covered [separately](migration.md).

For isolated native checks, use the [guarded test harness](../test/native/export-smoke.md). It creates a fresh profile and workspace and installs the actual VSIX. It does not modify your normal VS Code settings. Source edits do not refresh an already installed package: rebuild and reinstall when testing new code.

## Validate a candidate

Install Pandoc, a compatible Chrome/Chromium/Edge, and Poppler (`pdftotext`). The [CI workflow](../.github/workflows/ci-vsix.yml) provisions its own tools and records versions. For local macOS/Linux checks, use Node from `.node-version` and a clean checkout:

```sh
npm ci
npm run lint
npm audit
npm run package -- --release
python3 test/fixtures/exports/verify-fixtures.py
binary_version=$(node -p 'require("./package.json").version')
EXPORT_REAL_TOOLS=1 EXPORT_VSIX_PATH="dist/binary-markdown-$binary_version.vsix" npm run test:unit
npm run test:build
CI=1 npx playwright test --workers=2 --retries=0
```

Set `EXPORT_PANDOC_PATH`, `EXPORT_BROWSER_PATH` and `EXPORT_PDFTOTEXT_PATH` when tools are outside normal discovery. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for browser tests to use an installed Chromium-family browser, or install Playwright's test browser with `npx playwright install chromium`. Run with the browser sandbox enabled as an ordinary user. These test variables are separate from the extension's machine settings.

`--release` requires a clean, identified Git checkout. Package **before** `test:build`, which rewrites the tracked standalone test HTML; back up and restore that generated file before another clean-source package. Do not discard unrelated edits. Successful package/units/browser tests still need the installed-VSIX harness and artifact/reader review described in [validation](../reports/validation/0.2.0.md).

Normal development can use `npm test`; converter and archive tests deliberately skip when their explicit prerequisites are absent. A release candidate must run those gates with the variables above so they are exercised. `npm run watch` watches TypeScript only: use full compilation after editing webview JavaScript, CSS, shared modules or translations.

No byte-identical rebuild guarantee is claimed. VSIX/converted document metadata can differ between builds or tool versions; compare the source identity, lockfile, environment and candidate checksum. The release pipeline validates and promotes the same VSIX bytes.
