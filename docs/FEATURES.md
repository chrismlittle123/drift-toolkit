# drift-toolkit Features

> **Version:** 3.4.2
> **Last Updated:** 2026-01-21

This document lists all current features of drift-toolkit.

## Overview

drift-toolkit scans GitHub organizations for configuration drift and process violations. It integrates with [check-my-toolkit](https://github.com/chrismlittle123/check-my-toolkit) for standards definition.

---

## CLI Commands

### `drift code scan`

Scan repositories for configuration drift including check.toml changes, dependency file changes, and new projects without standards.

```bash
# Scan current directory
drift code scan

# Scan a specific local path
drift code scan --path /path/to/repo

# Scan a GitHub organization
drift code scan --org myorg

# Scan a single repo in an organization
drift code scan --org myorg --repo myrepo

# Dry run (show issues without creating them)
drift code scan --org myorg --dry-run

# Output results as JSON
drift code scan --json

# Scan all repos (ignore commit activity filter)
drift code scan --org myorg --all

# Custom time window
drift code scan --org myorg --since 48
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Local directory to scan (default: current directory) |
| `-o, --org <org>` | GitHub organization or username to scan |
| `-r, --repo <repo>` | Single repository to scan (requires --org) |
| `--config-repo <repo>` | Config repo name (default: drift-config) |
| `--github-token <token>` | GitHub token (or set GITHUB_TOKEN env var) |
| `--json` | Output results as JSON |
| `-n, --dry-run` | Show what issues would be created without creating them |
| `-a, --all` | Scan all repos regardless of commit activity (org scan only) |
| `--since <hours>` | Hours to look back for commits (default: 24, org scan only) |

### `drift process scan`

Scan repositories for process standard violations including branch protection, required files, and forbidden files.

```bash
# Scan a specific repository
drift process scan --repo owner/repo

# Scan a GitHub organization
drift process scan --org myorg

# Dry run
drift process scan --org myorg --dry-run

# Output as JSON
drift process scan --json
```

**Options:**
| Option | Description |
|--------|-------------|
| `-o, --org <org>` | Organization to scan |
| `-r, --repo <owner/repo>` | Single repository to scan |
| `-c, --config <path>` | Path to check.toml config file |
| `--json` | Output results as JSON |
| `-n, --dry-run` | Show what issues would be created without creating them |
| `--all` | Scan all repos regardless of commit activity |
| `--since <hours>` | Hours to look back for commits (default: 24) |

---

## Code Domain Features

### check.toml Change Tracking

Detects modifications to check-my-toolkit configuration files:

- Root `check.toml` changes
- Monorepo package `check.toml` changes
- Creates GitHub issues with diffs showing what changed

### Dependency File Change Detection

Tracks changes to configuration files that affect code standards:

- ESLint configs (`.eslintrc.*`, `eslint.config.*`)
- TypeScript configs (`tsconfig.json`, `tsconfig.*.json`)
- Prettier configs (`.prettierrc.*`)
- Other tool configs via `cm dependencies` command

### Workflow File Tracking

Always monitors `.github/workflows/*.yml` changes since these define CI/CD pipelines.

### New Project Detection

Surfaces projects (including monorepo packages) that don't have `check.toml`:

- Integrates with `cm projects detect --missing-config`
- Creates GitHub issues listing unconfigured projects
- Includes project type detection (typescript, python, etc.)

### Tier Validation

Verifies tier-appropriate rulesets are applied:

| Tier | Required Ruleset Pattern |
|------|-------------------------|
| production | `*-production` |
| internal | `*-internal` |
| prototype | `*-prototype` |

- Reads tier from `repo-metadata.yaml`
- Reads rulesets from `check.toml` `[extends]` section
- Creates issues for tier-ruleset mismatches

---

## Process Domain Features

### Branch Protection Validation

Validates GitHub branch protection settings:

- Required reviewers count
- Dismiss stale reviews
- Required status checks
- Enforce on administrators

### Required Files Check

Ensures required files exist:

- CODEOWNERS
- PR templates
- README
- Custom files defined in `[process.required_files]`

### Forbidden Files Check

Ensures certain files do NOT exist:

- `.env` files (security risk)
- Custom patterns defined in `[process.forbidden_files]`

---

## Organization Scanning Features

### Smart Scanning

By default, organization-wide scans only check repositories with commits to `main` or `master` in the last 24 hours.

```bash
# Default: only scan repos with recent commits (last 24h)
drift code scan --org myorg

# Scan all repos regardless of activity
drift code scan --org myorg --all

# Custom time window (e.g., last 48 hours)
drift code scan --org myorg --since 48
```

### Pre-Clone Filtering

Before cloning repositories, drift-toolkit checks via the GitHub Content API whether each repo has:

- `repo-metadata.yaml` (or `.yml`)
- `check.toml`

Repositories missing either file are skipped during org-wide scans.

### Parallel Execution

Organization scans run in parallel for better performance on large organizations.

### GitHub Actions Annotations

When running in GitHub Actions, drift-toolkit outputs workflow commands:

- `::error::` annotations for failures
- `::warning::` annotations for repos with issues
- `::notice::` annotations for successful runs

---

## Configuration Files

### repo-metadata.yaml

Repository metadata file that defines tier and status.

```yaml
tier: production # production | internal | prototype
status: active # active | pre-release | deprecated
team: platform # optional team ownership
```

### check.toml

check-my-toolkit configuration file. See [check-my-toolkit documentation](https://github.com/chrismlittle123/check-my-toolkit) for full schema.

```toml
[extends]
rulesets = ["typescript-production"]

[process.branches]
enabled = true
require_reviews = 2

[process.required_files]
enabled = true
files = ["CODEOWNERS", ".github/pull_request_template.md"]

[process.forbidden_files]
enabled = true
files = ["**/.env", "**/.env.*"]
```

---

## GitHub Issue Formats

### Code Drift Issue

**Title:** `[drift:code] Configuration changes detected`

Includes:
- Changed files with diffs
- Commit references
- Action required guidance

### Process Violations Issue

**Title:** `[drift:process] Process violations detected`

Includes:
- Summary table by category
- Specific violations with expected vs actual values
- How to fix guidance

### New Projects Issue

**Title:** `[drift:code] New project detected without standards`

Includes:
- List of projects missing check.toml
- Project type detection
- Setup instructions

### Tier Mismatch Issue

**Title:** `[drift:code] Tier-ruleset mismatch detected`

Includes:
- Current tier and rulesets
- Expected ruleset pattern
- How to fix

---

## Test Coverage

- **Repository Detection:** 35 tests
- **Project Detection:** 9 tests
- **Change Tracking:** 29 tests
- **Dependency Change Detection:** 17 tests
- **Issue Formatting:** 30 tests
- **Total Tests:** 866+
