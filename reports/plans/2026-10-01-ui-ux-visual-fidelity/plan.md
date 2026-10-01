# UI/UX visual fidelity implementation plan

Date: **2026-10-01**. Status: **Proposed correction plan; product changes and new visual acceptance have not been performed.**

The intended workflow is a focused AI implementation and evaluation loop. The implementing AI inspects the selected design and its actual rendered output; an evaluator then judges only the named section against that design. A FAIL returns concrete corrections to the implementer for another render and evaluation. Each invocation receives a small, explicit section packet so that growing conversation history does not obscure the design requirement.

Canonical `main` was refreshed at `8540d392360cc9c33999c7a045c034ca30fe175b`, the merge of PR #95. The plan is prepared on `feat/ui-ux-visual-fidelity-plan`. Historical [implementation screenshots and checks](../../validation/2026-10-01-selected-ui-ux/report.md) remain evidence for their recorded revisions, not proof that these visual requirements are satisfied.

## Fixed references and scope

The selected designs come from the [original design review](https://github.com/BinaryOutlook/binary-markdown/blob/a798921f7e5a9b01a88360315b035a391f69da47/reports/investigations/2026-09-30-ui-ux-visual-review/report.md) at immutable design revision `a798921f7e5a9b01a88360315b035a391f69da47`. The [reference manifest](references.json) records each image's repository path, SHA-256, dimensions, proposed visual requirements, and capture states. Twelve primary references and two companion references cover the mixed Commands and Views choices. Existing owner selections are carried forward.

An image, its written legend, and the owner's scope adjustments form the visual requirement together. Do not reinterpret the image as a list of feature names. Do not regenerate, replace, or edit a reference to make a failing implementation pass. Annotation circles, caption bands, invented example counters, and unrelated shell details are excluded from comparison. Generated wording can be corrected without changing its visual hierarchy or intended action.

| Section | Selected direction and reference filename | Visual requirements and comparison states |
| --- | --- | --- |
| 01 Canvas | Recommended: `01-canvas-recommended.png` | Comfortable top inset, readable article measure, quiet heading hierarchy, and unobtrusive width guidance. Compare focused/unfocused writing, an empty document, and a short pane. Retain configured font, width, and alignment behavior. |
| 02 Toolbar | Experimental: `02-toolbar-experimental.png` | Calm essential toolbar and a compact selection strip close to selected prose; clear mode and utility actions. Compare no selection, selected prose, disabled contexts, and narrow overflow. Contextual mode stays optional; saved Full/Simple remain available. |
| 03 Commands | Experimental Insert: `03-commands-experimental.png`; Moderate palette: `03-commands-moderate.png` | Balanced category/list composition, readable icon/title/description rows, useful visual previews, and separate shortcut hints. Compare All, a category, a search, no results, and unavailable actions. The rest of the Action Palette follows Moderate, not Experimental. |
| 04 Outline | Experimental: `04-outline-experimental.png` | Legible semantic tree, explicit Outline/Document tabs, unobtrusive reading marker, and one organized information/progress area. Compare nested and long headings, both tabs, scrolled content, and a narrow overlay. Eliminate duplicate statistics. |
| 05 Tables | Experimental: `05-tables-experimental.png`, with the owner's insertion diamond override | Readable row/column coordinates, grouped selection controls, and boundary insertion targets outside authored cell text. Arrange insertion above / left-right / below. Compare header/body selection, wide tables, the inspector, every saved placement, and narrow panes; no obstructed cells or clipped controls. |
| 06 Code | Moderate: `06-code-moderate.png` | Calm explicit language/wrap/copy/text-editor header, understandable copy feedback, readable tokens, and a clear language-search list. Compare horizontal scrolling, wrapped lines, selected language, search, and copied state in light/dark themes. Preserve stationary controls and exact copied/source text. |
| 07 Equations | Recommended: `07-equations-recommended.png` | Clearly separated Source/Preview, concise warning near the faulty expression, and discoverable exit guidance. Compare valid preview, active source, unsupported command, long source, and narrow panes. Preserve authored TeX. |
| 08 Diagrams | Moderate: `08-diagrams-moderate.png` | Explicit Preview/Source modes, calm valid diagrams, concise local errors, and a reliable source-location cue when available. Compare valid, invalid, source editing, and long diagnostics. Do not invent a parser location or an auto-fix action. |
| 09 Find/Replace | Experimental: `09-find-experimental.png`; submenu scope only | Persistent Find/Replace labels, clear primary actions, readable result context, explicit selected targets, and associated highlights. Keep this work within the Find/Replace surface. Compare filled fields, several results, no results, selective replacement, invalid regex, and a narrow pane. |
| 10 Metadata | Recommended: `10-metadata-recommended.png` | Small ownership labels distinguish authored YAML and generated contents; clear Refresh help and action. Compare collapsed/expanded YAML, generated contents, and pending refresh. Preserve raw comments, key order, and view-only cleanliness. |
| 11 Views | Moderate Split: `11-source-moderate.png`; Recommended Visual/Source: `11-source-recommended.png` | Distinct mode controls, balanced source/preview panes, clear editing authority, and understandable corresponding positions. Compare all three modes, a selected heading, live source editing, and narrow stacked panes. Keep one editable document/history/save route. |
| 12 Export | Moderate: `12-export-moderate.png`; submenu scope only | Distinct format/setup, current-job status, and warning/output sections with clear action hierarchy. Compare available/missing tools, running/canceling, failure, and completion with warnings. Do not compare a Checking tools screenshot with a completed-export concept as evidence of equivalence. |

## AI implementation and evaluation loop

This is a proposed workflow, not an implemented evaluator service. Use the [builder prompt](builder-prompt.md), [evaluator prompt](validation-prompt.md), and [section packet example](section-packet.example.json). Keep one section active in each evaluation. A toolbar, Export submenu, or Insert workspace is a valid target; the evaluator must not grade the whole product when the packet names one component.

| Stage | AI responsibility | Retained output |
| --- | --- | --- |
| 1. Inspect before coding | The builder opens the selected reference and the current real application render. It identifies the target region in each image and records the intended composition and visible gaps. | A short visual reading and prioritized changes for this section. |
| 2. Implement and inspect | The builder edits the scoped component, rebuilds or reloads the actual application, and inspects fresh screenshots during the work. It checks that the visible result matches its intended change. | Current render, source/build identity, and a builder self-check. |
| 3. Evaluate with fresh context | A separate evaluation invocation receives only this section's packet, selected reference, current rendered images, scope adjustments, and criteria. The first comparison is made from the images before consulting the builder's explanation. | PASS, FAIL, or BLOCKED and a discrepancy list. |
| 4. Return FAIL to the builder | Each discrepancy identifies the visible region, expected versus actual appearance, a concrete correction, and what the next screenshot must demonstrate. The builder fixes it and recaptures. | A new iteration and a re-evaluation of the same section, including previously failed criteria. |
| 5. Retain the result | A PASS is tied to the reviewed section, states, reference hash, and source/build identity. Shared changes that affect it require re-evaluation. | Section assessment; remaining states and whole-product review remain separate. |

The evaluator uses a fresh context for each iteration where the available runtime supports it. Do not feed it the entire project conversation, all twelve designs, or an assertion that the builder has already succeeded. The builder and evaluator may be the same model, but separate contexts reduce dependence on the builder's own explanation. They do not guarantee an objective or infallible judgment. A returned verdict must still cite visible evidence.

### Section scope and excluded regions

The packet names the target and identifies its region in both full images with a clear description and, where useful, measured bounds. Retain a full application screenshot to establish that the component was actually rendered in the product. Add a legible component capture when the full image is too small for comparison; preserve proportions and keep the full image available for checking the boundary.

For an Export evaluation, compare only the Export header/body, format/setup, job status, warning/output groups, and their actions. Ignore the surrounding toolbar, outline, writing canvas, and desktop chrome, even if they differ from the concept or represent unfinished designs. Those differences must not affect Export's verdict. If an excluded element overlaps or blocks an Export control, record the obstruction as a defect affecting Export. Do not widen the verdict to that element's own design.

In general, full-screen context establishes location, scale, clipping, and obstruction of the target. It does not authorize evaluating unrelated components. The evaluator verifies that the target description actually includes the complete component; a crop that hides a missing required part cannot obtain a PASS. If the boundary is ambiguous, return BLOCKED and request a precise region rather than guessing.

### Keeping intent explicit as context grows

Keep the durable packet beside each iteration's evidence. It contains the section ID and state, chosen reference path/hash, target and exclusions, relevant design intent, owner adjustments, visual criteria, current source/build identity, capture conditions, and unresolved discrepancy IDs. Extract only the selected section from [the reference manifest](references.json); the evaluator should not need to read the complete plan or reconstruct decisions from chat history.

At the start of a new builder turn, after context compaction, and before each capture or evaluation, reopen that section packet, the reference image, and the latest actual render. A text summary of the image does not replace viewing it again. The next evaluator receives the updated packet and new images; it also receives the prior discrepancy IDs to verify corrections, after forming its own initial image comparison. Do not silently change criteria, exclusions, or the chosen reference between iterations.

Use stable discrepancy IDs such as `EXP-01`. Keep each FAIL and the subsequent correction record. If repeated iterations leave the same major discrepancy unchanged, revisit the reference interpretation and implementation assumptions; do not lower the standard or accept the result merely because a retry limit was reached. Escalate a genuine scope or feasibility decision with the images and the attempted corrections.

Human visual review remains a final product decision. Routine FAIL-to-fix iterations are handled by the AI loop and do not require a new owner approval at every iteration.

## Implementation sequence

| Step | Work | Exit evidence |
| --- | --- | --- |
| 1. Freeze each visual requirement | Verify reference hashes. Define the compared region, layouts, sizing, labels, fixtures, and owner-approved adaptations before editing the component. | Complete requirement record and reproducible capture recipe; unresolved material layout decisions remain visible. |
| 2. Establish shared component styling | Translate the original 8 px spacing rhythm, approximately 6 px radii, thin borders, quiet surfaces, readable type, and restrained accent into shared styles. Respect themes and user preferences. | Reference-backed sizing/type specification and a representative light/dark comparison; no global default-theme switch. |
| 3. Prove the workflow on Insert | Repair the category/list proportions, command-row hierarchy, previews, and shortcut presentation. Use actual table/equation/code previews rather than raw fences as a substitute for the reference's previews. | Fresh matched screenshots and an explicit visual PASS for section 03, plus relevant insertion/focus/undo checks. |
| 4. Repair the other largest gaps | Address Tables and Find/Replace one section at a time, followed by Outline/Document. Build proper table-coordinate gutters and insertion targets; remove duplicate rail information and unclear field purpose. | One comparison record per section, no unresolved Critical/Major visual issues, and targeted behavior/security results. |
| 5. Complete the remaining sections | Apply the shared language to Canvas/Toolbar, Code/Equations/Diagrams, Metadata/Views, and Export. Preserve each chosen novelty level and the restricted submenu scopes. | Each of the twelve sections passes its own comparison; dependencies receive a fresh check after shared-style changes. |
| 6. Check the complete product | Inspect the combined screen, theme/locale variants, zoom, narrow panes, and the rebuilt installed extension. Run the full relevant regression/build/security gates. | Cohesive full-screen gallery, exact build identity, functional checks, and owner visual acceptance recorded separately. |

Insert is the pilot because its present text-heavy list exposes the gap clearly and can establish the reusable row, category, preview, and panel patterns. Do not proceed through all twelve sections while the pilot still visibly departs from its reference. Make focused commits after each locally reviewed section; keep failed attempts distinguishable from accepted evidence.

### Decisions to settle in each requirement record

Submenu-only scope for Find and Export permits adapting the outer panel placement; it does not permit discarding the concept's hierarchy, labels, grouping, or result/status organization. The table diamond supersedes the concept's 2 × 2 insertion arrangement. Record how the selection inspector fits the retained placement preferences before implementing it. Any new setting, default change, scope expansion, or material layout compromise needs an explicit owner decision rather than an evaluator inventing an exception.

The generated artboards illustrate proportions; they are not executable layout specifications. Derive practical CSS dimensions from the relevant UI region and verify the result visually. Capture settings can be chosen to reproduce the reference; changing a user's saved preferences is a separate product decision.

## Comparison policy

Use the [shared validation prompt](validation-prompt.md) with a packet prepared from the relevant section prompt in [the manifest](references.json). The evaluator must open and visually inspect both the unmodified reference image and the fresh implementation capture. Code inspection can guide a correction after identifying a visible discrepancy; source descriptions, feature lists, test counts, or the builder's explanation do not establish visual fidelity.

1. Match the theme, locale, zoom, document shape/content, panel size, scroll position, selection, and interaction state. Compare the relevant UI region at a consistent scale, excluding design annotations and unrelated chrome. Record remaining differences in the capture receipt.
2. Capture the baseline and the corrected component from the production UI with synthetic data. Name each source revision and local-change state. Capture an installed-extension example after rebuilding/reinstalling where host integration affects the surface.
3. Evaluate composition, hierarchy, typography, spacing, control grouping, preview quality, readable states, focus, overlap/clipping, and the intended interaction. Cite visible reference and actual evidence for each requirement.
4. Return PASS, FAIL, or BLOCKED for only the named section and states, plus a discrepancy table with stable ID, severity, expected appearance, observed appearance, affected region, concrete correction, and a recheck criterion. Excluded components cannot change the verdict unless they obstruct the target. BLOCKED applies to missing/unreadable references or captures, ambiguous boundaries, and materially incomparable states.
5. Fix the failed requirements and recapture. Re-run affected sections after shared layout/style changes. Compare the old and new evidence without changing the design reference.

Identify which states the selected image actually depicts. Those states receive a direct reference comparison. For a supplementary state not pictured, agree its derived visual requirements before implementation: reuse the selected component's grouping, spacing, typography, and state language, together with the existing behavioral contract. Record that this is a derived-state assessment rather than a direct image match. Missing material state requirements make that state BLOCKED; the evaluator must not invent a new design or compare unlike states to claim fidelity.

| Severity or verdict | Meaning |
| --- | --- |
| Critical | Controls obstruct authored content, important actions are unreachable, an editing boundary is misleading, or a severe accessibility/security problem is observed. |
| Major | Required composition, hierarchy, labels, previews, grouped controls, or state organization visibly depart from the selected design, even if the action works. |
| Minor | A localized refinement that does not change understanding or access; expected rasterization differences must be recorded rather than treated as a defect. |
| PASS | Every criterion and state named in this evaluation packet has evidence; no unresolved Critical/Major issue or unapproved deviation remains. Identify the section and states passed; a single-state PASS does not establish the whole section or product as accepted. |
| FAIL | A required visual/interaction criterion is unsatisfied. Passing behavioral tests cannot override this verdict. |
| BLOCKED | Evidence is absent, unreadable, or materially mismatched. State the missing capture or decision without claiming a pass. |

Do not invent a percentage such as 95% similarity from visual judgment. Do not average away a missing major feature with a high score in another category. An automatic review can miss problems; owner review remains the final visual acceptance step.

## Evidence layout and reproducibility

All command paths below are relative to the repository root. Prerequisites are Git, Python 3, access to the design revision, and the [documented build/test environment](../../../docs/building.md). Obtain the design objects with `git fetch origin a798921f7e5a9b01a88360315b035a391f69da47` if they are absent. Extraction preserves the original bytes and verifies the manifest hashes; it does not require another person's checkout.

```sh
python3 - <<'PY'
import hashlib
import json
import subprocess
from pathlib import Path

manifest = json.loads(Path('reports/plans/2026-10-01-ui-ux-visual-fidelity/references.json').read_text())
for section in manifest['sections']:
    for reference in section['references']:
        blob = subprocess.run(['git', 'show', manifest['designCommit'] + ':' + reference['sourcePath']], check=True, capture_output=True).stdout
        if hashlib.sha256(blob).hexdigest() != reference['sha256']:
            raise SystemExit('Reference hash mismatch: ' + reference['sourcePath'])
        output = Path(reference['localPath'])
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(blob)
print('Verified and extracted 14 fixed reference images.')
PY
```

References are extracted into the ignored `.vscode-test/visual-fidelity/references/` directory to avoid duplicating large design assets in this documentation change. Each section's proposed evidence folder is `reports/validation/ui-ux-visual-fidelity/<section-id>/iteration-01/`; keep later iterations separately. Retain a fresh implementation PNG, comparison Markdown, and a small receipt with reference hashes, source/build identity, viewport, theme, locale, zoom, fixture/input hash, state, verdict, and remaining issues. Evidence folders and screenshots are proposed outputs, not supplied acceptance results in this plan.

Create a local side-by-side gallery that shows the original reference and fresh implementation at comparable scales; neither panel should distort the source image. Inspect full-size images and the combined screen. Public evidence must use synthetic inputs and pass image/metadata/prose privacy review. Keep raw native logs, machine paths, and private documents out of the report.

## Automated regression after visual agreement

First establish visual fidelity against the chosen concept and have the owner approve representative rendered states. Then use those real application screenshots as stable regression baselines. A newly generated screenshot of the current implementation is not automatically an accepted baseline. Changing baselines or difference tolerances solely to clear a failure defeats the check.

Playwright supports screenshot assertions and produces image comparisons. Keep browser/OS/fonts and capture conditions fixed for a baseline; rendering can vary across environments. Its [visual-comparison documentation](https://playwright.dev/docs/test-snapshots) describes screenshot assertions and environment constraints. Pixel comparisons against an approved application baseline are useful for later drift; a full-frame pixel comparison against generated artwork with different captions/content is not the initial acceptance gate.

Add stable capture cases beside the existing [selected-design tests](../../../test/specs/selected-ui-ux.spec.ts). Cover labels, panel proportions, preview presence, control bounds, and overlay collisions with meaningful geometry/DOM assertions as well as snapshots. Keep selection, source preservation, undo, saving, host output access, and parser/search boundaries covered by the [existing test procedures](../../../docs/testing/README.md). A screenshot pass must not allow a behavioral or security regression.

## Deliverable and approval boundary

For each section, the review package should contain the selected reference, matched fresh captures for the required states, the discrepancy table, relevant functional checks, exact source identity, and a plainly stated visual verdict. The complete-product package also needs a cohesion review and installed-extension observations. Record **visual assessed**, **functional checked**, **security checked**, and **owner accepted** as separate states.

This planning change does not correct product visuals, create an approved screenshot baseline, publish a new candidate, or establish any section's visual PASS. The next implementation pass should use this proposed procedure once its detailed visual requirements and adaptations are agreed.
