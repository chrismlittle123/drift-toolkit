# check-my-toolkit Infra Features Specification

> Infrastructure validation features for check-my-toolkit.

## Overview

Infra validation is a feature set within check-my-toolkit that bridges CDK code and actual AWS resources. It answers:
- "What resources **should** exist according to my CDK code?"
- "Do they match what **actually** exists in AWS?"

---

## Ecosystem (Simplified)

| Package | Role |
|---------|------|
| `check-my-toolkit` | Defines and validates all standards (code, process, **infra**) |
| `drift-toolkit` | Scheduled enforcement layer, surfaces violations |

**check-my-toolkit** handles standards definition and validation.
**drift-toolkit** handles scheduled auditing and GitHub issue creation.

---

## check.toml Configuration

Infra standards are defined in check.toml alongside code and process standards:

```toml
[eslint]
enabled = true

[prettier]
enabled = true

[infra]
enabled = true
path = "./infra"                    # Path to CDK app
stacks = ["MyAppStack", "DataStack"]

[infra.accounts]
dev = "111111111111"
staging = "222222222222"
prod = "333333333333"

[infra.tracked_attributes]
# Security-critical attributes to monitor for drift
s3 = ["PublicAccessBlockConfiguration", "BucketPolicy", "Versioning"]
lambda = ["Runtime", "Timeout", "VpcConfig"]
iam = ["PolicyDocument", "AssumeRolePolicyDocument"]

[infra.resources]
# Optional: explicit resource declarations
# If omitted, resources are auto-discovered from CDK synth

[[infra.resources.items]]
source = "infra/lib/api-stack.ts"
construct = "ApiGateway"
arn_pattern = "arn:aws:apigateway:${region}::restapis/${resourceId}"

[[infra.resources.items]]
source = "infra/lib/storage-stack.ts"
construct = "DataBucket"
arn_pattern = "arn:aws:s3:::${bucketName}"
```

---

## CLI Commands

### `check-my-toolkit infra validate`

Validates infrastructure against actual AWS resources.

```bash
cmt infra validate                    # Validate current project
cmt infra validate --account prod     # Validate specific account
cmt infra validate --account all      # Validate all accounts
```

**How it works:**
1. Reads `[infra]` config from check.toml
2. Runs `cdk synth` to get expected resources
3. Queries AWS APIs for actual resource state
4. Compares expected vs actual
5. Reports discrepancies

**Options:**
- `--account` - Target account: `dev` | `staging` | `prod` | `all` (default: `dev`)
- `--region` - AWS region (default: from AWS config)
- `--json` - Output as JSON

**Output:**
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
  Source: infra/lib/storage-stack.ts (DataBucket)

ORPHANED: arn:aws:lambda:us-east-1:333333333333:function:old-handler
  Not declared in CDK code

DRIFTED: arn:aws:s3:::my-app-logs
  Attribute: PublicAccessBlockConfiguration.BlockPublicAcls
  Expected: true
  Actual: false
```

---

### `check-my-toolkit infra generate`

Generates resource declarations from CDK code.

```bash
cmt infra generate                    # Auto-discover and output
cmt infra generate --output check.toml --append   # Append to check.toml
```

**How it works:**
1. Runs `cdk synth` to generate CloudFormation templates
2. Parses templates for resource definitions
3. Maps constructs back to source TypeScript files
4. Outputs resource declarations

**Options:**
- `--path` - Path to CDK app (default: from check.toml or `./infra`)
- `--output` - Output file path (default: stdout)
- `--append` - Append to existing check.toml
- `--format` - Output format: `toml` | `json` | `yaml`

---

### `check-my-toolkit infra stacks`

Lists deployed CloudFormation stacks and their resources.

```bash
cmt infra stacks                      # List stacks in default account
cmt infra stacks --account prod       # List stacks in prod
cmt infra stacks --filter "MyApp*"    # Filter by name pattern
```

**Options:**
- `--account` - Target account
- `--region` - AWS region
- `--filter` - Filter by stack name pattern
- `--json` - Output as JSON

---

### `check-my-toolkit infra resources`

Queries AWS for resources matching criteria.

```bash
cmt infra resources --type AWS::S3::Bucket
cmt infra resources --tag Project=my-app
cmt infra resources --orphaned         # Resources not in any stack
```

**Options:**
- `--type` - CloudFormation resource type
- `--account` - Target account
- `--tag` - Filter by tag (e.g., `--tag Project=my-app`)
- `--orphaned` - Show only orphaned resources
- `--json` - Output as JSON

---

## Validation Types

### 1. Missing Resources

Resources declared in CDK but not found in AWS.

```
MISSING: arn:aws:s3:::my-app-data-bucket
  Source: infra/lib/storage-stack.ts (DataBucket)
  Action: Deploy stack or remove from CDK code
