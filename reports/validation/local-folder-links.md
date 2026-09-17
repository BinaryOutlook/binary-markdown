# Local file and folder links

Validated locally on 2026-09-16 UTC using macOS 26.5.2 / ARM64. The bug was discovered in Binary Markdown 0.2.1; the planned release for this repair is **0.2.2**, pending merge and release validation.

An absolute path such as `/fixtures/03 Labs/Lab2` was appended to the workspace path before opening. The reported missing-resource error was reproduced in the installed 0.2.1 editor with an existing anonymous fixture directory.

The repair separates filesystem paths, explicit `file:` URIs, and workspace-relative paths. It checks availability before invoking VS Code's existing resource-opening command, offers **Copy link address** when a target is unavailable, and displays the original destination on hover. Raw filesystem characters remain literal; URI escapes are handled by the URI API. Heading navigation and HTTP link routing retain their existing behavior.

Link setup is shared by rendered, inserted, and pasted links and installs one click handler per element. Tooltip attributes do not change the Markdown destination or serialization. Authored titles are retained.

| Verification | Local result |
| --- | --- |
| Compile and package | Development VSIX built from the changed source |
| Lint | No errors; nine existing warnings |
| Unit suite | 227 passed, 11 environment-dependent tests skipped, no failures |
| Focused browser suite on a dedicated local server | 49 passed, no retries, including initial-document link setup |
| Installed VSIX: absolute and relative folders | Correct folder selected in Explorer |
| Installed VSIX: absolute file and encoded `file:` URI | Correct file opened, including spaces and a literal percent character |
| Installed VSIX: unavailable directory | Clear notification; its copy action preserves the original destination |
| Installed VSIX: source and clipboard preservation | Markdown unchanged and clean; prior clipboard restored by the test |

The native `links` suite is included in `--suite all`, so the PR's hosted validation also exercises these flows on Windows, macOS, Ubuntu, and minimum supported VS Code. Hosted results are recorded in the PR checks; local results alone do not establish those platforms' status. An initial local browser rerun encountered a shared-server conflict and was discarded; the dedicated-server result above supersedes it.

The independently available link context menu is deferred to the next step. Its copy command can reuse `copyLinkAddress` in `src/link-opener.ts`, and its per-link context can be attached in `setupLink`. The shared host bridge contract is unchanged. No menu item or custom floating link panel is included in this change.

Absolute paths still depend on the current machine. Foreign-OS paths and explicit local paths in remote documents offer copying instead of being silently reinterpreted. Relative links retain the document's selected workspace root, including its existing scheme and authority. The Markdown parser, relative-link base, and Electron opener are unchanged.

All examples are synthetic. This report contains no personal paths, machine names, or personal identifiers. The native harness keeps detailed execution evidence in ignored local/CI artifacts; public summaries should use UTC and OS version plus ISA only.
