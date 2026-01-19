---
"drift-toolkit": minor
---

Add repository detection utilities for identifying scannable repositories

- Add `isScannableRepo()` to check if a repo has both repo-metadata.yaml and check.toml
- Add `getRepoMetadata()` to parse tier and status from repo-metadata.yaml
- Add `findCheckTomlFiles()` to discover check.toml files in monorepos
- Add `hasMetadata()` and `hasCheckToml()` helper functions
- Export new types: `RepoTier`, `RepoStatus`, `RepoMetadata`, `ScannabilityResult`
