# Implementation adaptations

These decisions apply the authorized [system design](system-design.md) to the fixed [selected references](references.json). They describe practical implementation choices; the original artwork, visual requirements and section exclusions remain unchanged. Final evidence belongs in the validation report, not this plan.

## Tables

The selection inspector remains part of the existing placement-aware table controls. Automatic placement and the eight saved placement choices keep their existing setting values. A floating side position uses a compact vertical inspector; top or bottom positions use the same groups horizontally, with keyboard-accessible overflow when necessary. The top-bar option uses the existing reserved toolbar row. This adapts the artwork's permanent right pane to the owner's requirement to retain stored placements.

The inspector groups row/column navigation, the requested insertion diamond, alignment and advanced actions. Coordinate gutters and boundary controls live outside the editable document. Explicit top and side placements reserve an inspector lane outside the writing viewport; automatic and bottom placements reserve space around editable tables. Space is reserved before selection so controls do not cover authored cells, headings or neighboring prose, and selecting a cell does not move it beneath the pointer. Narrow docked layouts retain the complete diamond before using a compact menu; overflow includes the existing row/column selectors when they cannot fit inline. Boundary controls append a row or column at the corresponding outer edge; the diamond retains insertion relative to the selected cell. An overflowing table has labeled left/right scroll buttons beneath it, independent of host scrollbar visibility. Neither gutter labels nor control text enter Markdown, copied table content or exports.

Bottom inspectors leave a dedicated gap below the table for the lower boundary insertion button. This corrects a fresh bottom-right FAIL where the panel covered that button even though the insertion diamond remained available. Both bottom corners receive hit-target and Undo regressions; their stored placement values remain unchanged.

## Find and Replace

The existing submenu keeps its placement and search engine. Persistent Find and Replace with labels survive populated values and diagnostic states. Replacement scope offers the whole document or explicitly selected matches, using the existing selected-match operation. The initial scope remains the whole document. Selected scope disables whole-document replacement and exposes a selected-target count; it does not imply a new section-search feature.

In narrow panes, the submenu docks near the bottom and its result list scrolls within the available height. Selecting a match keeps both its result row and the corresponding Visual or Source text in the unobstructed document viewport. This corrects an unassessable narrow capture where the selected result row was visible but its document highlight was covered by the panel; the earlier BLOCKED remains in history.

## Outline and document details

Outline and Document remain explicit tabs. The Document tab provides compact heading navigation and a current-section cue. Document title, counts and section progress appear once in the shared footer. Long headings wrap at their existing semantic levels. The narrow overlay preserves the same footer and desktop preference. Minimal uses the artwork's restrained blue accent for links and orientation states while headings remain charcoal. One thin active marker and the progress fill share the configured outline accent; explicit saved outline-color choices remain supported.

## Source and block controls

Split keeps one editable source and a read-only preview, with a labeled header for each pane. The VS Code host identifies its separate action as Open in VS Code; other hosts retain the generic text-editor label. View-only code controls gain visible text where space permits and retain compact accessible controls in narrow panes. Successful copying has one visible confirmation in the button and a visually hidden live announcement; actionable errors remain visible. Equation and Mermaid diagnostics remain local, bounded and tied to reliable source positions. A parser's reported line is identified as a diagnostic location rather than silently treated as a proven offending authored line.

The language picker retains a blue current-language mark while a separate neutral highlight follows the pending keyboard choice. Filtering and navigation therefore do not imply that the block language has already changed. Enter confirms the choice through the existing single Undo step; cancellation preserves the source. This corrects a filtered-picker FAIL where Java looked selected while the committed language was JavaScript.

Long equations expose labeled horizontal scrolling for Source and Preview when those panes overflow. The stored equation-wrap preference still controls source wrapping. Mermaid shows a short parser message immediately, with extended output in the existing details disclosure. Split uses a decorative source-heading cue that follows the caret's section without changing selection or authored text; the matching preview heading stays marked. Selected view modes use the configured blue accent.

Mermaid omits message-only line numbers from its visible summary and details when they can conflict with the structured source cue. The original parser message remains in the runtime diagnostic attribute; authored source and the parser's other explanatory text are preserved. Split conceals the code header's editing chrome while retaining the underlying read-only guards. Returning to Visual restores those controls.

When the actual Mermaid parser expects its square-node-end token, a localized closing-delimiter hint explains how to recover. Other parser messages retain the concise fallback. This derives the hint from the parser's expected-token data rather than guessing an offending line from the source. The earlier generic “Parse error” FAIL remains retained, with full parser output available in Diagnostic details.

