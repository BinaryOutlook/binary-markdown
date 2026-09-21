# Agent instructions for Binary Markdown

These instructions apply to work in this repository. Follow the user's explicit directions for task-specific workflow exceptions.

## Workspace and branches

- Reserve the primary checkout for `main`, the baseline product experience. Make implementation, documentation, and configuration changes in a dedicated branch and worktree unless the user explicitly requests an exception.
- Before making changes, inspect the current branch, working tree, registered worktrees, and relevant repository guidance. Preserve unrelated work.
- Confirm the canonical remote and fetch its `main` before starting new work and at meaningful integration checkpoints. If the fetch fails, disclose that the baseline could not be refreshed instead of claiming it is current.
- Keep the primary checkout current with a fast-forward update only when it is clean, on `main`, and can advance without replacing local history. If it is dirty or diverged, preserve it and report the condition. Do not reset, rebase, stash, or switch its branch merely to force synchronization.
- Start new implementation in a purpose-named worktree on a `feat/` branch from the refreshed remote `main`, unless the task specifies another base or branch. Continue existing task branches without discarding their work. Detached worktrees are suitable for inspection and testing; use a named branch for implementation intended to be retained.
- Keep diffs focused and stage only intended paths. Do not overwrite another person's or agent's changes, remove their worktree, or include unrelated files.

## Clarify the intended result

- Inspect the existing behavior before proposing a change. Do not assume a feature request conveys the complete design.
- Before implementation, briefly explain the intended user experience, scope, and observable success criteria. Match the detail to the size of the task.
- Ask concise questions about unresolved choices that materially affect product behavior, scope, compatibility, architecture, or external effects. Explain the choices and their tradeoffs, with a recommendation when useful.
- Wait for answers before implementing dependent material decisions. Continue independent investigation or preparation where possible. Silence does not settle an unresolved decision.
- If the user delegates design choices or asks you to bridge gaps independently, state reasonable assumptions and proceed within that scope. Resolve routine implementation details independently and carry settled decisions forward without repeatedly asking for the same confirmation.

## Public documentation and security

- Follow the [documentation standard](docs/documentation-standard.md). Write maintained developer prose in clear English and preserve interface translations and multilingual test data.
- Keep documentation self-contained for another contributor: state prerequisites, working directories, necessary steps, and expected results. Link to maintained guides for shared procedures instead of relying on a chat or one machine's setup.
- Use relative repository links and paths that stay within the repository. Describe external tools or locations with documented configuration variables or neutral placeholders. Do not embed personal absolute paths.
- Review prose, commands, examples, logs, screenshots, fixtures, and embedded metadata for credentials, personal information, private locations, account details, and machine identifiers. Prefer synthetic examples and sanitized evidence. Report suspected sensitive data by location and category without repeating its value.
- Preserve required copyright notices, upstream attribution, and public project provenance. Privacy cleanup must not erase legitimate credits or change what historical evidence establishes.
- Keep one authoritative guide for each topic and update relevant documentation when behavior changes. Use the [documentation index](docs/README.md) to find current guidance.

### Markdown layout before commits

- Before committing documentation or any other Markdown file, audit every Markdown file included in the proposed commit. Review the complete affected files for existing layout problems as well as issues introduced by the edit.
- Perform two separate passes after the final edit. First, review the raw Markdown and proposed diff for accidental line breaks, split words or identifiers, unwanted blank lines, broken links, malformed tables, incorrect list indentation, missing separation around block elements, and unbalanced fences.
- Second, inspect a rendered Markdown preview. Check paragraph flow, heading separation, list nesting and numbering, tables, links, code blocks, and math where present. Confirm that intended line breaks survive and that source formatting has not created unwanted visible breaks.
- Let the renderer wrap ordinary prose to the available width; do not insert manual line breaks solely to enforce a source column limit. Preserve intentional paragraph boundaries, Markdown hard breaks, and meaningful whitespace in code, math, quotations, and fixtures. Do not blindly reflow content whose line structure is part of its meaning or test expectations.
- Run relevant documentation and whitespace checks as supporting evidence. Automated checks do not replace the second, rendered review. Fix problems within the task's scope, report unrelated findings, and repeat the affected checks after any correction.
- Before the commit, summarize the two review passes and any remaining layout issue or preview limitation. Do not describe Markdown as double-audited if either pass was skipped.

## Implementation and verification

