# Roadmap: drift process scan

> Verifies that GitHub process standards are being followed.

## Overview

`drift process scan` checks GitHub repository settings against standards defined in check.toml. It validates branch protection, required files, CI workflows, and other process requirements. When violations are found, it creates GitHub issues.

---

## Prerequisites (check-my-toolkit)

These features must be implemented in check-my-toolkit first:

| Feature | Status | Description |
|---------|--------|-------------|
| Process schema in check.toml | Not started | `[process.*]` sections for defining standards |
| `cmt process validate` | Not started | Validate process standards against GitHub API |
| `cmt validate tier` | Not started | Verify tier-ruleset alignment |

**Blocked until:** Process schema and `cmt process validate` are available

---

## Milestones

### Milestone 1: Process Schema Design

**Goal:** Define what process standards can be configured in check.toml

| Task | Description |
|------|-------------|
| Branch protection schema | `[process.branches]` - reviews, status checks, force push |
| Required files schema | `[process.required_files]` - CODEOWNERS, PR template, etc. |
| Commit conventions schema | `[process.commits]` - conventional commits, scope, length |
| CI requirements schema | `[process.ci]` - required workflows |
| PR requirements schema | `[process.pull_requests]` - labels, linked issues |

**Output:** Documented schema for process standards in check.toml

---

### Milestone 2: GitHub API Integration

**Goal:** Query GitHub for actual repository settings

| Task | Description |
|------|-------------|
| Branch protection API | `GET /repos/{owner}/{repo}/branches/{branch}/protection` |
| Repository settings API | `GET /repos/{owner}/{repo}` |
| Contents API | `GET /repos/{owner}/{repo}/contents/{path}` for file checks |
| Workflows API | `GET /repos/{owner}/{repo}/actions/workflows` |
| Rulesets API | `GET /repos/{owner}/{repo}/rulesets` (newer API) |

**Output:** Wrapper functions to query all relevant GitHub settings

---

### Milestone 3: Basic Process Validation

**Goal:** Validate core process requirements

| Task | Description |
|------|-------------|
| Branch protection check | Compare expected vs actual protection rules |
| Required files check | Verify CODEOWNERS, PR template exist |
| Status checks check | Verify required status checks are configured |
| Issue creation | Create GitHub issue listing all violations |

**Output:** `drift process scan` creates issues for process violations

---

### Milestone 4: Extended Process Validation

**Goal:** Validate all process requirements

| Task | Description |
|------|-------------|
| Workflow validation | Verify required CI workflows exist |
| CODEOWNERS validation | Verify file is valid (not just exists) |
| Commit convention check | (informational - can't enforce retroactively) |
| PR requirements check | Labels, linked issues |

**Output:** Comprehensive process validation

---

### Milestone 5: Integrate with check-my-toolkit

**Goal:** Use check-my-toolkit for validation logic

| Task | Description |
|------|-------------|
| Call cmt process validate | Shell out to `cmt process validate --json` |
| Parse results | Extract violations from JSON output |
| Format issue | Convert violations to GitHub issue format |
| Remote validation | Pass `--repo` and `--token` for remote checks |

**Output:** drift-toolkit delegates validation to check-my-toolkit

---

### Milestone 6: Org-wide Process Scanning

**Goal:** Scan all repos in an organization for process compliance

| Task | Description |
|------|-------------|
| Repo iteration | Scan all repos with repo-metadata.yaml + check.toml |
| Smart scanning | Only scan repos with commits in last 24h |
| Parallel execution | Scan multiple repos concurrently |
| Per-repo issues | Create separate issue in each repo with violations |

**Output:** `drift process scan --org <org>` works end-to-end

---

### Milestone 7: GitHub Action Integration

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

## Process Standards Reference

### Branch Protection (`[process.branches]`)

```toml
[process.branches]
default_branch = "main"
protection = true
required_reviews = 2
dismiss_stale_reviews = true
require_code_owner_review = true
require_status_checks = true
required_status_checks = ["test", "lint", "build"]
enforce_admins = false
allow_force_push = false
allow_deletions = false
require_linear_history = false
require_signed_commits = false
```

### Required Files (`[process.required_files]`)

```toml
[process.required_files]
codeowners = true
codeowners_path = ".github/CODEOWNERS"
pr_template = true
pr_template_path = ".github/pull_request_template.md"
issue_templates = false
contributing = false
license = false
readme = true
```

### Commit Conventions (`[process.commits]`)

```toml
[process.commits]
conventional = true
allowed_types = ["feat", "fix", "docs", "chore", "refactor", "test", "ci"]
require_scope = false
max_subject_length = 72
```

### CI Requirements (`[process.ci]`)

```toml
[process.ci]
required_workflows = ["test.yml", "lint.yml"]
workflow_path = ".github/workflows"
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| check-my-toolkit | `process validate` command |
| @octokit/rest | GitHub API (existing) |

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
