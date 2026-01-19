# Roadmap: drift process scan

> Verifies that GitHub process standards are being followed.

## Overview

`drift process scan` checks GitHub repository settings against standards defined in check.toml. It validates branch protection, required files, CI workflows, and other process requirements. When violations are found, it creates GitHub issues.

---

## Prerequisites (check-my-toolkit)

**Already exists in check-my-toolkit:**

| Feature | Status | Description |
|---------|--------|-------------|
| Process schema in check.toml | **Already exists** | 12 process checks: hooks, ci, branches, commits, repo, etc. |
| `cm process check` | **Already exists** | Run workflow validation locally |
| `cm process audit` | **Already exists** | Verify workflow configs exist |
| `cm process diff` | **Already exists** | Show repository setting differences |
| `cm process sync` | **Already exists** | Synchronize repository settings |

**Missing features needed for drift:**

| Feature | Status | Description |
|---------|--------|-------------|
| Remote validation (`--repo` flag) | Not started | Validate process standards for remote repos via GitHub API |
| `cm validate tier` | Not started | Verify tier-ruleset alignment |

**Blocked until:** Remote validation (`--repo` flag) is available for `cm process check`

**Note:** The CLI command is `cm` (not `cmt`).

---

## Milestones

### Milestone 1: Understand Existing Process Schema

**Goal:** Map existing check-my-toolkit process checks to drift requirements

check-my-toolkit already has these process checks:

| Check | Section | What it validates |
|-------|---------|-------------------|
| hooks | `[process.hooks]` | Husky git hooks presence |
| ci | `[process.ci]` | GitHub Actions workflows |
| branches | `[process.branches]` | Branch naming patterns |
| commits | `[process.commits]` | Commit message format |
| changesets | `[process.changesets]` | Changeset files |
| pr | `[process.pr]` | PR size limits |
| tickets | `[process.tickets]` | Jira/Linear references |
| coverage | `[process.coverage]` | Test coverage thresholds |
| repo | `[process.repo]` | Branch protection, CODEOWNERS |
| backups | `[process.backups]` | S3 backup verification |
| codeowners | `[process.codeowners]` | CODEOWNERS file validation |
| docs | `[process.docs]` | Documentation requirements |

| Task | Description |
|------|-------------|
| Audit existing checks | Review what `cm process check` validates today |
| Identify gaps | Determine what drift needs that doesn't exist |
| Document schema | Create reference for drift integration |

**Output:** Clear understanding of what exists vs what's needed

---

### Milestone 2: Remote Validation in check-my-toolkit

**Goal:** Add `--repo` flag to `cm process check` for remote validation

| Task | Description |
|------|-------------|
| GitHub API integration | Query branch protection, repo settings via API |
| `--repo` flag | Add flag to specify `owner/repo` instead of local |
| `--token` flag | Add flag for GitHub token |
| JSON output | Ensure `--format json` works for remote validation |

**Output:** `cm process check --repo owner/repo --token $TOKEN` works

---

### Milestone 3: drift process scan Foundation

**Goal:** Basic process scanning using check-my-toolkit

| Task | Description |
|------|-------------|
| Integrate cm process check | Call `cm process check --repo <repo> --format json` |
| Parse results | Extract violations from JSON output |
| GitHub issue creation | Create issue in target repo with violations |
| Error handling | Handle permission errors gracefully |

**Output:** `drift process scan` creates issues for process violations

---

### Milestone 4: Tier Validation

**Goal:** Verify tier-appropriate rulesets are applied

| Task | Description |
|------|-------------|
| Implement cm validate tier | New command in check-my-toolkit |
| Parse repo-metadata.yaml | Extract tier from metadata |
| Ruleset verification | Check that rulesets match tier |
| Integration | Call from drift and create issues on mismatch |

**Output:** Tier-ruleset mismatches surfaced as issues

---

### Milestone 5: Org-wide Process Scanning

**Goal:** Scan all repos in an organization for process compliance

| Task | Description |
|------|-------------|
| Repo iteration | Scan all repos with repo-metadata.yaml + check.toml |
| Smart scanning | Only scan repos with commits in last 24h |
| Parallel execution | Scan multiple repos concurrently |
| Per-repo issues | Create separate issue in each repo with violations |

**Output:** `drift process scan --org <org>` works end-to-end

---

### Milestone 6: GitHub Action Integration

**Goal:** Run as scheduled GitHub Action

| Task | Description |
|------|-------------|
| Action workflow | Add process scan to drift-config workflow |
| Token permissions | Document required GitHub token scopes |
| Error handling | Handle repos where token lacks access |

