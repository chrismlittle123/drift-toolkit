---
"drift-toolkit": minor
---

Add pre-clone filtering to only scan repos with required metadata files

- Add `fileExists()` and `isRepoScannable()` functions to check for `repo-metadata.yaml` and `check.toml` via GitHub API before cloning
- Skip repos missing required files with "missing required files" message
- Add tier-ruleset mismatch detection and issue creation
- Reduces unnecessary clone operations during org-wide scanning
