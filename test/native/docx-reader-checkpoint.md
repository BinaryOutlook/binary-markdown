# Check editable DOCX code in desktop readers

Use this procedure to verify the native numbered-paragraph representation with actual desktop readers. Preparing valid DOCX files or converting them headlessly does not establish interactive editing acceptance. Keep original inputs, edited copies and reader results separate.

## Scope and target versions

This checkpoint covers editable native paragraphs, retained source whitespace and existing highlighting, numbering off by default, correct logical-line numbers, blank lines, wrapping, basic editing and save/close/reopen. The target matrix is deliberately bounded:

| Reader target | Required identity | Acceptance status in this procedure |
| --- | --- | --- |
| Microsoft Word for macOS | 16.113.1, build `16.113.26091740` | Pending actual reader observations |
| Stable LibreOffice | 26.2.6; record the complete version and build ID from the installed application | Pending actual reader observations |

These are test targets, not standing pass claims. Record the operating system, architecture and exact application version with each run. Put dated results in [validation reports](../../reports/README.md#validation); retain failures and unavailable checks. Additional Word platforms and reader versions, automatic syntax re-highlighting after editing, and a guarantee that copied code always excludes numbers are outside this checkpoint.

Counts and language labels describe the source at export time. Editing a document in Word or Writer does not recompute them or syntax highlighting. Native list numbers should follow the tested paragraph edits, subject to the accepted empty-line limitation below. Soft breaks remain inside their existing paragraph and do not receive another list number. Follow the [export scope and editing guidance](../../media/export-help.md#export-scope-and-editing) when interpreting compatibility results.

## Prepare fresh inputs

Use the checkout's Node version, installed dependencies and Pandoc, following the [build guide](../../docs/building.md). From the repository root:

```sh
npm run compile
node test/native/docx-reader-fixtures.cjs
```

Set `EXPORT_PANDOC_PATH` when Pandoc is outside normal discovery. The generator creates ignored `.vscode-test/docx-reader-checkpoint/` and refuses to reuse an existing output directory so earlier edits cannot be overwritten. For another run, choose a new directory with `DOCX_READER_OUTPUT_DIR`, for example `.vscode-test/docx-reader-checkpoint-second`.

The output contains nine DOCX files, original Markdown, exact expected lines and edit operations in `expectations.json`, and `receipt.json` with source identity, converter version, configurations and artifact hashes. `sourceDirty` records uncommitted changes; do not label those artifacts a clean-commit build. Fixture preparation invokes the compiled production exporter directly; installed-extension evidence remains a separate [native harness](export-smoke.md#create-and-run-an-isolated-test-installation) check.

| Output | Purpose |
| --- | --- |
| `top-left.docx`, `top-right.docx`, `bottom-left.docx`, `bottom-right.docx` | Numbers and totals enabled, each language-label corner |
| `hidden.docx` | Numbers and totals enabled, language labels hidden |
| `default-off.docx` | All options omitted, including `showCodeLineNumbers`; default numbering and totals absent |
| `numbers-only.docx` | Numbers enabled, totals and language labels absent |
| `counts-only.docx` | Totals enabled, numbers and language labels absent |
| `editing.docx` | Three-line highlighted editing block and an independent two-line block; numbers and totals enabled |

The layout inputs reuse [the shared code-line fixtures](../fixtures/export-code-lines.cjs). Expected counts are `0, 1, 2, 6, 5, 2, 3, 150`; their total is 169. They include leading/internal/trailing blanks, tabs, trailing spaces, Unicode, long labels, wrapping and multiple pages. The empty block has a display paragraph without a number.

## Run supporting headless checks

Install Python 3, the intended LibreOffice reader and Poppler's `pdftotext`. Set `DOCX_READER_SOFFICE` to that reader's actual `soffice` executable. From the repository root, run:

```sh
python3 test/native/docx-reader-inspect.py \
  --soffice "$DOCX_READER_SOFFICE" \
  --fixtures .vscode-test/docx-reader-checkpoint \
  --output .vscode-test/docx-reader-inspection
```

Use `--pdftotext` for an executable outside `PATH`. The checker requires a new output directory, verifies generated input hashes, uses temporary isolated LibreOffice profiles and removes those profiles afterward. It converts all nine originals to PDF and resaved DOCX, then renders the resaved DOCX files to PDF again. It compares exact code payloads, numbering settings, total metadata and retained `StringTok` highlighted runs, and checks rendered number sequences and multi-page markers in both the original and resaved documents. This does not establish preservation of every highlight color. Footer attachment is recorded as an observation; a historical development-reader failure and its stable-reader recheck are distinguished in the checkpoint report.

The output contains `rendered/`, `resaved/`, `resaved-rendered/` and `inspection.json`. The receipt records source identity, input/artifact hashes, the actual reader version and executable hash, checker identity and Poppler version. Its mode is explicitly `HEADLESS_ONLY`, and interactive acceptance remains unverified. Retain this evidence alongside the following reader observations; a passing command does not replace them. The checker needs only Python's standard library and does not generate screenshots.

## Inspect original documents

In each target reader, open the eight layout/control documents and inspect the first, wrapped and final pages. Verify that no repair dialog appears, code is editable text, highlighting remains visible, and the number gutter does not overlap code. Check every authored blank line and numbering restart, including the transitions from 9 to 10 and 99 to 100. Wrapped continuations and page breaks must not create numbers or omit text. Check label corners, hidden labels, independent controls, and the count at the block's end.

Save an unchanged copy in the same DOCX format, close it, and reopen that saved copy. Compare its code payload against `expectations.json`, retaining spaces, tabs and blank paragraphs exactly. An XML comparison supplements visible reader inspection; it does not replace it. Reader save operations may rewrite package metadata, style IDs or numbering IDs, so compare content and observed numbering rather than demanding byte-identical archives.

## Exercise basic editing

Make a separate fresh copy of `editing.docx` for each operation and each reader. Enable paragraph marks or whitespace display if needed. Its first block contains three paragraphs: `def greet(name):`, a tab followed by `message = "Hello " + name` and two trailing spaces, and four spaces followed by `return message`. The second block is an unchanged two-line control that must remain numbered 1 and 2.

| Case | Operation | Expected first-block paragraph count |
| --- | --- | --- |
| Replace text | Replace `Hello` with `Welcome` in the second paragraph | 3 |
| Enter within a line | Press Enter immediately before `greet` in the first paragraph | 4 |
| Enter at a line end | At the end of the first paragraph, press Enter and type `# INSERTED` | 4 |
| Insert a blank | At the start of the second paragraph, press Enter once; retain the new preceding blank paragraph | 4 |
| Enter on a blank | Insert the preceding blank paragraph, move into it, press Enter again and type `# AFTER_BLANK` | 5 |
| Delete a line | Delete the second paragraph and its paragraph mark | 2 |
| Soft break | Press Shift+Enter immediately before `message` in the last paragraph | 3 |

`expectations.json` supplies exact paragraph strings for every case; its `\t` and `\n` escapes represent a tab and a soft break. Verify the intended text change, sequential native numbers, unchanged second-block restart, retained code styling and all untouched whitespace. In particular, test both Enter positions and Enter on a blank paragraph: readers may apply a following paragraph style or terminate a list. Record such behavior as a failure or explicit limitation; do not manually repair formatting and report the original action as passing.

The [maintainer's 2026-09-21 decision](../../reports/validation/2026-09-21-docx-reader-checkpoint.md#maintainer-scope-decision-2026-09-21) accepts the observed native-list termination for **Enter on a blank** in the named readers. Keep that operation, its original expected result and the actual saved/reopened result in the evidence; classify it as an accepted reader limitation rather than a passing edit or an outstanding exporter fix. Do not weaken fixture expectations or generalize the exception to other operations. Initial source preservation, untouched content, normal line-end continuation and the remaining reader checks retain their requirements.

After each edit, save in DOCX format, close the document, reopen the saved file and repeat the checks. The exporter currently writes totals as static text, so the fixture expects those labels to remain 3 and 2 even when editing changes the number of paragraphs. These values describe the existing implementation; acceptance of static totals is tracked in the [checkpoint report](../../reports/validation/2026-09-21-docx-reader-checkpoint.md). Automatic syntax re-highlighting is outside this checkpoint. A soft break adds a visual line inside one numbered paragraph, so its expected paragraph string contains a newline but its list number remains unchanged.

## Record evidence

For each reader, record input hashes, exact version/build, each operation's observed result, saved artifact hashes and reopened content comparisons. Retain representative captures of initial layout, wrapped code, a blank line, a successful or failed paragraph edit, and reopened output. Use only synthetic content and screen images for private account details before publication.

Classify interactive observations, reader save/reopen, headless rendering and XML checks separately. A blocked application or unavailable GUI leaves its reader row pending. Copy behavior may be recorded as an observation without making universal number-free copying a gate. Keep required repository CI and the [export verification procedure](../../docs/export-verification.md) independent of this reader matrix.
