# Historical desktop release workflow

`release-electron.yml` preserves the inherited desktop tag-publishing workflow for reference. It is outside `.github/workflows` and does not run. Its unvalidated installers, old runtime and automatic publication are not part of the VS Code 0.2.0 release process. A future desktop release needs its own dependency, platform and installer validation before restoring a workflow.
