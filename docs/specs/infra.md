# Spec: drift infra scan

> Detects infrastructure drift between CDK code and actual AWS resources.

## Overview

`drift infra scan` validates that AWS infrastructure matches what's declared in CDK code. It calls check-my-toolkit's `scanInfra` API and creates GitHub issues when violations are found.

**Scope:** drift-toolkit is the orchestration layer. All CDK parsing, AWS API queries, and drift detection logic lives in check-my-toolkit.

```
drift-toolkit                    check-my-toolkit
─────────────                    ────────────────
Repo discovery          ───►     cm infra scan
Issue creation          ◄───     JSON results
Org-wide scanning
GitHub Action
```

---

## Prerequisites (check-my-toolkit)

**Required from check-my-toolkit:**

| Feature          | Command/API                       | Purpose                        |
| ---------------- | --------------------------------- | ------------------------------ |
| Infra scanning   | `scanInfra()` / `cm infra scan`   | Compare CDK vs AWS state       |
| JSON output      | `--json` flag                     | Structured results for parsing |
| Multi-account    | `--account all`                   | Scan dev/staging/prod          |
| Status-awareness | Reads `repo-metadata.yaml` status | Handle deprecated projects     |

**Blocked until:** `cm infra scan` is available in check-my-toolkit.

**Note:** The CLI command is `cm` (not `cmt`).

---

## Milestones

### Milestone 1: Basic Integration

**Goal:** Call check-my-toolkit and create issues

| Task             | Description                                         |
| ---------------- | --------------------------------------------------- |
| Programmatic API | Import and call `scanInfra()` from check-my-toolkit |
| Parse results    | Extract issues from JSON response                   |
| Issue creation   | Create GitHub issue with violations                 |
| Error handling   | Handle missing config, permission errors            |

**Output:** `drift infra scan` creates issues for a single repo

---

### Milestone 2: Status-based Scanning

**Goal:** Handle different project statuses appropriately

| Task                 | Description                                      |
| -------------------- | ------------------------------------------------ |
| Read status          | Get `status` from repo-metadata.yaml             |
| Deprecated handling  | Use cleanup issue format for deprecated projects |
| Pre-release handling | Skip prod account for pre-release projects       |

**Status behaviors:**

| Status        | Behavior                                           |
| ------------- | -------------------------------------------------- |
| `active`      | Normal scanning - all 3 accounts                   |
| `pre-release` | Skip prod account (not yet deployed to production) |
| `deprecated`  | Expect all resources deleted, report any remaining |

**Output:** Correct issue format based on project status

---

### Milestone 3: Org-wide Scanning

**Goal:** Scan all repos in an organization

| Task               | Description                                  |
| ------------------ | -------------------------------------------- |
| Repo discovery     | Find repos with `[infra]` in check.toml      |
| Parallel execution | Scan multiple repos concurrently             |
| Rate limiting      | Respect AWS API limits across parallel scans |
| Per-repo issues    | Create separate issue in each repo           |

**Output:** `drift infra scan --org <org>` works end-to-end

---

### Milestone 4: GitHub Action Integration

**Goal:** Run as scheduled GitHub Action

| Task                | Description                             |
| ------------------- | --------------------------------------- |
| Action workflow     | Add infra scan to drift-config workflow |
| AWS credentials     | Document IAM role setup for Actions     |
| Multi-account roles | Configure cross-account role assumption |
| Error handling      | Skip repos where credentials fail       |

**Output:** Scheduled infra scans via GitHub Action

---

## CLI Interface

```bash
# Scan current repo (all accounts)
drift infra scan

# Scan specific account
drift infra scan --account prod
drift infra scan --account dev

# Scan all repos in org
drift infra scan --org <org>

# Scan specific repo
drift infra scan --org <org> --repo <repo>

# JSON output
drift infra scan --json

# Dry run (show issues without creating them)
drift infra scan --dry-run
```

---

## Integration with check-my-toolkit

### Programmatic API (Preferred)

```typescript
import { scanInfra } from "check-my-toolkit";

const result = await scanInfra({
  configPath: "./check.toml",
  account: "all",
});

if (!result.valid) {
  await createGitHubIssue(formatInfraIssue(result));
}
```

### CLI Fallback

```bash
cm infra scan --account all --json
```

### Expected Response Format

