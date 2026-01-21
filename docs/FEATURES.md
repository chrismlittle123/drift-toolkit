# drift-toolkit Features

> **Version:** 1.14.1
> **Last Updated:** 2026-01-21

This document lists all current features of drift-toolkit. It is automatically updated when PRs are created.

## CLI Commands

### `drift code scan`

Scan repositories for code integrity and run compliance checks.

```bash
# Scan current directory
drift code scan

# Scan a specific local path
drift code scan --path /path/to/repo

# Scan with custom config
drift code scan --config ./my-drift.config.yaml

# Scan a GitHub organization
drift code scan --org myorg

# Scan a single repo in an organization
drift code scan --org myorg --repo myrepo

# Output results as JSON
drift code scan --json
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Local directory to scan (default: current directory) |
| `-c, --config <config>` | Path to drift.config.yaml |
| `-o, --org <org>` | GitHub organization or username to scan |
| `-r, --repo <repo>` | Single repository to scan (requires --org) |
| `--config-repo <repo>` | Config repo name (default: drift-config) |
| `--github-token <token>` | GitHub token (or set GITHUB_TOKEN env var) |
| `--json` | Output results as JSON |
| `-n, --dry-run` | Show what issues would be created without creating them |
| `-a, --all` | Scan all repos regardless of commit activity (org scan only) |
| `--since <hours>` | Hours to look back for commits (default: 24, org scan only) |

### `drift code fix`

Fix drifted files by syncing from approved sources.

```bash
# Fix all drifted files
drift code fix

# Dry run (show what would be fixed)
drift code fix --dry-run

# Fix a specific file
drift code fix --file CODEOWNERS
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Local directory to fix (default: current directory) |
| `-c, --config <config>` | Path to drift.config.yaml |
| `-f, --file <file>` | Fix a specific file only |
| `-n, --dry-run` | Show what would be fixed without making changes |

---

## Organization Scanning Features

### Smart Scanning

By default, organization-wide scans only check repositories with commits to `main` or `master` in the last 24 hours. This dramatically reduces scan time for large organizations.

```bash
# Default: only scan repos with recent commits (last 24h)
drift code scan --org myorg

# Scan all repos regardless of activity
drift code scan --org myorg --all

# Custom time window (e.g., last 48 hours)
drift code scan --org myorg --since 48
```

The commit check uses the GitHub Commits API before cloning, so inactive repositories are filtered without any disk I/O.

### Pre-Clone Filtering

Before cloning repositories, drift-toolkit checks via the GitHub Content API whether each repo has the required files:

- `repo-metadata.yaml` (or `.yml`)
- `check.toml`

Repositories missing either file are skipped during org-wide scans, avoiding unnecessary clones.

### GitHub Actions Annotations

When running in GitHub Actions, drift-toolkit outputs workflow commands for enhanced CI visibility:

- `::error::` annotations for failures (config not found, drift detected)
- `::warning::` annotations for repos with issues
- `::notice::` annotations for successful runs

These annotations appear in the GitHub Actions summary and file views.

---

## Library API

drift-toolkit exports a programmatic API for integration into other tools.

### Repository Detection

Functions to detect if a repository is scannable by drift-toolkit.

```typescript
import {
  isScannableRepo,
  getRepoMetadata,
  findCheckTomlFiles,
  hasCheckToml,
  hasMetadata,
} from "drift-toolkit";

// Check if a repo is scannable (has both repo-metadata.yaml and check.toml)
const result = isScannableRepo("/path/to/repo");
// { scannable: true, hasMetadata: true, hasCheckToml: true, ... }

// Get parsed repository metadata
const metadata = getRepoMetadata("/path/to/repo");
// { metadata: { tier: "production", status: "active", team: "platform" }, warnings: [] }

// Find all check.toml files (including monorepo subdirectories)
const files = findCheckTomlFiles("/path/to/repo");
// ["check.toml", "packages/api/check.toml", "packages/web/check.toml"]
```

**Types:**

- `RepoTier`: `"production" | "internal" | "prototype"`
- `RepoStatus`: `"active" | "pre-release" | "deprecated"`
- `RepoMetadata`: Parsed metadata with tier, status, team, and raw fields
- `ScannabilityResult`: Result of scanning a repo for scannability

### Project Detection

Detect projects (including monorepo packages) that are missing check.toml configuration.

