# Windows validation preparation

Recorded: 2026-09-14. Development work on `codex/windows-validation`, based on `codex/next-version-integration` at `bc558f64883d67d5d9e488e0270ee76585711218`. Windows changes are in `22897b1` and `0dc39aa`; native focus handling and the original observation were recorded in `5d0ff7d`. This is local preparation, not a Windows execution or release receipt.

## Observed checks

Local development checks on 2026-09-14 passed compilation, lint (with existing integration-branch warnings), 207 unit/real-converter/package checks without skips, and the full installed-VSIX harness on macOS ARM64. The native artifact gate accepted 16 outputs with 2,260 markers accounted for, and the additional CRLF/Unicode/absolute-path scenario passed for all four formats. These used a development VSIX, not a clean release candidate. Windows execution remains pending the first authorized GitHub run of this branch.

## Remaining scope

Platform-shim tests exercise discovery and host-selection logic. The actual Windows GitHub job has not run for this record. Native Windows execution, Windows reader appearance and a clean release candidate remain unverified. Follow the [Windows procedure](../../docs/testing/windows.md) and record a new run URL, source SHA and outcome when those checks are performed.
