# 11-source visual comparison prompt

Section: **Visual and Source mode identity**. Status: **Prepared prompt; new captures and visual assessment are pending.**

Use this task to prepare one section packet for the [builder](../builder-prompt.md) and a fresh [AI evaluator](../validation-prompt.md). Follow the [AI loop](../plan.md#ai-implementation-and-evaluation-loop) and [comparison policy](../plan.md#comparison-policy). The [reference manifest](../references.json) contains the fixed hashes and exact written intent. Run reference extraction from the [plan](../plan.md#evidence-layout-and-reproducibility) before evaluating.

```text
Evaluate section 11-source using the shared visual validation procedure at reports/plans/2026-10-01-ui-ux-visual-fidelity/validation-prompt.md.
Prepare a self-contained packet for this section only: target regions in both images, excluded unrelated components, chosen reference intent, owner adjustments, criteria, matched states, source/build identity, current renders, and prior discrepancy IDs. Use a fresh evaluator context; do not include the full project conversation or every design. The builder must inspect the reference and actual render before coding, during changes, and before handoff.
Judge only the named target. Ignore unrelated toolbar/sidebar/canvas/chrome differences unless they obstruct this target. On FAIL, send concrete corrections and recheck criteria to the builder, then recapture and re-evaluate.

Open these fixed reference images and verify their manifest hashes:
- .vscode-test/visual-fidelity/references/11-source-moderate.png
- .vscode-test/visual-fidelity/references/11-source-recommended.png

Open the fresh implementation captures and capture receipt in:
reports/validation/ui-ux-visual-fidelity/11-source/iteration-01/
Required evidence includes after.png and the additional state captures below. These are proposed output paths, not supplied PASS evidence. Read the source/build identity and capture settings in the receipt.

Honor these owner scope adjustments:
- Moderate applies to Split only; Visual/Source controls follow Recommended.
- Keep one editable document, shared undo/save and read-only preview; preserve view-only cleanliness.

Evaluate these visual requirements:
- Explicit mode selection and editing authority
- Balanced source/preview composition
- Understandable source/preview correspondence

Track these required section states; each packet names the matched subset under review. A PASS applies only to that subset; other states remain pending:
- Visual
- Source
- Split
- Corresponding selected heading
- Live source editing
- Narrow stacked panes

Return the scoped evidence inventory, discrepancy IDs and corrections with recheck criteria, and PASS/FAIL/BLOCKED for only the section and states named in this packet. Keep final section completion separate from a single-state pass. A working action is not evidence that its appearance matches. Do not invent a similarity percentage or change references/baselines to pass. Final visual acceptance remains with the owner.
```
