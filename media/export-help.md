# Export from Binary Markdown

Use this guide to export a saved Markdown document to HTML, PDF, Word, or EPUB,
configure the required tools, and resolve common failures.

## Before you begin

Export is experimental in local desktop VS Code on macOS, Linux and Windows. Remote extension hosts (including Remote-SSH), and browser VS Code are outside
the current export scope. In a remote window, open a local copy of the Markdown
file and its referenced assets in a supported desktop environment. Installing
conversion tools does not remove a host restriction.

Use a workspace you trust and a local folder you can write to. The source must
have a filename and be saved. The repository's validation record identifies the
specific systems tested.

## Export a saved document

1. Open the intended document in Binary Markdown and save it.
2. Open the sharing-arrow **Export** menu beside the VS Code-logo button.
3. Choose **HTML**, **PDF**, **DOCX** (Word), or **EPUB**.
4. Wait for completion, then open the output path shown in the result. Review
   any warnings about content that needed a fallback.

With the Binary Markdown editor active, you can also use **Binary Markdown:
Export to HTML**, **Export to PDF**, **Export to Word**, or **Export to EPUB**
from the Command Palette. These are the English command labels; interface labels
follow your configured language.

Unsaved or unnamed work must be saved before retrying. Export never saves it
automatically. You can keep editing after the job captures its source or cancel
an active job.

## Tools and settings

| Format | Required external tool | Executable setting |
| --- | --- | --- |
| HTML | None | None |
| PDF | Installed Chrome, Chromium, or Microsoft Edge | `binary-markdown.export.browserPath` |
| Word (.docx) and EPUB | Installed Pandoc | `binary-markdown.export.pandocPath` |

1. Install the tool for the format you need: [Pandoc](https://pandoc.org/installing.html),
   [Google Chrome](https://www.google.com/chrome/), or
   [Microsoft Edge](https://www.microsoft.com/edge/download).
2. Open VS Code Settings and search for `binary-markdown.export`.
3. Leave the executable setting empty (`""`, its default) for automatic detection.
   If detection fails, enter the absolute path to the executable.
4. Reopen the export menu to rescan, then retry the format.

Both executable settings have machine scope. Example paths depend on where you
installed the tools:

| Tool | macOS example | Linux example | Windows example |
| --- | --- | --- | --- |
| Pandoc | `/opt/homebrew/bin/pandoc` | `/usr/bin/pandoc` | `C:\Program Files\Pandoc\pandoc.exe` |
| Google Chrome | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | `/usr/bin/google-chrome` | `C:\Program Files\Google\Chrome\Application\chrome.exe` |

An invalid manual path is reported without silently selecting another tool.
Use your actual installation path, including a user-space path where appropriate.
PDF requires a browser that can run with its normal sandbox enabled; conversion
does not open a browser window. Native tools are installed and maintained by you.
The extension does not download them. Changing export paths does not reload the editor.

## PDF page appearance

PDF exports default to a white page with GitHub light appearance, keeping text,
code, math, and generated diagrams readable. Disable **Binary Markdown › Export:
Pdf White Background** (`binary-markdown.export.pdfWhiteBackground`, default
`true`) to retain the editor theme across the whole page, including its margins.
Text keeps its 16 mm page inset and captured base font size.

The setting is captured when export begins. Changing it does not reload the editor
or affect HTML, DOCX, or EPUB. Source images and explicitly authored diagram
colors are preserved.

## Code language tabs

`binary-markdown.export.showCodeLanguage` (default `true`) controls language tabs
in DOCX and direct PDF exports. Change it in User, Workspace or folder Settings.
Disable it to keep code styling without labels. The setting is captured once per
export, so changing it during a job affects the next export.

DOCX code remains editable and uses a light background, border and a language
tab attached below the block. Common language aliases use readable names;
unknown names remain literal text, and unlabeled blocks receive no invented
label. PDF tabs use the export appearance. HTML, EPUB and inline code keep their
existing behavior.

Long code blocks can span pages. In DOCX, keeping the label attached can move a
long block to a fresh page and leave space on the previous page. Reader-specific
pagination and final visual appearance require inspection in your target reader.

## Output and progress

The output is saved beside the Markdown file: `report.md` becomes `report.pdf`,
for example. If that name is occupied, the filename uses the final eight lowercase
SHA-256 hexadecimal characters of the completed output, such as
`report_7c91a2ef.pdf`. An identical hash-named file is reused. If its bytes differ,
numbered suffixes start at `report_7c91a2ef_2.pdf`. Existing files are never overwritten.
Unchanged Markdown does not guarantee identical output bytes across conversions.

The editor displays the actual stage and an indeterminate activity indicator.
Completion shows the output location and warnings. Missing engines, failed
conversions, and unwritable output folders produce a failure result.

## Initial format limitations

- HTML and PDF reuse supported editor rendering. HTML retains the editor theme; PDF uses the white/theme setting above. Inline `$...$` / `\(...\)`, display `$$...$$` / `\[...\]`, and fenced `math` blocks render with KaTeX. Backslash recognition follows `binary-markdown.math.backslashDelimiters` (enabled by default). Saved tables of contents render as links to headings. Footnotes remain visible source with warnings. Invalid supported math/diagrams receive source fallbacks.
- PDF uses simple pagination. Generous blank areas are acceptable; oversized text and tables split, while graphics scale to fit.
- DOCX and EPUB prioritize editable structure and native math. Enabled backslash equation delimiters are converted to dollars in an export-only copy held in memory; the source file is preserved, and temporary conversion files are removed when the job ends. TeX command support and layout can differ from KaTeX. Raw HTML is exported as readable source when its behavior cannot be preserved.
- DOCX code blocks have a pale background and border. DOCX and direct PDF exports can show the declared language (for example, `python`) in a small italic tab attached to the complete block's lower-right edge. The tab has a sloped left edge, a straight right edge, rounded bottom corners, and a matching background and border. Blocks without a language do not receive a guessed label. DOCX code remains editable, with syntax colouring for languages Pandoc recognizes; PDF retains its browser-rendered code formatting.
- Supported images retain source resolution. Unsupported image formats, unreadable resources and unrepresentable diagrams receive visible fallbacks.
- Only needed referenced resources may be fetched. Conversion remains local. Standalone HTML embeds supported resources for offline viewing.
- Interface and settings labels are localized; detailed conversion/resource diagnostics and fallback explanations currently remain English.
- Custom output paths/names, compression, templates, unsaved export, advanced pagination, additional platforms and dependency installers are future work.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| Every format is unavailable | Check that the window uses a supported local desktop host and that you trust the workspace. For Remote-SSH, use local copies of the document and assets. |
| Export asks you to save | Save the named document in the active Binary Markdown editor, wait for saving to finish, and retry. |
| Word/EPUB or PDF is unavailable | Install the relevant tool or correct its executable setting, then reopen the export menu. Other available formats can still work. |
| A manual path is rejected | Supply an absolute path to the actual Pandoc or supported browser executable, or clear it to restore automatic detection. |
| The output cannot be written | Check write access to the source directory. Export does not silently choose a different destination. |
| Content has warnings or a fallback | Review the limitations above and check referenced assets. Preserve the diagnostic and a small reproduction document when reporting an unexpected result. |
| Export waits after a native save failed | Cancel the waiting export or retry saving, then export once the saved content agrees with the editor. |

For a reproducible bug report, use **Binary Markdown: Copy Build Information**
and describe the format, steps, and observed result. Share a small non-private
example rather than your original private document.
