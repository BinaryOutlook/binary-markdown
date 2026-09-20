# Validate an export change

Use this guide to select and record checks for a change to export. Run commands from the repository root using the checkout's `.node-version`. The [build guide](building.md) covers dependency installation and packaging; the [export reference](export-subsystem.md#acceptance-criteria-and-milestone-mapping) defines the acceptance criteria.

## Choose checks for the affected behavior

| Changed area | Relevant checks |
| --- | --- |
| Documentation only | Run `node scripts/check-docs.cjs`, compare instructions with source, and preserve requirement IDs and historical results. Preview changed pages and inspect images/metadata before publication. |
| Save capture, queue, or host messages | Export unit tests, focused editor tests, and native save/selection/immutable-capture cases in both editor modes. |
| Renderer, resources, or export menu | Export unit/browser tests, native affected-format runs, offline HTML checks, and representative artifact inspection. |
| PDF or Pandoc backend | Real-tool checks, installed-VSIX conversions, artifact inspection, and affected target-reader review. |
| Naming, cancellation, or cleanup | Finalizer/controller tests and native collision, failure, and cancellation cases. |
| Shared code, settings, or packaging | Relevant identity/localization checks, shared Electron compilation, package inspection, and installed-host checks. |

## Run focused development checks

Prepare dependencies with `npm ci` on a new checkout. Then run:

```sh
npm run compile
npm run lint
python3 test/fixtures/exports/verify-fixtures.py
npm run test:export
CI=1 npm run test:e2e -- test/specs/export-editor.spec.ts test/specs/export-ui.spec.ts --retries=0
```

Browser tests need Playwright Chromium or the installed browser override documented in [CONTRIBUTING.md](../CONTRIBUTING.md#checks). The test server uses port 3000; ensure it is available. `test:e2e` regenerates the tracked standalone HTML fixture. Preserve any earlier edits to that generated file before running or restoring it. Full compilation is needed after shared/webview asset changes; TypeScript watch alone does not refresh all assets.

Successful focused checks establish only the behavior they exercise. The export unit command skips real converters unless explicitly enabled and skips package inspection unless a VSIX path is supplied. Record skips separately from passes.

## Exercise actual tools and the package

Install Pandoc, a compatible Chrome/Chromium/Edge, and Poppler's `pdftotext` for the relevant checks. Build a candidate, then select its path from the manifest:

```sh
npm run package
export EXPORT_REAL_TOOLS=1
export EXPORT_VSIX_PATH="$(node -p "const p = require('./package.json'); 'dist/' + p.name + '-' + p.version + '.vsix'")"
npm run test:export
```

Use `EXPORT_PANDOC_PATH`, `EXPORT_BROWSER_PATH`, and `EXPORT_PDFTOTEXT_PATH` when test tools are outside normal discovery. These test variables are separate from the extension's machine settings. The native harness accepts its own `--pandoc` and `--browser` options.

Follow the [installed-VSIX harness](../test/native/export-smoke.md) to create a fresh profile and workspace and run the affected scenarios. Inspect outputs with the [artifact audit](../test/native/export-artifact-audit.md) and representative target readers. Stop the development server for checks intended to prove package independence. Compare the same package bytes across hosts when making a combined compatibility claim.

For DOCX code numbering, use the [reader checkpoint procedure](../test/native/docx-reader-checkpoint.md) to generate fresh fixtures and check rendering, basic editing and save/reopen in the two named readers. Preserve original exports and edited copies separately. Converter checks and a headless resave do not substitute for these interaction checks.

For release validation, follow the fuller sequence and clean-source requirements in [building.md](building.md#validate-a-candidate) and the [release and support policy](releases-and-support.md). A development check does not replace those gates.

## Record results for review

Record the base/head revisions, affected FR/NFR/AC IDs, commands, outcomes, and unavailable checks. For native runs, retain the package hash, host and tool versions, frozen-input hashes, output identities, and representative viewer observations. Link receipts rather than copying large generated artifacts into Git.

Keep new observations distinct from the dated [export-branch record](../reports/validation/2026-09-10-export.md) and [0.2.0 integration record](../reports/validation/0.2.0.md). Preserve earlier failures and their later corrections. A required check that could not run remains unverified. Do not weaken assertions or change frozen fixtures to fit an implementation.

A review-ready change includes the scoped diff, affected documentation, relevant regression evidence, and explicit remaining limits. Human acceptance, merge, and release are separate states. A change to the export contract follows the [recorded decision process](export-subsystem.md#changes-to-this-contract).
