---
"drift-toolkit": minor
---

Add new project detection via `cm projects detect` command. This feature surfaces projects (including monorepo packages) that are missing `check.toml` configuration and creates GitHub issues with actionable guidance.

New exports:

- `detectMissingProjects(repoPath)` - Detect projects without check.toml
- `detectAllProjects(repoPath)` - Get full project detection output
- `MissingProject` and `MissingProjectsDetection` types
- `CmProjectsOutput` type
