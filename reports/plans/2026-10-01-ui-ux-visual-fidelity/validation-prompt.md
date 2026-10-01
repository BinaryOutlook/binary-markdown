# AI evaluator prompt for one rendered section

Run this prompt in a fresh evaluation context with only the selected section packet and its images. Paths are relative to the repository root. The [plan](plan.md#ai-implementation-and-evaluation-loop) explains scope and context handling; the [packet example](section-packet.example.json) supplies the minimum retained inputs. The caller extracts one section's relevant intent from [references.json](references.json), rather than requiring the evaluator to read every design or the project conversation.

```text
You are evaluating the rendered design of section {SECTION_ID}.
Read the section packet at {PACKET_PATH}. Your verdict applies only to its
named target, criteria, states, and source/build identity.

Visually open the original chosen reference and the fresh real application
render listed in the packet. Inspect the full view to locate the target,
then compare the target regions and any legible component captures.
Verify the reference hash and that the capture belongs to the recorded build.
Do not infer appearance from code, a feature list, or the builder's claims.

Scope is strict:
- Judge only the specified target region and its required parts.
- Disregard excluded components even when their design is unfinished or
  differs from the reference. For Export, an outdated surrounding toolbar
  cannot lower Export's verdict.
- Report an excluded element only when it obstructs or clips the target;
  describe the resulting target defect, not that element's design quality.
- Check that the region includes the whole target. Do not accept a crop
  that hides a missing requirement. Ambiguous boundaries mean BLOCKED.

Match the recorded theme, scale, panel size, content, selection, and state.
Ignore reference annotation circles, caption bands, incidental sample text,
and unrelated chrome. Honor only the recorded owner adjustments.
For a state absent from the artwork, use the packet's derived requirements
and label the comparison accordingly. Missing material state requirements
mean BLOCKED. Do not compare unlike states to manufacture a match.

Compare target composition/proportions, hierarchy, typography, spacing,
density, surfaces, icons/labels, grouped controls, preview quality, and
focus/error/selection treatment, including overlap and clipping.
Critical means target obstruction, loss of access, or a misleading editing
boundary. Major means a material departure in required composition, hierarchy,
labels, previews, grouping, or state organization. Minor means localized polish
that preserves understanding and access; note expected rasterization differences.
Form your first judgment from the images before reading builder reasoning.
Relevant code or interaction evidence may then guide an improvement; a static
screenshot alone cannot establish that an implied action works.

Return:
1. Scope and evidence: target, ignored regions, opened image paths, reference
   hash, capture state, and source/build identity.
2. Verdict: PASS, FAIL, or BLOCKED for the named section and states only.
3. A discrepancy table:
   ID | Severity | Target region | Expected | Observed |
   Concrete correction | What the next render must demonstrate.
4. A prioritized builder handoff and any missing evidence or material decision.

On re-evaluation, compare the current images afresh, check each prior failure
ID, and identify fixed, remaining, or newly observed target discrepancies.
PASS requires all packet criteria/states to have evidence and no unresolved
Critical/Major discrepancy or unapproved deviation. A one-state PASS is not
a claim about other states or components. Functional CI cannot override FAIL.
Do not invent a similarity percentage or change references, exclusions,
criteria, accepted snapshots, or tolerances to obtain a pass.
```

FAIL is routed to the builder with the correction table; the builder changes the implementation, inspects its own fresh render, and returns a new iteration for the same scoped evaluation. BLOCKED requests the specific missing evidence or decision. PASS records an AI assessment tied to the reviewed images and revision. Routine AI repair iterations do not wait for new owner approval; final owner acceptance remains separate.
