# Footnotes and reference links: issue #113 validation

Reviewed on 2026-11-14 (Asia/Singapore), before publication. [Issue #113](https://github.com/BinaryOutlook/binary-markdown/issues/113) was implemented on `feat/footnotes-reference-links` from remote `main` at `7982568add8140bcfa2edef7bd3af2b6fed122c1`. The [receipt](evidence/2026-11-14-footnotes-references.json) records changed runtime inputs, tool versions, and output hashes. Artifacts remain in the ignored local `validation-evidence/issue-113/` directory. This is development validation, not release acceptance.

## Acceptance checklist

| Criterion | Result |
| --- | --- |
| Reference forms and images | Full, collapsed, shortcut, repeated, and image references resolve shared definitions and titles. Parser and browser tests cover edits and linked images. |
| Footnote editing and navigation | Insertion avoids identifier collisions. Definition editing, keyboard navigation, repeated references, missing definitions, and unused/duplicate preview navigation pass. |
| Source preservation | Adjacent edits preserve unrelated definitions, placement, identifiers, destinations, and titles. Link text edits retain the shared target. |
| Views, history, save/reopen | Visual/Source/Split, Undo/Redo, save acknowledgments, and reload pass in the production browser harness. Installed-VS-Code persistence remains unverified. |
| Export and readers | HTML/PDF links and native DOCX/EPUB notes pass converter and reader checks below. Native tests also verify image bytes and unchanged source. |
| Syntax edge cases | Code, escapes, Unicode, titles, duplicates, malformed definitions, nested images, and reference-like math have regression coverage. |
| Documentation | The editor guide, support matrix, packaged help, and changelog describe syntax and limits. Source and rendered documentation were reviewed. |

## Verification

| Check | Result |
| --- | --- |
| Compilation and production fixtures | Passed; Node 24.21.0 |
| Complete unit suite | 475 passed, 20 optional checks skipped, 0 failed |
| TypeScript lint | 0 errors; 11 warnings in unchanged files |
| Full browser run | 1,275 passed, 1 stale command-count assertion failed |
| Final affected browser run | 149 passed, 0 failed, retries disabled |
| Real Pandoc reference/footnote test | 1 passed; Pandoc 3.8.3 produced DOCX and EPUB |
| Dependency audit | 0 vulnerabilities |
| Documentation and whitespace | Passed |

The command-count assertion was corrected for the new Footnote action. The final affected run covers that fix, reference/footnote behavior, insertion, exports, and selected UI checks, including new Split and unused-note navigation regressions. The full suite was not repeated after those corrections.

The installed Chromium sandbox helper could not initialize. Browser checks used a temporary local configuration with Chromium's inner sandbox disabled; repository and CI settings were unchanged. Optional converter/package checks were skipped in the ordinary unit run; the explicit Pandoc test ran separately.

## Output inspection

A synthetic document combined shared links, repeated case-varied notes, a table, a quotation, literal code, multi-paragraph notes, and math.

- **HTML:** Chromium displayed resolved links and readable notes without editor controls.
- **PDF:** Rasterized output was visually inspected. All six note/return links resolved; the document also contained six external links.
- **DOCX:** Headless LibreOffice rendered readable page-bottom notes, formatting, links, and math. Repeated references received separate numbers. Interactive Word editing was not tested.
- **EPUB:** EPUB.js displayed the exported book, three native note references, and their bodies. Forward and return navigation worked.

HTML/PDF retain notes at authored locations and share repeated-reference numbers; DOCX/EPUB may repeat native notes. These observations do not establish identical behavior across readers or platforms.

## Reproduction and remaining acceptance

Use the repository root, `.node-version`, and the [testing](../../docs/testing/README.md) and [export verification](../../docs/export-verification.md) guides. The feature-specific checks are:

```sh
CI=1 npx playwright test test/specs/references-footnotes.spec.ts --workers=2 --retries=0
EXPORT_REAL_TOOLS=1 node --test --test-name-pattern='real Pandoc preserves reference links' test/unit/export-backends.test.js
```

Compile and regenerate fixtures first. Set `EXPORT_PANDOC_PATH` if Pandoc is outside tool discovery; the commands use the normal browser configuration.

Remaining acceptance: install a fresh development VSIX in an isolated VS Code profile, edit references and notes in Visual/Source/Split, then save, close, reopen, and compare source while exercising Undo/Redo. Interactive Word editing and save/reopen remain unverified. This report does not close the issue.
