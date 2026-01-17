# Drift

**Monitor repository standards and detect drift across your entire GitHub organization.**

---

## Core Concepts

| Concept       | Description                                               |
| ------------- | --------------------------------------------------------- |
| **Integrity** | Compare files against approved "golden" versions          |
| **Scans**     | Run configurable shell commands against each repo         |
| **Discovery** | Find new files matching patterns that may need protection |
| **Dashboard** | Web UI to explore status across all repos                 |

---

## How It Works

1. Define checks and scans in a central `drift.config.yaml`
2. Optionally, repos can declare tier/team via `repo-metadata.yaml`
3. Drift scans repos locally or across an entire GitHub org/user
4. Results show integrity violations, scan failures, and discovered files
5. Dashboard provides visual exploration of results

---

## Installation

```bash
# Install globally
npm install -g drift-toolkit

# Or run directly with npx
npx drift-toolkit code scan

# Or add to your project
npm install drift-toolkit
```

---

## Quick Start

### Local Repository Scanning

```bash
# 1. Create a config file in your repo
cat > drift.config.yaml << 'EOF'
integrity:
  protected:
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high

scans:
  - name: has-readme
    command: test -f README.md
EOF

# 2. Create the approved version
mkdir -p approved
cp .github/workflows/ci.yml approved/ci.yml

# 3. Run the scan
drift code scan
```

### Organization Scanning

```bash
# 1. Create a drift-config repo in your org with:
#    - drift.config.yaml (config file)
#    - approved/ directory (golden files)

# 2. Scan your entire organization
drift code scan --org my-org --github-token $GITHUB_TOKEN
```

---

## CLI Commands

### `drift code scan`

Scan repositories for drift and compliance issues.

```bash
# Scan current directory
drift code scan

# Scan a specific directory
drift code scan --path /path/to/repo

# Scan entire GitHub org
drift code scan --org my-org

# Scan a single repo in an org
drift code scan --org my-org --repo my-repo

# Scan a GitHub user's repos
drift code scan --org my-username

# Output as JSON
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

### `drift code fix`

Fix drifted files by syncing from approved sources.

```bash
# Fix all drifted files
drift code fix

# Preview what would be fixed (dry run)
drift code fix --dry-run

# Fix a specific file only
drift code fix --file .github/workflows/ci.yml

