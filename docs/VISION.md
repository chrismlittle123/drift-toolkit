# drift-toolkit Vision

> A rethink of drift-toolkit as the enforcement layer for organizational standards.

## The Ecosystem

drift-toolkit is part of a two-package ecosystem:

| Package | Purpose | Timing |
|---------|---------|--------|
| `check-my-toolkit` | Defines and validates all standards (code, process, infra) | Preventative |
| `drift-toolkit` | Scheduled enforcement layer, surfaces violations | Detective |

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
1. Calls `check-my-toolkit` CLI to get list of dependency files per check
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
- Other process standards defined in check.toml

**How it works:**
1. Reads process standards from check.toml
2. Uses GitHub API / GH CLI to query actual repository settings
3. Compares expected vs actual
4. Creates GitHub issue listing all process violations

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
3. Parses validation results
4. Creates GitHub issue listing all infrastructure discrepancies

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

**Integration with check-my-toolkit:**
- check-my-toolkit handles CDK parsing, CloudFormation synthesis, AWS API queries
- drift-toolkit calls `cmt infra validate --json` and surfaces results as GitHub issues

---

## Repo Detection

A repository is scanned if it has:
1. A `repo-metadata.yaml` file
2. At least one `check.toml` file

No central drift-config repo. All configuration is derived from check.toml files in individual repositories.

**Monorepo support:**
- check.toml at repo level if not a monorepo
- check.toml in each package directory if monorepo
- Uses `check-my-toolkit projects detect` for package discovery

---

## Smart Scanning

**Schedule:**
- Runs on a schedule (e.g., 2am London time daily)
- Can be triggered manually

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
```

---

## GitHub Action

Deploy as a GitHub Action that:
1. Runs on schedule (configurable, e.g., `cron: '0 2 * * *'`)
2. Supports manual trigger (`workflow_dispatch`)
3. Scans repositories with recent changes
4. Creates GitHub issues for violations

**No dashboard.** CLI + GitHub Action only.

---

## Integration with check-my-toolkit

drift-toolkit depends on check-my-toolkit as an npm dependency.

**CLI commands used:**
- `check-my-toolkit projects detect` - discover projects/packages in monorepos
- `check-my-toolkit dependencies` (planned) - get list of tracked files per check
- `check-my-toolkit infra validate` - validate infrastructure against AWS

**check.toml structure:**
```toml
[eslint]
enabled = true
# dependencies = [".eslintrc.js", ".eslintignore"]  # tracked by drift

[prettier]
enabled = true
# dependencies = [".prettierrc", ".prettierignore"]

[infra]
enabled = true
path = "./infra"
stacks = ["MyAppStack"]
```

Each check in check.toml declares its dependency files. drift tracks these files for changes.

For infra, check-my-toolkit handles all CDK parsing, CloudFormation synthesis, and AWS API queries. drift-toolkit simply calls the validation command and surfaces results.

---

## What This Replaces

**Removed concepts:**
- ~~drift-config repo~~ → config derived from check.toml in each repo
- ~~drift.config.yaml~~ → replaced by check.toml
- ~~approved files pattern~~ → replaced by dependency tracking
- ~~dashboard~~ → GitHub issues are the interface

---

## Summary

drift-toolkit is an enforcement mechanism that:

1. **For Code:** Tracks check.toml and dependency file changes, surfaces when configuration drifts
2. **For Process:** Verifies GitHub process standards are followed via API checks
3. **For Infra:** Compares declared infrastructure state to actual AWS resources

All standards are defined in check.toml. drift-toolkit is the scheduled auditor that catches what slips through preventative checks.
