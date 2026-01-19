# check-my-toolkit Missing Features

> Features required in check-my-toolkit to complete the drift-toolkit vision.

## Overview

drift-toolkit depends on check-my-toolkit for standards definition and validation. The following features must be implemented in check-my-toolkit before drift-toolkit can be fully built.

| Feature | Priority | Blocker For |
|---------|----------|-------------|
| `dependencies` command | High | `drift code scan` |
| `infra validate` command | High | `drift infra scan` |
| Process standards in check.toml | Medium | `drift process scan` |
| Tier-to-ruleset validation | Medium | Standards enforcement |

---

## 1. `dependencies` Command

**Command:** `check-my-toolkit dependencies`

**Purpose:** Returns the list of files that drift-toolkit should track for changes. Each check in check.toml has associated configuration files that, if changed, indicate potential drift.

### CLI Interface

```bash
# Get all dependencies for current project
cmdependencies

# Get dependencies as JSON (for programmatic use)
cmdependencies --json

# Get dependencies for a specific check
cmdependencies --check eslint

# Get dependencies for a specific project in monorepo
cmdependencies --project packages/api
```

### Output Format

**Human-readable:**
```
Dependencies for check.toml

eslint:
  - .eslintrc.js
  - .eslintignore
  - eslint.config.js

prettier:
  - .prettierrc
  - .prettierignore

typescript:
  - tsconfig.json
  - tsconfig.build.json

knip:
  - knip.json

Always tracked:
  - check.toml
  - .github/workflows/*.yml
```

**JSON output (`--json`):**
```json
{
  "project": ".",
  "checkTomlPath": "./check.toml",
  "dependencies": {
    "eslint": [
      ".eslintrc.js",
      ".eslintignore",
      "eslint.config.js"
    ],
    "prettier": [
      ".prettierrc",
      ".prettierignore"
    ],
    "typescript": [
      "tsconfig.json",
      "tsconfig.build.json"
    ],
    "knip": [
      "knip.json"
    ]
  },
  "alwaysTracked": [
    "check.toml",
    ".github/workflows/*.yml"
  ],
  "allFiles": [
    "check.toml",
    ".eslintrc.js",
    ".eslintignore",
    "eslint.config.js",
    ".prettierrc",
    ".prettierignore",
    "tsconfig.json",
    "tsconfig.build.json",
    "knip.json",
    ".github/workflows/*.yml"
  ]
}
```

### Implementation Details

**Dependency resolution:**
1. Parse check.toml
2. For each enabled check, determine associated config files
3. Use built-in knowledge of common tools (eslint, prettier, typescript, etc.)
4. Allow custom dependencies to be specified in check.toml

**check.toml extension for custom dependencies:**
```toml
[eslint]
enabled = true
dependencies = [".eslintrc.js", ".eslintignore", "eslint.config.js"]

[custom-tool]
enabled = true
dependencies = ["custom-tool.config.yaml", "custom-tool.rules.json"]
```

**Built-in dependency mappings:**
| Check | Default Dependencies |
|-------|---------------------|
| eslint | `.eslintrc.*`, `eslint.config.*`, `.eslintignore` |
| prettier | `.prettierrc*`, `.prettierignore` |
| typescript | `tsconfig*.json` |
| knip | `knip.json`, `knip.config.ts` |
| jest | `jest.config.*` |
| vitest | `vitest.config.*` |
| biome | `biome.json` |

**Always tracked (hardcoded):**
- `check.toml` (all of them in monorepos)
- `.github/workflows/*.yml`
- `repo-metadata.yaml`

### Programmatic API

```typescript
import { getDependencies } from 'check-my-toolkit';

const result = await getDependencies({
  projectPath: '.',
  check: 'eslint', // optional, filter to specific check
});

// result.dependencies: Record<string, string[]>
// result.alwaysTracked: string[]
// result.allFiles: string[]
```

---

## 2. `infra validate` Command

**Command:** `check-my-toolkit infra validate`

**Purpose:** Validates that AWS infrastructure matches what's declared in CDK code. Detects missing resources, orphaned resources, and attribute drift.

### CLI Interface

