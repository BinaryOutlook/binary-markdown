# Export fixtures

These are fixed input documents for [the export subsystem contract](../../../docs/export-subsystem.md). They establish expected content before conversion tests are run. Their presence does **not** mean that an export backend, installed VSIX, target viewer, or W-30 has passed acceptance.

The fixture revision is `exports-v1`, authored on 2026-09-09. Input Markdown and asset SHA-256 digests are frozen in [manifest.json](manifest.json). Run `python3 test/fixtures/exports/verify-fixtures.py` from the repository root to verify those bytes and the fixed content inventory. Do not regenerate expectations from a failing export or silently shorten a fixture to make it pass. A deliberate fixture revision needs a reason and refreshed hashes before it becomes new acceptance input.

## Inputs

| File | Purpose | Fixed inspection landmarks |
| --- | --- | --- |
| [basic.md](basic.md) | Small mixed-content document with front matter, TOC, headings, nested lists, checklist, table, code, inline/display math, Mermaid, image, links, footnote and simple raw HTML | `BASIC-FIRST-MARKER`, `BASIC-LAST-MARKER`, `BASIC_CODE_FIRST`/`BASIC_CODE_LAST`, `BASIC-HTML-MARKER`, `BASIC-FOOTNOTE-MARKER` |
| [fallbacks.md](fallbacks.md) | Deliberately missing image, unsupported math, invalid Mermaid, disclosure HTML and inert active-content probes | `FALLBACK-FIRST-MARKER`, `FALLBACK-LAST-MARKER`, `MISSING-IMAGE-MARKER`, `UNSUPPORTED-MATH-AFTER-MARKER`, `INVALID-MERMAID-SOURCE-MARKER`, raw HTML summary/body markers |
| [pagination.md](pagination.md) | Ordinary quotation near a page boundary, 160-line code block, 96-row table and tall image | `PAGE-MOVE-FIRST-MARKER`/`PAGE-MOVE-LAST-MARKER`; `PAGINATION-CODE-FIRST-MARKER`/`PAGINATION-CODE-LAST-MARKER`; `PAGINATION-TABLE-FIRST-MARKER`/`PAGINATION-TABLE-LAST-MARKER`; final paragraph |
| [w30-report.md](w30-report.md) | W-30 candidate: coherent original synthetic engineering report, 24 scenario cards and large-content appendices | `W30-FIRST-MARKER`, `W30-LAST-MARKER`, all `SCENARIO-A01-MARKER` through `SCENARIO-A24-MARKER`, first/last oversized code/table markers and post-fallback/post-graphic markers |

The W-30 source contains **12,438 whitespace-delimited words** and **84,675 UTF-8 bytes** at the frozen revision. Word count is a reproducible workload descriptor (`len(text.split())`), including Markdown table/code tokens; it is not a prose-only word count or a rendering-performance target. The manifest additionally records line counts, heading counts, fenced block types, table row counts, resource references and content hashes.

The basic and W-30 files end with actual editor directives. Those trailing directives are editor metadata and must not leak into visible exported content. The W-30 YAML code sample also contains the literal words `IMAGE_DIR` and `FORCE_RELATIVE_PATH`; those literals are real code content and must remain. Front matter and `[TOC]` follow the application's declared export semantics, with no duplicate TOC or accidentally visible control directive.

## Asset provenance and source resolution

All three assets are original test data created for this repository. They contain no third-party images, fonts, external references or executable scripts. They use the repository's [MIT license](../../../LICENSE).

| File | Intrinsic size | Authoring method | Expected landmarks |
| --- | --- | --- | --- |
| [Field sample 图像.png](<assets/Field sample 图像.png>) | 2400 × 1600, RGB8 PNG | Deterministic quadrant colors, central crossing lines, diagonal and dark border; Python standard-library PNG encoding with zlib | Four colored quadrants, light diagonal/central lines, complete border |
| [tall-graphic.png](assets/tall-graphic.png) | 1200 × 4800, RGB8 PNG | Deterministic quarter-height colors with alternating lighter bands, white separators and dark side rails; standard-library PNG encoding | Red upper region, green/yellow middle regions, blue lower region and both side rails |
| [architecture.svg](assets/architecture.svg) | 2800 × 900 SVG view box | Hand-authored vector shapes and text using generic `sans-serif` | Four named components, three connectors, title `W30-ARCHITECTURE-MARKER` |

The PNGs intentionally compress well; their small file sizes do not imply small intrinsic resolution. Decode dimensions and compare original bytes for embedded HTML PNG data. DOCX/EPUB should package supported media without deliberate downsampling; PDF or target-specific media conversion may change encoding while preserving the supported image content. Layout scaling is permitted and required for the tall graphic. The SVG uses a generic font rather than embedding a third-party font; record the actual renderer/font environment when checking its appearance.

The references to `assets/does-not-exist.png` and `assets/w30-deliberately-missing.png` are **intentionally unresolved** and must stay unresolved. Do not add placeholder files at those paths. The spaced/Unicode PNG is referenced using percent encoding to exercise resolution against the saved source directory.

## Public reference and reuse terms

