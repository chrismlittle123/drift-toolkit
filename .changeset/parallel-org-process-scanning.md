---
"drift-toolkit": minor
---

feat: add parallel execution for org-wide process scanning

When using `drift process scan --org`, repos with check.toml are now scanned in parallel for process violations. Features include:

- Parallel scanning with configurable concurrency (default: 5 repos)
- Automatic issue creation for repos with violations
- Aggregated results with summary statistics
- JSON output support for CI/CD integration
- Dry-run mode support
- Graceful error handling (one failed repo doesn't stop others)
