# Review a rendered section with AI

This development workflow compares the actual production UI with one chosen concept at a time. It retains fixed references, fresh full/component screenshots, an independent AI verdict and corrections for the next builder iteration. Functional tests remain separate. An AI PASS is scoped evidence, not final owner acceptance or a release decision. The [system design](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/system-design.md) and [chosen reference manifest](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/references.json) record the authorized design boundaries.

## Prerequisites

Work from the repository root in a dedicated implementation worktree. Follow the [build guide](../building.md) for the checkout's Node version, dependencies and compilation. Install Playwright Chromium using the [testing instructions](README.md). The design commit recorded in the manifest must be available in Git; if necessary, fetch that exact commit from the canonical remote. Captures use synthetic research notes and the production webview markup, CSS and JavaScript. The browser test bridge simulates host messages; its screenshots do not establish installed-extension or converter behavior.

Capture and status commands are local and make no AI calls. The explicit `review` command requires an installed Codex CLI with existing authentication and a version supporting `exec`, `--image`, `--ephemeral`, `--ignore-user-config`, `--sandbox read-only` and `--output-schema`. It sends the supplied screenshots, artwork and scoped packet context to Codex/OpenAI and uses account usage. No SDK, new API key, authentication change or model override is added. Set `VISUAL_REVIEW_CODEX` to a trusted installed executable if it is not on PATH. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` for the maintained browser override described in the testing guide.

## Builder and evaluator loop

1. Read the active section in the manifest and the [builder prompt](../../reports/plans/2026-10-01-ui-ux-visual-fidelity/builder-prompt.md). Open the chosen artwork and a current real UI capture. Identify the target's composition, hierarchy and visible gaps before coding. Keep that visual reading separate from the evaluator packet.
2. Implement within the approved component scope. Rebuild after webview/shared/localization changes, inspect actual fresh renders during changes, and preserve content, settings, selection and shared editing history. A remembered description or CSS intention does not substitute for opening the images.
3. Capture and seal a new iteration, then run the fresh independent evaluator. Capture recipes cover all twelve selected sections in the [state registry](../../scripts/visual-review/sections.json). The example below evaluates Insert and the Moderate Action Palette companion. Use an optional list of case IDs after the section ID to review a smaller subset; the packet and status must still show that remaining states are pending.

```sh
npm run compile
node scripts/visual-review/cli.cjs capture 03-commands
node scripts/visual-review/cli.cjs review .vscode-test/visual-review/03-commands/iteration-001/packet.json
node scripts/visual-review/cli.cjs status
```

The capture command prints the new packet path. Use that exact path for review; subsequent captures increment the iteration number. Local output stays under ignored `.vscode-test/visual-review/<section>/iteration-NNN/`. Each capture retains full and component PNGs, measured target bounds, viewport/theme/locale/scale, observed theme tokens, fixture/input hashes, source revision/local-change status, renderer-input hash, section criteria, fixed references and prior failures. Canvas recipes verify actual editor focus after focusing a visible control; a hidden control cannot establish an unfocused state. Source or contract changes invalidate older verdicts; a documentation-only commit may retain the same product input hash while its recorded reviewed revision remains explicit.

To prepare a consistent set after shared layout changes, use `node scripts/visual-review/cli.cjs capture all`. It captures sections sequentially and prints one packet path for each. Review each packet separately: `all` is a capture convenience, not a combined evaluator judgment. Freeze product and coordinator inputs during review; changes require fresh captures and verdicts for the final handoff. Partial captures, interrupted preparation and missing receipts remain pending or BLOCKED in status.

Review partitions the section's ordered cases into groups of at most two states; Canvas uses one state per invocation because its focused and unfocused images are nearly identical. Each group receives a fresh invocation with the same section art, criteria and exclusions, plus only the prior IDs relevant to its cases. The evaluator associates each named full/target pair with its case and may reopen only the supplied files with the local image viewer. Unclear image association requires BLOCKED. This bounds image context within the section as well as excluding other sections. `groups.json` retains the original assessments; `receipt.json` combines them deterministically. Every case and criterion remains required. A FAIL cannot be averaged into PASS, and a missing or invalid group blocks the section. Validated failures from completed groups remain in the next builder packet even when another group's provider fails. Raw `group-NNN.log` and rejected output files remain ignored.

Each group also receives `sectionCaseChecklist`, the complete list of required case IDs, states and comparison contracts, without the other cases' images. This preserves knowledge of separately reviewed interaction states while bounding image context. A rest/theme capture is judged for the controls actually expected there; an open picker, activated wrap or temporary copied feedback remains required in its separate capture. The evaluator cannot claim to have inspected an omitted image or excuse a visible defect through that checklist.

The private output schema pins `packetDigest` and `sectionId` to the current group through single-value enums. PASS, FAIL and BLOCKED remain available. The coordinator independently validates the returned identity even if a provider bypasses its schema. An earlier Canvas identity mismatch remains BLOCKED in history; a later capture must receive a valid fresh assessment rather than rewriting that rejected output.

Capture rebuilds the shared standalone browser fixture. Run captures sequentially, and finish them before starting browser tests or another fixture build in the same worktree. Concurrent readers can otherwise see a partially rewritten fixture; that harness error cannot establish a product failure or pass.

| Section | Selected concept | Required evidence |
| --- | --- | --- |
| 01 Canvas | Recommended | Focused/unfocused guides, empty document, short and narrow panes. |
| 02 Toolbar | Experimental | Idle and selected context, protected code, Source, all-actions panel and narrow overflow. |
| 03 Commands | Experimental Insert; Moderate palette | Categories, filled/empty search, unavailable context, both ends of narrow navigation and palette. |
| 04 Outline | Experimental | Nested/long headings, both tabs, reading position and narrow overlay. |
| 05 Tables | Experimental with the owner's insertion diamond | Body/header selection, external gutters/boundaries, horizontal scroll, narrow pane and all eight saved placements. |
| 06 Code | Moderate | Stationary controls at rest and while scrolled, wrap, language search, copied feedback and light/dark rendering. |
| 07 Equations | Recommended | Preview/source, unsupported command, long source and narrow layout. |
| 08 Diagrams | Moderate | Valid preview, invalid source, local diagnostic, expanded details and narrow layout. |
| 09 Find | Experimental submenu | Persistent labels, selected results, no matches, invalid/expensive regex and narrow layout. |
| 10 Metadata | Recommended | Collapsed/expanded raw YAML, generated contents, pending changes and explicit refresh. |
| 11 Views | Moderate Split; Recommended Visual/Source | Mode controls, individual pane labels, correspondence, shared source editing and narrow layout. |
| 12 Export | Moderate submenu | Availability/setup, observed running stages, cancellation request, failure/retry, completion/output/warnings and narrow layout. |

4. Read `next.md` beside the packet. On FAIL, fix the prioritized discrepancies and reopen the fixed reference and new real render before submitting another iteration. Keep earlier FAIL evidence. Re-evaluation must resolve every earlier major failure and inspect the new images afresh. Do not change artwork, exclusions, case requirements or tolerances to make a failure disappear.
5. On BLOCKED, restore the named missing evidence or evaluation prerequisite, then capture another iteration. A failed process, malformed model output or missing authentication cannot produce PASS. On PASS, record the section and states reviewed; continue remaining state cases and the other chosen sections. Recheck affected sections after shared layout changes.

At a new builder turn or after compaction, reread the packet and unresolved discrepancy IDs, then reopen its reference and latest application screenshots. Submit only one section to each evaluator invocation. The fresh CLI invocation receives copied packet assets in a private temporary directory outside the checkout, runs read-only and receives no project chat history or builder success claim. Existing account/runtime safety rules still apply.

The retained builder packet includes complete earlier discrepancy descriptions and corrections. The evaluator's context projection includes only prior IDs and their associated case, criterion and region; earlier reviewers' prose is withheld so a mistaken observation does not become evidence in the next judgment. All current images, fixed references, criteria and scope remain available. Its `packetDigest` identifies the original sealed builder packet, not a hash of the projected context. The coordinator still requires a current-image resolution for every prior ID and preserves the original FAIL receipt.

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

Inspect screenshots and retained JSON/Markdown for private data before copying curated evidence into `reports/validation/`. Keep raw evaluator logs and account/runtime paths ignored. The coordinator rejects path traversal, symlink escapes, oversized image/JSON/output inputs, altered references and out-of-scope findings; it executes the trusted CLI through argument arrays and escapes model text in Markdown handoffs. Its PNG checks bound header dimensions and file size; they do not fully decode pixels or validate every PNG chunk. Fully decode publication images and audit their metadata separately. No model-generated command is executed. The fresh read-only invocation reduces evaluator context; it is not an operating-system filesystem jail. Record visual verdicts, functional/security checks, installed-host observations and owner acceptance separately, with exact source/build identity.

For this review, `node scripts/publish-visual-review.cjs` curates the latest complete PASS packet for every registered section into `reports/validation/2026-10-02-ui-ux-visual-fidelity/`. It validates current product/contract identities and complete required cases before copying any output. Finish all section evaluations first, then write an audited `.vscode-test/visual-review/delivery-validation.json` object with a `markdown` string containing the observed commands/results, security scope, installed build identity, current CI result and remaining owner checks. This prose is supplied by the contributor; the publisher does not independently verify those factual claims.

The publisher requires Python 3's standard-library ZIP support in addition to the Node dependencies above. It retains unchanged packet/receipt bytes, earlier verdict history, full and target PNGs, original chosen artwork, and an asset map with hashes. Earlier iteration image paths refer to the ignored local archive; only final cases and the labeled historical screenshot are copied. `report.md` supports GitHub review, while `report.html` uses the same folder's assets. The printed standalone HTML path embeds images and JSON evidence for offline sharing; `delivery/ui-ux-visual-fidelity.html.zip` inside the report folder contains that single file with neutral archive metadata. Supplemental repository guides require a network connection. All three versions require privacy and rendered-layout review before publication. Neither HTML version runs JavaScript.
