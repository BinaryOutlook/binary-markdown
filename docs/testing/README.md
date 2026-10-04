# Validate a change

Use the checkout's [build instructions](../building.md) and [contributor checks](../../CONTRIBUTING.md#checks) before selecting tests for the behavior you changed. [Export verification](../export-verification.md) explains focused checks, real converter tests and installed-extension validation.

## Complete unit suite

From the repository root, run `npm run compile` and `npm run test:unit`. The unit entry point discovers every direct `test/unit/*.test.js` file with Node, so a new suite is included without updating a list or depending on shell wildcard expansion. The same entry point runs in every CI validation lane. Focused `test:*` commands remain available for individual subsystems.

`npm test` compiles and lints first, then runs the complete unit suite and the full browser suite. Ordinary local unit runs explicitly skip real-converter and package checks when their opt-in prerequisites are absent; they do not establish candidate-level validation. Follow the [candidate instructions](../building.md#validate-a-candidate) to enable those checks and identify the tested VSIX.

## Concept rendering review

For concept-to-render evaluation, use the [scoped AI visual review workflow](visual-review.md). It captures the production browser UI, preserves fixed chosen references, and returns section-only PASS/FAIL/BLOCKED verdicts with a correction handoff. AI evaluation is explicit and separate from functional CI and final owner acceptance.

## Paragraph and table source regressions

From the repository root, run `npm run compile`, `npm run test:markdown-blocks`, `npm run test:table-format`, and `npm run test:build`, then `CI=1 npx playwright test test/specs/paragraph-semantics.spec.ts test/specs/table-source-format.spec.ts --retries=0`. These suites check semantic blocks, all seven themes, soft source wraps, hard breaks, separator preservation, Enter/Backspace, undo/redo, source switching, copy/paste, list continuation, table headers and export preparation. Combined cases edit tables among wrapped prose, hard breaks and unusual separators, and verify exact saved source after a format change. Run the complete browser suite after changes to the shared parser or serializer.

For actual file persistence, build and install a new development VSIX in the [isolated native harness](../../test/native/export-smoke.md), then run its `paragraph-semantics` and `table-source-format` suites against that same package. They measure the installed view, type both kinds of break, save through VS Code, reopen files, check exact source bytes, exercise both table layouts and setting precedence, and export HTML. Both suites also run with `--suite all`. A browser pass alone does not establish installed-host saving or another operating system's behavior.

## Custom section anchor regressions

After compilation, run `npm run test:markdown-blocks`, `npm run test:build`, and `CI=1 npx playwright test test/specs/html-anchors.spec.ts --retries=0`. These checks cover restricted standalone anchors, literal unsupported syntax, source preservation, fragment navigation, all-theme zero-height layout, deletion/replacement, Undo/Redo, Source switching, and prepared HTML targets. Run the complete browser suite after shared parser or serializer changes.

For actual file persistence and host navigation, package and install the development VSIX in the [isolated native harness](../../test/native/export-smoke.md), then run `node test/native/export-smoke.cjs run --suite html-anchors` with the initialization options for that owned profile. Record the exact package identity; browser checks alone do not establish installed-extension saving.

## Save, list and inline-code regressions

The installed harness includes `save-correctness` and `list-code-preservation` in `--suite all`. Run them against a newly packaged and installed VSIX using the [focused procedure](../../test/native/export-smoke.md#save-list-and-inline-code-preservation). The save check controls delivery of actual editor messages during native Save and compares the captured snapshot, host buffer, disk and reopened Source view. The preservation check covers ordered starts and checklists, literal and padded inline code, Undo/Redo, Source mode and save/reopen. The guide describes their controlled inputs and coverage boundaries; retain results for the exact package tested.

## Required candidate validation

The [VSIX workflow](../../.github/workflows/ci-vsix.yml) builds one identified candidate on Ubuntu for every branch push, PR and explicit dispatch. Workflow syntax and security checks run before dependency installation. Every validation lane checks the same package bytes against the source revision before exercising the installed extension.

| Lane | Host | VS Code | Browser regression suite |
| --- | --- | --- | --- |
| Ubuntu | Ubuntu x86-64 | Latest stable | Complete suite, no retries |
| macOS | macOS ARM64 | Latest stable | Complete suite, no retries |
| Windows | Windows x86-64 | Latest stable | Complete suite, no retries |
| Minimum supported VS Code | Ubuntu x86-64 | 1.85.0 | Native compatibility checks; browser suite runs in the other lanes |

Each lane runs compilation, frozen-input checks, unit and real-converter tests, package/source parity checks, the installed-VSIX harness and artifact assertions. The required `VSIX validation` result depends on all lanes. See the [Windows guide](windows.md) for its provisioning and platform-specific cases. Configured checks are requirements; their presence does not mean that a run passed. The package is available before lane validation completes. Use the [download procedure](../building.md#download-an-automated-development-build) and the final run status to distinguish packaged from validated snapshots. The installed identity suite compares CI build/run/attempt fields with the actual packaged stamp when present.

## Run and inspect native checks

Use the [native harness](../../test/native/export-smoke.md) with a fresh owned profile, an identified VSIX and actual converters. Follow the [artifact audit procedure](../../test/native/export-artifact-audit.md) to inspect outputs, and retain representative reader observations where appearance matters. The [manual copy and outline fixture](../../test/fixtures/manual/copy-paste.md) supports targeted UI checks; it carries no standing pass claim.

Record the source commit, package hash, OS/architecture, tool versions, commands, outcomes and skips. Keep current-run logs and generated files in ignored output directories or CI artifacts. Curated, sanitized summaries belong in [reports/validation](../../reports/README.md#validation), with links to the exact run or compact evidence. Do not include account names, personal documents, machine addresses or raw local profile paths.

## Release validation

Release preparation requires clean source, current identity and notices, a successful workflow for the actual `main` revision, the same validated package bytes, and the required lane evidence. The [release procedure](../releases-and-support.md#maintainer-release-procedure) defines promotion and maintainer review. Native or browser tests alone do not establish target-reader appearance, Remote-SSH/WSL, other architectures or standalone installer compatibility.
