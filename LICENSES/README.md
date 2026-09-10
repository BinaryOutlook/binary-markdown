# Retained third-party notices

- `AnyMarkdown-MIT.txt`: upstream Any Markdown and earlier MIT contributions to
  Binary Markdown; retained during the AGPL transition.
- `Mermaid-MIT.txt`: the MIT notice from the source revision reported by
  Mermaid 10.9.8's npm metadata, whose archive omits it:
  [49c1a1c7 LICENSE](https://github.com/mermaid-js/mermaid/blob/49c1a1c7d1faa995b07cc7224543bd0d9a7a9e70/LICENSE).
- `micromark-MIT.txt`: the common notice for the micromark monorepo's MIT
  packages, retained from micromark 3.2.0's reported source revision:
  [94b76796 license](https://github.com/micromark/micromark/blob/94b7679646bc0221899bba034f52f4abb3700f81/license).

The build records the exact packages included in the Mermaid browser bundle in
`vendor/MERMAID-DEPENDENCIES.json` and collects their complete available notices
in `vendor/MERMAID-THIRD-PARTY-LICENSES.txt`. Missing notices fail the build.
These files and the browser-control library's notices are included in the VSIX.
The AGPL transition does not replace any of these third-party terms.
