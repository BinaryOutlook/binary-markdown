# AI builder prompt for a scoped visual implementation

Use this prompt before implementing a section and whenever the evaluator returns FAIL. It runs within already authorized product scope. The [plan](plan.md#ai-implementation-and-evaluation-loop) describes the loop; the [evaluator prompt](validation-prompt.md) defines the independent assessment. The [packet example](section-packet.example.json) illustrates the small durable context shared between iterations.

```text
Implement section {SECTION_ID} using the section packet at {PACKET_PATH}.

Before coding:
- Read this packet, including the target, excluded regions, chosen design,
  relevant intent, owner adjustments, states, and acceptance criteria.
- Visually open the reference image and current real application render.
- Identify the target in both images. Write a short visual reading covering
  its composition, proportions, hierarchy, spacing, controls, and previews.
- List the concrete differences you intend to correct. Do not derive the
  design solely from feature names or a remembered image description.

During implementation:
- Work within the authorized component and retain its functional contracts.
- Rebuild/reload the actual application as required. Inspect fresh rendered
  screenshots after meaningful layout or styling changes and correct visible
  mismatches before handing off. Do not rely on CSS intentions alone.
- Ignore unrelated unfinished components unless they obstruct this target.

Before evaluator handoff:
- Capture the real full application view in the packet's matched state.
  Add a clear component capture if necessary; do not hide a required part.
- Record source/build identity, local changes, capture conditions, target
  boundary, and the paths of these fresh images in the iteration packet.
- Compare the target yourself and retain a brief self-check separately.
- Prepare only this section's packet and images for a fresh evaluation.
  Do not prime the evaluator with a success claim or the whole conversation.

When evaluation returns FAIL:
- Read each discrepancy ID, expected/actual difference, correction, and
  recheck criterion. Correct the implementation and create a new iteration.
- Reopen the fixed reference, inspect the new render, update the packet,
  and submit the same scoped section for evaluation again.
- Keep earlier FAIL records. Do not replace the reference, broaden exclusions,
  weaken criteria, or promote an unreviewed screenshot to an accepted baseline.

On a new turn or after compaction, reread the packet, outstanding discrepancy
IDs, reference image, and latest render before continuing. If the required
images or a material decision are missing, state the blocker explicitly.
```

The builder's self-check is preparation for evaluation. It does not replace the evaluator's comparison of the actual rendered images. A PASS applies to the recorded section, states, and revision; functional/security validation and final owner acceptance remain distinct.
