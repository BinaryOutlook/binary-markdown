# Implementation adaptations

These decisions apply the authorized [system design](system-design.md) to the fixed [selected references](references.json). They describe practical implementation choices; the original artwork, visual requirements and section exclusions remain unchanged. Final evidence belongs in the validation report, not this plan.

## Tables

The selection inspector remains part of the existing placement-aware table controls. Automatic placement and the eight saved placement choices keep their existing setting values. A floating side position uses a compact vertical inspector; top or bottom positions use the same groups horizontally, with keyboard-accessible overflow when necessary. The top-bar option uses the existing reserved toolbar row. This adapts the artwork's permanent right pane to the owner's requirement to retain stored placements.

The inspector groups row/column navigation, the requested insertion diamond, alignment and advanced actions. Coordinate gutters and boundary controls live outside the editable document. Explicit top and side placements reserve an inspector lane outside the writing viewport; automatic and bottom placements reserve space around editable tables. Space is reserved before selection so controls do not cover authored cells, headings or neighboring prose, and selecting a cell does not move it beneath the pointer. Narrow docked layouts retain the complete diamond before using a compact menu; overflow includes the existing row/column selectors when they cannot fit inline. Boundary controls append a row or column at the corresponding outer edge; the diamond retains insertion relative to the selected cell. An overflowing table has labeled left/right scroll buttons beneath it, independent of host scrollbar visibility. Neither gutter labels nor control text enter Markdown, copied table content or exports.

## Find and Replace

The existing submenu keeps its placement and search engine. Persistent Find and Replace with labels survive populated values and diagnostic states. Replacement scope offers the whole document or explicitly selected matches, using the existing selected-match operation. The initial scope remains the whole document. Selected scope disables whole-document replacement and exposes a selected-target count; it does not imply a new section-search feature.

## Outline and document details

Outline and Document remain explicit tabs. The Document tab provides compact heading navigation and a current-section cue. Document title, counts and section progress appear once in the shared footer. Long headings wrap at their existing semantic levels. The narrow overlay preserves the same footer and desktop preference.

## Source and block controls

Split keeps one editable source and a read-only preview, with a labeled header for each pane. The VS Code host identifies its separate action as Open in VS Code; other hosts retain the generic text-editor label. View-only code controls gain visible text where space permits and retain compact accessible controls in narrow panes. Equation and Mermaid diagnostics remain local, bounded and tied to reliable source positions. A parser's reported line is identified as a diagnostic location rather than silently treated as a proven offending authored line.

## Toolbar and command discovery

The optional contextual workflow retains permanent Insert, Format, view modes and Export controls. Format opens the searchable command palette with explicit category filters, action counts and keyboard navigation. Category changes and search recovery do not edit the document. Narrow overflow preserves each existing command label once, with focus returned to its visible control when closed.

## Export

The existing submenu groups format/setup, job status, and output/warnings. Stage rows use observed host events only: unseen stages are omitted, and completion is shown only after a completed host message. Cancellation requests distinguish waiting for host acknowledgement from acknowledged cancellation. Retry repeats the last requested available format after a failure. Synthetic browser captures demonstrate presentation of those message states; installed-host and converter checks remain separate evidence.

## Presentation and acceptance

Stored theme, font, width, alignment, toolbar and source-position defaults remain intact. The neutral review theme is an explicit capture setting, and dark code receives its own capture. A passing AI verdict is scoped evidence for the submitted images and source hashes. It cannot guarantee exact pixels across fonts/platforms or replace functional, security, installed-extension and owner acceptance checks.
