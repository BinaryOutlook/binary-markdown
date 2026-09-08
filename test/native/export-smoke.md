# Installed-VSIX export smoke tests

This harness exercises installed local desktop VS Code on macOS or Linux: toolbar, actual save lifecycle, installed converters, cancellation and output filenames. It complements the artifact inspection tools in this directory; passing it does not certify visual fidelity or environments absent from its receipts. See the [validation record](../../docs/export-validation.md) for the subsequent same-package Ubuntu x86-64/macOS ARM64 runs.

The consolidated `--suite all` run passed on 2026-09-09 in a fresh isolated installation: **39 scenario receipts plus a final frozen-input check**. That run used VS Code 1.136.0, Node 20.20.0, Pandoc 3.8.3 and Google Chrome 152.0.7977.65. The VSIX was 4,187,330 bytes, SHA-256 `958ba238a2b064888c9b5e76631c2aa884004e4769ade61c72523168c4808438`. Re-run after changing the implementation or environment; this is a dated receipt, not a compatibility guarantee.

## Prerequisites

- Use the Node version in `.node-version`, local desktop VS Code on macOS or Linux and the VS Code `code` CLI. Supply `--code /path/to/code` when it is not on PATH. Run as an ordinary user, not root.
- Run `npm ci`, `npm run package` and `python3 test/fixtures/exports/verify-fixtures.py` from the checkout.
- Install Pandoc and Chrome/Chromium/Edge yourself before the full four-format run. No command here downloads native engines. Optional `--pandoc /path/to/pandoc` and `--browser /path/to/browser` select manual executable paths; empty defaults exercise automatic discovery.
- Close the earlier test window before starting another session on the same port. Normal VS Code windows can remain open. Linux needs a local desktop display or an explicitly provisioned Xvfb display; SSH alone is not a display. This tests a local extension host, not VS Code Remote-SSH.

## Create and run an isolated test installation

Run these commands from the checkout. The defaults use `.vscode-test/export-native-repro` and debugging port `9327`:

```sh
node test/native/export-smoke.cjs init
node test/native/export-smoke.cjs install
node test/native/export-smoke.cjs launch
```

Initialization requires a **new directory** and never erases existing files. It copies the frozen and supplementary fixtures and creates owned extensions/workspace directories beneath the ignored `.vscode-test` directory. The profile is a new `bm-native-*` directory under the canonical system temporary directory. IPC socket paths must stay short: use `TMPDIR=/tmp` when necessary and keep it consistent for every command. Matching ownership sentinels bind the workspace, temporary profile and installation to one random token; their paths are printed at initialization and recorded in the sentinel. Choose another dedicated directory with `--workdir .vscode-test/export-native-second` for another clean run; pass the same value on every command.

If VS Code asks for Workspace Trust, inspect the generated workspace path and trust **only that test workspace**. The driver refuses a missing sentinel, a different workspace/profile, or a development checkout in place of the isolated installed extension. It cannot issue arbitrary VS Code commands or modify normal-profile settings. In the recorded automated run, trust was disabled only in the newly generated temporary test profile; no normal-profile setting was changed.

```sh
node test/native/export-smoke.cjs check
node test/native/export-smoke.cjs run --suite all
```

`check` requires a live inspection response from the guarded driver and verifies the seven frozen input hashes before reporting ready. `run` repeats ownership and input guards and requires the package hash recorded by `install` before making changes. The window title includes a random ownership token; the CDP connection selects that window's **visible editor iframe**, then every successful export must have the selected document's filename stem and sibling directory. An old background iframe cannot satisfy those assertions.

Use `--suite formats`, `saves`, `edges`, `ui`, `selection`, `immutable` or `offline` for a focused run. The package default is `dist/<package-name>-<package-version>.vsix` from the checkout's manifest. `--package dist/binary-markdown-0.1.0.vsix`, `--port 9327`, `--workdir ...`, `--code ...` and `--timeout 120000` are explicit options. Keep the initialization port on subsequent commands. The timeout is a test watchdog, not a product timing requirement; increase it for a complex report or slower machine. In an environment that sandboxes tool execution, native VS Code and browser/CDP access need the environment's explicit native-process permission.

The suites cover:

- **Formats:** frozen basic/fallback/pagination/W-30 sources through HTML, PDF, DOCX and EPUB; output identity and unchanged source bytes.
- **Saves:** immediate native Save and Command-S on macOS or Ctrl-S on Linux in both visual/source modes; exported marker, unchanged saved source and editor state.
- **Edges:** missing engines with independent HTML, settings without editor reload, output-byte hash/reuse, dirty/untitled rejection, unwritable output, a held referenced image with editing/cancellation, and a controlled test-only Pandoc worker for cancellation/failure. The worker uses the Node executable running the harness rather than a hard-coded personal path.
- **UI:** simple/full toolbar placement and keyboard navigation, Chinese/English runtime labels independent of native English VS Code, and GitHub/night HTML exports.
- **Selection:** a normal text tab cannot export a hidden Markdown editor.
- **Immutable:** a held referenced resource allows later unsaved edits while the successful export preserves its earlier saved capture.
- **Offline:** four relocated HTML exports load offline without external requests, script errors or editor controls; all images decode and the basic original image bytes are preserved. A focused offline run first creates its own four HTML files through the installed extension.

Reports are timestamped JSON under the owned directory's `evidence/`; relocated HTML and its basic screenshot are retained there too. The recorded run used `.vscode-test/export-native-consolidated/evidence/native-1788893157572.json`, with engine details in `tools.json`. Preserve the report with the tested VSIX hash, converter versions and artifact inspection results. Repackage/reinstall after implementation changes; the old installed VSIX is not automatically refreshed. Run the separate `EXPORT_VSIX_PATH=... node --test test/unit/export-package.test.js` gate to check the archive against the compiled checkout. Syntax checks and rejected missing-receipt, outside-workspace and duplicate-initialization guards also passed.

When finished, close only the uniquely titled test window. The harness has no cleanup command and never kills general VS Code processes or deletes profiles. Retain or manually remove only the specific owned `.vscode-test` directory and temporary profile recorded in its sentinel when their evidence is no longer needed.
