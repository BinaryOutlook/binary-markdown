# Documentation standard

Status: **Adopted incrementally, starting with export documentation** · 2026-09-14.

This standard describes how contributors write and maintain Binary Markdown's documentation. English is the maintainer's chosen documentation language. The [export subsystem](export-subsystem.md) is the first alignment area. Other existing files are being aligned incrementally. Start at the [documentation index](README.md).

## Recommended approach

Use **Diátaxis for structure, Google's developer style guide for prose, and Docs as Code for maintenance**, with selective TSDoc comments and a curated changelog. This is a project convention assembled from established guidance, not a certification or a universal requirement for open-source projects.

| Convention | Purpose | Application here |
| --- | --- | --- |
| [Diátaxis](https://diataxis.fr/start-here/) | Organize content by reader need. | Distinguish tutorials, how-to guides, reference, and explanation. |
| [Google developer style guide](https://developers.google.com/style/highlights) | Write clear and consistent technical prose. | Use its core language and formatting guidance, with the project choices below. |
| [Docs as Code](https://www.writethedocs.org/guide/docs-as-code/) | Maintain documentation alongside software. | Keep Markdown in Git, review changes in PRs, and introduce automated checks. |
| [TSDoc](https://tsdoc.org/) | Standardize TypeScript documentation comments. | Document important interfaces and behavior using compatible comment syntax. |
| [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) | Explain changes to users. | Group meaningful changes by version and category; maintain an Unreleased section. |

## Language and writing

- Write maintained guides, developer comments, and test descriptions in English. Use American English for new and revised prose, such as "behavior" and "color". Preserve exact identifiers, interface labels, names, and quotations.
- Retain interface translations and multilingual test inputs and expected results. Preserve upstream archives, third-party notices, and historical evidence. Add English context when readers need it.
- Address the reader as "you" in instructions. Use active voice and precise verbs. Explain unfamiliar terms when first used. Avoid promotional or unsupported claims.
- Use sentence-case headings, numbered steps for procedures, and tables for reference or comparisons. Write interface labels in **bold** and identifiers, paths, and commands in `code`. Give code fences a language identifier.
- Use descriptive link text and image alternatives. Include equations or diagrams when they clarify the subject. Prefer ordinary Markdown and relative repository links; use HTML only when the required presentation needs it.

## Choose a reader need

Each page should have one primary purpose. Link to related material instead of interrupting a procedure with long architectural or historical explanations. These categories do not require four new directories or a website migration.

| Kind | Reader's need | Binary Markdown example |
| --- | --- | --- |
| Tutorial | Learn through a guided first success. | Create and export your first document. |
| How-to guide | Complete a particular task. | Configure Pandoc for Word export. |
| Reference | Look up exact behavior or options. | Settings, commands, defaults, and export limitations. |
| Explanation | Understand the system and its decisions. | Why export captures a saved document revision. |

Keep the root README as the entry point: purpose, installation, a short usage example, current limitations, and links to deeper guides. Use CONTRIBUTING for contributor workflow. Give each repeated topic one authoritative page, with short summaries and links elsewhere. Check setting IDs and defaults against the manifest.

For the README, aim for roughly 800–1,000 words when that is enough to orient a new reader. Lead with a brief description, installation, and a small set of feature highlights. Keep release status, essential compatibility limits, upstream credit, and licensing visible. Put complete settings tables, troubleshooting, support procedures, and repository history in their maintained guides; summarize and link from the README. This is an editorial target, not a reason to remove necessary warnings or provenance. Keep existing section anchors where practical and check incoming links when renaming a heading.

Keep architectural decisions in `docs/decisions/`, with status, context, decision, alternatives, and consequences. Preserve superseded decisions and link to their replacements. Keep plans and dated validation records distinct from current guides; preserve requirement IDs and evidence links when reorganizing them.

## Where material belongs

| Location | Purpose | Maintenance |
| --- | --- | --- |
| `docs/` | Current tutorials, how-to guides, reference, explanations and project policy | Update with behavior changes; index in `docs/README.md` |
| `docs/decisions/` | Continuing design rationale | Record status and link superseding decisions; preserve earlier decisions |
| `reports/` | Dated investigations, comparisons and validation outcomes | Identify revision/environment and limitations; index in `reports/README.md` |
| `release-notes/` | Announcements associated with one version | Preserve that version's scope; the release page establishes publication |
| `archive/` | Completed plans, superseded handoffs and inherited material | Label as historical and link to current guidance |
| `test/fixtures/` and `test/native/` | Reusable test inputs and harness procedures | Keep executable assumptions beside the tests; put results in reports |

Evergreen means maintained and applicable, not undated. Migration instructions and accepted decisions can refer to earlier versions. Separate procedures from one-time outcomes when a page contains both. Use one authoritative explanation of a behavior and link it from reports; do not duplicate the current guide. The packaged export help remains in `media/export-help.md`, where the extension loads it. The documentation index links there without maintaining another copy.

Use `YYYY-MM-DD-topic.md` for dated reports and version names for release records. Preserve source and artifact hashes, requirement IDs, observations and attribution. Do not convert a historical failure, skip or unknown result into a pass while editing. When removing sensitive fields, explain the redaction and retain the remaining evidence's original scope.

Screen public material for credentials, personal documents, email/account names, machine names/addresses, and home or temporary-profile paths. Prefer synthetic examples. Inspect images and embedded metadata as well as text; retain only necessary, sanitized evidence. Public project links and required third-party attribution remain provenance. Store large generated artifacts and raw logs in ignored output directories or reviewed CI artifacts rather than documentation.

## Write verifiable instructions

For a how-to guide, start with the outcome and prerequisites, then provide ordered steps, an expected result, and relevant troubleshooting. Use this outline where it helps; a short procedure does not need empty sections.

Example wording:

> To export a Word document, install Pandoc and save your Markdown file. Open the export menu and select **DOCX** (Word).

Verify actual interface labels before publishing an instruction. Distinguish released behavior, development behavior, and proposed work. Scope compatibility and validation claims to the versions and environments supported by evidence. Keep examples reproducible and free of credentials, personal paths, and private documents.

## Document code selectively

Use TSDoc-style `/** ... */` comments for important TypeScript interfaces and functions. Explain contracts, side effects, failure behavior, cancellation, and ordering requirements where relevant. Use `@param`, `@returns`, `@remarks`, and `@example` when they add useful information; TypeScript already supplies types. For JavaScript, use JSDoc-style comments and type annotations where helpful.

Explain why non-obvious code exists. Avoid repeating obvious statements or adding comments merely to reach a coverage target. Generated API pages are optional; they do not replace a contributor architecture overview.

## Review and maintenance

Update affected documentation in the same PR as a behavior change, or explain why no update is needed. Use this short contributor checklist:

- [ ] The page serves a clear reader need and uses consistent English terminology.
- [ ] Instructions, interface labels, examples, and defaults match the relevant revision.
- [ ] Links resolve, and limitations appear beside the affected instructions.
- [ ] Release and support claims match evidence and maintainer decisions.
- [ ] Historical records, translations, and multilingual test data remain intact.

AI can draft, translate, and check consistency. Maintainer review should focus on support commitments, intended behavior, and design rationale that code cannot establish. Validate important beginner instructions through a reader walkthrough; use representative document-reader checks for export appearance claims.

Run `node scripts/check-docs.cjs` to check local links/anchors, JSON evidence and common private-data patterns in maintained pages and curated records. The candidate-build job runs this offline check. It excludes inherited upstream archives and does not replace manual review of prose, screenshots or image metadata. Suspected private values are reported by location and category, without printing the value. Markdown lint and manifest/reference consistency checks can be added incrementally; external link availability is separate from the local check.

## Adoption

Apply this standard to new and revised documentation, and align existing active pages in small changes, starting with export. Keep it linked from CONTRIBUTING so contributors can find it. Remaining repository-wide alignment is separate work. Translation of legacy test prose is a separate migration slice; the English convention does not authorize changing multilingual test data. A documentation website, exhaustive comment rewrite, and application refactoring are not required to adopt this standard.
