---
"drift-toolkit": minor
---

Add GitHub issue creation for detected drift

- Create GitHub issues automatically when configuration drift is detected during org scans
- Issues include diffs of changed files with truncation for large diffs
- Add `--dry-run` flag to preview what issues would be created without creating them
- Issue format: title `[drift:code] Configuration changes detected`, label `drift:code`
