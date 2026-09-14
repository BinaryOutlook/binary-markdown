# Validate a change

Use the checkout's [build instructions](../building.md) and
[contributor checks](../../CONTRIBUTING.md#checks) before selecting tests for the
behavior you changed. [Export verification](../export-verification.md) explains
focused checks, real converter tests and installed-extension validation.

## Required candidate validation

The [VSIX workflow](../../.github/workflows/ci-vsix.yml) builds one identified
candidate on Ubuntu. Every validation lane checks the same package bytes against
the source revision before exercising the installed extension.

| Lane | Host | VS Code | Browser regression suite |
| --- | --- | --- | --- |
| Ubuntu | Ubuntu x86-64 | Latest stable | Complete suite, no retries |
| macOS | macOS ARM64 | Latest stable | Complete suite, no retries |
| Windows | Windows x86-64 | Latest stable | Complete suite, no retries |
| Minimum supported VS Code | Ubuntu x86-64 | 1.85.0 | Native compatibility checks; browser suite runs in the other lanes |

Each lane runs compilation, frozen-input checks, unit and real-converter tests,
package/source parity checks, the installed-VSIX harness and artifact assertions.
The required `VSIX validation` result depends on all lanes. See the
[Windows guide](windows.md) for its provisioning and platform-specific cases.
Configured checks are requirements; their presence does not mean that a run passed.

## Run and inspect native checks

Use the [native harness](../../test/native/export-smoke.md) with a fresh owned
profile, an identified VSIX and actual converters. Follow the
[artifact audit procedure](../../test/native/export-artifact-audit.md) to inspect
outputs, and retain representative reader observations where appearance matters.
The [manual copy and outline fixture](../../test/fixtures/manual/copy-paste.md)
supports targeted UI checks; it carries no standing pass claim.

Record the source commit, package hash, OS/architecture, tool versions, commands,
outcomes and skips. Keep current-run logs and generated files in ignored output
directories or CI artifacts. Curated, sanitized summaries belong in
[reports/validation](../../reports/README.md#validation), with links to the exact
run or compact evidence. Do not include account names, personal documents,
machine addresses or raw local profile paths.

## Release validation

Release preparation requires clean source, current identity and notices, a
successful workflow for the actual `main` revision, the same validated package
bytes, and the required lane evidence. The
[release procedure](../releases-and-support.md#maintainer-release-procedure)
defines promotion and maintainer review. Native or browser tests alone do not
establish target-reader appearance, Remote-SSH/WSL, other architectures or
standalone installer compatibility.
