---
"drift-toolkit": minor
---

Add smart scanning with 24h commit window for org scans

- Only scan repos with commits to main/master in the last 24 hours (configurable)
- Add `--all` flag to scan all repos regardless of commit activity
- Add `--since <hours>` option to customize the time window
- Uses GitHub Commits API to check for recent activity before cloning
