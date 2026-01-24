---
"drift-toolkit": patch
---

Fix: Filter out repos from other orgs where user is a collaborator

When using `type=all` parameter with GitHub API to list repos, the API returns all repositories the user has access to, including repos in other organizations where the user is a collaborator. This caused external repos to be included in scans.

The fix adds owner filtering to ensure only repos that actually belong to the requested org/user are included in results.
