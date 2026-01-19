---
"drift-toolkit": minor
---

Add check.toml change tracking utilities

- Add `detectCheckTomlChanges()` to detect added/modified/deleted check.toml files
- Add `compareCheckTomlFiles()` for comprehensive change comparison between commits
- Add `getCheckTomlFilesAtCommit()` to list check.toml files at a specific commit
- Add `isGitRepo()` and `getHeadCommit()` git utilities
- Export new types: `CheckTomlChanges`, `ChangeDetectionOptions`
