# Export subsystem

Reference · Maintained with the source in this checkout. Dated validation records identify their own tested revisions and environments.

This is the authoritative reference for Binary Markdown's experimental export contract: scope, format support, functional and non-functional requirements, workload, and acceptance criteria. The requirements describe expected behavior; they do not certify that every case has passed in every environment. Dated validation records identify the packages and environments actually tested.

The specification originated in this fork's export workstream at commit `5488f37` on 2026-09-09. Its original plan and decisions are preserved in the [development history](../archive/development/export.md). This documentation revision preserves all 43 FRs, 15 NFRs, and 15 acceptance criteria without changing their table entries.

## Reading guide

| You want to... | Read |
| --- | --- |
| Try export with a small document | [Export your first HTML document](export-tutorial.md) |
| Configure tools or troubleshoot an export | [Export from Binary Markdown](../media/export-help.md) |
| Look up supported content and requirements | [Format support](#rendering-and-format-support), [functional requirements](#functional-requirements), and [non-functional requirements](#non-functional-requirements) |
| Understand implementation boundaries | [How export works](export-architecture.md) |
| Validate an export change | [Contributor verification guide](export-verification.md) |
| Inspect dated results | [Export-branch evidence](../reports/validation/2026-09-10-export.md), [0.2.0 integration evidence](../reports/validation/0.2.0.md), and [PDF appearance evidence](../reports/investigations/2026-09-12-export-page-background.md) |
| Understand earlier decisions and milestones | [Development history](../archive/development/export.md) |

This is the first area applying the [documentation standard](documentation-standard.md). Contributor workflow is described in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Outcome and confirmed scope

Deliver a user-visible workflow in which a user saves a local Markdown document, selects HTML, PDF, DOCX, or EPUB, and receives a usable export beside the source. Explain recoverable compromises and fatal failures clearly. The first release may have simple layout and limited customization; preservation of supported content, source integrity, truthful progress, and safe file handling remain required.

Markdown is the authoritative source. Export is responsible for accurate supported content, usable native document structure and compatibility verified in the stated reader versions. Subsequent editing in a word processor follows that application's native conventions. Editable DOCX output does not promise code-editor behavior inside the receiving application. The [user-facing export scope](../media/export-help.md#export-scope-and-editing) explains the recommended workflow and known limitations.

For DOCX code under AC-07, verify initial content, whitespace, numbering and layout, retained editable text, and reader save/reopen behavior. Basic editing checks remain useful compatibility evidence and can identify exporter defects. The maintainer's [2026-09-21 scope decision](../reports/validation/2026-09-21-docx-reader-checkpoint.md#maintainer-scope-decision-2026-09-21) accepts the documented Enter-on-empty-numbered-line behavior as a reader limitation; retain its observed result separately from acceptance status. This exception does not waive other required checks or excuse malformed output, source loss, or incorrect export configuration. No format or supported-host requirement changes.

The following decisions define the export MVP.

| Area | Confirmed decision |
| --- | --- |
| Required host | Local desktop VS Code on macOS ARM64, Ubuntu x86-64 and Windows x86-64. All three require validation of the same candidate. Experimental local Linux export is enabled; other distributions and architectures require their own evidence. Keep shared editor/Electron builds compatible. |
| Formats | Standalone HTML, rendered PDF, Word `.docx`, and EPUB. All four are required by the MVP contract. |
| HTML/PDF fidelity | Reuse supported displayed rendering. HTML retains current appearance; PDF defaults to a white page with GitHub light appearance, with an option to retain the current theme across the whole page. Keep the existing renderer. |
| DOCX/EPUB fidelity | Prioritize editable text and document structure; disclose styling/layout differences. |
| Source eligibility | Named, saved Markdown only. Show “save and retry” for unsaved work; no automatic save. |
| Resources | Embed/package original-resolution supported images and prepared diagrams/math. Retrieve only referenced resources needed for the export. Conversion stays local. |
| PDF pagination | Keep ordinary blocks together when they fit a page. Blank space is acceptable. Split oversized text/code/tables; scale oversized graphics to fit. |
| Dependency delivery | Detect installed Pandoc and a compatible browser, accept manual paths, and provide installation instructions. Bundle needed JavaScript/assets; native binaries and automatic downloading are deferred. |
| Entry point | A sharing-arrow button immediately to the right of the VS Code-logo toolbar button, opening a four-format dropdown. |
| Output location | Automatically beside the Markdown file, using its filename stem and the selected extension. No destination or filename dialog. |
| Collisions | Hash completed export bytes, use the last eight lowercase SHA-256 hexadecimal characters, reuse an identical hash-named file, otherwise choose the first unused numbered suffix. Never overwrite. |
| Progress | Show real operation stages and indeterminate activity during opaque work. No export-duration, throughput, or response-time targets. |
| Initial workload | An inspectable, approximately 30-page complex Markdown report with mixed content and assets, defined as W-30 below. |
| Limitations | Mark the feature experimental early. Continue recoverable cases with visible fallbacks and a warning summary; report fatal failures separately. |

These choices supersede exploratory proposals for Save As, Save and Export, overwrite prompts, bundled runtimes, and numerical performance targets. The aim is a useful first release with a clear support boundary. Future community contributions can improve it; their arrival is not a delivery dependency.

### Terms and requirement authority

- **Saved revision:** the named source file's content after pending editor-to-host changes and saving have completed.
- **Export job:** one selected format generated from one fixed saved revision, its prepared resources, and resolved appearance.
- **Source stem:** the source filename without its final Markdown extension; `report.md` becomes `report.pdf`.
- **Recoverable problem:** a content/resource problem for which valid output with an explicit fallback remains possible.
- **Fatal problem:** a condition preventing valid output, such as a missing engine, failed conversion, or unwritable destination.
- **Stage progress:** the operation actually underway. An active indicator does not assert a measured percentage or guarantee eventual success.

All FRs and NFRs below have **Must** priority within the current MVP. **User** identifies a direct product decision; **Derived** identifies a necessary integration safeguard. An acceptance criterion is a verification obligation, not a claim that a test has passed. Preserve requirement IDs as the design evolves, and use [Changes to this contract](#changes-to-this-contract) for material changes.

## Rendering and format support

Render the entire captured document, including when the editor is in source mode. Reuse the production renderer with a document-only boundary; copying the live editor's visible viewport or a stale hidden preview is insufficient. Remove controls, caret/selection markup, hidden editors, host bridges, scroll-height restrictions, and active document-supplied scripts. Wait for actual math, diagram, font, and image readiness before capturing output.

The [fixed fixtures](../test/fixtures/exports/README.md) exercise the following support boundary. Implemented behavior and representative checks do not establish compatibility with every document or target viewer; dated observations are recorded in [export-validation.md](../reports/validation/2026-09-10-export.md) and [0.2.0 integration validation](../reports/validation/0.2.0.md).

| Content | HTML/PDF target | DOCX/EPUB target |
| --- | --- | --- |
| Headings, prose, lists, links, tables, code | Supported displayed content and captured appearance; PDF uses the selected white/theme mode and adapts for print. | Editable text and structural equivalents. |
| Mathematics | Inline `$...$` / `\(...\)`, display `$$...$$` / `\[...\]`, and fenced `math` blocks render with KaTeX styles/fonts. Backslash recognition follows the editor setting. Each display block is one complete TeX expression. | Pandoc produces native DOCX Office Math and EPUB MathML for supported equations. Enabled backslash delimiters are normalized in an export-only copy; TeX commands and source files are preserved. Unsupported expressions require declared fallbacks. |
| Mermaid/diagrams | Wait for diagram rendering; retain vector form where practical. | Package target-compatible assets; do not silently leave supported diagrams as code. |
| Images and fonts | Resolve and embed needed assets; standalone HTML works after relocation offline. | Package compatible media; preserve source resolution without deliberate downsampling. |
| Raw HTML, editor extensions, unsupported constructs | Follow declared renderer support and remove editor-only machinery. | Explicit target-specific behavior; visible fallback/warning for known incompatible content. |
| Front matter, TOC, internal image directives | Exclude front matter/editor-only directives from visible content. Save expands `[TOC]` markers and refreshes managed contents. Exports require current TOCs and include links to unique heading destinations without editor controls or boundary comments. | Normalize temporary input deliberately; avoid duplicate TOCs or leaked directives. |
| Footnotes | Existing footnote markers/definitions remain visible source with a warning; linked footnotes are not generated. | Use Pandoc's supported native note/navigation structures, with target-specific verification. |

Do not claim a parser capability merely because Pandoc can write its output format. Existing rendering bugs are not silently expanded into export guarantees. Declare known limitations and preserve supported content; fallback acceptance is not permission to hide a regression by downgrading the support matrix.

## Functional requirements

### Entry and format selection

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-001 | The system shall place an Export button immediately to the right of the existing VS Code-logo toolbar button. | User | AC-01 |
| FR-EXP-002 | The Export button shall use a rightward sharing-arrow icon with a stem curving toward the bottom. | User | AC-01 |
| FR-EXP-003 | Activating the Export button shall open a dropdown containing HTML, PDF, Word (.docx), and EPUB options. | User | AC-01 |
| FR-EXP-004 | Selecting a format shall initiate the export checks for the Markdown document associated with that editor. | User | AC-01, AC-02 |
| FR-EXP-005 | The export interface shall identify formats that require missing dependencies and make the corresponding setup guidance accessible. | Derived | AC-05 |
| FR-EXP-006 | The export interface shall make the experimental status and known format limitations available before conversion begins. | User | AC-01, AC-08 |

The current insertion point is in the utility group in [editor-body-html.js](../src/shared/editor-body-html.js). Icon population is handled by [editor.js](../src/webview/editor.js). These are implementation pointers, not a requirement to change unrelated toolbar behavior or create a separate preferences page.

### Source eligibility and revision consistency

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-007 | When the selected document is unnamed or has unsaved changes, the system shall reject the export and explain that the user must save and retry. | User | AC-02 |
| FR-EXP-008 | An export request shall not save the source document automatically. | User | AC-02 |
| FR-EXP-009 | The system shall permit conversion only after the editor content and saved revision have been confirmed to agree. | Derived | AC-02 |
| FR-EXP-010 | Changes made after an export job captures its saved revision shall not change the source content used by that job. | Derived | AC-02 |

### Output formats and resources

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-011 | HTML export shall produce a standalone document containing the complete supported rendered document without editor controls or host-bridge dependencies. | User | AC-03 |
| FR-EXP-012 | PDF export shall generate a PDF from the prepared rendered document using the selected browser engine without opening a visible browser window. | User | AC-06 |
| FR-EXP-013 | DOCX export shall produce a Word document through the selected Pandoc executable. | User | AC-07 |
| FR-EXP-014 | EPUB export shall produce an EPUB document through the selected Pandoc executable. | User | AC-07 |
| FR-EXP-015 | The system shall resolve relative resource references against the saved Markdown document's resource location. | Derived | AC-04 |
| FR-EXP-016 | The system shall embed or package supported source images without deliberate source-resolution reduction. | User | AC-04 |
| FR-EXP-017 | The system shall retrieve online resources only when they are referenced and needed by the selected export. | User | AC-04, AC-12 |
| FR-EXP-018 | The system shall prepare supported mathematical content in the representation appropriate to the selected format. | User | AC-03, AC-07, AC-08 |
| FR-EXP-019 | The system shall prepare supported diagrams as exportable assets for the selected format. | User | AC-03, AC-04, AC-07 |

“Preserve resolution” does not require displaying a large image at its intrinsic pixel dimensions, nor does it require byte-identical image encoding inside every output container. HTML asset embedding can preserve the original bytes; PDF/document backends may require format-specific encoding. Generated diagrams should retain their vector representation where the target supports it. Existing renderer limitations must be declared rather than silently presented as newly supported syntax.

### Simple PDF pagination

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-020 | When an ordinary block fits a whole printable page but not the remaining space on the current page, the PDF layout shall move that block to the next page. | User | AC-06 |
| FR-EXP-021 | A text, code, or table block larger than a whole printable page shall be split across pages without omitting its content. | Derived | AC-06 |
| FR-EXP-022 | An image or diagram larger than the printable page shall be scaled to fit while preserving its aspect ratio. | Derived | AC-06 |

Large blank regions are acceptable. Advanced pagination optimization is deferred. Reference paper size/margins belong to the fixture/export defaults; matching the precise page count of every target application is not required.

### PDF page appearance

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-042 | `binary-markdown.export.pdfWhiteBackground` shall default to `true`. PDF shall use a white page and a coherent GitHub light appearance for text, code, math and generated diagram labels, while retaining the captured base font size. This setting shall not change the editor or other export formats. | User, 2026-09-12 | AC-15 |
| FR-EXP-043 | With the white-background option disabled, PDF shall paint the captured theme background across the entire A4 page, including margins and the unused part of the final page, while retaining 16 mm content margins. | User, 2026-09-12 | AC-15 |

The effective appearance is captured once with the saved revision, before dependency discovery and asynchronous rendering. Offscreen Mermaid rendering uses that palette and restores the live renderer configuration after completion, failure or cancellation. Explicit colours inside source images and diagram node styles remain authored content; white mode is not image recolouring. DOCX keeps Pandoc's page styling: the investigated defect does not require DOCX page-background rewriting. See [the bug record](../reports/investigations/2026-09-12-export-page-background.md) and [issue #6](https://github.com/BinaryOutlook/binary-markdown-fork/issues/6).

### Dependency configuration

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-023 | For each external export tool, the system shall attempt automatic discovery of a usable installed executable. | User | AC-05 |
| FR-EXP-024 | The system shall allow a user to configure a manual executable path for each external export tool. | User | AC-05 |
| FR-EXP-025 | When an explicit executable path is unusable, the system shall report that problem rather than silently substituting a different executable. | Derived | AC-05 |
| FR-EXP-026 | When a required tool is unavailable, the system shall provide instructions for installing or configuring that tool. | User | AC-05 |

Executable overrides are machine-specific settings. Tool installation is user-managed in the MVP; no bundled native tools or automatic downloader is required.

### Automatic output naming

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-027 | The system shall save a successful export automatically without requiring a filename or destination dialog. | User | AC-09 |
| FR-EXP-028 | The default output filename shall use the source stem followed by `.html`, `.pdf`, `.docx`, or `.epub`, according to the selected format. | User | AC-09 |
| FR-EXP-029 | The system shall save the output beside the source Markdown file. | User | AC-09 |
| FR-EXP-030 | If the basic output filename is occupied, the system shall append an underscore and the final eight lowercase hexadecimal characters of the SHA-256 digest of the completed export bytes before the output extension. | User | AC-09 |
| FR-EXP-031 | If the hash-suffixed destination already contains byte-identical export content, the system shall reuse that file as the export result without rewriting it. | User | AC-09 |
| FR-EXP-041 | If the hash-suffixed destination contains different bytes, the system shall append an incrementing suffix starting at `_2` before the output extension until an unused filename is selected. | User | AC-09 |
| FR-EXP-032 | When the automatic destination cannot be written, the system shall report the failure without silently selecting a different location. | Derived | AC-09 |

Candidate names are `report.pdf`, `report_<hash8>.pdf`, and, when the hash name contains different bytes, `report_<hash8>_2.pdf`, `report_<hash8>_3.pdf`, and so on. Eight hexadecimal characters are not a uniqueness guarantee; the numeric suffix resolves remaining collisions. Hash the completed artifact and do not alter its bytes after calculating the suffix. The output filename must not feed back into a self-referential hash computation. No overwrite operation is authorized by this naming policy, including if another job claims a filename during finalization.

Reuse is reported as an existing identical export, with its actual location. It is not reported as a newly written file. The basic name's occupancy triggers the hash rule even if that basic file happens to be identical; identical-content reuse applies at the hash-suffixed destination.

### Progress, warnings, cancellation, and completion

| ID | Requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| FR-EXP-033 | When an export request is accepted for processing, the system shall display an active export status. | User | AC-10 |
| FR-EXP-034 | When the export enters a different operation stage, the system shall update the displayed stage to describe that operation. | User | AC-10 |
| FR-EXP-035 | While an operation remains active without finer-grained progress information, the system shall retain a clearly indeterminate activity indicator for that operation. | User | AC-10 |
| FR-EXP-036 | When a recoverable content/resource problem occurs, the system shall continue conversion with an identifiable visible fallback in the output. | User | AC-08 |
| FR-EXP-037 | When export completes with recoverable problems, the system shall present a summary identifying the affected content/resources and their fallbacks. | User | AC-08, AC-10 |
| FR-EXP-038 | The system shall provide a user action to cancel an active export job. | Derived | AC-11 |
| FR-EXP-039 | On successful completion, the system shall display the actual saved output location. | Derived | AC-09, AC-10 |
| FR-EXP-040 | On cancellation or fatal failure, the system shall display the corresponding outcome instead of reporting export success. | Derived | AC-10, AC-11 |

Examples of real stages are checking the saved document, checking dependencies, preparing resources, rendering diagrams, converting with Pandoc, rendering PDF, and saving the output. Stages may differ by format and should not be simulated merely to make the interface look busy. A backend that supplies no conversion percentage can remain at “Converting to Word…” with an indeterminate indicator until a genuine state change occurs. Known completed-resource counts may be shown when measured; fabricated percentages and completion-time estimates are not required.

## Non-functional requirements

There are **no export-duration, throughput, or response-time targets** in this specification. The user's quality priorities are truthful status visibility, continued usability, integrity, and successful handling of the representative workload. Stage-display actions are FRs; their accuracy and usability are captured below as NFRs.

| ID | Quality attribute and requirement | Basis | Acceptance |
| --- | --- | --- | --- |
| NFR-EXP-001 | **Status accuracy:** Displayed export progress shall be consistent with actual job state and shall not imply measured advancement from elapsed time alone. | User | AC-10 |
| NFR-EXP-002 | **Responsiveness:** An active export shall leave the editor usable for normal interaction and access to cancellation. | User/Derived | AC-10, AC-11, AC-13 |
| NFR-EXP-003 | **Source integrity:** Export processing shall leave the Markdown source, its dirty state, selection, and undo history unchanged. | Derived | AC-02, AC-11 |
| NFR-EXP-004 | **Existing-file integrity:** Export processing shall not overwrite an existing destination file, including when another job creates the candidate filename concurrently. | User/Derived | AC-09, AC-11 |
| NFR-EXP-005 | **Output integrity:** Only a completed, structurally valid artifact shall be exposed as a successful export. | Derived | AC-07, AC-09, AC-11 |
| NFR-EXP-006 | **Dependency isolation:** Failure or absence of a format-specific dependency shall not prevent export through an otherwise available backend. | User/Derived | AC-05 |
| NFR-EXP-007 | **Resource lifecycle:** Finished, cancelled, or failed jobs shall not leave owned rendering/conversion workers running or abandoned partial output files. | Derived | AC-11 |
| NFR-EXP-008 | **Host compatibility:** The packaged subsystem shall operate in the declared local macOS ARM64, Ubuntu x86-64 and Windows x86-64 VS Code environments using only its shipped assets and explicitly installed dependencies. Other distributions and architectures require separate evidence. | User, including Ubuntu and Windows validation requests | AC-14 |
| NFR-EXP-009 | **Accessibility:** The export control, format menu, progress information, and cancellation action shall be usable by keyboard and expose meaningful accessible names/state. | Derived | AC-01, AC-10, AC-11 |
| NFR-EXP-010 | **Localization:** Export UI and settings shall follow the application's existing separation of runtime UI language and native VS Code settings localization. | Derived | AC-01, AC-05 |
| NFR-EXP-011 | **Privacy:** Conversion shall occur locally without uploading the Markdown document to a conversion service. | User/Derived | AC-12 |
| NFR-EXP-012 | **Execution safety:** Export shall not execute commands, filters, or active scripts supplied by document content as instructions to the host. | Derived | AC-12 |
| NFR-EXP-013 | **Portability:** A completed standalone HTML export shall render its supported document content after relocation without fetching external resources. | User | AC-03, AC-04 |
| NFR-EXP-014 | **Fidelity:** Export shall retain supported document content and structure according to the declared format-support matrix, with visible/accounted-for fallbacks for known unsupported content. | User | AC-03, AC-06, AC-07, AC-08, AC-13 |
| NFR-EXP-015 | **Workload suitability:** The subsystem shall successfully export the defined approximately 30-page complex-report Markdown fixture to all four MVP formats on the declared test environment. | User | AC-13 |

For HTML/PDF, fidelity refers to supported displayed rendering and captured appearance, including PDF's selected white/theme mode. For DOCX/EPUB, fidelity prioritizes editable text and structure, including native mathematical objects where supported, rather than identical browser styling. Scaling an image for layout does not require reducing its stored source resolution. The support matrix must name current limitations; accepting warnings is not permission to silently omit supported content.

## Reference workload W-30

The initial acceptance target is an approximately 30-page complex technical report, not an assertion of coverage for a measured percentage of users. The implementer owns selecting a suitable public reference and preparing the Markdown input; no personal document needs to be supplied by the user.

Before evaluating W-30, record:

- A stable Markdown fixture and asset manifest, with source provenance and hashes. If adapting external material, record its reuse terms before committing that material.
- Representative headings, prose, nested lists, tables, code, equations, diagrams, local/referenced images, and links. Include content that exercises page-boundary behavior. Identify supported constructs separately from deliberate unsupported-content cases.
- Source and asset sizes, content inventory, reference PDF page count, page settings, renderer/engine versions, font setup, and the test environment. These describe the workload; they are not speed limits.
- A reference layout producing approximately 30 pages. The exported HTML/EPUB need not have a fixed page count, and DOCX/PDF pagination may differ with layout and accepted blank space.

A downloaded PDF can guide fixture selection, but copying that PDF through the system does not test Markdown export. Use inspectable Markdown and assets as the actual input. The W-30 source content and expected outcomes should be fixed before using them as acceptance evidence; do not retrospectively redefine the fixture to hide failed cases.

Passing W-30 requires readable/structurally valid artifacts, preserved supported content, accounted-for fallbacks, valid progress, and safe completion. It does not require a particular duration. Measurements may be retained as diagnostic evidence, without turning them into NFR thresholds.

The selected input is [w30-report.md](../test/fixtures/exports/w30-report.md), an original synthetic engineering report frozen as `exports-v1` with the other inputs/assets in [manifest.json](../test/fixtures/exports/manifest.json). Its 12,438 whitespace-delimited words, 84,675 UTF-8 bytes, 24 scenario cards and oversized appendices are workload descriptors. The [fixture README](../test/fixtures/exports/README.md) records provenance and content expectations; the public NIST reference supplies a complexity example without copied report content.

The [historical workload record](../reports/validation/2026-09-10-export.md) records the original **35-page** reference-layout calibration. The original macOS native W-30 PDF is **51 pages**, and the subsequent Ubuntu native PDF is **54 pages** under captured editor appearance. These are different layout observations on the frozen workload: the latter provides capacity/content evidence and is not a failure to hit an exact page-count target. Preserve the frozen input and verify content, pagination and fallbacks; do not shorten it to force a count. See the [export validation report](../reports/validation/2026-09-10-export.md) for the dated calibration, artifact, and inspection record. W-30 has been exported through all four native paths and its exact artifacts re-audited; human product acceptance remains separate.

## Acceptance criteria and milestone mapping

| ID | Observable acceptance criterion | Milestone |
| --- | --- | --- |
| AC-01 | In the native editor's supported toolbar modes, verify the Export position/icon, all four menu entries, accessible keyboard operation, localized labels, and access to experimental/format information. Activating it preserves the document's editing state. | D2, D5 |
| AC-02 | Verify untitled/dirty rejection without saving; then type distinctive text, save, and export immediately in both editor modes. Verify correct document/revision, unchanged source/editor state, and consistent output if editing continues after capture. | D1, D5 |
| AC-03 | Export a supported rendering fixture to HTML, relocate it, and open it offline. Verify complete document content/current appearance and the absence of editor controls or host dependencies. | D2 |
| AC-04 | Exercise original-resolution images, paths with spaces/non-ASCII characters, fonts, equations, and diagrams. Verify embedded HTML image bytes/dimensions, portable supported resources, and named fallbacks for unavailable references. | D2, D3, D5 |
| AC-05 | Exercise detected, manually configured, missing, and invalid executables in an installed extension. Verify native settings/localization, setup guidance, and continued availability of independent formats. | D3, D4, D5 |
| AC-06 | Produce a real PDF with a block that moves to the next page, oversized code/table content with identifiable first/last lines, and a large graphic. Inspect page renderings for preservation and fit; blank space is acceptable. | D4 |
| AC-07 | Run real DOCX/EPUB conversions; inspect structure/media and representative target-viewer rendering. Verify editable text/structure and supported native math rather than treating process exit status as sufficient evidence. | D3, D5 |
| AC-08 | Trigger a known unsupported block and a missing resource. Verify an identifiable fallback in output and a corresponding warning summary. Trigger a fatal error separately and verify failure reporting. | D2–D5 |
| AC-09 | Exercise automatic naming beside the source on an empty destination, occupied basic name, byte-identical hash name, hash name with different content, occupied numeric suffixes, a concurrent name claim, and an unwritable directory. Recompute SHA-256 from the completed export bytes; verify the suffix, identical-file reuse, first unused numeric name, and preservation of existing files. | D2, D3, D4, D5 |
| AC-10 | Exercise actual stage changes and a controllable long-running backend without fine-grained progress events. Verify truthful stage labels, continued activity visibility, usable editor controls, and correct final status without a percentage or timing target. | D2–D5 |
| AC-11 | Cancel during resource preparation and backend conversion, and induce a failed write/worker failure. Verify the reported outcome, cleanup, source/existing-output preservation, and absence of success for partial files. | D2–D5 |
| AC-12 | Inspect resource requests and exercise document text resembling commands/active content. Verify only needed referenced resources are retrieved, no document upload occurs, and content is not treated as executable instructions. | D2, D3, D4, D5 |
| AC-13 | Run fixed W-30 input through all four formats, inspect supported content/fallbacks and representative output pages, and observe valid progress and continued editor usability. Record the workload/environment, without pass/fail timing thresholds. | D0 fixture; D5 verification |
| AC-14 | Install the same actual VSIX in isolated local macOS ARM64, Ubuntu x86-64 and Windows x86-64 VS Code profiles, independently of any development server, record resolved external tools and host architecture/runtime, and reproduce the native entry/save/export flows. Missing-dependency cases remain part of this check. SSH may orchestrate the Ubuntu desktop process; VS Code Remote-SSH remains outside scope. | D2 early smoke; D5 final; subsequent Ubuntu and Windows extensions |
| AC-15 | Verify default/explicit-white and theme-retaining PDF modes across all seven themes. Rasterize multi-page A4 output and check every page edge, margins and final blank area; check readable light text, code, math and Mermaid labels. Confirm captured settings survive later changes and cancellation, setting changes leave the editor intact, translations resolve, and HTML/DOCX/EPUB appearance is unaffected by the PDF setting. Compare DOCX page/style XML across themes. | D4, D5 |

These criteria are specification targets, not executed results. Record unavailable target viewers or required host checks as unverified. Existing regression failures must be distinguished from new ones; disabling assertions or replacing expected output with the implementation's own output does not establish acceptance.

## Deferred scope

The configured Windows lane extends the current acceptance requirement, not the coverage of earlier releases. Its [initial preparation report](../reports/validation/2026-09-14-windows-preparation.md) records local results and pending Windows execution. Use the current candidate's workflow outcome before claiming that this obligation has passed.

Deferred work includes Windows ARM64, untested Linux distributions/architectures and remote-host acceptance, browser-only VS Code, Electron export integration, unsaved/untitled export, batch export, destination/name customization, templates and styling controls beyond the PDF background and code-language settings, image compression/storage optimization, advanced pagination, native runtime bundles/downloaders, typeset PDF, additional Pandoc writers, whole-document image export, arbitrary filters/custom commands, and a full renderer/parser replacement.

Potential later paths include Electron's built-in PDF API, managed native-tool installation, additional Pandoc profiles or PDF engines, and richer print layout. They should be selected from user feedback and concrete failed cases, with their own requirements and acceptance evidence. No current MVP acceptance depends on delivering them.

## Changes to this contract

Keep requirement IDs stable. For a proposed change, record the behavior, affected FR/NFR/AC IDs, evidence, alternatives, and effect on the support matrix. Update the requirement and its acceptance case together after the decision. Mark retired IDs superseded and retain their history rather than reusing their numbers.

Maintainer decisions are needed for changes to formats, supported hosts, saved-only behavior, naming, resource policy, fidelity promises, mandatory native dependencies, or acceptance criteria. Routine internal implementation choices can proceed within the existing contract. Record consequential design decisions with context, alternatives, and consequences; link the affected requirements.

Use the [verification guide](export-verification.md) for current contributor checks. Preserve dated test results and record new observations separately.

## Previous section links

Existing links into the original handoff remain available here.

| Earlier section | New location |
| --- | --- |
| <a id="user-journey"></a>User journey | [Read the section](../media/export-help.md#export-a-saved-document) |
| <a id="architecture-and-implementation-boundaries"></a>Architecture and implementation boundaries | [Read the section](export-architecture.md) |
| <a id="shared-contracts"></a>Shared contracts | [Read the section](export-architecture.md#shared-contracts) |
| <a id="dependency-and-resource-handling"></a>Dependency and resource handling | [Read the section](export-architecture.md#dependency-and-resource-handling) |
| <a id="repository-map-and-integration-pitfalls"></a>Repository map and integration pitfalls | [Read the section](export-architecture.md#repository-map-and-integration-pitfalls) |
| <a id="delivery-backlog"></a>Delivery backlog | [Read the section](../archive/development/export.md#delivery-backlog) |
| <a id="ticket-boundaries-and-implementation-notes"></a>Ticket boundaries and implementation notes | [Read the section](../archive/development/export.md#ticket-boundaries-and-implementation-notes) |
| <a id="verification-and-handback"></a>Verification and handback | [Read the section](../archive/development/export.md#verification-and-handback) |
| <a id="definition-of-ready-for-review"></a>Definition of ready for review | [Read the section](../archive/development/export.md#definition-of-ready-for-review) |
| <a id="agile-and-human-ai-working-agreement"></a>Agile and human-AI working agreement | [Read the section](../archive/development/export.md#agile-and-human-ai-working-agreement) |
| <a id="flexibility-and-escalation"></a>Flexibility and escalation | [Read the section](../archive/development/export.md#flexibility-and-escalation) |
| <a id="resumable-status-record"></a>Resumable status record | [Read the section](../archive/development/export.md#resumable-status-record) |
| <a id="decision-log"></a>Decision log | [Read the section](../archive/development/export.md#decision-log) |
| <a id="reconnaissance-and-remaining-risks"></a>Reconnaissance and remaining risks | [Read the section](../archive/development/export.md#reconnaissance-and-remaining-risks) |
| <a id="feasibility-and-rival-approaches"></a>Feasibility and rival approaches | [Read the section](../archive/development/export.md#feasibility-and-rival-approaches) |
| <a id="historical-probes"></a>Historical probes | [Read the section](../archive/development/export.md#historical-probes) |
| <a id="dependency-size-tradeoff"></a>Dependency size tradeoff | [Read the section](../archive/development/export.md#dependency-size-tradeoff) |
| <a id="risks-to-resolve-through-the-milestones"></a>Risks to resolve through the milestones | [Read the section](../archive/development/export.md#risks-to-resolve-through-the-milestones) |
| <a id="delegation-prompt"></a>Delegation prompt | [Read the section](../archive/development/export.md#delegation-prompt) |

## Development addendum: front matter and TOC (v0.2-YAML_AUX)

User-approved scope, 2026-09-14. The saved-source requirement remains unchanged.

| Requirement | Behavior | Acceptance |
| --- | --- | --- |
| FR-EXP-043 | Save preparation refreshes explicitly managed TOCs using the same source generator as manual refresh. No conversion/rendering work is added to the native save participant. | Native and keyboard saves in visual/source modes preserve metadata and write current entries; repeated saves are unchanged. |
| FR-EXP-044 | Export verifies that managed TOCs match the captured saved source and rejects stale/malformed regions without editing or saving the source. | Clean-but-stale input cannot reach conversion or produce a success output. |
| FR-EXP-045 | HTML/PDF include TOC entries with unique heading destinations, excluding refresh controls and boundary comments. Front matter remains absent from the visible body. | Inspect real HTML links and PDF internal-link destinations; no generated page numbers or PDF bookmarks are promised. |

The editor stores raw leading metadata and ordinary Markdown links within named TOC boundaries. See [behavior and implementation scope](yaml-toc.md). DOCX/EPUB strip managed comment boundaries before conversion and retain generated links. Existing metadata allowlisting remains in effect. The dated 0.2.0 validation receipts remain historical evidence; this addendum does not retroactively extend their coverage.