- Follow [CONTRIBUTING.md](CONTRIBUTING.md), the [build guide](docs/building.md), and the [testing guide](docs/testing/README.md). Read the relevant subsystem guidance before changing its contracts.
- Preserve Markdown content, user settings, selection, and editing state unless the agreed change intentionally alters them. View-only actions must not modify documents. Keep product identifiers and setting defaults stable unless their change is part of the agreed scope.
- For editor changes, consider parsing, editing, serialization, saving, undo, source switching, and export as applicable. Rendering correctly alone does not establish that editing preserves the document.
- Use the Node version recorded in `.node-version`. Run full compilation after changing webview JavaScript, CSS, shared JavaScript, or translations; the watch command only watches TypeScript. Keep supported translation dictionaries in sync.
- Select checks that exercise the changed behavior. Add meaningful regression coverage for bugs and new behavior where appropriate; documentation-only changes need documentation checks, not unrelated application tests.
- Follow the documented candidate and release gates when preparing those deliverables. Rebuild and reinstall when verifying changes in a packaged extension. Distinguish source tests, browser tests, installed-extension checks, and actual output-reader observations.
- Report commands and outcomes accurately, including failures, skips, and limits. Do not describe a focused pass as a full regression run or infer current CI, merge, or release status from an older result.

### Integration documentation and CI monitoring

- Minor documentation drift is acceptable during active integration. Before declaring the integration PR ready to merge into `main`, update the README and affected documentation to match the final agreed scope.
- For documentation-only changes following a successful full CI run, perform relevant documentation and whitespace checks. Do not actively wait for or repeatedly poll another full CI run unless the user explicitly requests it.
- After an authorized merge into `main`, apply the same no-wait policy if the merged content introduces no untested functional changes or new conflict resolutions beyond the previously validated branch.
- Keep required CI enabled and respect branch protections. This policy permits skipping active monitoring; it does not permit bypassing required checks or release gates.
- Report verification accurately: identify the previous successful run and state whether newer CI is pending, failed, or unverified. Never describe expected success as an observed pass. Investigate known failures rather than dismissing them because an earlier run passed.

## Release versions and review candidates

- The user decides the intended release version. Before preparing a new release series, recommend a target and briefly explain the feature scope, compatibility changes and remaining acceptance work. Carry forward an approved target without repeatedly asking.
- Recommend patch increments for compatible fixes and minor increments for new functionality. Highlight breaking changes explicitly. While the project remains below 1.0, ask the user to decide the appropriate milestone rather than inferring it from change volume.
- If a release target remains undecided, continue authorized development and testing with clearly identified development snapshots. An unanswered question does not approve a release version. Existing explicitly authorized patch automation remains governed by the release policy.
- Once the target and candidate preparation are authorized, label final-review builds "`<version> RC<n>`", starting at RC1. Increment the candidate counter when preparing a replacement review build; keep the approved release target unchanged.
- Use RC status when the intended feature scope is settled and remaining work is acceptance testing and fixes. Use development or beta status while substantial design or feature work remains.
- Distinguish the review label from the package version. VSIX manifests require numeric `major.minor.patch` versions. For GitHub-distributed candidates, labels and prerelease tags may use suffixes such as `v0.4.0-rc.1`. Follow the release guide for channel-specific numbering.
- Keep manifests, lockfile version fields, release notes and build information consistent when changing the package version. Preserve the extension identifier so settings and update continuity remain intact.
- Identify every distributed candidate by its review label, package version, full source commit, local-change status and VSIX checksum. Retain the matching build-information and checksum files. Do not silently replace a previously distributed candidate.
- Before requesting human review, provide the exact artifact, installation instructions, build-identity check, focused acceptance checklist and known limitations. Confirm which candidate each result applies to.
- A changed candidate requires verification appropriate to its changes. Explain which earlier observations still apply and which need repeating. Follow existing CI and release gates without claiming that an earlier candidate's results validate a different build.
- Candidate preparation, version selection, merging and release publication are separate actions. Perform each within existing authorization and the maintained release procedure.

## Delivery and communication

- Carry authorized local work through implementation and appropriate verification. Keep the user informed about meaningful findings, decisions, and blockers.
- Distinguish local preparation, branch publication, pull-request creation, merging, and release publication. Perform each within the authority granted by the request, and carry forward authorization already given. If further approval is needed, first prepare a concrete, reviewable result and explain why it is needed.
- Before publishing, inspect the actual diff and staged paths, check public material for private data, and verify the relevant branch and validation state. Do not bypass repository review or required checks.
- Finish with what changed, why, the verification performed, and any material limitation or remaining decision. Keep local success, remote CI, merging, and publication as separate claims supported by current evidence.
