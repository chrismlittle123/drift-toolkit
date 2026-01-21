# drift-toolkit Features

> **Version:** 1.14.1
> **Last Updated:** 2026-01-21

This document lists all current features of drift-toolkit. It is automatically updated when PRs are created.

## CLI Commands

### `drift code scan`

Scan repositories for code integrity and run compliance checks.

```bash
# Scan current directory
drift code scan

# Scan a specific local path
drift code scan --path /path/to/repo

# Scan with custom config
drift code scan --config ./my-drift.config.yaml

# Scan a GitHub organization
drift code scan --org myorg

# Scan a single repo in an organization
drift code scan --org myorg --repo myrepo

# Output results as JSON
drift code scan --json
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Local directory to scan (default: current directory) |
| `-c, --config <config>` | Path to drift.config.yaml |
| `-o, --org <org>` | GitHub organization or username to scan |
| `-r, --repo <repo>` | Single repository to scan (requires --org) |
| `--config-repo <repo>` | Config repo name (default: drift-config) |
| `--github-token <token>` | GitHub token (or set GITHUB_TOKEN env var) |
| `--json` | Output results as JSON |
| `-n, --dry-run` | Show what issues would be created without creating them |
| `-a, --all` | Scan all repos regardless of commit activity (org scan only) |
| `--since <hours>` | Hours to look back for commits (default: 24, org scan only) |

### `drift code fix`

Fix drifted files by syncing from approved sources.

```bash
# Fix all drifted files
drift code fix

# Dry run (show what would be fixed)
drift code fix --dry-run

# Fix a specific file
drift code fix --file CODEOWNERS
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Local directory to fix (default: current directory) |
| `-c, --config <config>` | Path to drift.config.yaml |
| `-f, --file <file>` | Fix a specific file only |
| `-n, --dry-run` | Show what would be fixed without making changes |

---

## Organization Scanning Features

### Smart Scanning

By default, organization-wide scans only check repositories with commits to `main` or `master` in the last 24 hours. This dramatically reduces scan time for large organizations.

```bash
# Default: only scan repos with recent commits (last 24h)
drift code scan --org myorg

# Scan all repos regardless of activity
drift code scan --org myorg --all

# Custom time window (e.g., last 48 hours)
drift code scan --org myorg --since 48
```

The commit check uses the GitHub Commits API before cloning, so inactive repositories are filtered without any disk I/O.

### Pre-Clone Filtering

Before cloning repositories, drift-toolkit checks via the GitHub Content API whether each repo has the required files:

- `repo-metadata.yaml` (or `.yml`)
- `check.toml`

Repositories missing either file are skipped during org-wide scans, avoiding unnecessary clones.

### GitHub Actions Annotations

When running in GitHub Actions, drift-toolkit outputs workflow commands for enhanced CI visibility:

- `::error::` annotations for failures (config not found, drift detected)
- `::warning::` annotations for repos with issues
- `::notice::` annotations for successful runs

These annotations appear in the GitHub Actions summary and file views.

---

## Configuration Schema

### drift.config.yaml

```yaml
# Optional: Define valid metadata values for validation
schema:
  tiers: [production, internal, prototype]
  teams: [platform, mobile, web]

# Integrity checks - compare files against approved versions
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high

  # Discover new files that might need protection
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "New workflow detected - consider adding to protected list"

# Custom scans to run
scans:
  - name: eslint
    description: Run ESLint
    command: npm run lint
    if_file: package.json # Skip if file doesn't exist
    severity: high
    timeout: 120 # seconds

  - name: typescript
    command: npm run typecheck
    if_file: tsconfig.json
    tiers: [production, internal] # Only run on these tiers

  - name: security-audit
    command: npm audit
    if_command: "test -f package-lock.json" # Skip if command fails

# Exclude repos from org-wide scanning (glob patterns)
exclude:
  - "*-archived"
  - "legacy-*"
```

### repo-metadata.yaml

Repository metadata file that defines tier and status.

```yaml
tier: production # production | internal | prototype
status: active # active | pre-release | deprecated
team: platform # optional team ownership
```

---

## Test Coverage

- **Repository Detection:** 35 tests
- **Project Detection:** 9 tests
- **Change Tracking:** 29 tests
- **Dependency Change Detection:** 17 tests
- **Issue Formatting:** 30 tests
- **Total Tests:** 866
- **Minimum Coverage:** 80% for `src/repo/**`