```typescript
import { detectMissingProjects, detectAllProjects } from "drift-toolkit";

// Detect projects without check.toml (uses cm projects detect)
const missing = detectMissingProjects("/path/to/repo");
// [{ path: "packages/new-api", type: "typescript" }, ...]

// Get full project detection output
const all = detectAllProjects("/path/to/repo");
// { projects: [...], workspaceRoots: [...], summary: { total, withConfig, missingConfig } }
```

**Types:**

- `MissingProject`: Project path and type
- `MissingProjectsDetection`: Detection result with repository, scan time, and projects
- `CmProjectsOutput`: Full output from `cm projects detect`

### Change Tracking

Git-based change detection for check.toml files.

```typescript
import {
  detectCheckTomlChanges,
  compareCheckTomlFiles,
  getCheckTomlFilesAtCommit,
  isGitRepo,
  getHeadCommit,
} from "drift-toolkit";

// Check if path is a git repository
const isRepo = isGitRepo("/path/to/repo"); // true

// Get current HEAD commit SHA
const sha = getHeadCommit("/path/to/repo"); // "abc123..."

// Detect check.toml changes since a base commit
const changes = detectCheckTomlChanges("/path/to/repo", {
  baseCommit: "abc123",
  targetCommit: "HEAD",
});
// { added: [], modified: ["check.toml"], deleted: [], hasChanges: true }

// List check.toml files at a specific commit
const files = getCheckTomlFilesAtCommit("/path/to/repo", "HEAD~5");
// ["check.toml", "packages/api/check.toml"]

// Compare check.toml files between two commits
const diff = compareCheckTomlFiles("/path/to/repo", "main", "feature-branch");
// { added: ["packages/new/check.toml"], modified: [], deleted: [], hasChanges: true }
```

**Types:**

- `CheckTomlChanges`: Result with added, modified, deleted arrays and hasChanges flag
- `ChangeDetectionOptions`: Options for baseCommit and targetCommit

### Dependency Change Detection

Detect changes to all configuration files tracked by `cm dependencies` (eslint configs, tsconfigs, workflow files, etc.).

```typescript
import {
  detectDependencyChanges,
  getTrackedDependencyFiles,
} from "drift-toolkit";

// Get list of all tracked dependency files
const files = getTrackedDependencyFiles("/path/to/repo");
// ["check.toml", ".eslintrc.js", "tsconfig.json", ".github/workflows/*.yml"]

// Detect changes to dependency files between commits
const changes = detectDependencyChanges("/path/to/repo", {
  baseCommit: "HEAD~1",
  targetCommit: "HEAD",
});
// {
//   changes: [{ file: ".eslintrc.js", status: "modified", checkType: "eslint", alwaysTracked: false }],
//   byCheck: { eslint: [...] },
//   alwaysTrackedChanges: [...],
//   totalTrackedFiles: 10,
//   hasChanges: true
// }
```

When changes are detected during org scans, a GitHub issue is created with:

- File diffs grouped by check type (eslint, tsc, etc.)
- Links to the commit
- Action items for investigation

**Types:**

- `DependencyChanges`: Result with changes, byCheck grouping, and hasChanges flag
- `DependencyChange`: Single file change with checkType and alwaysTracked info
- `DependencyChangesDetection`: Issue format with diffs included

### Integrity Checking

Compare files against approved versions to detect drift.

```typescript
import {
  checkIntegrity,
  checkAllIntegrity,
  discoverFiles,
} from "drift-toolkit";

// Check a single file
const result = checkIntegrity(
  { file: "CODEOWNERS", approved: "approved/CODEOWNERS", severity: "critical" },
  "/path/to/repo",
  "/path/to/approved"
);
// { file: "CODEOWNERS", status: "match" | "drift" | "missing", ... }

// Check multiple files
const results = checkAllIntegrity(checks, targetPath, approvedPath);

// Discover files matching patterns (e.g., find new workflow files)
const discovered = discoverFiles(
  [{ pattern: ".github/workflows/*.yml", suggestion: "Consider protecting" }],
  "/path/to/repo",
  ["ci.yml"] // already protected
);
```

### Scanning

Run custom scan commands against repositories.

