# 05-tables visual comparison prompt

Section: **Contextual table controls**. Status: **Prepared prompt; new captures and visual assessment are pending.**

Use this task to prepare one section packet for the [builder](../builder-prompt.md) and a fresh [AI evaluator](../validation-prompt.md). Follow the [AI loop](../plan.md#ai-implementation-and-evaluation-loop) and [comparison policy](../plan.md#comparison-policy). The [reference manifest](../references.json) contains the fixed hashes and exact written intent. Run reference extraction from the [plan](../plan.md#evidence-layout-and-reproducibility) before evaluating.

```text
Evaluate section 05-tables using the shared visual validation procedure at reports/plans/2026-10-01-ui-ux-visual-fidelity/validation-prompt.md.
Prepare a self-contained packet for this section only: target regions in both images, excluded unrelated components, chosen reference intent, owner adjustments, criteria, matched states, source/build identity, current renders, and prior discrepancy IDs. Use a fresh evaluator context; do not include the full project conversation or every design. The builder must inspect the reference and actual render before coding, during changes, and before handoff.
Judge only the named target. Ignore unrelated toolbar/sidebar/canvas/chrome differences unless they obstruct this target. On FAIL, send concrete corrections and recheck criteria to the builder, then recapture and re-evaluate.

Open these fixed reference images and verify their manifest hashes:
- .vscode-test/visual-fidelity/references/05-tables-experimental.png

Open the fresh implementation captures and capture receipt in:
reports/validation/ui-ux-visual-fidelity/05-tables/iteration-01/
Required evidence includes after.png and the additional state captures below. These are proposed output paths, not supplied PASS evidence. Read the source/build identity and capture settings in the receipt.

Honor these owner scope adjustments:
- The owner replaces the image's 2 by 2 insertion buttons with a diamond: above / left-right / below.
- Retain existing stored placement choices and plain Markdown semantics; record the inspector-placement adaptation before implementation.

Evaluate these visual requirements:
- Readable coordinate gutters
- Grouped selection/alignment controls and the requested diamond
- Insertion targets outside authored cell content; no obstruction or clipping

Track these required section states; each packet names the matched subset under review. A PASS applies only to that subset; other states remain pending:
- Body and header selection
- Coordinates and boundary insertion
- Wide table scrolling
- Each saved placement
- Narrow pane

Return the scoped evidence inventory, discrepancy IDs and corrections with recheck criteria, and PASS/FAIL/BLOCKED for only the section and states named in this packet. Keep final section completion separate from a single-state pass. A working action is not evidence that its appearance matches. Do not invent a similarity percentage or change references/baselines to pass. Final visual acceptance remains with the owner.
```
