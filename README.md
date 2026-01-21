# drift-toolkit

Detect when code, process, or infrastructure drifts from your standards.

drift-toolkit scans your entire GitHub organisation across three domains: **Code**, **Process**, and **Infra**. It integrates with [check-my-toolkit](https://github.com/chrismlittle123/check-my-toolkit) to define and enforce standards.

[![npm version](https://img.shields.io/npm/v/drift-toolkit.svg)](https://www.npmjs.com/package/drift-toolkit)
[![CI](https://github.com/chrismlittle123/drift-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/chrismlittle123/drift-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Domains

### Code

Tracks changes to configuration files that define code standards.

- **check.toml changes** - Detects modifications to check-my-toolkit configuration
- **Dependency file changes** - Tracks eslint, typescript, prettier configs via `cm dependencies`
- **Workflow changes** - Monitors `.github/workflows/*.yml` modifications
- **New project detection** - Surfaces projects missing check.toml
- **Tier validation** - Verifies tier-appropriate rulesets are applied

### Process

Validates GitHub repository settings against standards.

- **Branch protection** - Required reviews, status checks, dismissal rules
- **Required files** - CODEOWNERS, PR templates, README
- **Forbidden files** - Files that must not exist (e.g., .env files)

### Infra (Coming Soon)

Detects infrastructure drift between CDK code and AWS resources.

---

## How it works

1. Repositories opt-in by adding `check.toml` and `repo-metadata.yaml`
2. drift-toolkit discovers repos with these files in your org
3. Scans detect configuration changes and standard violations
4. GitHub issues are created for detected drift

---

## Installation

```bash
npm install -g drift-toolkit
```

Or run directly with npx:

```bash
npx drift-toolkit code scan --org myorg
```

## Quick Start

### 1. Set up a repository

Each repository needs:

```
my-repo/
├── check.toml           # check-my-toolkit configuration
└── repo-metadata.yaml   # Defines tier and status
```

**repo-metadata.yaml:**

```yaml
tier: production # production | internal | prototype
status: active # active | pre-release | deprecated
team: platform
```

**check.toml:**

```toml
[extends]
rulesets = ["typescript-production"]

[process.branches]
enabled = true
require_reviews = 2

[process.required_files]
enabled = true
files = ["CODEOWNERS", ".github/pull_request_template.md"]
```

### 2. Run the scan

```bash
# Scan all repos in your org
drift code scan --org myorg

# Scan a specific repo
drift code scan --org myorg --repo api-service

# Process standard validation
drift process scan --org myorg

# Dry run (no issues created)
drift code scan --org myorg --dry-run
```

## CLI Usage

### Code Scanning

```
drift code scan [options]

Options:
  -o, --org <org>            GitHub organization to scan
  -r, --repo <repo>          Single repository to scan (requires --org)
  -p, --path <path>          Local directory to scan
  --config-repo <repo>       Config repo name (default: drift-config)
  --github-token <token>     GitHub token (or set GITHUB_TOKEN env var)
  --json                     Output results as JSON
  -n, --dry-run              Show what issues would be created
  -a, --all                  Scan all repos regardless of commit activity
  --since <hours>            Hours to look back for commits (default: 24)
  -h, --help                 Show help
```

### Process Scanning

```
drift process scan [options]

Options:
  -o, --org <org>            Organization to scan
  -r, --repo <owner/repo>    Single repository to scan
  -c, --config <path>        Path to check.toml config file
  --json                     Output results as JSON
  -n, --dry-run              Show what issues would be created
  --all                      Scan all repos regardless of commit activity
  --since <hours>            Hours to look back for commits (default: 24)
  -h, --help                 Show help
```

### Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token (see [Token Requirements](#github-token-requirements))

## GitHub Token Requirements

### Required Scopes

| Scope      | Purpose                                 | When Needed                 |
| ---------- | --------------------------------------- | --------------------------- |
| `repo`     | Read repository contents, create issues | Always                      |
| `repo`     | Read branch protection settings         | Process scan                |
| `read:org` | List repositories in organization       | Org-wide scanning (`--org`) |

### Code Scanning

**Single Repository:** The default `GITHUB_TOKEN` provided by GitHub Actions is sufficient:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Organization-Wide:** Requires a PAT with `repo` and `read:org` scopes.

### Process Scanning

Process scanning validates branch protection rules and repository settings. It requires additional permissions.

**Fine-Grained PAT:**

- Repository access: All repositories (or select specific repos)
- Repository permissions:
  - Administration: Read (required for branch protection rules)
  - Contents: Read
  - Issues: Read and write
  - Metadata: Read
- Organization permissions:
  - Members: Read

### Troubleshooting

| Error                                    | Cause                                 | Solution                                               |
| ---------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| `Resource not accessible by integration` | Default GITHUB_TOKEN lacks org access | Use a PAT with `read:org` scope                        |
| `Not Found` on private repos             | Token lacks `repo` scope              | Add `repo` scope to your PAT                           |
| `API rate limit exceeded`                | Too many API calls                    | Use a PAT (higher rate limits than GITHUB_TOKEN)       |
| `403` on branch protection endpoints     | Token lacks admin read access         | Add Administration: Read permission (Fine-Grained PAT) |

## GitHub Actions

### Using the Action

```yaml
name: Drift Scan

on:
  schedule:
    - cron: "0 9 * * *" # Daily at 9am UTC
  workflow_dispatch:

jobs:
  code-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: chrismlittle123/drift-toolkit@main
        with:
          org: ${{ github.repository_owner }}
          github-token: ${{ secrets.DRIFT_GITHUB_TOKEN }}

  process-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npx drift-toolkit process scan --org ${{ github.repository_owner }}
        env:
          GITHUB_TOKEN: ${{ secrets.DRIFT_GITHUB_TOKEN }}
```

### Action Inputs

| Input           | Description                   | Required | Default        |
| --------------- | ----------------------------- | -------- | -------------- |
| `org`           | GitHub organization to scan   | Yes      | -              |
| `repo`          | Specific repository to scan   | No       | All repos      |
| `config-repo`   | Name of config repository     | No       | `drift-config` |
| `github-token`  | GitHub token with repo access | Yes      | -              |
| `json`          | Output results as JSON        | No       | `false`        |
| `fail-on-drift` | Fail action if drift detected | No       | `true`         |

### Action Outputs

| Output              | Description                                 |
| ------------------- | ------------------------------------------- |
| `has-drift`         | Whether drift was detected (`true`/`false`) |
| `repos-scanned`     | Number of repositories scanned              |
| `repos-with-issues` | Number of repositories with issues          |
| `results`           | Full JSON results (if `json: true`)         |

## GitHub Issue Formats

### Code Drift

**Title:** `[drift:code] Configuration changes detected`

Issues include:

- Changed files with diffs
- Commit references
- Action required guidance

### Process Violations

**Title:** `[drift:process] Process violations detected`

Issues include:

- Summary table by category
- Specific violations with expected vs actual values
- How to fix guidance

### New Projects

**Title:** `[drift:code] New project detected without standards`

Issues include:

- List of projects missing check.toml
- Project type detection
- Setup instructions

## Smart Scanning

By default, drift-toolkit only scans repositories with commits to main in the last 24 hours. This reduces noise and API usage.

```bash
# Override with --all to scan everything
drift code scan --org myorg --all

# Or adjust the time window
drift code scan --org myorg --since 48  # Last 48 hours
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, branch naming conventions, and the release process.

## License

MIT
