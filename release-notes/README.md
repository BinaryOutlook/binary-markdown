# Release notes

Version-specific notes are source material for release preparation. The
[published release page](https://github.com/BinaryOutlook/binary-markdown/releases)
identifies actual publication, source and downloadable artifacts; a file here
does not publish a release.

- [0.2.1](0.2.1.md): equation editing, YAML/TOC support, export presentation, Windows validation and documentation cleanup.
- [0.2.0](0.2.0.md): original export, identity and release-process scope.
- [Changelog](../CHANGELOG.md): concise version history and unreleased changes.

Write current installation and support guidance in [docs](../docs/README.md).
The [release workflow](../.github/workflows/release-vsix.yml) reads
`release-notes/<version>.md` and resolves its relative links against the release's
source commit. Keep older notes scoped to their version when adding new platform
support or features.