```bash
# Validate infra for current project (default: dev account)
cminfra validate

# Validate specific account
cminfra validate --account prod

# Validate all accounts
cminfra validate --account all

# JSON output for programmatic use
cminfra validate --json

# Specify region
cminfra validate --region us-east-1
```

### Output Format

**Human-readable:**
```
Infra Validation Results
========================

Account: prod (333333333333)
Region: us-east-1

✓ 12 resources found
✗ 1 resource missing
! 2 orphaned resources
~ 1 resource drifted

Issues:
-------

MISSING: arn:aws:s3:::my-app-data-bucket
  Source: infra/lib/storage-stack.ts
  Construct: DataBucket
  Stack: MyAppStack

ORPHANED: arn:aws:lambda:us-east-1:333333333333:function:old-handler
  Not declared in CDK code
  Last modified: 2024-01-15

DRIFTED: arn:aws:s3:::my-app-logs
  Attribute: PublicAccessBlockConfiguration.BlockPublicAcls
  Expected: true
  Actual: false
```

**JSON output (`--json`):**
```json
{
  "valid": false,
  "account": "prod",
  "accountId": "333333333333",
  "region": "us-east-1",
  "timestamp": "2024-01-15T10:30:00Z",
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
    },
    {
      "type": "orphaned",
      "arn": "arn:aws:lambda:us-east-1:333333333333:function:old-handler",
      "lastModified": "2024-01-15T08:00:00Z"
    },
    {
      "type": "drifted",
      "arn": "arn:aws:s3:::my-app-logs",
      "attribute": "PublicAccessBlockConfiguration.BlockPublicAcls",
      "expected": true,
      "actual": false
    }
  ],
  "resources": [
    {
      "arn": "arn:aws:s3:::my-app-logs",
      "type": "AWS::S3::Bucket",
      "status": "drifted",
      "source": "infra/lib/storage-stack.ts"
    }
  ]
}
```

### check.toml Configuration

```toml
[infra]
enabled = true
path = "./infra"                    # Path to CDK app
stacks = ["MyAppStack", "DataStack"] # Stacks to validate

[infra.accounts]
dev = "111111111111"
staging = "222222222222"
prod = "333333333333"

# Optional: AWS profile or role per account
[infra.accounts.dev]
account_id = "111111111111"
profile = "dev-profile"

[infra.accounts.prod]
account_id = "333333333333"
role_arn = "arn:aws:iam::333333333333:role/InfraValidator"

# Optional: attributes to track for drift detection
[infra.tracked_attributes]
s3 = ["PublicAccessBlockConfiguration", "BucketPolicy", "Versioning"]
lambda = ["Runtime", "Timeout", "VpcConfig"]
iam = ["PolicyDocument", "AssumeRolePolicyDocument"]
```

### Implementation Details

**Workflow:**
1. Read `[infra]` config from check.toml
2. Run `cdk synth` in the specified path to generate CloudFormation templates
3. Parse templates to extract expected resources
4. Query AWS APIs for actual resource state
5. Compare expected vs actual
6. Report discrepancies

**CDK synth parsing:**
- Parse `cdk.out/*.template.json` files
- Extract resource logical IDs and types
- Map back to source files using CDK metadata (construct paths)

**AWS API queries:**
- Use CloudFormation DescribeStackResources for stack-managed resources
- Use service-specific APIs for attribute details (S3, Lambda, IAM, etc.)
- Use Resource Groups Tagging API for resource discovery

**Deployment tracking (for trunk-based):**
- Read last deployed commit from CloudFormation stack tags or git tags
- Filter expected resources based on what's been deployed to each environment
- New resources not yet deployed to prod should not trigger "missing" errors in prod

### Tracked Attributes (Default)

| Service | Attributes |
|---------|------------|
| S3 | PublicAccessBlockConfiguration, BucketPolicy, Versioning, LifecycleConfiguration |
| Lambda | Runtime, Timeout, MemorySize, VpcConfig, Environment |
| API Gateway | EndpointConfiguration, Policy |
| IAM Role | AssumeRolePolicyDocument, AttachedPolicies |
| IAM Policy | PolicyDocument |
| RDS | PubliclyAccessible, StorageEncrypted, MultiAZ |
| Security Group | IpPermissions, IpPermissionsEgress |
| DynamoDB | BillingMode, ProvisionedThroughput |