The complexity reference is **NIST SP 800-218, Secure Software Development Framework (SSDF), version 1.1**, published February 2022: [official publication page](https://csrc.nist.gov/pubs/sp/800/218/final) and [official 36-page PDF](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf). These sources were inspected on 2026-09-09. The reference supplies an example of a substantial technical report with structured prose, tables, references and appendices; its 36-page count is **not** the rendered page count of W-30.

The PDF's authority page says the publication is not subject to copyright in the United States and requests attribution. No NIST prose, tables, diagrams, logo, PDF bytes or other source material is copied into these fixtures. W-30 is an original, AI-assisted synthetic report about a fictional observation service, with original prose, individually authored scenario cards, deterministic invented table/listing records and original assets. It is not a summary, adaptation or reproduction of the NIST report. The fixture text/assets are contributions under the repository's MIT license; the link does not imply NIST endorsement. No downloaded reference PDF is required to run fixture checks.

## Support expectations fixed before evaluation

“Expected” describes required evidence to obtain, not a test result. The implementation support matrix may name existing renderer limitations, but it must not silently downgrade supported cases after observing a failure.

| Content class | HTML/PDF expectation | DOCX/EPUB expectation |
| --- | --- | --- |
| Ordinary text, headings, emphasis, ordered/nested lists, tables and fenced code | Preserve supported display, complete text and order; remove editor controls/viewport constraints | Editable text and structural equivalents; page appearance can differ |
| Supported math | Render basic inline math and the one-line display equations with required styles/fonts | Use native target math when supported; separately account for any declared conversion limitation |
| Valid Mermaid diagrams | Complete diagram rendering before capture, with text/relationships visible | Prepare and package compatible diagram assets; supported diagrams must not silently remain source code |
| Original local PNG/SVG | Resolve from the source directory and embed required resources for offline relocation | Package compatible media with preserved source resolution and declared target conversions |
| Footnotes, TOC, checklist and simple HTML | Verify against the existing renderer's supported behavior; record an existing limitation explicitly | Preserve supported note/navigation/checklist/text structure, with explicit target-specific treatment |
| Missing image | Visible fallback identifying the missing reference plus a warning | Same accounting; surrounding text remains |
| Unknown math command | Identifiable expression/source fallback plus a warning; following marker survives | Same accounting; do not downgrade supported equations elsewhere |
| Invalid Mermaid (`fallbacks.md`) | Source/error fallback identifiable in output plus a warning | Same accounting; preserve the deliberate source marker |
| Disclosure HTML | Preserve summary/body words visibly or expose a readable declared fallback; interactivity is not required | Preserve summary/body words as editable content or a declared readable fallback |
| Active document-supplied script/URL | Script must not execute or remain active in prepared/exported content; preserve safe link text where supported | Must not turn text/YAML fields into executable filters or host commands |
| Ordinary external hyperlinks | Keep navigable links; do not fetch them merely because they are present | Same resource boundary |

`fallbacks.md` has inert probes assigning unique JavaScript global markers. They are test document content, never instructions to execute. Observe that they remain unexecuted and that prepared output has no active script or unsafe link. The fenced shell example is also content, not a test setup command. Remote fetching and cancellation need a controlled request/worker harness outside these fixed offline assets; a successful offline fixture alone does not prove those behaviors.

## Reference layout and W-30 evidence still required

Start calibration with **A4 portrait, 16 mm margins**, a recorded locally available/bundled sans-serif font, body **11 pt**, line height **1.35**, and recorded print CSS. The usable page height is 265 mm. Keep ordinary blocks together when they fit a full page; split oversized text/code/tables and scale graphics proportionally to fit. The code and table are intentionally large enough to exceed one page under this layout. Exact quotation placement in `pagination.md` must be observed rather than inferred from source-line counts.

The layout is a reference configuration, not a new user-visible customization requirement. The text/asset inputs are frozen; complete a reference render and record its actual page count before claiming that W-30 meets the approximately 30-page description. If the proposed typography needs calibration, record the chosen font/size/line-height and reason before acceptance evaluation, without shortening/removing the input or weakening content checks. A page count substantially outside the intended workload requires an explicit fixture/reference-layout revision record. HTML and EPUB do not need fixed pages, and a Word viewer need not match browser pagination.

| Evidence item | Current status |
| --- | --- |
| Source/asset provenance, inventory and frozen bytes | Defined in these fixtures and manifest; local verifier checks byte/inventory consistency |
| Reference PDF page count | **Unverified — reference render required** |
| Exact font family/files and rendering engine/version | **Unverified — record from reference render** |
| macOS, VS Code, extension-host and external tool versions | **Unverified — record from the actual native validation environment** |
| All four W-30 artifacts | **Unverified — real conversions required** |
| Supported content/fallback review in artifacts | **Unverified — compare inventory and inspect representative pages/target viewers** |
| Progress, editor usability, cancellation and source preservation | **Unverified — observe through the native installed export path** |

For each real run, retain input/asset hashes, package revision/hash, resolved tool versions/paths, font setup, output hashes, actual page count where relevant and observed warnings. Inspect the first page, representative middle pages, oversized code/table boundaries, tall graphic, fallback appendix and final marker. Check intermediate row/line/scenario markers as well as outer markers to detect selective omission or duplication. Opening a package, extracting text or getting exit code zero individually does not prove rendered fidelity.

The workload carries no export-duration, throughput or response-time threshold. These files do not assert that all required environments or target viewers are available. Record absent required checks as unverified, and keep actual evidence/status in the authoritative subsystem document.
