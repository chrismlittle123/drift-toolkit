# drift-toolkit Vision

> A rethink of drift-toolkit as the enforcement layer for organizational standards.

## The Ecosystem

drift-toolkit is part of a two-package ecosystem:

| Package            | Purpose                                                    | Timing       |
| ------------------ | ---------------------------------------------------------- | ------------ |
| `check-my-toolkit` | Defines and validates all standards (code, process, infra) | Preventative |
| `drift-toolkit`    | Scheduled enforcement layer, surfaces violations           | Detective    |

**check-my-toolkit** is the preventative guard at PR/push time. It defines standards in check.toml and validates them, including infrastructure validation via CDK.

**drift-toolkit** is the detective/audit layer that catches what slips through and surfaces violations as GitHub issues.

---

## Core Concept

**check.toml is the source of truth for all scans.**

drift-toolkit enforces standards by:

1. Tracking changes to check.toml files themselves
2. Tracking changes to dependency files (eslint config, workflows, etc.)
3. Detecting violations that bypassed check-my-toolkit enforcement
4. Surfacing infrastructure drift from declared standards
5. Verifying tier-appropriate standards are applied

When violations are detected, drift creates GitHub issues as a **signal for developers to investigate**.

---

## Three Domains

### Code (`drift code scan`)

Detects changes to configuration files that define code standards.

**What it tracks:**

- All check.toml files (always tracked, highest priority)
- Dependency files declared in check.toml (e.g., `.eslintrc.js`, `tsconfig.json`, `knip.json`)
- GitHub Actions workflow files

**How it works:**

1. Calls `check-my-toolkit dependencies` CLI to get list of dependency files per check
2. Compares current state to last scan (git-based change detection)
3. If check.toml or any dependency changed → GitHub issue with diff

**New project detection:**

- Uses `check-my-toolkit projects detect` to find projects without check.toml
- Creates issue: "New project detected without standards"

---

### Process (`drift process scan`)

Verifies that GitHub process standards are being followed.

**What it checks:**

- Branch protection rules
- PR review requirements
- Issue labeling rules
- CODEOWNERS presence and validity
- Required status checks
- Any other process standards defined in check.toml

**How it works:**

1. Reads process standards from check.toml `[process.*]` sections
2. Uses GitHub API to query actual repository settings
3. Compares expected vs actual
4. Creates GitHub issue listing all process violations

**Process config in check.toml:**

```toml
[process.branches]
protection = true
required_reviews = 2
require_status_checks = true

[process.commits]
conventional = true

[process.ci]
required_workflows = ["test", "lint"]
```

---

### Infra (`drift infra scan`)

Detects infrastructure drift between declared state and actual AWS resources.

**What it checks:**

- Resources in AWS not in manifest (orphaned resources)
- Resources in manifest not in AWS (missing resources)
- Attribute drift (e.g., security group rules changed, IAM policies modified)

**How it works:**

1. Reads `[infra]` config from check.toml
2. Calls `check-my-toolkit infra validate` to compare CDK code vs AWS state
3. Scans all 3 AWS accounts (dev, staging, prod) on every run
4. Only scans deployed infrastructure (uses last deployed commit per environment)
5. Creates GitHub issue listing all infrastructure discrepancies

**Infra config in check.toml:**

```toml
[infra]
enabled = true
path = "./infra"
stacks = ["MyAppStack"]

[infra.accounts]
dev = "111111111111"
staging = "222222222222"
prod = "333333333333"
```

**Deployment tracking (trunk-based):**

- Track last deployed commit SHA per environment via git tags or CloudFormation stack tags
- Only scan resources that should exist based on what's been deployed
- Example: if code hasn't been promoted to prod, skip prod resource checks for new resources

---

## Standards Inheritance

Standards are defined in a central registry and inherited via check.toml.

**Registry:** `github:chrismlittle123/check-my-toolkit-community-registry`

**Inheritance model:**

```toml
[extends]
registry = "github:chrismlittle123/check-my-toolkit-community-registry"
rulesets = ["typescript-production"]  # Must match tier

# Local overrides allowed
[code.linting.eslint]
enabled = true
```

**Tier-to-ruleset enforcement:**

- `production` tier → must extend from `*-production` rulesets
- `internal` tier → must extend from `*-internal` rulesets
- `prototype` tier → must extend from `*-prototype` rulesets
- Overrides are allowed, but base ruleset must match tier
- drift creates an issue if tier/ruleset mismatch detected

---

## Repo Detection & Filtering

### Detection

A repository is scanned if it has:

1. A `repo-metadata.yaml` file
2. At least one `check.toml` file

No central repo list. Detection is automatic based on these files.

### repo-metadata.yaml

```yaml
tier: production # production | internal | prototype
status: active # active | pre-release | deprecated
team: backend # optional
```

### Tier-based behavior

| Tier         | Standards                       | Scanning                      |
| ------------ | ------------------------------- | ----------------------------- |
| `production` | Strictest (production rulesets) | Full scanning, all checks     |
| `internal`   | Moderate (internal rulesets)    | Full scanning, all checks     |
| `prototype`  | Relaxed (prototype rulesets)    | Full scanning, relaxed checks |

### Status-based behavior

| Status        | Behavior                                                                       |
| ------------- | ------------------------------------------------------------------------------ |
| `active`      | Normal scanning - verify compliance with standards                             |
| `pre-release` | Normal scanning - project not yet in production, may have relaxed infra checks |
| `deprecated`  | Verify all infra resources have been DELETED                                   |