```

### 2. Orphaned Resources

Resources in AWS not declared in CDK (potential cleanup candidates).

```
ORPHANED: arn:aws:lambda:us-east-1:333333333333:function:old-handler
  Account: prod
  Created: 2024-01-15
  Action: Delete resource or add to CDK code
```

### 3. Attribute Drift

Resources exist but attributes don't match expected state.

```
DRIFTED: arn:aws:s3:::my-app-logs
  Attribute: PublicAccessBlockConfiguration.BlockPublicAcls
  Expected: true
  Actual: false
  Action: Redeploy stack or investigate manual change
```

---

## Tracked Attributes

Default security-critical attributes monitored for drift:

| Service | Tracked Attributes |
|---------|-------------------|
| S3 | PublicAccessBlockConfiguration, BucketPolicy, Versioning |
| Lambda | Runtime, Timeout, MemorySize, VpcConfig |
| API Gateway | EndpointConfiguration, Policy |
| IAM | PolicyDocument, AssumeRolePolicyDocument |
| RDS | PubliclyAccessible, StorageEncrypted |
| Security Groups | IpPermissions, IpPermissionsEgress |

Custom attributes can be configured in `[infra.tracked_attributes]`.

---

## AWS Authentication

Uses standard AWS credential chain:
- Environment variables (`AWS_ACCESS_KEY_ID`, etc.)
- AWS profiles (`~/.aws/credentials`)
- IAM roles (for CI/CD)

**Multi-account access:**
- Configure named profiles per account
- Or use role assumption

```bash
# Using profiles
AWS_PROFILE=prod cmt infra validate --account prod

# Or configure in check.toml
[infra.accounts]
dev = { account_id = "111...", profile = "dev-profile" }
prod = { account_id = "333...", role_arn = "arn:aws:iam::333...:role/InfraValidator" }
```

---

## Integration with drift-toolkit

drift-toolkit calls check-my-toolkit programmatically for infra scanning:

```typescript
import { validateInfra } from 'check-my-toolkit';

const result = await validateInfra({
  configPath: './check.toml',
  account: 'prod',
});

if (!result.valid) {
  // Create GitHub issue with result.issues
}
```

**drift-toolkit `infra scan` workflow:**
1. Discover repos with `[infra]` in check.toml
2. Call `check-my-toolkit infra validate --account all --json`
3. Parse results
4. Create GitHub issue if violations found

---

## Dependencies

Infra features require additional dependencies (lazy-loaded):
- `@aws-sdk/client-cloudformation`
- `@aws-sdk/client-s3`
- `@aws-sdk/client-lambda`
- `@aws-sdk/client-iam`
- `@aws-sdk/client-resource-groups-tagging-api`
- `aws-cdk-lib` (for synth parsing)

These are optional peer dependencies - only loaded when infra commands are used.

---

## Open Questions

1. **CDK synth requirement** - Should we require `cdk synth` or also support pre-generated templates?
2. **Cross-stack references** - How to handle resources that reference other stacks?
3. **Dynamic resources** - How to handle resources created by custom resources or macros?
4. **Remediation suggestions** - Should we suggest specific fix commands?
5. **Baseline snapshots** - Should we support "accept current state as baseline" for gradual adoption?

---

## Summary

Infra validation in check-my-toolkit:

1. **Define** infrastructure standards in check.toml
2. **Generate** resource declarations from CDK code
3. **Validate** against actual AWS state
4. **Report** missing, orphaned, and drifted resources

drift-toolkit then surfaces these violations via scheduled scans and GitHub issues.
