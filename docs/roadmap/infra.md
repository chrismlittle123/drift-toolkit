# Roadmap: drift infra scan

> Detects infrastructure drift between CDK code and actual AWS resources.

## Overview

`drift infra scan` validates that AWS infrastructure matches what's declared in CDK code. It detects missing resources, orphaned resources, and attribute drift across all 3 environments (dev, staging, prod). It also verifies that deprecated projects have their resources cleaned up.

---

## Prerequisites (check-my-toolkit)

**Already exists in check-my-toolkit:**

| Feature | Status | Description |
|---------|--------|-------------|
| `[infra.tagging]` schema | **Already exists** | AWS resource tagging validation |
| `cm infra check` | **Already exists** | Run infrastructure tagging checks |
| `cm infra audit` | **Already exists** | Verify infrastructure configs exist |

**Missing features needed for drift:**

| Feature | Status | Description |
|---------|--------|-------------|
| Extended infra schema | Not started | `[infra]` section for stacks, accounts, CDK path |
| `cm infra validate` | Not started | Validate CDK code vs actual AWS resources |
| CDK synth integration | Not started | Parse CloudFormation templates from CDK |
| Multi-account support | Not started | Query resources across dev/staging/prod |
| Deployment tracking | Not started | Track last deployed commit per environment |

**Blocked until:** `cm infra validate` is available

**Note:** This is the most complex domain. The existing `[infra.tagging]` check is separate from the proposed CDK validation feature. The CLI command is `cm` (not `cmt`).

---

## Milestones

### Milestone 1: Infra Schema Design

**Goal:** Define infrastructure configuration in check.toml

| Task | Description |
|------|-------------|
| Basic infra schema | `[infra]` - enabled, path, stacks |
| Account mapping | `[infra.accounts]` - dev, staging, prod account IDs |
| Account auth config | Support profiles and role ARNs per account |
| Tracked attributes | `[infra.tracked_attributes]` - attributes to monitor |

**Output:** Documented schema for infra configuration in check.toml

---

### Milestone 2: CDK Integration (check-my-toolkit)

**Goal:** Parse CDK code to determine expected resources

| Task | Description |
|------|-------------|
| CDK synth wrapper | Run `cdk synth` and capture output |
| Template parsing | Parse CloudFormation templates from cdk.out |
| Resource extraction | Extract resource types, logical IDs |
| Source mapping | Map resources back to TypeScript source files |

**Output:** `cm infra validate` can determine expected resources from CDK

---

### Milestone 3: AWS API Integration (check-my-toolkit)

**Goal:** Query AWS for actual resource state

| Task | Description |
|------|-------------|
| CloudFormation queries | DescribeStacks, DescribeStackResources |
| S3 queries | GetBucketPolicy, GetPublicAccessBlock, etc. |
| Lambda queries | GetFunction, GetFunctionConfiguration |
| IAM queries | GetRole, GetPolicy, GetRolePolicy |
| Multi-account support | Assume roles or use profiles per account |

**Output:** `cm infra validate` can query actual AWS state

---

### Milestone 4: Basic Drift Detection (check-my-toolkit)

**Goal:** Compare expected vs actual resources

| Task | Description |
|------|-------------|
| Missing detection | Resources in CDK but not in AWS |
| Orphaned detection | Resources in AWS but not in CDK |
| Basic comparison | Resource exists yes/no |
| JSON output | Structured output for drift-toolkit |

**Output:** `cm infra validate --json` returns validation results

---

### Milestone 5: Attribute Drift Detection (check-my-toolkit)

**Goal:** Detect when resource attributes have changed

| Task | Description |
|------|-------------|
| S3 attribute checks | PublicAccessBlock, BucketPolicy, Versioning |
| Lambda attribute checks | Runtime, Timeout, VpcConfig |
| IAM attribute checks | PolicyDocument, AssumeRolePolicyDocument |
| Security group checks | IpPermissions, IpPermissionsEgress |
| Configurable attributes | Use `[infra.tracked_attributes]` |

**Output:** Attribute drift detected and reported

