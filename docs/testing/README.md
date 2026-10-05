# Validate a change

Use the checkout's [build instructions](../building.md) and [contributor checks](../../CONTRIBUTING.md#checks) before selecting tests for the behavior you changed. [Export verification](../export-verification.md) explains focused checks, real converter tests and installed-extension validation.

## Complete unit suite

From the repository root, run `npm run compile` and `npm run test:unit`. The unit entry point discovers every direct `test/unit/*.test.js` file with Node, so a new suite is included without updating a list or depending on shell wildcard expansion. The same entry point runs in every native CI validation lane and in the documentation fast path. Focused `test:*` commands remain available for individual subsystems.

`npm test` compiles and lints first, then runs the complete unit suite and the full browser suite. Ordinary local unit runs explicitly skip real-converter and package checks when their opt-in prerequisites are absent; they do not establish candidate-level validation. Follow the [candidate instructions](../building.md#validate-a-candidate) to enable those checks and identify the tested VSIX.

## Concept rendering review

For concept-to-render evaluation, use the [scoped AI visual review workflow](visual-review.md). It captures the production browser UI, preserves fixed chosen references, and returns section-only PASS/FAIL/BLOCKED verdicts with a correction handoff. AI evaluation is explicit and separate from functional CI and final owner acceptance.

## Paragraph and table source regressions

From the repository root, run `npm run compile`, `npm run test:markdown-blocks`, `npm run test:table-format`, and `npm run test:build`, then `CI=1 npx playwright test test/specs/paragraph-semantics.spec.ts test/specs/table-source-format.spec.ts --retries=0`. These suites check semantic blocks, all seven themes, soft source wraps, hard breaks, separator preservation, Enter/Backspace, undo/redo, source switching, copy/paste, list continuation, table headers and export preparation. Combined cases edit tables among wrapped prose, hard breaks and unusual separators, and verify exact saved source after a format change. Run the complete browser suite after changes to the shared parser or serializer.

For actual file persistence, build and install a new development VSIX in the [isolated native harness](../../test/native/export-smoke.md), then run its `paragraph-semantics` and `table-source-format` suites against that same package. They measure the installed view, type both kinds of break, save through VS Code, reopen files, check exact source bytes, exercise both table layouts and setting precedence, and export HTML. Both suites also run with `--suite all`. A browser pass alone does not establish installed-host saving or another operating system's behavior.

## Save, list and inline-code regressions

The installed harness includes `save-correctness` and `list-code-preservation` in `--suite all`. Run them against a newly packaged and installed VSIX using the [focused procedure](../../test/native/export-smoke.md#save-list-and-inline-code-preservation). The save check controls delivery of actual editor messages during native Save and compares the captured snapshot, host buffer, disk and reopened Source view. The preservation check covers ordered starts and checklists, literal and padded inline code, Undo/Redo, Source mode and save/reopen. The guide describes their controlled inputs and coverage boundaries; retain results for the exact package tested.

## CI scope and required validation

The [VSIX workflow](../../.github/workflows/ci-vsix.yml) packages one identified candidate on every branch push and pull request. Workflow syntax and security checks run before dependency installation. Branch pushes build and check the package without launching a second full test matrix. Pull requests validate the checked-out merge result. Every `main` push and explicit workflow dispatch runs full validation, even when only documentation changed.

A pull request takes the documentation fast path only when its complete diff against the base contains Markdown under `docs/`, `reports/` or `release-notes/`, or the root `README.md`, `CONTRIBUTING.md`, `AGENTS.md` or `CHANGELOG.md`. It still runs lint, documentation/link/public-text checks, dependency audit, clean packaging, and unit/package checks. Changes to code, tests, dependencies, workflow configuration, `.gitignore`, packaged runtime help, non-Markdown evidence or any unknown path require full validation. Missing or ambiguous comparison data also requires full validation. A documentation-only final commit cannot hide earlier code changes in the same PR.

The required **VSIX validation** result always checks classification and packaging, then requires either every full-validation job to succeed or both expensive job groups to have been intentionally skipped for a documentation-only PR. Failed, cancelled or unexpectedly skipped jobs cannot satisfy it. A branch build does not report this merge gate, and a documentation fast-path result is not release validation.

Full validation keeps all existing platform coverage:

| Lane | Host | VS Code | Browser regression suite |
| --- | --- | --- | --- |
| Ubuntu | Ubuntu x86-64 | Latest stable | Complete suite across three shards, no retries |
| macOS | macOS ARM64 | Latest stable | Complete suite across three shards, no retries |
| Windows | Windows x86-64 | Latest stable | Complete suite across three shards, no retries |
| Minimum supported VS Code | Ubuntu x86-64 | 1.85.0 | Complete native suite; browser suite runs on the other three platforms |

Each native lane verifies the shared candidate bytes and source revision, compiles for archive parity, checks frozen fixtures, and runs unit tests, real converters, the complete installed-VSIX harness and artifact assertions. Nine independent browser jobs run alongside the four native lanes. Each browser job checks out the same source revision and runs one third of its platform's suite with two workers and zero retries. Browser jobs provision only their browser; they do not install export engines or VS Code. See the [Windows guide](windows.md) for native provisioning and platform-specific cases.

The package is available before validation completes. Use the [download procedure](../building.md#download-an-automated-development-build) and the final run status to distinguish packaged from validated snapshots. The installed identity suite compares CI build/run/attempt fields with the actual packaged stamp when present.

The TypeScript browser specs are authoritative where compiled JavaScript copies previously existed. The independent JavaScript suite remains enabled. A unit check rejects new `.spec.js`/`.spec.ts` pairs so generated files cannot silently double discovery again.

### Browser reports and release evidence

Native evidence retains the `validation-<platform>-<source>-<attempt>` artifact names. Browser evidence uses `browser-<platform>-<shard>-<source>-<attempt>` and includes console results, a Playwright blob report and failure traces. Source is the full tested commit; attempt is the workflow run attempt. These artifacts expire after seven days. Release promotion requires all four native evidence archives and all nine browser archives, as well as success for every expected job; it cannot promote a branch build or documentation-only pass.

To combine browser reports locally, download the nine browser artifacts from the same run and attempt into separate directories under an ignored `ci-results/` directory. Copy their `blob-report/*.zip` files into one directory, giving files distinct names if necessary. From the repository root after `npm ci`, merge them with an explicit configuration so reports from different operating systems share the same test root:

```sh
npx playwright merge-reports --config=playwright.config.ts --reporter=html ci-results/all-blob-reports
npx playwright show-report
```

You can reproduce one shard after compilation and `npm run test:build` with `CI=1 npx playwright test --workers=2 --retries=0 --shard=1/3`. Run shards `1/3`, `2/3` and `3/3` to cover a platform completely. Configured checks and estimated speed improvements are not evidence of a successful run; record actual job durations and outcomes.

## Run and inspect native checks

Use the [native harness](../../test/native/export-smoke.md) with a fresh owned profile, an identified VSIX and actual converters. Follow the [artifact audit procedure](../../test/native/export-artifact-audit.md) to inspect outputs, and retain representative reader observations where appearance matters. The [manual copy and outline fixture](../../test/fixtures/manual/copy-paste.md) supports targeted UI checks; it carries no standing pass claim.

Record the source commit, package hash, OS/architecture, tool versions, commands, outcomes and skips. Keep current-run logs and generated files in ignored output directories or CI artifacts. Curated, sanitized summaries belong in [reports/validation](../../reports/README.md#validation), with links to the exact run or compact evidence. Do not include account names, personal documents, machine addresses or raw local profile paths.

## Release validation

Release preparation requires clean source, current identity and notices, a successful workflow for the actual `main` revision, the same validated package bytes, and the required lane evidence. The [release procedure](../releases-and-support.md#maintainer-release-procedure) defines promotion and maintainer review. Native or browser tests alone do not establish target-reader appearance, Remote-SSH/WSL, other architectures or standalone installer compatibility.
