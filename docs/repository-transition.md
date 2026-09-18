# Binary Markdown repository transition

On September 16, 2026, Binary Markdown moved its active development into a standalone GitHub repository. Version **0.2.1** is the final product release from the original fork. Future fixes, contributions, and releases belong in the standalone repository.

We are grateful to raggbal and the Any Markdown contributors for the visual editor foundation that made this work possible. Original Git history, authorship, acknowledgments, and applicable license notices remain available. This move introduces no licensing change.

## Where to find things

| Resource | Location |
| --- | --- |
| Active development, new issues, and new pull requests | [binary-markdown](https://github.com/BinaryOutlook/binary-markdown) |
| Earlier issues, reviews, and Actions runs | [binary-markdown-fork](https://github.com/BinaryOutlook/binary-markdown-fork) |
| Original release records and publication dates | [Historical releases](https://github.com/BinaryOutlook/binary-markdown-fork/releases) |
| Downloads, including byte-identical copies of earlier release assets | [Binary Markdown releases](https://github.com/BinaryOutlook/binary-markdown/releases) |
| Original editor foundation | [Any Markdown](https://github.com/raggbal/any-markdown) |
| Attribution and license terms | [Acknowledgments](../ACKNOWLEDGMENTS.md), [NOTICE](../NOTICE), [licensing](licensing.md) |

The original repository remains in Any Markdown's fork network. Its issues, pull requests, comments, reviews, stars, and releases stay attached to that repository. The standalone repository starts its own GitHub records; copying Git history does not transplant those records or transfer watchers.

The original fork's final development checkpoint is [`1a93cc3b089da4bdde57aaab18e39fb8ebe7e0cc`](https://github.com/BinaryOutlook/binary-markdown-fork/commit/1a93cc3b089da4bdde57aaab18e39fb8ebe7e0cc). Its 21 published branches and 9 tags were copied without rewriting their history. The successor's `main` then advances with migration documentation and subsequent development. Historical tags and published assets are not replaced.

## Historical links

Reusing the name `binary-markdown` means GitHub no longer redirects that old address to the renamed fork. For a historical issue or PR, replace the repository segment with `binary-markdown-fork` and keep the number. For example, the original PR #9 is now at [`binary-markdown-fork/pull/9`](https://github.com/BinaryOutlook/binary-markdown-fork/pull/9). The same rule applies to old Actions run links. Numbers in the successor identify new records and must not be assumed to refer to historical ones.

Maintained documentation points to the historical repository for earlier reviews and runs. External bookmarks and the text of historical Git commits cannot all be redirected or rewritten. Use the [historical issues](https://github.com/BinaryOutlook/binary-markdown-fork/issues?q=is%3Aissue) and [pull requests](https://github.com/BinaryOutlook/binary-markdown-fork/pulls?q=is%3Apr) to locate those records.

The earlier upstream contributions remain associated with the original fork: [code-copy PR #8](https://github.com/raggbal/any-markdown/pull/8) and [outline-state PR #9](https://github.com/raggbal/any-markdown/pull/9). Keeping the fork available allows follow-up without continuing a separate product roadmap.

## Existing installations and contributors

The extension identity remains **`BinaryOutlook.binary-markdown`**. The repository move itself requires no reinstall, settings migration, or change to editor associations. Future releases use a new version for changed package bytes. Marketplace publication is a separate release step and is not claimed by this repository transition.

Contributors should check both remote destinations explicitly:

```sh
git remote set-url origin https://github.com/BinaryOutlook/binary-markdown.git
git remote set-url fork https://github.com/BinaryOutlook/binary-markdown-fork.git
git remote -v
```

If a clone has no `fork` remote, use `git remote add fork` with the historical URL instead of `git remote set-url fork`. Fetch the new `origin` before starting work. Use the historical remote for deliberate upstream follow-up; new Binary Markdown product changes belong in the standalone repository.

## Releases and automation

The three earlier releases are retained on the fork. Their 14 uploaded assets are also copied byte-for-byte to the successor to preserve canonical download paths. Each copied release identifies its original record and original publication date. GitHub gives the copies new IDs and publication timestamps; they are historical mirrors, not newly validated product versions.

Automatic and manual release workflows are disabled in the historical fork. The successor is configured and validated independently before its workflows are resumed. Fresh validation of its exact `main` commit is required for new releases; old fork CI records remain historical evidence. The existing three-day automatic release interval uses the successor's copied release publication timestamp as its new baseline. See [releases and support](releases-and-support.md).