# Fix using a specific config
drift code fix --config /path/to/drift.config.yaml
```

**Options:**
| Option | Description |
|--------|-------------|
| `-p, --path <path>` | Local directory to fix (default: current directory) |
| `-c, --config <config>` | Path to drift.config.yaml |
| `-f, --file <file>` | Fix a specific file only |
| `-n, --dry-run` | Show what would be fixed without making changes |

**How it works:**

1. Reads the `drift.config.yaml` to find protected files
2. For each drifted or missing file, copies the approved version to the target location
3. Approved files are resolved relative to the config file's directory

For example, if your config is at `/projects/my-repo/drift.config.yaml` and contains:

```yaml
integrity:
  protected:
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
```

Running `drift code fix` will copy `/projects/my-repo/approved/ci.yml` to `/projects/my-repo/.github/workflows/ci.yml`.

---

## Features

### Integrity Checks

Compare files against approved "golden" versions using SHA-256 hashing.

- **Protected files**: Define files that must match an approved version exactly
- **Severity levels**: Assign critical, high, medium, or low severity to each check
- **Diff generation**: See exactly what changed when drift is detected
- **Missing file detection**: Alert when protected files don't exist

### File Discovery

Find new files that may need protection.

- **Glob patterns**: Use patterns like `*.yml` or `**/*.json`
- **Suggestions**: Provide guidance for each discovered file
- **Protection tracking**: Shows if discovered files are already protected

### Scans

Run arbitrary shell commands against repositories.

- **Custom commands**: Run any shell command (npm audit, test scripts, etc.)
- **File conditions**: Only run if specific files exist (`if_file: package.json` or `if_file: [file1, file2]`)
- **Command conditions**: Only run if a shell command succeeds (`if_command: "grep -q 'tier: internal' repo-metadata.yml"`)
- **Tier filtering**: Only run for repos with specific tiers (`tiers: [production]`)
- **Timeout support**: Configure per-scan timeouts (default: 60 seconds)
- **Exit code detection**: Pass/fail based on command exit code
- **Scan descriptions**: Optional description field for documentation
- **Scan severity**: Assign severity levels to scans (critical, high, medium, low)

### Organization Scanning

Scan all repositories across a GitHub org or user account.

- **Auto-discovery**: Lists all repos via GitHub API with pagination
- **Org/User detection**: Automatically detects organization vs user account
- **Single repo mode**: Scan just one specific repo with `--repo`
- **Central config**: Uses a `drift-config` repo for configuration
- **Shallow cloning**: Fast cloning with depth=1 (60-second timeout per clone)
- **Parallel scanning**: Concurrent repo scanning (5 repos at a time)
- **Per-repo isolation**: Errors in one repo don't fail the entire scan
- **Progress reporting**: Real-time status output during org scans
- **Archived repo filtering**: Automatically skips archived and disabled repos
- **Private repo support**: Use GitHub token for private repository access

### Repo Exclusion

Exclude specific repositories from org scanning using glob patterns.

```yaml
# drift.config.yaml
exclude:
  - "drift-config" # Exact name match
  - "*-deprecated" # Suffix pattern
  - "archived-*" # Prefix pattern
  - "test-*" # Another prefix pattern
```

- **Exact matches**: Exclude repos by exact name
- **Glob patterns**: Use `*` wildcards for flexible matching
- **Multiple patterns**: Combine patterns to exclude different repo types
- **Config-based**: Defined centrally in `drift.config.yaml`

### Repo Metadata

Repos can optionally declare metadata for conditional behavior.

```yaml
# repo-metadata.yaml
tier: production
team: platform
```

- **Tier-based filtering**: Scans can target specific tiers
- **Team tracking**: Track ownership for organizational visibility
- **Custom metadata**: Add any additional fields as needed
- **Schema validation**: Define valid values in drift.config.yaml (see below)

### Metadata Schema Validation

Define valid tier and team values in your drift.config.yaml to catch typos and enforce consistency:

```yaml
# drift.config.yaml
schema:
  tiers:
    - production
    - internal
    - prototype
  teams:
    - platform
    - frontend
    - data

scans:
  - name: security-audit
    command: npm audit
    tiers: [production] # Only runs on repos with tier: production
```

When a repo has invalid metadata, Drift shows a warning:

```
⚠ METADATA VALIDATION WARNINGS
──────────────────────────────────────────────────
  ! Unknown tier "producton". Valid tiers: production, internal, prototype
```

This helps catch typos like `tier: producton` that would otherwise silently skip scans.

### Dashboard

Web UI built with Next.js 15, React 19, and Tailwind CSS for exploring scan results.

**Running the Dashboard:**

```bash
# Generate scan results as JSON
drift code scan --org my-org --github-token $GITHUB_TOKEN --json > dashboard/public/scan-results.json

# Start development server
cd dashboard
npm install
npm run dev
# Open http://localhost:3000

# Or build for production
npm run build
npm start
```

**Features:**

- **Overview stats**: Total repos, passing, failing, integrity rates
- **Repos with issues**: Quick view of problematic repositories
- **Repository list**: Sortable table of all scanned repos with status
- **Per-repo details**: Drill into individual repo results
- **Integrity results**: See each file check with status, severity badges, and expandable diffs
- **Scan results**: See each scan with duration, exit codes, and expandable output
- **Discovered files**: View files matching discovery patterns with suggestions
- **GitHub links**: Direct links to repositories
- **Status badges**: Visual indicators for pass/fail/error/drift states

**Data Source:**

The dashboard reads from `public/scan-results.json`. Generate this file by running a scan with `--json` output and redirecting to the dashboard's public directory.

### GitHub Action

Run Drift as part of CI/CD workflows.

```yaml
- uses: chrismlittle123/drift-toolkit@v1
  with:
    org: my-org
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Inputs:**
| Input | Required | Description |
|-------|----------|-------------|
| `org` | Yes | GitHub organization to scan |
| `repo` | No | Specific repository to scan |
| `config-repo` | No | Config repo name (default: drift-config) |
| `github-token` | Yes | GitHub token with repo access |
| `json` | No | Output results as JSON |
| `fail-on-drift` | No | Fail the action if drift is detected (default: true) |

**Outputs:**
| Output | Description |
|--------|-------------|
| `has-drift` | Whether drift was detected (true/false) |
| `repos-scanned` | Number of repositories scanned |
| `repos-with-issues` | Number of repositories with issues |
| `results` | JSON results (if json input is true) |

---

## Configuration

### drift.config.yaml

Central configuration file defining all checks and scans. Supports multiple file names: `drift.config.yaml`, `drift.config.yml`, or `drift.yaml`.

```yaml
integrity:
  # Files that must match approved versions exactly
  protected:
    - file: .github/workflows/release.yml
      approved: approved/release.yml
      severity: critical

    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high

  # Patterns to discover new files
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "Workflow files should be reviewed for protection"

scans:
  # Simple file existence checks
  - name: has-readme
    command: test -f README.md

  - name: has-license
    command: test -f LICENSE

  # Conditional scans (only run if file exists)
  - name: typescript-check
    command: npm run typecheck
    if_file: tsconfig.json

  # Multiple file conditions (all must exist)
  - name: lint-check
    command: npm run lint
    if_file: [package.json, .eslintrc.js]

  # Command conditions (only run if command succeeds)
  - name: internal-gitignore
    description: Internal repos must have .gitignore
    command: test -f .gitignore
    if_command: "grep -q 'tier: internal' repo-metadata.yml"

  # Tier-specific scans with severity
  - name: security-audit
    description: Check for known security vulnerabilities
    command: npm audit --audit-level=high
    if_file: package.json
    tiers: [production]
    severity: critical
    timeout: 120

# Repos to exclude from org scanning (glob patterns supported)
exclude:
  - "*-deprecated"
  - "archived-*"
  - "test-*"
```

### Config Repo Structure (for Organization Scanning)

When scanning a GitHub organization, Drift clones a central config repository (default: `drift-config`) that contains the configuration and approved files. The approved file paths in your config are resolved relative to this repo's root.

**Expected structure:**

```
drift-config/
├── drift.config.yaml          # Main configuration file
├── approved/                   # Directory containing golden files
│   ├── release.yml
│   ├── ci.yml
│   └── dependabot.yml
└── repo-metadata.yaml          # Optional: metadata for the config repo itself
```

**Example config referencing approved files:**

```yaml
# drift.config.yaml
integrity:
  protected:
    - file: .github/workflows/release.yml # Path in target repos
      approved: approved/release.yml # Path in config repo
      severity: critical
```

When Drift scans `my-org/some-repo`, it compares `some-repo/.github/workflows/release.yml` against `drift-config/approved/release.yml`.

### repo-metadata.yaml

Optional per-repo metadata for conditional scan filtering. Supports both `repo-metadata.yaml` and `repo-metadata.yml`.

```yaml
tier: production # or: internal, prototype, archived
team: platform
```

---

## Output Formats

### Human-readable (default)

```
Drift v0.3.0
Target: /path/to/repo

INTEGRITY CHECKS
──────────────────────────────────────────────────
  ✓ .github/workflows/release.yml - ok
  ✗ .github/workflows/ci.yml - DRIFT DETECTED (high)

SCAN RESULTS
──────────────────────────────────────────────────
  ✓ has-readme - passed (5ms)
  ✗ lint-check - failed (exit 1, 1234ms)

SUMMARY
──────────────────────────────────────────────────
  Integrity: 1/2 passed, 1 drifted
  Scans: 1/2 passed, 1 failed

✗ INTEGRITY VIOLATIONS DETECTED
```

### JSON (--json)

```json
{
  "path": "/path/to/repo",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "integrity": [...],
  "discovered": [...],
  "scans": [...],
  "summary": {
    "integrityPassed": 1,
    "integrityFailed": 1,
    "integrityMissing": 0,
    "discoveredFiles": 2,
    "scansPassed": 1,
    "scansFailed": 1,
    "scansSkipped": 0
  }
}
```

### Exit Codes

| Code | Meaning                         |
| ---- | ------------------------------- |
| `0`  | All checks passed               |
| `1`  | Drift detected or scan failures |

---

## Severity Levels

| Level      | Use Case                                     |
| ---------- | -------------------------------------------- |
| `critical` | Security-sensitive files, CI/CD pipelines    |
| `high`     | Important config files, build scripts        |
| `medium`   | Standard documentation, non-critical configs |
| `low`      | Nice-to-have consistency, style files        |

---

## Security

- **Token sanitization**: GitHub tokens are never exposed in error messages (supports Bearer, PAT, and GitHub token patterns)
- **Dangerous command detection**: Validates scan commands against 15+ dangerous patterns (file deletion, credential exposure, reverse shells, privilege escalation)
- **Safe file operations**: Uses `execFileSync` to avoid shell injection
- **Zod validation**: All configs validated against strict schemas
- **Rate limit handling**: Automatic retry with exponential backoff for GitHub API rate limits
- **Buffer limits**: Output buffers capped at 10MB for scans, 1MB for diffs

---

## Programmatic Usage

```typescript
import {
  scan,
  loadConfig,
  loadRepoMetadata,
  validateRepoMetadata,
  checkIntegrity,
  checkAllIntegrity,
  discoverFiles,
  runScan,
  runAllScans,
} from "drift-toolkit";
import type {
  DriftConfig,
  DriftResults,
  IntegrityCheck,
  ScanDefinition,
  MetadataSchema,
  RepoContext,
} from "drift-toolkit";

// Run a full scan (returns DriftResults)
const results: DriftResults = await scan({
  path: "/path/to/repo",
  config: "/path/to/drift.config.yaml", // optional
  json: false, // optional
});

// Load configuration
const config: DriftConfig | null = loadConfig("/path/to/config/dir");

// Check a single file's integrity
const check: IntegrityCheck = {
  file: ".github/workflows/ci.yml",
  approved: "approved/ci.yml",
  severity: "high",
};
const integrityResult = checkIntegrity(check, "/repo", "/approved-base-path");

// Check all protected files
const allIntegrityResults = checkAllIntegrity(
  config.integrity?.protected || [],
  "/repo",
  "/approved-base-path"
);

// Discover files matching patterns
const discovered = discoverFiles(
  config.integrity?.discover || [],
  "/repo",
  config.integrity?.protected || []
);

// Run a single scan
const scanDef: ScanDefinition = { name: "test", command: "npm test" };
const scanResult = runScan(scanDef, "/repo");

// Run all scans with context
const allScanResults = runAllScans(
  config.scans || [],
  "/repo",
  { tier: "production", team: "platform" } // optional RepoContext
);
```

---

## Implementation Status

| Feature                         | Status      |
| ------------------------------- | ----------- |
| CLI (`drift code scan`, `drift code fix`) | ✅ Complete |
| Integrity checks                | ✅ Complete |
| File discovery                  | ✅ Complete |
| Custom scans                    | ✅ Complete |
| Conditional scans (if)          | ✅ Complete |
| Tier-based filtering            | ✅ Complete |
| Org/user scanning               | ✅ Complete |
| Parallel repo scanning          | ✅ Complete |
| GitHub Action                   | ✅ Complete |
| Dashboard                       | ✅ Complete |
| JSON output                     | ✅ Complete |
| Security validation             | ✅ Complete |
| Rate limit handling             | ✅ Complete |
| Metadata schema validation      | ✅ Complete |

---

## Not In Scope (Yet)

- Scan history tracking over time
- PR creation for auto-fixes
- Per-repo workflow (push-based scanning)
- Non-GitHub support (GitLab, Bitbucket)
- Dashboard filtering by tier/team
- Drift trend analytics

---

## Requirements

- Node.js >= 20
- Git (for cloning repos)
- GitHub token (for org scanning)

### GitHub Token Permissions

When scanning GitHub organizations, you need a token with appropriate permissions:

| Scope         | Required For                                             |
| ------------- | -------------------------------------------------------- |
| `repo`        | Access to private repositories                           |
| `read:org`    | List organization repositories                           |
| `public_repo` | Access to public repositories only (if no private repos) |

**Creating a token:**

1. Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Select the organization you want to scan
3. Grant "Repository access" to "All repositories" (or specific repos)
4. Under "Repository permissions", set:
   - **Contents**: Read-only (to clone and read files)
   - **Metadata**: Read-only (required for all tokens)

**For GitHub Actions**, use `${{ secrets.GITHUB_TOKEN }}` which automatically has access to repos in the workflow's context, or create a PAT/GitHub App for cross-repo access.
