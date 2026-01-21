# drift-toolkit

Detect when code, process, or infrastructure drifts from your standards—or decays into neglect.

drift-toolkit scans your entire GitHub organisation across three domains: **Code**, **Process**, and **Infra**. For each, it answers two questions: _Is it correct?_ and _Is it alive?_

[![npm version](https://img.shields.io/npm/v/drift-toolkit.svg)](https://www.npmjs.com/package/drift-toolkit)
[![CI](https://github.com/chrismlittle123/drift-toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/chrismlittle123/drift-toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Code

Your source code and its configuration.

**Correctness:** Linting configs modified or weakened. Ignore comments added (eslint-disable, @ts-ignore). TypeScript strictness loosened. Formatting rules bypassed. Unapproved dependencies introduced. Lockfile inconsistencies.

**Decay:** Branches not merged in 30+ days. Repositories with no commits in 6 months. TODO comments older than 90 days. Pull requests open too long. Dependabot alerts ignored.

---

## Process

How your projects are maintained and governed.

**Correctness:** Missing README or CODEOWNERS. Branch protection rules disabled. PR templates absent. License files missing. Tag conventions not followed. Required documentation incomplete.

**Decay:** Linear tickets with no activity for 60+ days. Backlog items unprioritised for 6 months. Tickets in progress but stale. Empty or abandoned projects. Orphan tickets with no assignee.

---

## Infra

What you deploy and the services you depend on.

**Correctness:** Resources created outside IaC. Naming conventions violated. Required tags missing. Security groups too permissive. Resources in wrong regions. Configuration drift from Terraform state.

**Decay:** Cloud resources with no traffic for 30+ days. Container images deployed but 90+ days old. Staging environments nobody uses. API keys not rotated. Orphaned resources with no owner.

---

## How it works

Point drift-toolkit at your GitHub organisation. It scans every repository, connects to your cloud providers and project management tools, and generates a report.

You define the standards. drift-toolkit tells you what violates them and what's rotting.

Run it on a schedule. Review the report monthly. Delete aggressively. Keep your organisation clean.

---

## The principle

Storage is cheap. Attention is not.

drift-toolkit surfaces what needs fixing and what needs deleting—so your team focuses on building, not archaeology.

---

## Features

- **Integrity Checks** - Ensure critical files (CODEOWNERS, CI workflows, security policies) match approved versions
- **Custom Scans** - Run shell commands to verify repo compliance (npm audit, secret detection, etc.)
- **File Discovery** - Find new files that might need protection
- **Organization Scanning** - Scan all repos in a GitHub org from a central config repo
- **GitHub Actions** - Automate scans on a schedule

## Installation

```bash
npm install -g drift-toolkit
```

Or run directly with npx:

```bash
npx drift-toolkit code scan --org myorg
```

## Quick Start

### 1. Create a config repository

Create a repository named `drift-config` in your organization with this structure:

```
myorg/drift-config/
├── drift.config.yaml      # Define what to check
├── approved/              # Golden versions of protected files
│   ├── CODEOWNERS
│   └── .github/workflows/ci.yml
└── .github/workflows/
    └── drift-scan.yml     # Scheduled scans (optional)
```

### 2. Define your checks

Create `drift.config.yaml`:

```yaml
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical

    - file: .github/workflows/ci.yml
      approved: approved/.github/workflows/ci.yml
      severity: high

  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "Workflow files should be reviewed"

scans:
  - name: has-readme
    command: test -f README.md

  - name: npm-audit
    command: npm audit --audit-level=high
    if: package.json
    timeout: 120
```

### 3. Run the scan

```bash
# Scan all repos in your org
drift code scan --org myorg

# Scan a specific repo
drift code scan --org myorg --repo api-service

# Output as JSON
drift code scan --org myorg --json
```

## CLI Usage

```
drift code scan [options]

Options:
  -o, --org <org>            GitHub organization to scan
  -r, --repo <repo>          Single repository to scan (requires --org)
  --config-repo <repo>       Config repo name (default: drift-config)
  --github-token <token>     GitHub token (or set GITHUB_TOKEN env var)
  -p, --path <path>          Local directory to scan
  -c, --config <config>      Path to drift.config.yaml
  --json                     Output results as JSON
  -h, --help                 Show help

drift code fix [options]

Options:
  -p, --path <path>          Local directory to fix (default: current directory)
  -c, --config <config>      Path to drift.config.yaml
  -f, --file <file>          Fix a specific file only
  -n, --dry-run              Show what would be fixed without making changes
  -h, --help                 Show help
```

### Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token (see [Token Requirements](#github-token-requirements))

## GitHub Token Requirements

### Required Scopes

| Scope      | Purpose                                      | When Needed                          |
| ---------- | -------------------------------------------- | ------------------------------------ |
| `repo`     | Read repository contents, create issues      | Always (code scan)                   |
| `repo`     | Read branch protection settings              | Process scan                         |
| `read:org` | List repositories in organization            | Org-wide scanning (`--org`)          |

### Code Scanning

For code scanning, the token needs access to repository contents and issues.

**Single Repository:** The default `GITHUB_TOKEN` provided by GitHub Actions is sufficient:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Organization-Wide:** Requires a PAT with `repo` and `read:org` scopes.

### Process Scanning

Process scanning validates branch protection rules and repository settings. It requires additional permissions to read repository administration settings.

**Classic PAT:**

- `repo` (Full control of private repositories)
- `read:org` (Read org membership)

**Fine-Grained PAT:**

- Repository access: All repositories (or select specific repos)
- Repository permissions:
  - Administration: Read (required for branch protection rules)
  - Contents: Read
  - Issues: Read and write
  - Metadata: Read
- Organization permissions:
  - Members: Read

**GitHub App:**

- Repository permissions:
  - Administration: Read
  - Contents: Read
  - Issues: Write
  - Metadata: Read
- Organization permissions:
  - Members: Read

### Organization-Wide Scanning

For scanning all repositories in an organization, you need a Personal Access Token (PAT) or Fine-Grained Token with additional permissions:

**Classic PAT:**

- `repo` (Full control of private repositories)
- `read:org` (Read org membership)

**Fine-Grained PAT (Code Scan):**

- Repository access: All repositories (or select specific repos)
- Permissions:
  - Contents: Read
  - Issues: Read and write
  - Metadata: Read

**Fine-Grained PAT (Process Scan):**

- Repository access: All repositories (or select specific repos)
- Repository permissions:
  - Administration: Read
  - Contents: Read
  - Issues: Read and write
  - Metadata: Read
- Organization permissions:
  - Members: Read

Store the token as a repository secret (e.g., `DRIFT_GITHUB_TOKEN`) and use it in your workflow:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.DRIFT_GITHUB_TOKEN }}
```

### Configuring Tokens in GitHub Actions

1. Go to **Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Name it `DRIFT_GITHUB_TOKEN`
4. Paste your PAT value
5. Reference it in your workflow as `${{ secrets.DRIFT_GITHUB_TOKEN }}`

### Troubleshooting

| Error                                    | Cause                                        | Solution                                              |
| ---------------------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `Resource not accessible by integration` | Default GITHUB_TOKEN lacks org access        | Use a PAT with `read:org` scope                       |
| `Not Found` on private repos             | Token lacks `repo` scope                     | Add `repo` scope to your PAT                          |
| `API rate limit exceeded`                | Too many API calls                           | Use a PAT (higher rate limits than GITHUB_TOKEN)      |
| `403` on branch protection endpoints     | Token lacks admin read access                | Add Administration: Read permission (Fine-Grained PAT) |
| Process scan skips repos                 | Token cannot access branch protection rules  | Ensure `repo` scope or Administration: Read           |

## GitHub Actions

### Using the Action

Add drift scanning to your workflows using our GitHub Action:

```yaml
name: Drift Scan

on:
  schedule:
    - cron: "0 9 * * *" # Daily at 9am UTC
  workflow_dispatch:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: chrismlittle123/drift-toolkit@main
        with:
          org: ${{ github.repository_owner }}
          github-token: ${{ secrets.DRIFT_GITHUB_TOKEN }}
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

### Example: Create Issue on Drift

```yaml
- name: Run drift scan
  id: scan
  uses: chrismlittle123/drift-toolkit@main
  with:
    org: myorg
    github-token: ${{ secrets.DRIFT_GITHUB_TOKEN }}
    json: "true"
    fail-on-drift: "false"

- name: Create issue
  if: steps.scan.outputs.has-drift == 'true'
  uses: actions/github-script@v7
  with:
    script: |
      await github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: `Drift detected in ${process.env.REPOS} repos`,
        body: 'Please review drift scan results.',
        labels: ['drift']
      });
  env:
    REPOS: ${{ steps.scan.outputs.repos-with-issues }}
```

## Configuration Reference

### Integrity Checks

Protected files are compared against approved versions using SHA-256 hashes:

```yaml
integrity:
  protected:
    - file: CODEOWNERS # Path in target repo
      approved: approved/CODEOWNERS # Path in config repo
      severity: critical # critical | high | medium | low
```

Severity levels affect exit codes.

### File Discovery

Find files matching patterns that might need protection:

```yaml
integrity:
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "Workflow files should be reviewed for security"
```

### Custom Scans

Run shell commands to verify compliance:

```yaml
scans:
  - name: npm-audit
    command: npm audit --audit-level=high
    if: package.json # Only run if this file exists
    timeout: 120 # Timeout in seconds (default: 60)
```

The scan passes if the command exits with code 0.

## Output Examples

### Terminal Output

```
Drift v0.1.0
Organization: myorg
Repos to scan: 15

Scanning myorg/api-service... ✗ issues found
Scanning myorg/frontend... ✓ ok
Scanning myorg/docs... ✓ ok

RESULTS BY REPOSITORY
════════════════════════════════════════════════════════════

api-service
────────────────────────────────────────────────────────────
  ✗ CODEOWNERS - DRIFT DETECTED (critical)
  ✓ .github/workflows/ci.yml - ok
  ✓ npm-audit - passed

SUMMARY
════════════════════════════════════════════════════════════
  Repos: 15 scanned, 1 with issues
  Integrity: 14/15 passed, 1 drifted

✗ ISSUES DETECTED IN 1 REPO
```

### JSON Output

```json
{
  "org": "myorg",
  "configRepo": "drift-config",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "repos": [...],
  "summary": {
    "reposScanned": 15,
    "reposWithIssues": 1,
    "totalIntegrityFailed": 1,
    "totalScansFailed": 0
  }
}
```

## Examples

See the [examples](./examples) directory for:

- [drift-scan.yml](./examples/drift-scan.yml) - GitHub Actions workflow
- [drift.config.yaml](./examples/drift.config.yaml) - Configuration file

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, branch naming conventions, and the release process.

## License

MIT
