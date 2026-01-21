---
"drift-toolkit": minor
---

Add smart scanning for process command - filter repos by recent commit activity

- New `--since <hours>` flag to only scan repos with commits in the specified time window (default: 24 hours)
- New `--all` flag to scan all repos regardless of recent commit activity
- Reduces API calls when scanning large organizations by focusing on active repos
