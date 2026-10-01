# Review a rendered section with AI

This development workflow compares the actual production UI with one chosen concept at a time. It retains fixed references, fresh full/component screenshots, an independent AI verdict and corrections for the next builder iteration. Functional tests remain separate. An AI PASS is scoped evidence, not final owner acceptance or a release decision. The [system design](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/system-design.md) and [chosen reference manifest](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/references.json) record the authorized design boundaries.

## Prerequisites

Work from the repository root in a dedicated implementation worktree. Follow the [build guide](../building.md) for the checkout's Node version, dependencies and compilation. Install Playwright Chromium using the [testing instructions](README.md). The design commit recorded in the manifest must be available in Git; if necessary, fetch that exact commit from the canonical remote. Captures use synthetic research notes and the production webview markup, CSS and JavaScript. The browser test bridge simulates host messages; its screenshots do not establish installed-extension or converter behavior.

Capture and status commands are local and make no AI calls. The explicit `review` command requires an installed Codex CLI with existing authentication and a version supporting `exec`, `--image`, `--ephemeral`, `--ignore-user-config`, `--sandbox read-only` and `--output-schema`. It uses account usage. No SDK, new API key, authentication change or model override is added. Set `VISUAL_REVIEW_CODEX` to a trusted installed executable if it is not on PATH. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for the maintained browser override described in the testing guide.

## Builder and evaluator loop

1. Read the active section in the manifest and the [builder prompt](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/builder-prompt.md). Open the chosen artwork and a current real UI capture. Identify the target's composition, hierarchy and visible gaps before coding. Keep that visual reading separate from the evaluator packet.
2. Implement within the approved component scope. Rebuild after webview/shared/localization changes, inspect actual fresh renders during changes, and preserve content, settings, selection and shared editing history. A remembered description or CSS intention does not substitute for opening the images.
3. Capture and seal a new iteration, then run the fresh independent evaluator. The example below evaluates Insert and the Moderate Action Palette companion. Use an optional list of case IDs after the section ID to review a smaller subset; the packet and status must still show that remaining states are pending.

```sh
npm run compile
node scripts/visual-review/cli.cjs capture 03-commands
node scripts/visual-review/cli.cjs review .vscode-test/visual-review/03-commands/iteration-001/packet.json
node scripts/visual-review/cli.cjs status
```

The capture command prints the new packet path. Use that exact path for review; subsequent captures increment the iteration number. Local output stays under ignored `.vscode-test/visual-review/<section>/iteration-NNN/`. Each capture retains full and component PNGs, measured target bounds, viewport/theme/locale/scale, fixture/input hashes, source revision/local-change status, renderer-input hash, section criteria, fixed references and prior failures. Source or contract changes invalidate older verdicts; a documentation-only commit may retain the same product input hash while its recorded reviewed revision remains explicit.

4. Read `next.md` beside the packet. On FAIL, fix the prioritized discrepancies and reopen the fixed reference and new real render before submitting another iteration. Keep earlier FAIL evidence. Re-evaluation must resolve every earlier major failure and inspect the new images afresh. Do not change artwork, exclusions, case requirements or tolerances to make a failure disappear.
5. On BLOCKED, restore the named missing evidence or evaluation prerequisite, then capture another iteration. A failed process, malformed model output or missing authentication cannot produce PASS. On PASS, record the section and states reviewed; continue remaining state cases and the other chosen sections. Recheck affected sections after shared layout changes.

At a new builder turn or after compaction, reread the packet and unresolved discrepancy IDs, then reopen its reference and latest application screenshots. Submit only one section to each evaluator invocation. The fresh CLI invocation receives copied packet assets in a private temporary directory outside the checkout, runs read-only and receives no project chat history or builder success claim. Existing account/runtime safety rules still apply.

## Verdicts and scope

| Result | Meaning | Next action |
| --- | --- | --- |
| PASS, exit 0 | All submitted criteria and cases have image evidence; no unresolved Critical/Major discrepancy remains. | Retain the receipt; continue unreviewed states and final owner acceptance. |
| FAIL, exit 2 | An actionable target discrepancy leaves a required visual criterion unmet. | Correct the listed difference, inspect the new render, recapture and review. |
| BLOCKED, exit 3 | Evidence or AI output cannot establish a valid assessment. | Restore the missing prerequisite or evidence; no visual pass is claimed. |
| Setup error, exit 1 | Capture/path/input preparation failed before an assessment could be stored. | Resolve the error and prepare a new packet. |

The evaluator judges the packet's target regions only. An Export assessment ignores an unfinished surrounding toolbar, sidebar and canvas. An excluded element matters only if it obstructs Export; the finding must then describe the Export defect. Full views verify placement and clipping; component views improve legibility. A crop cannot omit a required part. Derived narrow/error/theme states use their written contract and are not presented as direct matches to a different artwork state.

The coordinator validates section/case/criterion/region IDs, complete image acknowledgements, hashes, stale product inputs, prior failure resolutions and conditions for PASS. These checks do not prove that the model noticed every visible problem. The model must cite expected versus observed evidence and concrete corrections, without inventing a similarity percentage. Schema validity and functional CI cannot override a visual FAIL.

## Import another evaluator's result

An image-capable evaluator can inspect the same packet and images with the [shared validation prompt](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/validation-prompt.md) and return the [JSON schema](../../scripts/visual-review/verdict.schema.json). Save its output as a repository-relative ignored file and import it explicitly:

```sh
node scripts/visual-review/cli.cjs import .vscode-test/visual-review/03-commands/iteration-001/packet.json .vscode-test/imported-verdict.json
```

Imports receive the same strict identity/scope checks and cannot overwrite an earlier receipt. The importing person is responsible for selecting a fresh image-capable evaluator; the importer cannot establish the origin or independence of externally supplied model output.

## Verification and publication

Run `node --test test/unit/visual-review.test.js` for offline coordinator checks. The complete unit entry point discovers it automatically. Hosted CI performs no authenticated or paid AI evaluation. Product changes still require the [appropriate regression checks](README.md), full compilation and installed-package evidence where host behavior matters.

Inspect screenshots and retained JSON/Markdown for private data before copying curated evidence into `reports/validation/`. Keep raw evaluator logs and account/runtime paths ignored. The coordinator rejects path traversal, symlink escapes, oversized image/JSON/output inputs, altered references and out-of-scope findings; it executes the trusted CLI through argument arrays and escapes model text in Markdown handoffs. No model-generated command is executed. Record visual verdicts, functional/security checks, installed-host observations and owner acceptance separately, with exact source/build identity.
