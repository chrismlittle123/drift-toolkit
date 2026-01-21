---
"drift-toolkit": minor
---

Add org-wide repo discovery for process scanning

- Add `--org` option to `drift process scan` command to discover repos with check.toml
- Add `discoverProcessRepos()` function to find repos in an org that have check.toml files
- Add `hasRemoteCheckToml()` helper function to check for check.toml via GitHub API
- Discovery uses parallel requests with configurable concurrency for performance
