# infra-toolkit Specification

> A CDK utilities package for generating and validating infrastructure manifests.

## Purpose

infra-toolkit bridges the gap between CDK code and actual AWS resources. It answers:
- "What resources **should** exist according to my CDK code?"
- "Do they match what **actually** exists in AWS?"

---

## Role in the Ecosystem

| Package | Role |
|---------|------|
| `check-my-toolkit` | Defines standards |
| `infra-toolkit` | Generates expected infra state |
| `drift-toolkit` | Detects drift (consumes infra-toolkit output) |

**infra-toolkit is generative.** It produces manifests from CDK code.
**drift-toolkit is detective.** It compares manifests to reality.

---

## Core Concepts

### Infrastructure Manifest

A manifest declares the expected AWS resources for a project.

**Location:** Lives in the application repo, typically alongside the `infra/` directory.

**Format:** TypeScript config that maps CDK constructs to AWS ARNs.

```typescript
// infra-manifest.ts
import { InfraManifest } from 'infra-toolkit';

export const manifest: InfraManifest = {
  project: 'my-app',
  stacks: ['MyAppStack'],
  accounts: {
    dev: '111111111111',
    staging: '222222222222',
    prod: '333333333333',
  },
  resources: [
    {
      source: 'infra/lib/api-stack.ts',
      construct: 'ApiGateway',
      arnPattern: 'arn:aws:apigateway:${region}::restapis/${resourceId}',
    },
    {
      source: 'infra/lib/storage-stack.ts',
      construct: 'DataBucket',
      arnPattern: 'arn:aws:s3:::${bucketName}',
    },
  ],
};
```

### Dynamic ARN Resolution

ARNs vary across accounts (dev/staging/prod). The manifest uses patterns that resolve dynamically:
- Query CloudFormation stack outputs
- Parse deployed stack resources
- Map logical IDs to physical resource IDs

---

## CLI Commands

### `infra-toolkit manifest generate`

Generates a manifest from CDK code.

```bash
infra-toolkit manifest generate --path ./infra --output ./infra-manifest.ts
```

**How it works:**
1. Runs `cdk synth` to generate CloudFormation templates
2. Parses templates for resource definitions
3. Maps constructs back to source TypeScript files
4. Outputs manifest with ARN patterns

**Options:**
- `--path` - Path to CDK app directory (default: `./infra`)
- `--output` - Output manifest file path
- `--format` - Output format: `typescript` | `json` | `yaml`

---

### `infra-toolkit manifest validate`

Validates manifest against actual AWS resources.

```bash
infra-toolkit manifest validate --manifest ./infra-manifest.ts --account prod
```

**How it works:**
1. Loads manifest file
2. Resolves ARN patterns for specified account
3. Queries AWS APIs to check resource existence
4. Compares resource attributes against expected state
5. Reports discrepancies

**Options:**
- `--manifest` - Path to manifest file
- `--account` - Target account: `dev` | `staging` | `prod` | `all`
- `--region` - AWS region (default: from AWS config)
- `--json` - Output as JSON

**Output:**
```json
{
  "valid": false,
  "resources": {
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
      "construct": "DataBucket"
    },
    {
      "type": "orphaned",
      "arn": "arn:aws:lambda:us-east-1:333333333333:function:old-handler",
      "note": "Resource exists in AWS but not in manifest"
    },
    {
      "type": "drifted",
      "arn": "arn:aws:s3:::my-app-logs",
      "attribute": "PublicAccessBlockConfiguration",
      "expected": { "BlockPublicAcls": true },
      "actual": { "BlockPublicAcls": false }
    }
  ]
}
```

---

### `infra-toolkit stacks list`

Lists deployed CloudFormation stacks and their resources.

```bash
infra-toolkit stacks list --account prod --region us-east-1
```

**Options:**
- `--account` - Target account
- `--region` - AWS region
- `--filter` - Filter by stack name pattern
- `--json` - Output as JSON

---

### `infra-toolkit resources query`

Queries AWS for resources matching criteria.

