# drift-toolkit Vision

> A rethink of drift-toolkit as the enforcement layer for organizational standards.

## The Ecosystem

drift-toolkit is part of a three-package ecosystem:

| Package | Purpose | Timing |
|---------|---------|--------|
| `check-my-toolkit` | Defines standards (check.toml), enforces at PR time | Preventative |
| `infra-toolkit` | Generates expected infra state from CDK code | Generative |
| `drift-toolkit` | Detects drift from standards, surfaces violations | Detective |

**check-my-toolkit** is the preventative guard at PR/push time.
**drift-toolkit** is the detective/audit layer that catches what slips through.

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
1. Reads infra manifest from application repo (in `infra/` directory)
2. Calls `infra-toolkit` to get expected state from CDK code
3. Uses AWS CLI/API to query actual resource state
4. Compares expected vs actual across all 3 AWS accounts (dev/staging/prod)
5. Creates GitHub issue listing all infrastructure discrepancies

**Manifest structure:**
- Lives in application repo
- Maps CDK TypeScript file paths to AWS ARNs
- Dynamic TypeScript config that can be compiled and verified against actual CDK code
- One repo maps to 3 AWS accounts

**Integration with infra-toolkit:**
- `infra-toolkit` handles CDK parsing, CloudFormation synthesis, ARN resolution
- `drift-toolkit` consumes the output and compares to actual AWS state

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

**check.toml structure:**
```toml
[eslint]
enabled = true
# dependencies = [".eslintrc.js", ".eslintignore"]  # tracked by drift

[prettier]
enabled = true
# dependencies = [".prettierrc", ".prettierignore"]
```

Each check in check.toml declares its dependency files. drift tracks these files for changes.

---

## Integration with infra-toolkit

drift-toolkit calls infra-toolkit to:
1. Parse CDK code in `infra/` directory
2. Generate expected resource manifest
3. Resolve ARNs from deployed CloudFormation stacks

**Planned infra-toolkit commands:**
- `infra-toolkit manifest generate` - generate manifest from CDK code
- `infra-toolkit manifest validate` - compare manifest to actual AWS state

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
