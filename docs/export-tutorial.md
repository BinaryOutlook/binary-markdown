# Export your first HTML document

This tutorial introduces the export menu and its saved-document workflow. You
will create a small Markdown file and export it to a standalone HTML document.
HTML needs no additional converter.

## Before you begin

- [Install Binary Markdown](../README.md#install) in local desktop VS Code on
  macOS, Linux or Windows. Export is experimental; the
  [validation record](../reports/validation/0.2.0.md) identifies tested environments.
- Use a local folder you can write to and a workspace you trust. Remote-SSH, other remote windows, and browser VS Code are outside export scope.

## Create and save a document

1. In VS Code, create `first-export.md` in your local folder.
2. Enter this Markdown in the text editor:

   ```markdown
   # My first export

   This document contains **bold text** and a short list.

   - Save the Markdown file.
   - Export it to HTML.
   ```

3. Save the file. Choose **Reopen Editor With… → Binary Markdown** if it is
   still open in the text editor.

You should see a rendered heading, bold text, and two list items.

## Export and inspect the result

1. Open the sharing-arrow **Export** menu beside the VS Code-logo button.
2. Select **HTML**. If the editor asks you to save, save the document and retry.
3. Wait for completion, then open the output path shown in the result.
4. Check that the heading, bold text, and both list items appear in your browser.
   Editor controls should be absent.

The output is `first-export.html` beside your Markdown file when that name is
unused. If it already exists, export chooses a collision-safe name and shows
that actual path. Your Markdown source remains the file you edit.

You have now used the saved-document workflow. To try PDF, Word, or EPUB, follow
the [export guide](../media/export-help.md#tools-and-settings) for their external
tools. If export is unavailable or fails, use its
[troubleshooting table](../media/export-help.md#troubleshooting).