```typescript
import { runScan, runAllScans } from "drift-toolkit";

// Run a single scan
const result = runScan(
  {
    name: "eslint",
    command: "npm run lint",
    if_file: "package.json",
    severity: "high",
  },
  "/path/to/repo",
  { tier: "production" } // optional context for tier filtering
);
// { scan: "eslint", status: "pass" | "fail" | "skip", exitCode: 0, ... }
```

### Configuration

Load and validate drift configuration.

```typescript
import { loadConfig, findConfigPath, getCodeConfig } from "drift-toolkit";

// Find config file
const configPath = findConfigPath("/path/to/repo");

// Load configuration
const config = loadConfig("/path/to/config/dir");

// Get code domain config
const codeConfig = getCodeConfig(config);
```

---

## Configuration Schema

### drift.config.yaml

```yaml
# Optional: Define valid metadata values for validation
schema:
  tiers: [production, internal, prototype]
  teams: [platform, mobile, web]

# Integrity checks - compare files against approved versions
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high

  # Discover new files that might need protection
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "New workflow detected - consider adding to protected list"

# Custom scans to run
scans:
  - name: eslint
    description: Run ESLint
    command: npm run lint
    if_file: package.json # Skip if file doesn't exist
    severity: high
    timeout: 120 # seconds

  - name: typescript
    command: npm run typecheck
    if_file: tsconfig.json
    tiers: [production, internal] # Only run on these tiers

  - name: security-audit
    command: npm audit
    if_command: "test -f package-lock.json" # Skip if command fails

# Exclude repos from org-wide scanning (glob patterns)
exclude:
  - "*-archived"
  - "legacy-*"
```

### repo-metadata.yaml

Repository metadata file that defines tier and status.

```yaml
tier: production # production | internal | prototype
status: active # active | pre-release | deprecated
team: platform # optional team ownership
```

---

## Exported Types

```typescript
// Scan types
export type { ScanDefinition, ScanResult } from "drift-toolkit";

// Integrity types
export type {
  IntegrityCheck,
  IntegrityResult,
  DiscoveryPattern,
  DiscoveryResult,
} from "drift-toolkit";

// Config types
export type {
  DriftConfig,
  CodeDomainConfig,
  MetadataSchema,
  RepoContext,
} from "drift-toolkit";

// Result types
export type {
  DriftResults,
  OrgScanResults,
  RepoScanResult,
  OrgScanSummary,
} from "drift-toolkit";

// Severity levels
export type { Severity } from "drift-toolkit"; // "critical" | "high" | "medium" | "low"

// Repo detection types
export type {
  RepoTier,
  RepoStatus,
  RepoMetadata,
  ScannabilityResult,
} from "drift-toolkit";

// Change tracking types
export type { CheckTomlChanges, ChangeDetectionOptions } from "drift-toolkit";

// Project detection types
export type {
  MissingProject,
  MissingProjectsDetection,
  CmProjectsOutput,
} from "drift-toolkit";

// Dependency change types
export type {
  DependencyChanges,
  DependencyChange,
  DependencyChangesDetection,
  DependencyFileChange,
} from "drift-toolkit";
```

---

## Constants

Available constants for integration:

```typescript
import {
  TIMEOUTS, // { scanCommand: 60000, gitClone: 60000 }
  BUFFERS, // { scanOutput: 10MB, diffOutput: 1MB }
  DISPLAY_LIMITS, // { diffLines: 20, commandPreview: 50 }
  GITHUB_API, // { baseUrl, version, perPage }
  CONCURRENCY, // { maxRepoScans: 5 }
  DEFAULTS, // { configRepo: "drift-config", scanTimeoutSeconds: 60, commitWindowHours: 24 }
  FILE_PATTERNS, // { config: [...], metadata: [...], checkToml: "check.toml" }
  BRANCH_PATTERNS, // { types: [...], excluded: [...] }
  GITHUB_ISSUES, // { maxBodyLength, driftLabel, driftTitle, ... }
  WORKFLOW_PATTERNS, // { patterns: [".github/workflows/*.yml", ...] }
} from "drift-toolkit/constants";
```

---

## Test Coverage

- **Repository Detection:** 35 tests
- **Project Detection:** 9 tests
- **Change Tracking:** 29 tests
- **Dependency Change Detection:** 17 tests
- **Issue Formatting:** 30 tests
- **Total Tests:** 866
- **Minimum Coverage:** 80% for `src/repo/**`
