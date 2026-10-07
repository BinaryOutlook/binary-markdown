# Editor behavior baseline

Status: completed focused browser and ordinary unit baseline on unchanged editor source.

This capture runs existing checks against unchanged editor source at `3bb891ea0848acb0d4fc00806e5ef292ca8793bb`. It supports the [modularization plan](plan.md); it does not validate an implemented extraction.

The [compact run receipt](baseline-receipt.json) records sanitized environment details, counts and SHA-256 hashes of the retained local run logs.

## Identity

- Editor SHA-256: `4116ea853f9c87545ded5f89a689184fac01b9fb49e866beae2a1f2ffbb15662`.
- Lockfile SHA-256: `a7cd003af4fd5a251df5afbed1b1f7c5561cc9a3993b449652e00e110f24f514`.
- Runtime: the version pinned in `.node-version`.
- Browser test runner: the locked Playwright dependency.
- Browser: installed Chromium selected through `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
- Platform: macOS ARM.

Dependencies were installed from the lockfile with `npm ci`. Raw command logs and generated browser evidence are local test outputs, not public documentation artifacts.

## Checks

| Check | Result | Scope |
| --- | --- | --- |
| `npm run compile` | Passed | Current TypeScript, locales, webview/shared files and vendor assets |
| `npm run test:build` | Passed | Current standalone and production browser fixtures |
| Browser discovery | 265 tests in 15 files | Explicit focused selection below |
| `npm run test:unit` | 405 passed, 19 skipped, 0 failed | All 424 discovered unit cases; 18 real-tool cases and one packaged-VSIX case were not enabled |
| Focused browser selection | 265 passed, 0 failed | 15 files, two workers, zero retries, `CI=1` |

The initial unit attempt failed because the restricted shell could not bind localhost test servers. The initial browser attempt could not launch because the Playwright-specific headless browser executable was absent. These attempts did not establish application failures or passes. The corrected runs allowed the required localhost networking and used the documented installed Chromium override; both exited successfully. The 19 unit skips remain explicit prerequisites, not passes.

## Reproduce the focused selection

From the repository root, use the runtime from `.node-version`, install locked dependencies, compile and build fixtures. If the test browser is absent, follow the installed-browser override in [Contributing](../../../CONTRIBUTING.md#checks).

```sh
npm ci
npm run compile
npm run test:build
npm run test:unit
CI=1 npx playwright test \
  test/specs/immediate-undo-redo.spec.ts \
  test/specs/codeblock-source-switch.spec.ts \
  test/specs/paragraph-semantics.spec.ts \
  test/specs/table-source-format.spec.ts \
  test/specs/ordered-list-preservation.spec.ts \
  test/specs/inline-code-preservation.spec.ts \
  test/specs/document-aux.spec.ts \
  test/specs/equation-compatibility.spec.ts \
  test/specs/equation-background-sync.spec.ts \
  test/specs/export-editor.spec.ts \
  test/specs/local-links.spec.ts \
  test/specs/key-operations.spec.ts \
  test/specs/copy-paste.spec.ts \
  test/specs/table-cell-operations.spec.ts \
  test/specs/ime-misc.spec.ts \
  --workers=2 --retries=0
```

The fixture builder rewrites tracked `test/html/standalone-editor.html`. Preserve an existing edit before running it and restore only your own generated change when finished. A freshly compiled production fixture is generated separately.

## Evidence boundary

The browser selection covers exact-source preservation, paragraphs/tables/lists/code, equations, history and pending sync, source switching, clipboard, IME simulation, links, save acknowledgments and export isolation. It is a focused baseline, not the full browser regression suite or an installed-extension save/reopen run. No native harness, real converter/output-reader acceptance, Electron package, other operating system or remote CI result is claimed here.

The three missing initialization/listener/live-render captures are described in the plan and must be added before their affected extraction waves. A passing baseline does not by itself prove equivalence for a future refactor.
