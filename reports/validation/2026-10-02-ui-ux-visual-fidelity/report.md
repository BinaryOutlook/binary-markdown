# Scoped AI visual fidelity review

The original review was recorded on 2026-10-02. Its generated evidence was archived on 2026-10-04 from source branch snapshot `0033846a64a3b1de6127f24771c092a5f4063bff`. This compact record retains the review's identity, scope and limitations while the complete images, assessment records and delivery files remain in a separate archive.

## Evidence identity

| Field | Recorded value |
| --- | --- |
| Product source assessed by AI | `9941d02028b4989a2af4d7647c6b972d11ff5529` |
| Product input SHA-256 | `334c1575ab0be09973a26f60ff320f2ab673b05cc2538bcb6cef79f15096c344` |
| Review contract SHA-256 | `6a49fa68b56b31cae2ecb755cf2986d4dc9e20fc4f48b544e02c0560c95bb13c` |
| Coverage | Twelve sections, 82 required cases and 46 independent final case-group assessments |
| Final section verdicts | Twelve PASS results for the recorded product inputs |
| Capture boundary | Production browser fixture with synthetic notes, fixed selected artwork and explicit state contracts |

The sections cover Canvas, Toolbar, Commands, Outline, Tables, Code, Equations, Diagrams, Find, Metadata, Views and Export. Full application images establish placement and obstruction; component images provide detail. Each assessment grades its declared target regions, including derived narrow, error and theme states where required.

Earlier FAIL and BLOCKED records, original packets, receipts, case-group assessments, image hashes and fixed references remain unchanged in the archive. A missing assessment or unresolved major discrepancy could not be averaged into a PASS. The [maintained workflow](../../../docs/testing/visual-review.md) describes capture, evaluation, correction and stale-evidence handling; the [implementation adaptations](../../plans/2026-10-01-ui-ux-visual-fidelity/implementation-notes.md) record the agreed design boundaries.

## Archive and provenance

The complete export contains all 239 files from this report directory plus `archive-manifest.json`. The manifest records every original repository-relative filename, byte count and SHA-256. Every exported file was checked against its original bytes, and ZIP integrity was verified before removing the generated files from the branch.

| Export | SHA-256 |
| --- | --- |
| `binary-markdown-pr96-evidence-0033846.zip` | `d30ffa13f70f8c5ca74a07ac61b209f22625adebea7907eec186ed6a252a1b16` |
| Original single-file HTML ZIP | `2d9980fce5653b51bb69b4800c6f0a6921b5af343979260d0612af02ed92c987` |

The complete export is retained separately from the source tree and supplied with the pruning handoff. Historical repository copies remain available at the exact pre-pruning snapshot:

- [Full original report](https://github.com/BinaryOutlook/binary-markdown/blob/0033846a64a3b1de6127f24771c092a5f4063bff/reports/validation/2026-10-02-ui-ux-visual-fidelity/report.md).
- [Original evidence directory](https://github.com/BinaryOutlook/binary-markdown/tree/0033846a64a3b1de6127f24771c092a5f4063bff/reports/validation/2026-10-02-ui-ux-visual-fidelity).
- [Original self-contained HTML ZIP](https://raw.githubusercontent.com/BinaryOutlook/binary-markdown/0033846a64a3b1de6127f24771c092a5f4063bff/reports/validation/2026-10-02-ui-ux-visual-fidelity/delivery/ui-ux-visual-fidelity.html.zip). Extract it and open `ui-ux-visual-fidelity.html`; the report images and assessment records work offline.

To check a separately obtained export on macOS, run `shasum -a 256 binary-markdown-pr96-evidence-0033846.zip` in its containing directory and compare the digest above. On Linux, use `sha256sum` with the same filename. A matching checksum establishes the exported bytes, not publisher identity or owner acceptance.

## Validation and acceptance boundary

The sealed visual evidence predates later document-navigation fixes, toolbar simplification and the expansion-toggle follow-up. It does not establish a new independent AI verdict for those later revisions. [PR #96](https://github.com/BinaryOutlook/binary-markdown/pull/96) records the subsequent implementation and its exact validation runs.

[CI run 37157891008](https://github.com/BinaryOutlook/binary-markdown/actions/runs/37157891008) passed for later product head `2ee98dab8d691d5e74803d74cc4d111e3831a5ea`: four platform/minimum-version lanes, installed-extension checks, output-integrity gates and three complete browser lanes with zero retries. That result applies to its own revision and does not validate subsequent changes automatically.

Owner acceptance, spoken screen-reader output, standalone Electron behavior and observations in actual export readers remain separate from the recorded AI and automated results. Follow the [build guide](../../../docs/building.md) and [testing guide](../../../docs/testing/README.md) when preparing a new identified package or checking later source changes.

Pruning the generated delivery leaves the runtime implementation and functional regression tests intact. It removes the bulky files from the final source snapshot; existing Git commits and stored objects remain subject to normal branch and retention management.
