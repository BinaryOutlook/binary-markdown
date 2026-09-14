# Documentation standard

Status: **Adopted incrementally, starting with export documentation** · 2026-09-14.

This standard describes how contributors write and maintain Binary Markdown's
documentation. English is the maintainer's chosen documentation language. The
[export subsystem](export-subsystem.md) is the first alignment area. Other existing
files are being aligned incrementally; automated documentation checks remain proposed.

## Recommended approach

Use **Diátaxis for structure, Google's developer style guide for prose, and
Docs as Code for maintenance**, with selective TSDoc comments and a curated
changelog. This is a project convention assembled from established guidance,
not a certification or a universal requirement for open-source projects.

| Convention | Purpose | Application here |
| --- | --- | --- |
| [Diátaxis](https://diataxis.fr/start-here/) | Organize content by reader need. | Distinguish tutorials, how-to guides, reference, and explanation. |
| [Google developer style guide](https://developers.google.com/style/highlights) | Write clear and consistent technical prose. | Use its core language and formatting guidance, with the project choices below. |
| [Docs as Code](https://www.writethedocs.org/guide/docs-as-code/) | Maintain documentation alongside software. | Keep Markdown in Git, review changes in PRs, and introduce automated checks. |
| [TSDoc](https://tsdoc.org/) | Standardize TypeScript documentation comments. | Document important interfaces and behavior using compatible comment syntax. |
| [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) | Explain changes to users. | Group meaningful changes by version and category; maintain an Unreleased section. |

## Language and writing

- Write maintained guides, developer comments, and test descriptions in English.
  Use American English for new and revised prose, such as "behavior" and "color".
  Preserve exact identifiers, interface labels, names, and quotations.
- Retain interface translations and multilingual test inputs and expected results.
  Preserve upstream archives, third-party notices, and historical evidence.
  Add English context when readers need it.
- Address the reader as "you" in instructions. Use active voice and precise verbs.
  Explain unfamiliar terms when first used. Avoid promotional or unsupported claims.
- Use sentence-case headings, numbered steps for procedures, and tables for
  reference or comparisons. Write interface labels in **bold** and identifiers,
  paths, and commands in `code`. Give code fences a language identifier.
- Use descriptive link text and image alternatives. Include equations or diagrams
  when they clarify the subject. Prefer ordinary Markdown and relative repository
  links; use HTML only when the required presentation needs it.

## Choose a reader need

Each page should have one primary purpose. Link to related material instead of
interrupting a procedure with long architectural or historical explanations.
These categories do not require four new directories or a website migration.

| Kind | Reader's need | Binary Markdown example |
| --- | --- | --- |
| Tutorial | Learn through a guided first success. | Create and export your first document. |
| How-to guide | Complete a particular task. | Configure Pandoc for Word export. |
| Reference | Look up exact behavior or options. | Settings, commands, defaults, and export limitations. |
| Explanation | Understand the system and its decisions. | Why export captures a saved document revision. |

Keep the root README as the entry point: purpose, installation, a short usage
example, current limitations, and links to deeper guides. Use CONTRIBUTING for
contributor workflow. Give each repeated topic one authoritative page, with short
summaries and links elsewhere. Check setting IDs and defaults against the manifest.

Keep architectural decisions in `docs/decisions/`, with status, context, decision,
alternatives, and consequences. Preserve superseded decisions and link to their
replacements. Keep plans and dated validation records distinct from current guides;
preserve requirement IDs and evidence links when reorganizing them.

## Write verifiable instructions

For a how-to guide, start with the outcome and prerequisites, then provide ordered
steps, an expected result, and relevant troubleshooting. Use this outline where
it helps; a short procedure does not need empty sections.

Example wording:

> To export a Word document, install Pandoc and save your Markdown file. Open the
> export menu and select **DOCX** (Word).

Verify actual interface labels before publishing an instruction. Distinguish
released behavior, development behavior, and proposed work. Scope compatibility
and validation claims to the versions and environments supported by evidence.
Keep examples reproducible and free of credentials, personal paths, and private
documents.

## Document code selectively

Use TSDoc-style `/** ... */` comments for important TypeScript interfaces and
functions. Explain contracts, side effects, failure behavior, cancellation, and
ordering requirements where relevant. Use `@param`, `@returns`, `@remarks`, and
`@example` when they add useful information; TypeScript already supplies types.
For JavaScript, use JSDoc-style comments and type annotations where helpful.

Explain why non-obvious code exists. Avoid repeating obvious statements or adding
comments merely to reach a coverage target. Generated API pages are optional;
they do not replace a contributor architecture overview.

## Review and maintenance

Update affected documentation in the same PR as a behavior change, or explain
why no update is needed. Use this short contributor checklist:

- [ ] The page serves a clear reader need and uses consistent English terminology.
- [ ] Instructions, interface labels, examples, and defaults match the relevant revision.
- [ ] Links resolve, and limitations appear beside the affected instructions.
- [ ] Release and support claims match evidence and maintainer decisions.
- [ ] Historical records, translations, and multilingual test data remain intact.

AI can draft, translate, and check consistency. Maintainer review should focus on
support commitments, intended behavior, and design rationale that code cannot
establish. Validate important beginner instructions through a reader walkthrough;
use representative document-reader checks for export appearance claims.

Introduce Markdown lint, local link and anchor checks, and manifest/reference
consistency checks incrementally. Define exceptions for frozen fixtures and
archives. Network link failures should be assessed separately from deterministic
local checks. These checks are not yet installed by adopting this standard.

## Adoption

Apply this standard to new and revised documentation, and align existing active
pages in small changes, starting with export. Keep it linked from CONTRIBUTING so
contributors can find it. Remaining repository-wide alignment is separate work.
Translation of legacy test prose is a separate migration slice; the English
convention does not authorize changing multilingual test data. A documentation
website, exhaustive comment rewrite, and application refactoring are not required
to adopt this standard.
