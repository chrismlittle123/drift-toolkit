---
"drift-toolkit": minor
---

feat: integrate dependency change detection into org scan workflow

When running `drift code scan --org`, the tool now detects changes to dependency files (eslint configs, tsconfigs, workflow files, etc.) tracked by `cm dependencies`. When changes are detected, a GitHub issue is created with:

- File diffs grouped by check type (eslint, tsc, etc.)
- Links to the commit
- Action items for investigation

This completes Milestone 2 from the code.md spec.