**Pre-release project scanning:**

- Full code and process scanning (standards still apply)
- Infra scanning may skip prod account (not yet deployed)
- Useful for projects in development before go-live

**Deprecated project scanning:**

- Infra scan verifies AWS resources tied to the project are cleaned up
- Code/process scans can be minimal or skipped
- Creates issue if orphaned resources still exist

### Monorepo support

- check.toml at repo level if not a monorepo
- check.toml in each package directory if monorepo
- Uses `check-my-toolkit projects detect` for package discovery

---

## Smart Scanning

**Schedule:**

- Runs on a schedule (e.g., 2am London time daily)
- Can be triggered manually via `workflow_dispatch`

**Optimization:**

- Only scans repositories with commits to main in the last 24 hours
- If no tracked files changed, no issue created (silent pass)
- If scan fails to run, visible in GitHub Actions logs

---

## GitHub Issues

**Issue creation:**

- One issue per category (code, process, infra) per scan
- Issues created unassigned
- Duplicate issues are OK (signal for investigation)

**Issue content:**

- Lists all violations within that category
- Includes diff of what changed
- Links to the commit that introduced the change

**Resolution:**

- Close issues manually after investigation
- No auto-close mechanism
- Purpose is to surface changes, not to block

**Labels:**

- `drift:code`
- `drift:process`
- `drift:infra`

---

## Audit Command

Weekly audit to surface repos with outstanding drift issues.

```bash
drift scan audit --threshold 5
```

**How it works:**

1. Queries all repos for open issues with `drift:*` labels
2. Filters to repos exceeding threshold (default: 5 issues)
3. Creates a summary GitHub issue in drift-config repo

**Purpose:**

- Prevents constant notifications from daily scans
- Surfaces repos that need attention
- Acts as a queue for platform/devops teams to review

---

## CLI Commands

```bash
# Code scanning
drift code scan              # Scan current repo
drift code scan --org <org>  # Scan all repos in org

# Process scanning
drift process scan
drift process scan --org <org>

# Infra scanning
drift infra scan
drift infra scan --org <org>

# Audit
drift scan audit                    # Weekly audit summary
drift scan audit --threshold 10     # Custom threshold
```

---

## Deployment

### Trunk-based development

drift-toolkit uses trunk-based development:

- `main` branch only
- Deploy to dev on every push
- Deploy to staging on release candidate tag
- Deploy to prod on release tag

### drift-config repo

A central `drift-config` repo contains:

- GitHub Action workflow for scheduled scans
- Runs org-wide scans on schedule
- Manual trigger support via `workflow_dispatch`

**Workflow example:**

```yaml
name: Drift Scan
on:
  schedule:
    - cron: "0 2 * * *" # 2am daily
  workflow_dispatch:

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx drift-toolkit code scan --org ${{ github.repository_owner }}
      - run: npx drift-toolkit process scan --org ${{ github.repository_owner }}
      - run: npx drift-toolkit infra scan --org ${{ github.repository_owner }}
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Credentials

| Domain       | Credential      | Source                                                    |
| ------------ | --------------- | --------------------------------------------------------- |
| Code/Process | GitHub token    | `GITHUB_TOKEN` or PAT with org access                     |
| Infra        | AWS credentials | Environment variables, must have access to all 3 accounts |

---

## Integration with check-my-toolkit

drift-toolkit depends on check-my-toolkit as an npm dependency.

**CLI commands used:**

- `check-my-toolkit projects detect` - discover projects/packages in monorepos
- `check-my-toolkit dependencies` - get list of tracked files per check (planned)
- `check-my-toolkit infra validate` - validate infrastructure against AWS (planned)

**check.toml structure:**

```toml
[extends]
registry = "github:chrismlittle123/check-my-toolkit-community-registry"
rulesets = ["typescript-production"]

[code.linting.eslint]
enabled = true

[process.branches]
protection = true

[infra]
enabled = true
path = "./infra"
stacks = ["MyAppStack"]
```

---

## Prerequisites (must be built in check-my-toolkit first)

1. **`check-my-toolkit dependencies`** - Returns list of tracked files per check as JSON
2. **`check-my-toolkit infra validate`** - Validates CDK code against AWS resources
3. **Process validation** - Ability to define and validate process standards in check.toml

---

## What This Replaces

**Removed concepts:**

- ~~drift-config repo for standards~~ → standards in check-my-toolkit-community-registry
- ~~drift.config.yaml~~ → replaced by check.toml
- ~~approved files pattern~~ → replaced by dependency tracking
- ~~dashboard~~ → GitHub issues are the interface

**Kept from existing codebase:**

- GitHub API client

---

## Summary

drift-toolkit is an enforcement mechanism that:

1. **For Code:** Tracks check.toml and dependency file changes, surfaces when configuration drifts
2. **For Process:** Verifies GitHub process standards are followed via API checks
3. **For Infra:** Compares declared infrastructure state to actual AWS resources (all 3 accounts)
4. **For Standards:** Verifies tier-appropriate rulesets are applied
5. **For Deprecated Projects:** Verifies infrastructure resources have been cleaned up

All standards are defined in check.toml and inherited from a central registry. drift-toolkit is the scheduled auditor that catches what slips through preventative checks.
