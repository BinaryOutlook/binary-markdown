# Share the visual design review

This guide covers the 30 September 2026 review snapshot, packaged on 1 October 2026. It contains 12 areas, 20 current screenshots and 36 final concepts. Recommendations are consultant proposals awaiting owner review.

For GitHub, send the full report’s rendered Markdown link and use the draft PR conversation for feedback. The report displays its visuals through repository links. Reading a public report requires no checkout. GitHub renders `report.md` with images; it does not run the interactive controls in `index.html`. Use an area ID and option name so comments stay specific.

For email or file transfer, send either the PDF reading copy or self-contained HTML edition. Each is one file containing every current visual and final option. The HTML retains original image bytes, embeds the complete written review and evidence, and lets the reviewer export choices and notes as plain text. Notes are not automatically sent or uploaded; they remain in the current tab until exported. Reopening the original file starts blank.

## Build the portable editions

Use the repository root. Prerequisites are the Node version in `.node-version`, `npm ci`, Python 3 with ReportLab and Pillow, and Arial regular, bold and italic TrueType fonts. The HTML builder uses installed `markdown-it` and `jsdom`; the recipient does not need those dependencies.

```sh
node reports/investigations/2026-09-30-ui-ux-visual-review/evidence/build-sharing.cjs
python3 reports/investigations/2026-09-30-ui-ux-visual-review/evidence/build-sharing-pdf.py
```

Generated files are placed in ignored `dist/ui-ux-visual-review-share/`:

- `Binary-Markdown-UI-UX-Review-2026-09-30.pdf`
- `Binary-Markdown-UI-UX-Review-2026-09-30.html`

The PDF builder defaults to macOS system fonts. On another system, set `REVIEW_FONT_DIR` to a directory containing `Arial.ttf`, `Arial Bold.ttf` and `Arial Italic.ttf`. Set `REVIEW_SHARE_OUTPUT` for a different PDF output directory; pass an output directory as the HTML builder’s first argument. The original screenshots and concepts are not modified. The PDF compresses embedded image streams; the HTML retains original image bytes.

Open the downloaded HTML in a modern browser. Compare Current, Recommended, Moderate and Experimental; fill global feedback and per-area choices, then select **Export feedback** before closing. If downloads are blocked, copy the prepared text shown below the button. Send the text file back yourself or paste it into the PR discussion. Optional source links require internet; the report and visuals work offline.

## Review reply template

```text
Area ID:
Preferred option: Recommended / Moderate / Experimental / Revise / Defer
What works:
Concern or tradeoff:
Required change or evidence:
Overall design philosophy:
```

The screenshots describe source `944b4dd2781c906ee9a912295c814e77a0a9f3f0`. GitHub main advanced after capture, including code-block toolbar and wrapping changes. Recheck current behavior before implementing a choice, especially area 06.

The [publication security audit](evidence/publication-security-audit.json) covers disclosure checks, images and metadata, report scripts and Git scope. This is a publication-content review, not an application-wide penetration test. The [main report](report.md) remains the authoritative written proposal.
