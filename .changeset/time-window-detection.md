---
"drift-toolkit": minor
---

Add time-window based git change detection

- Add `getRecentCommits()` to get commits within a time window (default 24h)
- Add `getChangedFilesInCommits()` to extract changed files from commits
- Add `detectRecentChanges()` convenience function combining both
- New types: `TimeWindowOptions`, `RecentCommit`, `RecentChanges`
- Supports both `main` and `master` branches automatically
