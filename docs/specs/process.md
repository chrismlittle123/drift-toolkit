# Spec: drift process scan

> Verifies that GitHub process standards are being followed.

## Overview

`drift process scan` validates GitHub repository settings against standards defined in check.toml. It calls check-my-toolkit's `validateProcess` API and creates GitHub issues when violations are found.

**Scope:** drift-toolkit is the orchestration layer. All process validation logic lives in check-my-toolkit.

```
drift-toolkit                    check-my-toolkit
─────────────                    ────────────────
Repo discovery          ───►     cm process scan
Issue creation          ◄───     JSON results
Org-wide scanning
GitHub Action
```

---

## Prerequisites (check-my-toolkit)

**Required from check-my-toolkit:**

| Feature           | Command/API                              | Purpose                           |
| ----------------- | ---------------------------------------- | --------------------------------- |
| Process scanning  | `validateProcess()` / `cm process scan`  | Validate repo settings via API    |
| JSON output       | `--json` flag                            | Structured results for parsing    |
| Remote validation | `--repo owner/repo` flag                 | Scan repos without cloning        |

**Blocked until:** `cm process scan --repo` is available in check-my-toolkit.

**Note:** The CLI command is `cm` (not `cmt`).

---

## Milestones

### Milestone 1: Basic Integration

**Goal:** Call check-my-toolkit and create issues

| Task             | Description                                          |
| ---------------- | ---------------------------------------------------- |
| Programmatic API | Import and call `validateProcess()` from check-my-toolkit |
| Parse results    | Extract violations from JSON response                |
| Issue creation   | Create GitHub issue with violations                  |
| Error handling   | Handle missing config, permission errors             |

**Output:** `drift process scan` creates issues for a single repo

---

### Milestone 2: Org-wide Scanning

**Goal:** Scan all repos in an organization

| Task               | Description                                        |
| ------------------ | -------------------------------------------------- |
| Repo discovery     | Find repos with check.toml                         |
| Smart scanning     | Only scan repos with commits in last 24h           |
| Parallel execution | Scan multiple repos concurrently                   |
| Per-repo issues    | Create separate issue in each repo with violations |

**Output:** `drift process scan --org <org>` works end-to-end

---

### Milestone 3: GitHub Action Integration

**Goal:** Run as scheduled GitHub Action

| Task              | Description                               |
| ----------------- | ----------------------------------------- |
| Action workflow   | Add process scan to drift-config workflow |
| Token permissions | Document required GitHub token scopes     |
| Error handling    | Handle repos where token lacks access     |

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

# Scan all repos (ignore commit activity filter)
drift process scan --org <org> --all

# Custom time window for activity filter
drift process scan --org <org> --since 48
```

---

## Integration with check-my-toolkit

### Programmatic API (Preferred)

```typescript
import { validateProcess } from "check-my-toolkit";

const result = await validateProcess({
  repository: "myorg/my-app",
  token: process.env.GITHUB_TOKEN,
});

if (!result.valid) {
  await createGitHubIssue(formatProcessIssue(result));
}
```

### CLI Fallback

```bash
cm process scan --repo myorg/my-app --json
```

### Expected Response Format

```json
{
  "valid": false,
  "repository": "myorg/my-app",
  "timestamp": "2024-01-15T10:30:00Z",
  "summary": {
    "passed": 5,
    "failed": 3,
    "warnings": 1
  },
  "checks": [
    {
      "category": "branches",
      "check": "required_reviews",
      "status": "fail",
      "expected": 2,
      "actual": 1
    },
    {
      "category": "required_files",
      "check": "pr_template",
      "status": "fail",
      "expected": true,
      "actual": false,
      "path": ".github/pull_request_template.md"
    }
  ]
}
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

### Summary

| Category       | Passed | Failed |
| -------------- | ------ | ------ |
| branches       | 3      | 2      |
| required_files | 1      | 1      |
| ci             | 2      | 0      |

### Violations

#### Branch Protection

| Setting               | Expected | Actual |
| --------------------- | -------- | ------ |
| Required reviews      | 2        | 1      |
| Dismiss stale reviews | true     | false  |

#### Missing Required Files

- [ ] `.github/pull_request_template.md` - not found

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

_Created by drift-toolkit_
```

---

## Validation Categories

drift-toolkit can request specific categories from check-my-toolkit:

| Category          | What It Validates                           |
| ----------------- | ------------------------------------------- |
| `branches`        | Branch protection settings                  |
| `required_files`  | CODEOWNERS, PR template, etc.               |
| `forbidden_files` | Files that must NOT exist (.env, etc.)      |
| `commits`         | Commit message format                       |
| `pull_requests`   | PR requirements (labels, linked issues)     |
| `ci`              | Workflow files and required commands        |

**Note:** Full configuration reference is in check-my-toolkit's process spec.

---

## Dependencies

| Package          | Purpose                                   |
| ---------------- | ----------------------------------------- |
| check-my-toolkit | `validateProcess()` API for scanning      |
| @octokit/rest    | GitHub API for issue creation (existing)  |

---

## GitHub Token Permissions

The GitHub token needs these permissions for process scanning:

| Permission | Scope | Reason                                |
| ---------- | ----- | ------------------------------------- |
| `repo`     | Full  | Read branch protection, create issues |
| `read:org` | Org   | List repos in organization            |

For GitHub Apps:

- Repository permissions: Administration (read), Contents (read), Issues (write), Metadata (read)
- Organization permissions: Members (read)

---

## Risks & Mitigations

| Risk                     | Mitigation                                 |
| ------------------------ | ------------------------------------------ |
| Token lacks admin access | Skip repos where 403 returned, log warning |
| Too many violations      | Group by category, summarize counts        |
| Private repos            | Filter to accessible repos only            |

---

## References

- **check-my-toolkit process spec:** Full validation logic and check.toml schema
- **check.toml schema:** See check-my-toolkit docs for `[process.*]` configuration
