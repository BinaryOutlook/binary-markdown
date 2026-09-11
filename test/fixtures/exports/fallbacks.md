# Deliberate fallback and execution-safety cases

FALLBACK-FIRST-MARKER: This document deliberately contains unsupported content and missing resources. A completed export must account for these cases visibly and in its warning summary.

## Missing local image

![MISSING-IMAGE-MARKER: local image deliberately unavailable](assets/does-not-exist.png)

## Unsupported mathematics

The following equation contains a deliberately unknown command, not an accidental typo in a supported fixture:

$$
\BinaryMarkdownUnsupportedMacro{x}
$$

UNSUPPORTED-MATH-AFTER-MARKER: This paragraph must survive even when the equation cannot render.

## Invalid diagram

```mermaid
this is deliberately invalid mermaid syntax
INVALID-MERMAID-SOURCE-MARKER
```

## Raw content with a structural fallback

<details><summary>RAW-HTML-SUMMARY-MARKER</summary><p>RAW-HTML-BODY-MARKER: Disclosure-widget interactivity is not required in exported document formats. Preserve these words or declare the fallback.</p></details>

## Content that must never become instructions

```sh
printf '%s\n' 'COMMAND-TEXT-MARKER: illustrative content only'
```

```yaml
filters:
  - document-supplied-filter-must-not-run.lua
pdf-engine: document-supplied-engine-must-not-run
```

<script>globalThis.__EXPORT_DOCUMENT_SCRIPT_EXECUTED__ = "SCRIPT-MUST-NOT-RUN";</script>

<a href="javascript:globalThis.__EXPORT_DOCUMENT_LINK_EXECUTED__='LINK-MUST-NOT-RUN'">UNSAFE-LINK-TEXT-MARKER</a>

An ordinary [unreferenced-resource crawl trap](https://example.com/must-not-be-fetched-as-an-asset) is a link, not an image request.

FALLBACK-LAST-MARKER: Content after every deliberate failure must remain available.
