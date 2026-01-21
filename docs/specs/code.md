# Spec: drift code scan

> Detects changes to configuration files that define code standards.

## Overview

`drift code scan` tracks changes to check.toml files and their dependencies (eslint config, tsconfig, etc.). When changes are detected, it creates GitHub issues to surface the drift for investigation.

---

## Prerequisites (check-my-toolkit)

Features required from check-my-toolkit:

| Feature              | Status            | Description                                                      |
| -------------------- | ----------------- | ---------------------------------------------------------------- |
| `cm dependencies`    | Not started       | Expose existing configFiles data via CLI as JSON                 |
| `cm projects detect` | **Already works** | Returns `status: "has-config"` or `"missing-config"` per project |

**Blocked until:** `cm dependencies` is available

**Note:** The CLI command is `cm` (not `cmt`). Tool runners already declare their config files internally - the `dependencies` command just needs to expose this data.

---

## Milestones

### Milestone 1: Foundation

**Goal:** Basic change detection for check.toml files

| Task                 | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| Strip existing code  | Remove old drift.config.yaml logic, keep GitHub API client            |
| Repo detection       | Implement detection based on repo-metadata.yaml + check.toml          |
| check.toml tracking  | Always track check.toml files for changes                             |
| Git change detection | Detect if check.toml changed since last scan (commits to main in 24h) |
| Basic GitHub issue   | Create issue when check.toml changes                                  |

**Output:** `drift code scan` creates issues when check.toml files change

---

### Milestone 2: Dependency Tracking

**Goal:** Track all dependency files, not just check.toml

| Task                        | Description                                                 |
| --------------------------- | ----------------------------------------------------------- |
| Integrate cm dependencies   | Call `cm dependencies --json` to get tracked files          |
| Dependency change detection | Detect changes to any tracked file (eslint, tsconfig, etc.) |
| Diff generation             | Include diff of changed files in GitHub issue               |
| Workflow tracking           | Always track `.github/workflows/*.yml` changes              |

**Output:** Issues include all changed config files with diffs

---

### Milestone 3: New Project Detection

**Goal:** Surface new projects that don't have check.toml

| Task                         | Description                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------- |
| Integrate cm projects detect | Call `cm projects detect --format json` and filter by `status: "missing-config"` |
| New project issue            | Create issue: "New project detected without standards"                           |
| Monorepo support             | Detect packages in monorepos without check.toml (already supported by cm)        |

**Output:** Issues created for projects missing standards

---

### Milestone 4: Tier Validation

**Goal:** Verify tier-appropriate rulesets are applied

| Task                     | Description                                        |
| ------------------------ | -------------------------------------------------- |
| Parse repo-metadata.yaml | Extract tier (production/internal/prototype)       |
| Parse check.toml extends | Extract rulesets being used                        |
| Tier-ruleset validation  | Verify production tier uses \*-production rulesets |
| Mismatch issue           | Create issue if tier/ruleset mismatch detected     |

**Output:** Issues created for tier-ruleset mismatches

---

### Milestone 5: Org-wide Scanning

**Goal:** Scan all repos in an organization

| Task               | Description                                          |
| ------------------ | ---------------------------------------------------- |
| Repo discovery     | List all repos in org via GitHub API                 |
| Filter by metadata | Only scan repos with repo-metadata.yaml + check.toml |
| Smart scanning     | Only scan repos with commits to main in last 24h     |
| Parallel execution | Scan multiple repos concurrently                     |
| Error handling     | Continue scanning if one repo fails                  |

**Output:** `drift code scan --org <org>` works end-to-end

---

### Milestone 6: GitHub Action Integration

**Goal:** Run as scheduled GitHub Action

| Task            | Description                                   |
| --------------- | --------------------------------------------- |
| Action workflow | Create example workflow for drift-config repo |
| Manual trigger  | Support workflow_dispatch for manual runs     |
| Credentials     | Document GitHub token requirements            |
| Error reporting | Surface scan failures in Actions logs         |

**Output:** drift-config repo can run scheduled code scans

---

## CLI Interface

```bash
# Scan current repo
drift code scan

# Scan all repos in org
drift code scan --org <org>

# Scan specific repo
drift code scan --org <org> --repo <repo>

# JSON output (for debugging)
drift code scan --json

# Dry run (no issues created)
drift code scan --dry-run
```

---

## GitHub Issue Format

**Title:** `[drift:code] Configuration changes detected`

**Labels:** `drift:code`

**Body:**

````markdown
## Configuration Drift Detected

Repository: `myorg/my-app`
Scan time: 2024-01-15 02:00 UTC
Commit: abc1234

### Changed Files

#### check.toml

```diff
- rulesets = ["typescript-internal"]
+ rulesets = ["typescript-production"]
```
````

#### .eslintrc.js

```diff
- "no-console": "warn"
+ "no-console": "off"
```

### Action Required

Review these configuration changes and close this issue once investigated.

---

_Created by drift-toolkit_

```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| check-my-toolkit | CLI (`cm`): `dependencies` command, `projects detect` |
| @octokit/rest | GitHub API (existing) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| check-my-toolkit dependencies command delayed | Can hardcode common dependency mappings as fallback |
| Too many issues created | Smart scanning (24h window) + audit command |
| Large diffs in issues | Truncate diffs, link to commit for full diff |
| Rate limiting on org scan | Existing retry/backoff logic in GitHub client |

```