---

### Milestone 6: Deployment Tracking

**Goal:** Only validate deployed resources per environment

| Task | Description |
|------|-------------|
| Git tag tracking | Read deployed commit from git tags (e.g., `deployed-prod-abc123`) |
| CloudFormation tag tracking | Read commit SHA from stack tags |
| Environment filtering | Skip resources not deployed to target environment |
| New resource handling | Don't report "missing in prod" for resources only in dev |

**Output:** Accurate drift detection based on actual deployments

---

### Milestone 7: drift-toolkit Integration

**Goal:** Integrate infra validation into drift-toolkit

| Task | Description |
|------|-------------|
| Call cm infra validate | Shell out to `cm infra validate --json --account all` |
| Parse results | Extract issues from JSON output |
| Format issue | Convert to GitHub issue format |
| All 3 accounts | Scan dev, staging, prod in one run |

**Output:** `drift infra scan` creates issues for infra drift

---

### Milestone 8: Status-based Scanning (Pre-release & Deprecated)

**Goal:** Handle different project statuses appropriately

| Task | Description |
|------|-------------|
| Read status from metadata | Check `status` field in repo-metadata.yaml |
| Pre-release handling | Skip prod account scanning (not yet deployed) |
| Deprecated handling | Expect NO resources to exist in any account |
| Cleanup issue | Create issue listing resources that should be deleted |
| Stack deletion check | Verify CloudFormation stacks are deleted |

**Status behaviors:**
| Status | Behavior |
|--------|----------|
| `active` | Normal scanning - all 3 accounts |
| `pre-release` | Skip prod account (not yet deployed to production) |
| `deprecated` | Inverted validation - expect all resources deleted |

**Output:** Status-appropriate scanning with correct issue creation

---

### Milestone 9: Org-wide Infra Scanning

**Goal:** Scan all repos in an organization for infra drift

| Task | Description |
|------|-------------|
| Filter repos with infra | Only scan repos with `[infra]` in check.toml |
| AWS credentials | Require credentials with access to all accounts |
| Parallel execution | Scan multiple repos (but rate limit AWS calls) |
| Per-repo issues | Create separate issue in each repo |

**Output:** `drift infra scan --org <org>` works end-to-end

---

### Milestone 10: GitHub Action Integration

**Goal:** Run as scheduled GitHub Action

| Task | Description |
|------|-------------|
| Action workflow | Add infra scan to drift-config workflow |
| AWS credentials | Document IAM role/credentials setup |
| Multi-account access | Configure role assumption or profiles |
| Error handling | Handle permission errors gracefully |

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

# Dry run
drift infra scan --dry-run
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
|---------|-------|---------|----------|---------|
| dev | 15 | 0 | 1 | 0 |
| staging | 15 | 0 | 0 | 0 |
| prod | 14 | 1 | 0 | 2 |

### Issues

#### MISSING (prod)

| Resource | Source | Stack |
|----------|--------|-------|
| `arn:aws:s3:::my-app-data-bucket` | infra/lib/storage-stack.ts | MyAppStack |

**Action:** Deploy stack to prod or remove from CDK code

#### ORPHANED (dev)

| Resource | Last Modified |
|----------|---------------|
| `arn:aws:lambda:us-east-1:111...:function:old-handler` | 2024-01-10 |

**Action:** Delete resource or add to CDK code

#### DRIFTED (prod)

| Resource | Attribute | Expected | Actual |
|----------|-----------|----------|--------|
| `arn:aws:s3:::my-app-logs` | PublicAccessBlockConfiguration.BlockPublicAcls | `true` | `false` |
| `arn:aws:s3:::my-app-logs` | Versioning | `Enabled` | `Suspended` |

**Action:** Redeploy stack or investigate manual changes

### How to Fix

1. For missing resources: `cdk deploy MyAppStack --profile prod`
2. For orphaned resources: Delete via AWS Console or add to CDK
3. For drifted resources: `cdk deploy` to restore expected state

