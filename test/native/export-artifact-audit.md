# Inspect native export artifacts

Use this procedure after an [installed-VSIX run](export-smoke.md). Select the
receipts for the identified candidate; do not infer identity from the newest
filename. The [candidate validation guide](../../docs/testing/README.md) defines
the required checks. Earlier observations are retained in the
[2026-09-09 artifact report](../../reports/validation/2026-09-09-export-artifact-audit.md).

## Reproduction

Use the receipt paths, not the basic filename or the newest-looking collision file. The audit verifies that the workspace Markdown still matches the frozen `exports-v1` manifest, records output hashes, reads package XML/media, checks every fixed code/table/scenario marker and inspects PDF images/geometry. Dependencies are Python with `pypdf` and Pillow, plus Poppler's `pdftotext`, `pdfinfo` and `pdftoppm`. The reference scripts use the repository's compiled PDF backend and vendored browser controller with an installed macOS Chrome.

```sh
python3 test/native/export-artifact-audit.py
node test/native/export-artifact-audit.reference.cjs declared
node test/native/export-artifact-audit.reference.cjs compact
node test/native/export-artifact-audit.pagination.cjs
node test/native/export-artifact-audit.themes.cjs
```

The scripts write ignored evidence under `.vscode-test/export-native/evidence/artifact-audit/`. Keep generated documents, screenshots and machine-specific receipts out of public Git history. `audit.json` records receipt-selected filenames, hashes, warning codes, media matches, marker pages and alternative text; it omits personal source paths. Re-running it against revised receipts creates a new observation set, so retain an earlier JSON if comparing runs.


## Record a new observation

Record the source and VSIX hashes, environment, selected receipts, frozen-input
hashes, artifact inventory and the actual assertion result. Retain skips,
failures and scope limitations. Automated marker/container checks do not replace
representative inspection in PDF, document and ebook readers.

Use the workflow's `assert-artifact-audit.cjs` gate for required inventory checks.
Retain generated output in ignored local directories or CI artifacts. Put only
a curated, sanitized summary and necessary compact evidence in
[reports/validation](../../reports/README.md#validation).
