# Export from Binary Markdown

Export is experimental in local desktop VS Code on macOS and Linux. See the repository's validation record for the specific systems tested. Windows, remote extension hosts and browser VS Code remain outside the current export scope.

Save the Markdown file, then use the sharing-arrow button beside the VS Code-logo button. Choose HTML, PDF, Word (.docx), or EPUB. Unsaved or unnamed work must be saved before retrying; export never saves it automatically.

## Tools and settings

HTML works without an additional tool. PDF uses an installed Chrome, Chromium or Microsoft Edge browser without opening a browser window. Word and EPUB use Pandoc.

- [Install Pandoc](https://pandoc.org/installing.html). If you use Homebrew, the documented package is available through `brew install pandoc`.
- Install [Google Chrome](https://www.google.com/chrome/) or [Microsoft Edge](https://www.microsoft.com/edge/download) for PDF.
- Open VS Code Settings and search for `binary-markdown.export`. Leave executable paths blank for automatic detection, or enter an absolute executable path.
- Typical macOS paths include `/opt/homebrew/bin/pandoc` and `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
- Typical Linux paths include `/usr/bin/pandoc` and `/usr/bin/google-chrome`; a user-space Pandoc installation can use its own absolute executable path. PDF requires a browser that can run with its normal sandbox enabled.
- An invalid manual path is reported; it does not silently select another tool. Reopen the export menu to rescan after installation.

Native tools are installed and maintained by the user. The extension does not download them automatically. Changing export paths does not reload the editor.

## Output and progress

The output is saved beside the Markdown file: `report.md` becomes `report.pdf`, for example. If occupied, the filename uses the last eight SHA-256 hexadecimal characters of the completed output, then numbered suffixes if necessary. Identical hash-named files are reused. Existing files are never overwritten.

The editor displays the actual stage and an indeterminate activity indicator while work continues. You can keep editing after source capture or cancel an active job. Completion shows the output location and any warnings. A missing engine, conversion failure or unwritable source folder is reported as failure.

## Initial format limitations

- HTML and PDF reuse supported editor rendering and current appearance. Fenced `math` blocks render with KaTeX. Dollar-delimited math (`$...$` / `$$...$$`), `[TOC]` and footnotes remain visible source with warnings, matching the current renderer. Invalid supported math/diagrams receive source fallbacks.
- PDF uses simple pagination. Generous blank areas are acceptable; oversized text and tables split, while graphics scale to fit.
- DOCX and EPUB prioritize editable structure and native math. Their layout differs from browser output. Raw HTML is exported as readable source when its behavior cannot be preserved.
- Supported images retain source resolution. Unsupported image formats, unreadable resources and unrepresentable diagrams receive visible fallbacks.
- Only needed referenced resources may be fetched. Conversion remains local. Standalone HTML embeds supported resources for offline viewing.
- Interface and settings labels are localized; detailed conversion/resource diagnostics and fallback explanations currently remain English.
- Custom output paths/names, compression, templates, unsaved export, advanced pagination, additional platforms and dependency installers are future work.