---
*Created by drift-toolkit*
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
*Created by drift-toolkit*
```

---

## Infra Configuration Reference

### Basic Configuration

```toml
[infra]
enabled = true
path = "./infra"
stacks = ["MyAppStack", "DataStack"]

[infra.accounts]
dev = "111111111111"
staging = "222222222222"
prod = "333333333333"
```

### With Authentication

```toml
[infra.accounts.dev]
account_id = "111111111111"
profile = "dev-profile"

[infra.accounts.prod]
account_id = "333333333333"
role_arn = "arn:aws:iam::333333333333:role/InfraValidator"
```

### With Tracked Attributes

```toml
[infra.tracked_attributes]
s3 = ["PublicAccessBlockConfiguration", "BucketPolicy", "Versioning"]
lambda = ["Runtime", "Timeout", "VpcConfig", "Environment"]
iam = ["PolicyDocument", "AssumeRolePolicyDocument"]
rds = ["PubliclyAccessible", "StorageEncrypted"]
security_group = ["IpPermissions", "IpPermissionsEgress"]
```

---

## AWS Permissions Required

The scanning role/credentials need these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackResources",
        "cloudformation:ListStacks",
        "s3:GetBucketPolicy",
        "s3:GetBucketPolicyStatus",
        "s3:GetPublicAccessBlock",
        "s3:GetBucketVersioning",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "iam:GetRole",
        "iam:GetRolePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "ec2:DescribeSecurityGroups",
        "rds:DescribeDBInstances",
        "dynamodb:DescribeTable",
        "apigateway:GET"
      ],
      "Resource": "*"
    }
  ]
}
```

For multi-account, create this role in each account and allow assumption from the scanning account.

---

## Dependencies

| Package | Purpose |
|---------|---------|
| check-my-toolkit | CLI (`cm`): `infra validate` command (to be built) |
| @aws-sdk/* | AWS API queries (in check-my-toolkit) |
| aws-cdk-lib | CDK synth (in check-my-toolkit) |
| @octokit/rest | GitHub API for issue creation (existing in drift-toolkit) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AWS API rate limiting | Implement backoff, limit parallel account queries |
| CDK synth failures | Cache last successful synth, report errors clearly |
| Missing IAM permissions | Validate permissions upfront, skip inaccessible resources |
| Large number of resources | Paginate API calls, summarize in issues |
| Environment branch mismatch | Use deployment tracking via tags |
| False positives for new resources | Track deployed commits, filter by deployment state |

---

## Deployment Tracking Design

### Option A: Git Tags

```bash
# After successful deployment
git tag deployed-dev-$(git rev-parse HEAD)
git tag deployed-prod-$(git rev-parse HEAD)
git push --tags
```

drift reads these tags to know what's deployed where.

### Option B: CloudFormation Stack Tags

```typescript
// In CDK
new Stack(app, 'MyStack', {
  tags: {
    'drift:deployed-commit': process.env.GITHUB_SHA,
    'drift:deployed-at': new Date().toISOString(),
  },
});
```

drift reads stack tags to know deployed commit.

### Option C: Deployment Manifest

```json
// deployments.json (committed after each deploy)
{
  "dev": {
    "commit": "abc1234",
    "deployedAt": "2024-01-15T10:00:00Z"
  },
  "prod": {
    "commit": "def5678",
    "deployedAt": "2024-01-14T15:00:00Z"
  }
}
```

**Recommendation:** Option B (CloudFormation tags) - most reliable, no extra files needed.

---

## Success Criteria

- [ ] Infra schema defined in check.toml
- [ ] `cm infra validate` detects missing resources
- [ ] `cm infra validate` detects orphaned resources
- [ ] `cm infra validate` detects attribute drift
- [ ] Deployment tracking implemented (know what's deployed where)
- [ ] `drift infra scan` creates issues for infra drift
- [ ] `drift infra scan` scans all 3 accounts
- [ ] Deprecated projects scanned for remaining resources
- [ ] `drift infra scan --org` scans all qualifying repos
- [ ] GitHub Action runs infra scans on schedule
- [ ] AWS credentials documented and working