### Programmatic API

```typescript
import { validateInfra } from 'check-my-toolkit';

const result = await validateInfra({
  projectPath: '.',
  account: 'prod', // or 'all'
  region: 'us-east-1',
});

// result.valid: boolean
// result.issues: InfraIssue[]
// result.summary: { found, missing, orphaned, drifted }
```

### Dependencies

Optional peer dependencies (lazy-loaded):
- `@aws-sdk/client-cloudformation`
- `@aws-sdk/client-s3`
- `@aws-sdk/client-lambda`
- `@aws-sdk/client-iam`
- `@aws-sdk/client-rds`
- `@aws-sdk/client-ec2`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/client-apigateway`
- `@aws-sdk/client-resource-groups-tagging-api`
- `aws-cdk-lib` (for synth)

---

## 3. Process Standards in check.toml

**Purpose:** Define GitHub repository process standards in check.toml that can be validated by both check-my-toolkit (at PR time) and drift-toolkit (scheduled).

### check.toml Schema

```toml
[process]
enabled = true

# Branch protection
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

# Required files
[process.required_files]
codeowners = true
codeowners_path = ".github/CODEOWNERS"
pr_template = true
pr_template_path = ".github/pull_request_template.md"
issue_templates = true
contributing = false
license = false

# Commit conventions
[process.commits]
conventional = true
allowed_types = ["feat", "fix", "docs", "chore", "refactor", "test", "ci"]
require_scope = false
max_subject_length = 72

# PR requirements
[process.pull_requests]
require_linked_issue = false
require_labels = true
required_labels = ["type:*"]  # glob pattern
max_files_changed = 50  # warning threshold

# CI/CD
[process.ci]
required_workflows = ["test.yml", "lint.yml"]
workflow_path = ".github/workflows"
```

### CLI Interface

```bash
# Validate process standards
cmprocess validate

# Validate specific category
cmprocess validate --category branches
cmprocess validate --category required_files

# JSON output
cmprocess validate --json

# Check against specific repo (for drift-toolkit)
cmprocess validate --repo owner/repo --token $GITHUB_TOKEN
```

### Output Format

**Human-readable:**
```
Process Validation Results
==========================

Repository: myorg/my-app

✓ Branch protection enabled
✗ Required reviews: expected 2, actual 1
✓ Status checks required
✗ Missing required status check: build
✓ CODEOWNERS file exists
✗ PR template missing
✓ Conventional commits enforced

Issues:
-------

VIOLATION: Branch protection - required_reviews
  Expected: 2
  Actual: 1
  Path: Settings > Branches > main

VIOLATION: Missing required status check
  Expected: ["test", "lint", "build"]
  Missing: ["build"]
  Path: Settings > Branches > main > Status checks

VIOLATION: Required file missing
  File: .github/pull_request_template.md
  Action: Create PR template
```

**JSON output (`--json`):**
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

### Implementation Details

**GitHub API endpoints used:**
- `GET /repos/{owner}/{repo}` - repo settings
- `GET /repos/{owner}/{repo}/branches/{branch}/protection` - branch protection
- `GET /repos/{owner}/{repo}/contents/{path}` - file existence
- `GET /repos/{owner}/{repo}/actions/workflows` - workflow list
- `GET /repos/{owner}/{repo}/rulesets` - repository rulesets (newer API)

**Local vs Remote validation:**
- Local: Check file existence, parse workflow files
- Remote: Query GitHub API for branch protection, repo settings
- drift-toolkit uses remote validation (scheduled scans)
- check-my-toolkit at PR time uses local validation where possible

### Programmatic API

```typescript
import { validateProcess } from 'check-my-toolkit';

const result = await validateProcess({
  projectPath: '.', // for local checks
  repository: 'myorg/my-app', // for remote checks
  token: process.env.GITHUB_TOKEN,
  categories: ['branches', 'required_files'], // optional filter
});

