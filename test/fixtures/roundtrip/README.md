# Mixed-document round trip

These original AGPL-3.0-only fixtures replace an obsolete skipped comparison against absent `samples/b.md` and `samples/b2.md`. They do not reconstruct those unavailable samples or claim their coverage.

The expected Markdown was authored before running the replacement test. Only two intentional normalizations differ from the input: `__bold__` becomes `**bold**`, and asterisk list markers become hyphens. All words, nesting, order, code indentation and blank lines must survive. Compare the complete result without collapsing whitespace. Do not generate this expectation from the editor's output.
