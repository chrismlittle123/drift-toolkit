# Scans Roadmap

Scans are the core of Drift - configurable checks that run against each repository to detect drift, issues, and gather information. Drift is designed to be **general-purpose**: you can define any scan and collect any data.

---

## Priority Feature: File Integrity Monitoring

> **This is a critical security feature.** Certain files (CODEOWNERS, check.toml, workflow files, etc.) should be protected and any unauthorized changes detected immediately.

### Why This Matters

- **CODEOWNERS** controls who can approve PRs - unauthorized changes = security risk
- **check.toml / config files** define standards - drift here undermines compliance
- **GitHub Actions workflows** can run arbitrary code - must be monitored
- **Security policies** should not change without explicit approval

### How It Works

```
Central Drift Repo                    Target Repos
├── approved/                         ├── CODEOWNERS  ←── compare
│   ├── CODEOWNERS (golden)  ─────────┤
│   ├── check.toml (golden)  ─────────├── check.toml  ←── compare
│   └── .github/workflows/            └── .github/workflows/
│       └── release.yml      ─────────    └── release.yml  ←── compare
```

### Capabilities

| Capability             | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| **Integrity checks**   | Detect any changes to protected files vs approved versions |
| **Hash comparison**    | Fast detection via SHA comparison                          |
| **Diff reporting**     | Show exactly what changed                                  |
| **New file discovery** | Periodically find files that _should_ be protected         |
| **Severity levels**    | Critical alerts for high-risk file changes                 |
| **Approval workflow**  | Track which changes were approved vs unauthorized          |

### Configuration

```yaml
# drift.config.yaml
integrity:
  # Files that must match exactly
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical

    - file: check.toml
      approved: approved/check.toml
      severity: high

    - file: .github/workflows/release.yml
      approved: approved/workflows/release.yml
      severity: critical

  # Patterns to discover new files that might need protection
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "Workflow files should be reviewed for protection"
    - pattern: "**/CODEOWNERS"
      suggestion: "CODEOWNERS files should be protected"
    - pattern: "**/*.toml"
      suggestion: "Config files may need protection"
```

### Output

```
$ drift code scan --org my-org

INTEGRITY CHECK RESULTS
=======================

my-org/api-service
  CRITICAL: CODEOWNERS has unauthorized changes
    - Line 12: removed @security-team
    - Line 15: added @unknown-user

  OK: check.toml matches approved version

my-org/frontend
  OK: All protected files match approved versions

NEW FILES DETECTED (may need protection)
========================================
  my-org/api-service/.github/workflows/deploy-prod.yml
    → Consider adding to protected files list

SUMMARY: 1 critical integrity violation, 1 new file to review
```

---

## Phase 1: Core Scanning (MVP)

- [x] Define scans in `drift.config.yaml`
- [x] Run arbitrary shell commands as scans
- [x] Capture command exit code (pass/fail)
- [x] Capture command stdout/stderr
- [x] Store scan results in `repos.json`
- [x] Run scans via GitHub Actions on schedule

---

## Phase 2: File Integrity Monitoring

- [ ] Define protected files in `drift.config.yaml`
- [ ] Store approved/golden versions in central repo
- [ ] SHA-256 hash comparison for fast detection
- [ ] Full diff output when hash mismatch detected
- [ ] Severity levels (critical, high, medium, low)
- [ ] Discovery mode: find new files matching patterns
- [ ] Suggest files that should be added to protection list
- [ ] Track "last approved" timestamp per file

---

## Phase 3: Conditional Scans

- [ ] Skip scan if file doesn't exist (`if: package.json`)
- [ ] Skip scan based on repo tier (`tiers: [production]`)
- [ ] Skip scan based on repo metadata (`if: metadata.language == 'typescript'`)
- [ ] Support multiple conditions with AND/OR logic
- [ ] Skip archived repos by default

---

## Phase 4: Output Parsing

- [ ] Parse JSON output from scans automatically
- [ ] Define expected output schema per scan
- [ ] Extract specific fields from scan output
- [ ] Support severity levels from scan output (critical, high, medium, low)
- [ ] Count-based thresholds (fail if > N issues)
- [ ] Regex-based pass/fail conditions