// result.valid: boolean
// result.checks: ProcessCheck[]
// result.summary: { passed, failed, warnings }
```

---

## 4. Tier-to-Ruleset Validation

**Purpose:** Verify that a project's check.toml extends from rulesets appropriate for its tier (production, internal, prototype).

### CLI Interface

```bash
# Validate tier-ruleset alignment
cmvalidate tier

# JSON output
cmvalidate tier --json
```

### Validation Logic

**repo-metadata.yaml:**
```yaml
tier: production
status: active
```

**check.toml:**
```toml
[extends]
registry = "github:chrismlittle123/check-my-toolkit-community-registry"
rulesets = ["typescript-production"]
```

**Rules:**
1. If `tier: production` → rulesets must include a `*-production` ruleset
2. If `tier: internal` → rulesets must include a `*-internal` ruleset
3. If `tier: prototype` → rulesets must include a `*-prototype` ruleset
4. Overrides are allowed, but base ruleset must match tier
5. If no tier specified, default to `internal`

### Output Format

**Human-readable:**
```
Tier-Ruleset Validation
=======================

Tier: production (from repo-metadata.yaml)
Rulesets: ["typescript-production", "custom-overrides"]

✓ Tier-ruleset alignment valid
  Base ruleset: typescript-production
  Tier requirement: *-production
```

**Failure case:**
```
Tier-Ruleset Validation
=======================

Tier: production (from repo-metadata.yaml)
Rulesets: ["typescript-internal"]

✗ Tier-ruleset mismatch
  Expected: ruleset matching *-production
  Actual: typescript-internal
  Action: Update check.toml to extend from typescript-production
```

**JSON output:**
```json
{
  "valid": false,
  "tier": "production",
  "rulesets": ["typescript-internal"],
  "expectedPattern": "*-production",
  "matchingRuleset": null,
  "error": "Tier-ruleset mismatch: production tier requires *-production ruleset"
}
```

### Programmatic API

```typescript
import { validateTierRuleset } from 'check-my-toolkit';

const result = await validateTierRuleset({
  projectPath: '.',
});

// result.valid: boolean
// result.tier: string
// result.rulesets: string[]
// result.matchingRuleset: string | null
```

---

## 5. Additional Enhancements

### `projects detect` Improvements

**Current:** Detects projects/packages in monorepos.

**Needed enhancements:**
- Return whether each project has a check.toml
- Return project tier and status from repo-metadata.yaml
- Support filtering by has/missing check.toml

```bash
# Current
cmprojects detect

# Enhanced - show check.toml status
cmprojects detect --show-status

# Filter to projects without check.toml
cmprojects detect --missing-config
```

**Enhanced JSON output:**
```json
{
  "projects": [
    {
      "path": "packages/api",
      "name": "api",
      "hasCheckToml": true,
      "tier": "production",
      "status": "active"
    },
    {
      "path": "packages/utils",
      "name": "utils",
      "hasCheckToml": false,
      "tier": null,
      "status": null
    }
  ],
  "summary": {
    "total": 2,
    "withConfig": 1,
    "withoutConfig": 1
  }
}
```

---

## Implementation Priority

### Phase 1 (Enables `drift code scan`)
1. `dependencies` command
2. `projects detect` enhancements (--missing-config flag)

### Phase 2 (Enables `drift process scan`)
3. Process standards schema in check.toml
4. `process validate` command
5. Tier-to-ruleset validation

### Phase 3 (Enables `drift infra scan`)
6. Infra schema in check.toml
7. `infra validate` command
8. Deployment tracking integration

---

## Summary

| Feature | Command | Purpose | Complexity |
|---------|---------|---------|------------|
| Dependencies | `cmdependencies` | List tracked files per check | Low |
| Projects detect | `cmprojects detect --missing-config` | Find projects without standards | Low |
| Process validate | `cmprocess validate` | Validate GitHub process standards | Medium |
| Tier validation | `cmvalidate tier` | Verify tier-ruleset alignment | Low |
| Infra validate | `cminfra validate` | Validate AWS resources vs CDK | High |

These features form the foundation that drift-toolkit needs to perform its scheduled enforcement scans.
