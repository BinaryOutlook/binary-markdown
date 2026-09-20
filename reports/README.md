# Reports

These records preserve observations about particular revisions and environments. Use the [documentation index](../docs/README.md) for current instructions. An earlier pass, failure or pending-review statement applies to the recorded work only; it is not a current release or support claim.

## Investigations and comparisons

| Date | Report | Scope |
| --- | --- | --- |
| 2026-09-20 | [Editable DOCX code-line numbering](investigations/2026-09-20-docx-code-numbering.md) | Isolated native-paragraph/table prototypes, preservation findings and LibreOffice development-reader evidence; reader matrix and technical freeze remain unaccepted |
| 2026-09-14 | [DOCX code blocks and language tabs](investigations/2026-09-14-docx-code-blocks.md) | Reproduction, implementation choices and local reader/format checks; final Word visual acceptance remains separate |
| 2026-09-12 | [Export page background](investigations/2026-09-12-export-page-background.md) | Original PDF investigation and subsequent fix evidence |
| 2026-09-14 | [Feature comparison](comparisons/2026-09-14-feature-comparison.md) | Source at `0a7641a`; competitor information and priorities as assessed on that date |
| 2026-09-08 | [Earlier feature comparison](comparisons/2026-09-08-feature-comparison.md) | Source at `9ff6ce04`; predates export and later integration features |

## Validation

| Recorded scope | Report | Evidence boundary |
| --- | --- | --- |
| 2026-09-20 editor/export issue stack | [Integration review](validation/2026-09-20-editor-export-stack.md) | All 22 issues and 10 correction PRs, exact dependency heads, local checks and unresolved reader/manual acceptance; development work, not a release |
| 2026-09-14 Windows workstream | [Local Windows preparation](validation/2026-09-14-windows-preparation.md) | macOS development checks and platform-shim tests; actual Windows execution pending |
| 2026-09-14 YAML/TOC branch | [YAML and TOC validation](validation/2026-09-14-yaml-toc.md) | Identified local branch, focused browser checks and installed-extension exports |
| Version 0.2.0 integration | [Candidate validation](validation/0.2.0.md) | Recorded macOS/Ubuntu/minimum-VS-Code candidates and hosted runs |
| Export work through 2026-09-10 | [Export validation](validation/2026-09-10-export.md) | Original export milestones, failures, corrections and host boundaries |
| 2026-09-09 export artifacts | [Artifact inspection](validation/2026-09-09-export-artifact-audit.md) | Identified package outputs and representative pages |
| Version 0.1.0 work; original date unspecified | [Copy and outline results](validation/0.1.0-copy-paste.md) | Original combined build and later naming-migration checks |

The reports link their compact JSON receipts and representative images in [validation/evidence](validation/evidence/). Artifact hashes and recorded outcomes are retained. Local temporary locations and timestamped receipt basenames have been generalized for privacy; they are not runnable paths to the original machines.

## Add a report

Use `YYYY-MM-DD-topic.md` for dated work, or a version for a release record. Include purpose, date, source revision, environment, observations, limitations and links to evidence. Label proposals and unknown results explicitly. Link new reports here and link reusable findings from the relevant maintained guide.

Keep secrets, personal documents, user/account identifiers, machine names, addresses and raw checkout/profile paths out of reports. Use synthetic examples and inspect image content and metadata before retaining an image. Project URLs, source and artifact hashes, and required attribution identify public project material and remain useful provenance. Large logs, traces and generated exports belong in ignored local output or reviewed CI/release artifacts.