---

## Phase 5: Built-in Scans

- [ ] **File existence**: Check for required files (README, LICENSE, etc.)
- [ ] **Branch hygiene**: Stale branches, unprotected default branch
- [ ] **PR health**: Stale PRs, PRs without reviewers
- [ ] **Secret detection**: Scan for exposed credentials
- [ ] **Dependency freshness**: Outdated dependencies

All built-in scans should be optional and overridable.

---

## Phase 6: Scan History & Trends

- [ ] Store historical scan results (not just latest)
- [ ] Track when scans started/stopped failing
- [ ] Track when protected files were last verified
- [ ] Calculate drift velocity (getting better or worse?)
- [ ] Retention policy for historical data
- [ ] Export scan history for external analysis

---

## Phase 7: Advanced Execution

- [ ] Parallel scan execution across repos
- [ ] Timeout per scan with configurable limits
- [ ] Retry failed scans with backoff
- [ ] Scan dependencies (run scan B only if scan A passes)
- [ ] Scan groups/tags for selective execution
- [ ] Dry-run mode (show what would run)

---

## Phase 8: Custom Scan Types

- [ ] HTTP endpoint scans (health checks, API validation)
- [ ] GraphQL query scans (GitHub API queries)
- [ ] File content scans (regex patterns in files)
- [ ] Aggregate scans (cross-repo analysis)

---

## Data Model

```typescript
interface ScanDefinition {
  name: string;
  description?: string;
  command: string;

  // Conditions
  if?: string | string[]; // file existence
  tiers?: string[]; // only these tiers
  when?: string; // expression

  // Output handling
  outputFormat?: "json" | "text" | "exitcode";
  severity?: "critical" | "high" | "medium" | "low";

  // Execution
  timeout?: number; // seconds
  retries?: number;
  continueOnError?: boolean;
}

interface IntegrityCheck {
  file: string; // path in target repo
  approved: string; // path to golden version
  severity: "critical" | "high" | "medium" | "low";
}

interface IntegrityResult {
  file: string;
  repo: string;
  status: "match" | "drift" | "missing" | "error";
  approvedHash: string;
  currentHash?: string;
  diff?: string; // unified diff if drifted
  timestamp: string;
}

interface DiscoveryPattern {
  pattern: string; // glob pattern
  suggestion: string; // why this might need protection
}

interface ScanResult {
  scan: string;
  repo: string;
  status: "pass" | "fail" | "skip" | "error";
  exitCode: number;
  stdout: string;
  stderr: string;
  parsedOutput?: unknown; // if JSON
  duration: number; // ms
  timestamp: string;
}
```

---

## Configuration Examples

```yaml
# drift.config.yaml

# Priority: File Integrity Monitoring
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical

    - file: check.toml
      approved: approved/check.toml
      severity: high

    - file: .github/workflows/release.yml
      approved: approved/workflows/release.yml
      severity: critical

    - file: .github/workflows/ci.yml
      approved: approved/workflows/ci.yml
      severity: high

  # Find new files that might need protection
  discover:
    - pattern: ".github/workflows/*.yml"
      suggestion: "New workflow detected - review for protection"
    - pattern: "**/CODEOWNERS"
      suggestion: "CODEOWNERS should always be protected"

scans:
  # Run any command
  - name: npm-audit
    command: npm audit --json
    if: package.json
    outputFormat: json

  # Custom script
  - name: check-config
    command: ./scripts/validate-config.sh
    tiers: [production]

  # Check file exists
  - name: has-readme
    command: test -f README.md

  # Flexible - run anything
  - name: custom-linter
    command: npx my-custom-tool --report
    timeout: 300

  # Gather info (not just pass/fail)
  - name: repo-stats
    command: |
      echo '{"stars": '$(gh api repos/{repo} --jq .stargazers_count)', "issues": '$(gh api repos/{repo} --jq .open_issues_count)'}'
    outputFormat: json
```
