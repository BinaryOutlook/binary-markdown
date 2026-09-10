# Build Binary Markdown from source

Building your own version is an intended way to use the extension. For everyday development start from `main`; feature branches can contain unfinished experiments. A locally built package is a development build unless it is the maintainer's validated, published release.

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

`npm run package` writes three files to `dist/`: `<name>-<version>.vsix`, the matching `.vsix.sha256`, and `.vsix.build-info.json`. For version 0.2.0, verify from inside `dist` so the checksum's filename resolves correctly:

```sh
cd dist
shasum -a 256 --check binary-markdown-0.2.0.vsix.sha256
cd ..
```

On Linux, `sha256sum --check` is an equivalent command. A digest checks bytes, not publisher identity; obtain release artifacts and checksums from the same official release. The source stamp records commit, tree, local modifications and build runtime. **Binary Markdown: Copy Build Information** adds the running VS Code version and host architecture. An unidentified source archive reports unknown fields rather than inventing a Git revision. An archive builder may supply `BINARY_MARKDOWN_SOURCE_COMMIT` with the full source SHA, which is labelled as provided, not a verified clean checkout.

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
EXPORT_REAL_TOOLS=1 EXPORT_VSIX_PATH=dist/binary-markdown-0.2.0.vsix node --test test/unit/*.test.js
npm run test:build
CI=1 npx playwright test --workers=2 --retries=0
```

Set `EXPORT_PANDOC_PATH`, `EXPORT_BROWSER_PATH` and `EXPORT_PDFTOTEXT_PATH` when tools are outside normal discovery. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for browser tests to use an installed Chromium-family browser, or install Playwright's test browser with `npx playwright install chromium`. Run with the browser sandbox enabled as an ordinary user. These test variables are separate from the extension's machine settings.

`--release` requires a clean, identified Git checkout. Package **before** `test:build`, which rewrites the tracked standalone test HTML; back up and restore that generated file before another clean-source package. Do not discard unrelated edits. Successful package/units/browser tests still need the installed-VSIX harness and artifact/reader review described in [validation](validation/0.2.0.md).

Normal development can use `npm test`; converter and archive tests deliberately skip when their explicit prerequisites are absent. A release candidate must run those gates with the variables above so they are exercised. `npm run watch` watches TypeScript only: use full compilation after editing webview JavaScript, CSS, shared modules or translations.

No byte-identical rebuild guarantee is claimed. VSIX/converted document metadata can differ between builds or tool versions; compare the source identity, lockfile, environment and candidate checksum. The release pipeline validates and promotes the same VSIX bytes.