```bash
infra-toolkit resources query --type AWS::S3::Bucket --account prod
```

**Options:**
- `--type` - CloudFormation resource type
- `--account` - Target account
- `--tag` - Filter by tag (e.g., `--tag Project=my-app`)
- `--json` - Output as JSON

---

## Manifest Schema

### TypeScript Interface

```typescript
interface InfraManifest {
  // Project identifier
  project: string;

  // CloudFormation stack names to track
  stacks: string[];

  // AWS account mapping
  accounts: {
    dev: string;
    staging: string;
    prod: string;
  };

  // Resource declarations
  resources: ResourceDeclaration[];
}

interface ResourceDeclaration {
  // Source file where construct is defined
  source: string;

  // CDK construct name/ID
  construct: string;

  // ARN pattern with variables
  arnPattern: string;

  // Optional: specific attributes to track for drift
  trackedAttributes?: string[];

  // Optional: tags that should exist on resource
  expectedTags?: Record<string, string>;
}
```

---

## Integration with drift-toolkit

drift-toolkit calls infra-toolkit programmatically:

```typescript
import { validateManifest } from 'infra-toolkit';

const result = await validateManifest({
  manifestPath: './infra-manifest.ts',
  account: 'prod',
});

if (!result.valid) {
  // Create GitHub issue with result.issues
}
```

---

## Integration with CDK

infra-toolkit parses CDK in two ways:

### 1. CloudFormation Template Parsing

After `cdk synth`, parse the generated templates:
- Extract resource logical IDs
- Map to CloudFormation resource types
- Generate ARN patterns from resource definitions

### 2. CDK Metadata (Future)

Leverage CDK's construct tree metadata:
- Source file mappings
- Construct paths
- Custom metadata annotations

---

## AWS API Usage

infra-toolkit queries AWS using:
- **CloudFormation** - Stack resources, outputs, drift detection
- **Resource Groups Tagging API** - Find resources by tags
- **Service-specific APIs** - S3, Lambda, API Gateway, etc. for attribute queries

**Authentication:**
- Uses standard AWS credential chain
- Supports AWS profiles for multi-account
- Assumes appropriate IAM roles per account

---

## Attribute Drift Detection

Not all attributes matter equally. infra-toolkit focuses on security-critical attributes:

| Service | Tracked Attributes |
|---------|-------------------|
| S3 | PublicAccessBlockConfiguration, BucketPolicy, Versioning |
| Lambda | Runtime, Timeout, MemorySize, VpcConfig |
| API Gateway | EndpointConfiguration, Policy |
| IAM | PolicyDocument, AssumeRolePolicyDocument |
| RDS | PubliclyAccessible, StorageEncrypted |
| Security Groups | IpPermissions, IpPermissionsEgress |

Custom tracked attributes can be specified per resource in the manifest.

---

## Future Considerations

### Terraform Support

The manifest concept could extend to Terraform:
- Parse `terraform state` output
- Compare HCL definitions to state
- Support Terraform Cloud/Enterprise state backends

### Pulumi Support

Similar approach for Pulumi:
- Query Pulumi state
- Parse Pulumi TypeScript/Python definitions

### Multi-Region

Support resources deployed across multiple regions:
```typescript
accounts: {
  prod: {
    accountId: '333333333333',
    regions: ['us-east-1', 'eu-west-1'],
  },
}
```

---

## Open Questions

1. **Manifest generation accuracy** - How reliably can we map synth output back to source files?
2. **Cross-stack references** - How to handle resources that reference other stacks?
3. **Dynamic resources** - How to handle resources created by custom resources or macros?
4. **Drift severity** - Should some attribute drift be warnings vs errors?
5. **Remediation** - Should infra-toolkit suggest fixes, or is that out of scope?

---

## Summary

infra-toolkit is the bridge between infrastructure-as-code and reality:

1. **Generate** manifests from CDK code
2. **Validate** manifests against AWS
3. **Report** discrepancies for drift-toolkit to surface

It keeps the complexity of CDK/CloudFormation parsing isolated from drift-toolkit's detection logic.