**Output:** Scheduled process scans via GitHub Action

---

## CLI Interface

```bash
# Scan current repo
drift process scan

# Scan all repos in org
drift process scan --org <org>

# Scan specific repo
drift process scan --org <org> --repo <repo>

# Scan specific category only
drift process scan --category branches
drift process scan --category required_files

# JSON output
drift process scan --json

# Dry run
drift process scan --dry-run
```

---

## GitHub Issue Format

**Title:** `[drift:process] Process violations detected`

**Labels:** `drift:process`

**Body:**
```markdown
## Process Violations Detected

Repository: `myorg/my-app`
Scan time: 2024-01-15 02:00 UTC

### Violations

#### Branch Protection
| Setting | Expected | Actual |
|---------|----------|--------|
| Required reviews | 2 | 1 |
| Dismiss stale reviews | true | false |
| Require status checks | true | true |

#### Missing Required Files
- [ ] `.github/pull_request_template.md` - not found
- [x] `.github/CODEOWNERS` - exists

#### Missing Status Checks
Expected: `test`, `lint`, `build`
Configured: `test`, `lint`
Missing: `build`

### How to Fix

1. Go to Settings > Branches > Branch protection rules
2. Edit rule for `main` branch
3. Set "Required approving reviews" to 2
4. Enable "Dismiss stale pull request approvals"
5. Add `build` to required status checks

---
*Created by drift-toolkit*
```

---

## Process Standards Reference (Actual check-my-toolkit Schema)

### Branch Naming (`[process.branches]`)

```toml
[process.branches]
enabled = true
pattern = "^(main|develop|feature/.+|bugfix/.+|hotfix/.+|release/.+)$"
exclude = ["dependabot/*"]
```

**Note:** This validates branch NAMING patterns, not protection rules.

### Branch Protection & CODEOWNERS (`[process.repo]`)

```toml
[process.repo]
enabled = true
require_branch_protection = true
require_codeowners = true

[process.repo.branch_protection]
required_reviews = 2
dismiss_stale_reviews = true
require_code_owner_review = true
require_status_checks = true
required_status_checks = ["test", "lint", "build"]
enforce_admins = false
```

### Commit Conventions (`[process.commits]`)

```toml
[process.commits]
enabled = true
types = ["feat", "fix", "docs", "chore", "refactor", "test", "ci"]
require_scope = false
max_subject_length = 72
```

### CI Requirements (`[process.ci]`)

```toml
[process.ci]
enabled = true
require_workflows = ["test.yml", "lint.yml"]

[process.ci.jobs]
required = ["test", "lint"]

[process.ci.actions]
forbidden = ["actions/checkout@v2"]  # Enforce v3+
```

### CODEOWNERS Validation (`[process.codeowners]`)

```toml
[process.codeowners]
enabled = true

[[process.codeowners.rules]]
pattern = "*.ts"
owners = ["@frontend-team"]

[[process.codeowners.rules]]
pattern = "/infra/*"
owners = ["@platform-team"]
```

### PR Requirements (`[process.pr]`)

```toml
[process.pr]
enabled = true
max_files = 50
max_lines = 500
```

### Git Hooks (`[process.hooks]`)

```toml
[process.hooks]
enabled = true
require_husky = true
require_hooks = ["pre-commit", "commit-msg"]
protected_branches = ["main", "develop"]
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| check-my-toolkit | CLI (`cm`): `process check`, `process diff`, `process sync` |
| @octokit/rest | GitHub API (existing in drift-toolkit) |

---

## GitHub Token Permissions

The GitHub token needs these permissions for process scanning:

| Permission | Scope | Reason |
|------------|-------|--------|
| `repo` | Full | Read branch protection, create issues |
| `read:org` | Org | List repos in organization |
| `admin:repo_hook` | Optional | Read webhook configurations |

For GitHub Apps, these permissions are needed:
- Repository permissions: Administration (read), Contents (read), Issues (write), Metadata (read)
- Organization permissions: Members (read)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Token lacks admin access | Skip repos where 403 returned, log warning |
| Branch protection API differences | Handle both legacy and ruleset APIs |
| Too many violations per repo | Group by category, summarize counts |
| Private repos without access | Filter to accessible repos only |

---

## Success Criteria

- [ ] Process schema defined in check.toml
- [ ] Branch protection validated correctly
- [ ] Required files checked
- [ ] Required status checks validated
- [ ] CI workflows validated
- [ ] `drift process scan` creates issues with violations
- [ ] `drift process scan --org` scans all qualifying repos
- [ ] GitHub Action runs process scans on schedule