Expanded diagnostics allow enough bounded height for the submitted parser explanation. Longer output has a styled scrollbar, a named focusable region and a visible keyboard-focus outline. This corrects a fresh FAIL where the smaller details box clipped parser text without a clear continuation cue. Keyboard scrolling remains view-only and does not alter source or Undo history.

## Toolbar and command discovery

The optional contextual workflow retains permanent Insert, Format, view modes and Export controls. Format opens the searchable command palette with explicit category filters, action counts and keyboard navigation. Category changes and search recovery do not edit the document. Narrow overflow preserves each existing command label once, with focus returned to its visible control when closed.

Narrow Insert navigation retains complete command cards and a visible range. At the final page, the viewport fits the complete remaining rows so clipping a preceding card does not leave a blank band above them. The forward action is visibly disabled; Previous remains available. The existing scroll, focus and insertion behavior still preserves the document and its selection. This corrects a terminal-page FAIL without dropping a command or changing the required narrow captures.

Paging uses the same complete-card boundary as the visibility check. A fractionally aligned visible row cannot become its own Previous or Next target. This fixes a full Ubuntu CI regression reproduced locally with a half-pixel row offset; both ordinary and fractional navigation retain complete cards, disabled terminal controls and unchanged document state.

A separate permanent ellipsis in Contextual mode, labeled All actions for assistive technology and hover, makes the complete command palette discoverable beside Format. It uses the existing palette and keyboard behavior. In narrow panes it remains reachable through the toolbar overflow, which closes before the palette opens. Source and Split retain the existing disabled visual-command boundary. This corrects an independent idle/selection FAIL where Format alone did not communicate access to the complete command set. The extra entry is visible only in the optional Contextual session, preserving the space available to docked table controls in the saved Full/Simple modes.

The compact near-selection strip finds an unobstructed position above, below or beside the selection. It protects document blocks and width controls, retains targets of at least 24 pixels, and suppresses the optional strip when no nearby space is available; permanent Format remains accessible. The distance guard controls placement, not the AI's fidelity criteria. Builder inspection rejected an intermediate render that avoided a heading by moving the strip too far away. The independent earlier heading-obstruction FAIL is retained for resolution against the final capture.

## Export

The existing submenu groups format/setup, job status, and output/warnings. Installation guide explicitly labels the existing action that opens bundled export help. Missing Pandoc retains its separate Configure Pandoc settings action. Stage rows use observed host events only: unseen stages are omitted, each stage appears once with its Current or Completed state, and a later stage marks the preceding observed stages complete. Job completion requires a completed host message. Cancellation requests distinguish waiting for host acknowledgement from acknowledged cancellation. Retry repeats the last requested available format after a failure. Synthetic browser captures demonstrate presentation of those message states; installed-host and converter checks remain separate evidence.

Available format rows have a solid button boundary, accent label and trailing action cue. Unavailable rows retain their setup status with a subdued dashed boundary; their existing activation guard remains authoritative. The completed-file action uses the blue accent with contrasting text, while the warning disclosure stays secondary. These changes correct fresh FAIL findings where available formats resembled static text and the enabled output action resembled a disabled control.

## Presentation and acceptance

Stored theme, font, width, alignment, toolbar and source-position defaults remain intact. The neutral review theme is an explicit capture setting, and dark code receives its own capture. A passing AI verdict is scoped evidence for the submitted images and source hashes. It cannot guarantee exact pixels across fonts/platforms or replace functional, security, installed-extension and owner acceptance checks.

The evaluator also bounds context within each section: at most two state cases enter one fresh invocation, and Canvas receives separate one-state contexts, followed by strict aggregation of every required case and criterion. Earlier multi-state Canvas verdicts incorrectly reported lines absent from an unfocused capture. Those FAIL receipts remain in history; separate Canvas contexts and explicit named-image association supply new assessments without changing the artwork or requirements. Direct image/pixel inspection can diagnose evidence problems, but the coordinator never substitutes a builder assertion for an AI PASS.

Every call also receives the complete section state checklist without other states' images. This addresses a Code review that demanded open-picker, wrapped and copied states simultaneously in light/dark rest captures. Those FAIL findings remain retained. The checklist keeps each separate state required and makes no claim about omitted images; genuine long-equation, Mermaid-diagnostic and Split-cue findings received product corrections.

Each private output schema pins the exact section and packet identities, while the coordinator independently rejects mismatched returned identities. This prevents accidental identity substitution without constraining the evaluator's verdict. Rejected outputs remain BLOCKED; they are never edited into an assessment.
