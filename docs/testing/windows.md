# Windows validation

The Windows lane validates the same candidate source and VSIX as Ubuntu,
macOS and the minimum supported VS Code version. Historical release receipts
remain evidence only for their recorded platforms; adding this workflow does
not retroactively validate an earlier Windows release.

## Required checks

`Validate (windows)` uses a standard `windows-2025` x64 GitHub runner. It downloads
the same Ubuntu-built VSIX as every other lane and verifies the candidate's
SHA-256 and source identity before testing. It runs:

- Compilation, frozen fixture verification, unit tests, real converter tests
  and byte-for-byte packaged-runtime parity.
- Installed desktop VS Code with an isolated profile and extension directory;
  all native scenarios, all four frozen documents in HTML/PDF/DOCX/EPUB, and
  the same artifact inventory assertions used on macOS and Ubuntu.
- The complete Chromium browser regression suite with two workers and no retries.
- Absolute image paths, Unicode/space-containing directories and unchanged CRLF
  source bytes through all four native export formats.

Failures propagate through the existing required `VSIX validation` check.
The release workflow also requires Windows artifact-audit evidence. Validation
receipts and failure traces are retained for seven days, and superseded PR runs
are cancelled by the existing concurrency policy.

## Windows dependencies and behavior

The disposable runner provisions checksum-verified Pandoc 3.8.3 and Poppler
26.07.0-0 archives, the lockfile's Playwright Chromium, an isolated VS Code
archive, and a Python virtual environment for the artifact audit. Negative
converter fixtures are compiled with the runner's .NET Framework C# compiler;
they execute natively so cancellation tests do not leave interpreter children.

Production exports discover `.exe` files through PATH and common per-user and
Program Files locations. Manual paths remain authoritative. Windows browser
discovery uses the sandboxed Chromium protocol because GUI executables do not
reliably print a version to stdout. Remote windows and browser VS Code remain
outside the local export scope.

Permission tests deny writes with an ACL on a newly owned fixture directory and
restore it in `finally`. Run Windows tests from native PowerShell: elevated Git
Bash enables backup/restore privileges that can bypass ACLs. The fixture checks
that directory creation is actually denied before testing export failure.
Process cleanup matches both the exact test profile and
the test driver before terminating that process tree. `.gitattributes` keeps
checkout bytes consistent for frozen fixtures and shared-candidate comparisons.

## Evidence boundary

Keep dated observations in [validation reports](../../reports/README.md#validation).
The [initial local preparation record](../../reports/validation/2026-09-14-windows-preparation.md)
describes its own evidence and the Windows checks that were still pending.

Local platform-shim tests verify discovery and host-selection logic. Only a
successful GitHub Windows job verifies Windows execution. Record its run URL,
source SHA and outcomes before making a release claim. Windows desktop-reader
appearance, Windows ARM64, Remote-SSH/WSL and Electron installers require their
own validation and are not implied by this VSIX job.