```json
{
  "valid": false,
  "account": "prod",
  "accountId": "333333333333",
  "summary": {
    "found": 12,
    "missing": 1,
    "orphaned": 2,
    "drifted": 1
  },
  "issues": [
    {
      "type": "missing",
      "arn": "arn:aws:s3:::my-app-data-bucket",
      "source": "infra/lib/storage-stack.ts",
      "construct": "DataBucket",
      "stack": "MyAppStack"
    }
  ]
}
```

---

## GitHub Issue Format

**Title:** `[drift:infra] Infrastructure drift detected`

**Labels:** `drift:infra`

**Body:**

```markdown
## Infrastructure Drift Detected

Repository: `myorg/my-app`
Scan time: 2024-01-15 02:00 UTC

### Summary

| Account | Found | Missing | Orphaned | Drifted |
| ------- | ----- | ------- | -------- | ------- |
| dev     | 15    | 0       | 1        | 0       |
| staging | 15    | 0       | 0        | 0       |
| prod    | 14    | 1       | 0        | 2       |

### Issues

#### MISSING (prod)

| Resource                          | Source                     | Stack      |
| --------------------------------- | -------------------------- | ---------- |
| `arn:aws:s3:::my-app-data-bucket` | infra/lib/storage-stack.ts | MyAppStack |

**Action:** Deploy stack to prod or remove from CDK code

#### ORPHANED (dev)

| Resource                                               | Last Modified |
| ------------------------------------------------------ | ------------- |
| `arn:aws:lambda:us-east-1:111...:function:old-handler` | 2024-01-10    |

**Action:** Delete resource or add to CDK code

#### DRIFTED (prod)

| Resource                   | Attribute                                      | Expected  | Actual      |
| -------------------------- | ---------------------------------------------- | --------- | ----------- |
| `arn:aws:s3:::my-app-logs` | PublicAccessBlockConfiguration.BlockPublicAcls | `true`    | `false`     |
| `arn:aws:s3:::my-app-logs` | Versioning                                     | `Enabled` | `Suspended` |

**Action:** Redeploy stack or investigate manual changes

### How to Fix

1. For missing resources: `cdk deploy MyAppStack --profile prod`
2. For orphaned resources: Delete via AWS Console or add to CDK
3. For drifted resources: `cdk deploy` to restore expected state

---

_Created by drift-toolkit_
```

---

## Deprecated Project Issue Format

**Title:** `[drift:infra] Deprecated project has active resources`

**Labels:** `drift:infra`, `deprecated`

**Body:**

```markdown
## Deprecated Project Has Active Resources

Repository: `myorg/old-service`
Status: `deprecated` (from repo-metadata.yaml)
Scan time: 2024-01-15 02:00 UTC

### Resources That Should Be Deleted

#### dev (111111111111)

- `arn:aws:s3:::old-service-data`
- `arn:aws:lambda:us-east-1:111...:function:old-service-handler`
- CloudFormation Stack: `OldServiceStack`

#### staging (222222222222)

- `arn:aws:s3:::old-service-data`
- CloudFormation Stack: `OldServiceStack`

#### prod (333333333333)

- `arn:aws:s3:::old-service-data`
- CloudFormation Stack: `OldServiceStack`

### How to Clean Up

1. Verify no dependencies on these resources
2. Delete CloudFormation stacks: `aws cloudformation delete-stack --stack-name OldServiceStack`
3. Or use CDK: `cdk destroy OldServiceStack`
4. Archive the repository after cleanup

---

_Created by drift-toolkit_
```

---

## Dependencies

| Package          | Purpose                                  |
| ---------------- | ---------------------------------------- |
| check-my-toolkit | `scanInfra()` API for drift detection    |
| @octokit/rest    | GitHub API for issue creation (existing) |

**Note:** All AWS SDK dependencies are in check-my-toolkit, not drift-toolkit.

---

## Risks & Mitigations

| Risk                       | Mitigation                                                  |
| -------------------------- | ----------------------------------------------------------- |
| check-my-toolkit not ready | Block on milestone completion                               |
| AWS credentials in Actions | Document IAM role setup, use OIDC                           |
| Too many issues per org    | Rate limit issue creation, summarize in single issue option |
| Scan timeouts              | Set reasonable timeout, report partial results              |

---

## References

- **check-my-toolkit infra spec:** Full CDK parsing, AWS API, and drift detection logic
- **check.toml schema:** See check-my-toolkit docs for `[infra]` configuration
