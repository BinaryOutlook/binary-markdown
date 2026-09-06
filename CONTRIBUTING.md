# Contributing to Binary Markdown

Contributions to code, tests, documentation, translations, and accessibility are welcome. Contributions are provided under the project's MIT license; contributors retain their copyright.

## Development

Install a Node.js version compatible with `.node-version`, then run:

```sh
npm ci
npm run compile
```

Compilation builds TypeScript and translations, copies webview/shared modules, and bundles vendor assets. `npm run watch` watches TypeScript only; rerun the full compile command for webview JavaScript, CSS, shared JavaScript, or locale changes.

## Checks

```sh
npm run lint
npm run test:outline-state
npm run test:identity
npm run test:e2e -- test/specs/codeblock-copy.spec.ts test/specs/sidebar-state.spec.ts test/specs/copy-paste.spec.ts
```

The browser tests need Playwright Chromium. On a new machine, install it with `npx playwright install chromium`. `npm test` runs compilation, lint, unit checks, and the full browser suite. Report failing tests and distinguish existing failures from changes introduced by your patch.

The identity tests check registration consistency and separation from the archived upstream manifest. This helps prevent a rename from breaking commands, shortcuts, settings, or coexistence with the original extension.

## Package and test

```sh
npm run package
```

Install the resulting `dist/binary-markdown-0.1.0.vsix` through **Extensions → … → Install from VSIX…**. Close old editor tabs and reload the window after updating. Use [the manual fixture](docs/copy-paste-test.md) to verify copying and outline state.

Packaged documentation links target the matching `v<version>` Git tag, so a release keeps its own instructions even when the default branch changes.

For an isolated local environment on macOS/Linux:

```sh
code --user-data-dir /tmp/binary-markdown-test --extensions-dir .vscode-test/manual/extensions --install-extension dist/binary-markdown-0.1.0.vsix --force
code --new-window --user-data-dir /tmp/binary-markdown-test --extensions-dir .vscode-test/manual/extensions docs/copy-paste-test.md
```

The short user-data path avoids macOS's Unix-socket path limit. It is temporary and may be removed by OS cleanup; reuse it during a trial to retain test settings. On Windows, use a short writable temporary directory for `--user-data-dir`. Remove the obsolete `BinaryOutlook.any-markdown` test extension if it is still present in this isolated extension directory.

The Electron app has its own package in `electron/`. Its identity has been aligned with Binary Markdown, but desktop installer validation is separate from VS Code extension validation.

## Pull requests and reports

- Open a focused PR against this fork. Discuss larger behaviour changes in an issue first.
- Describe the problem, resulting behaviour, and checks performed. Include a small reproduction document when useful.
- Preserve Markdown content and user settings. View-only actions should not edit documents.
- Keep active product identifiers under `binary-markdown`; preserve original project names in attribution and historical material.
- Do not copy terminal usernames, personal paths, or private documents into public reports.

BinaryOutlook currently handles reviews and releases. Changes may be developed and tested locally without publishing. Merging a PR does not itself publish a Marketplace extension.
