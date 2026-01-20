# Changelog

## 1.14.0

### Minor Changes

- 677df0e: feat: integrate dependency change detection into org scan workflow

  When running `drift code scan --org`, the tool now detects changes to dependency files (eslint configs, tsconfigs, workflow files, etc.) tracked by `cm dependencies`. When changes are detected, a GitHub issue is created with:
  - File diffs grouped by check type (eslint, tsc, etc.)
  - Links to the commit
  - Action items for investigation

  This completes Milestone 2 from the code.md spec.

## 1.13.0

### Minor Changes

- a5df732: Add GitHub Actions error reporting with workflow command annotations

## 1.12.2

### Patch Changes

- c9e1373: Add documentation for GitHub token requirements and configuration

## 1.12.1

### Patch Changes

- c33ee8d: Add org/repo targeting inputs and documentation for manual workflow runs

## 1.12.0

### Minor Changes

- 38b4df0: Add example GitHub Action workflow for scheduled drift code scanning

## 1.11.0

### Minor Changes

- d76db15: Add smart scanning with 24h commit window for org scans
  - Only scan repos with commits to main/master in the last 24 hours (configurable)
  - Add `--all` flag to scan all repos regardless of commit activity
  - Add `--since <hours>` option to customize the time window
  - Uses GitHub Commits API to check for recent activity before cloning

## 1.10.0

### Minor Changes

- eb79bb1: Add pre-clone filtering to only scan repos with required metadata files
  - Add `fileExists()` and `isRepoScannable()` functions to check for `repo-metadata.yaml` and `check.toml` via GitHub API before cloning
  - Skip repos missing required files with "missing required files" message
  - Add tier-ruleset mismatch detection and issue creation
  - Reduces unnecessary clone operations during org-wide scanning

## 1.9.1

### Patch Changes

- 37c4fd5: Update FEATURES.md documentation with project detection feature and current test coverage.

## 1.9.0

### Minor Changes

- 35bb0a7: Add new project detection via `cm projects detect` command. This feature surfaces projects (including monorepo packages) that are missing `check.toml` configuration and creates GitHub issues with actionable guidance.

  New exports:
  - `detectMissingProjects(repoPath)` - Detect projects without check.toml
  - `detectAllProjects(repoPath)` - Get full project detection output
  - `MissingProject` and `MissingProjectsDetection` types
  - `CmProjectsOutput` type

## 1.8.1

### Patch Changes

- 09990a1: Improve metadata loading error handling to distinguish between different failure modes.

  Previously, `parseRepoMetadata` and `getRepoMetadata` returned `null` for empty files, invalid YAML, and non-object content, making debugging difficult. Now these functions return default metadata with descriptive warnings:
  - Empty file: "File is empty, using default values"
  - Invalid YAML syntax: "Failed to parse YAML: <error>, using default values"
  - Non-object content: "Invalid metadata format (expected object, got <type>), using default values"

  `getRepoMetadata` now only returns `null` when the file doesn't exist. For all other error cases, it returns default metadata (tier: internal, status: active) with appropriate warnings.

## 1.8.0

### Minor Changes

- 60d7b55: Add automatic tracking of GitHub Actions workflow files (.github/workflows/_.yml and .github/workflows/_.yaml) as always-tracked files, independent of cm dependencies output.

## 1.7.2

### Patch Changes

- a3765ea: Re-enable typescript-internal registry and add gitleaks allowlist for test files

## 1.7.1

### Patch Changes

- d8291a5: Add branch protection configuration to require CI checks to pass before merging PRs
- 52f100b: Enable enforce_admins for branch protection to block direct pushes to main
- ba45320: Add TypeScript naming convention rules to ESLint configuration
- d158aa7: Remove branch protection config from check.toml (managed via GitHub Rulesets)
- 467542f: Revert enforce_admins to allow release workflow to push to main

## 1.7.0

### Minor Changes

- c658a46: Add diff generation for changed files with generateFileDiff(), supporting truncation, GitHub URLs, and markdown formatting.

## 1.6.0

### Minor Changes

- 91ec249: Add dependency file change detection that tracks all configuration files from cm dependencies, not just check.toml. Includes grouping by check type and glob pattern support.

## 1.5.0

### Minor Changes

- 04bede5: Add cm dependencies integration for tracking configuration files
  - New `getDependencies()` function to get tracked config files from check-my-toolkit
  - Supports filtering by check type and monorepo projects
  - Includes caching for scan session performance
  - Graceful error handling for cm not installed or network issues

## 1.4.2

### Patch Changes

- 5af92b6: Fix ESLint no-undef error for Buffer in checker.test.ts

## 1.4.1

### Patch Changes

- d6252ff: Fix linting errors from issue creation feature (max-params, no-undef, prettier)

## 1.4.0

### Minor Changes

- 4c204dd: Add GitHub issue creation for detected drift
  - Create GitHub issues automatically when configuration drift is detected during org scans
  - Issues include diffs of changed files with truncation for large diffs
  - Add `--dry-run` flag to preview what issues would be created without creating them
  - Issue format: title `[drift:code] Configuration changes detected`, label `drift:code`

## 1.3.3

### Patch Changes

- 1db97a2: Fix TypeScript compilation errors in test files by adding missing required properties to test fixtures.

## 1.3.2

### Patch Changes

- 17c8b28: Improve test coverage to 94%+ across all metrics by adding comprehensive unit tests for utilities, scanner, integrity checker, GitHub API functions, and fix command.

## 1.3.1

### Patch Changes

- 8d9ed32: Security hardening and test coverage improvements
  - Fix token exposure by using GIT_ASKPASS instead of URL embedding
  - Add safeJoinPath to config loader to prevent path traversal
  - Replace execSync with execFileSync via shared git utility
  - Add try-finally cleanup for guaranteed temp directory removal
  - Add verbose logging option for skipped directories
  - Set 80% coverage thresholds in vitest config
  - Add tests for client.ts, loader.ts, and scan.ts (69 new tests)

## 1.3.0

### Minor Changes

- 075c94a: Add time-window based git change detection
  - Add `getRecentCommits()` to get commits within a time window (default 24h)
  - Add `getChangedFilesInCommits()` to extract changed files from commits
  - Add `detectRecentChanges()` convenience function combining both
  - New types: `TimeWindowOptions`, `RecentCommit`, `RecentChanges`
  - Supports both `main` and `master` branches automatically

## 1.2.1

### Patch Changes

- 3277398: Add FEATURES.md documentation and PR hook
  - Add docs/FEATURES.md with comprehensive documentation of all CLI commands, library API, types, and configuration options
  - Add Claude hook to remind about updating FEATURES.md when creating PRs with src/ changes

## 1.2.0

### Minor Changes

- 6da14ad: Add check.toml change tracking utilities
  - Add `detectCheckTomlChanges()` to detect added/modified/deleted check.toml files
  - Add `compareCheckTomlFiles()` for comprehensive change comparison between commits
  - Add `getCheckTomlFilesAtCommit()` to list check.toml files at a specific commit
  - Add `isGitRepo()` and `getHeadCommit()` git utilities
  - Export new types: `CheckTomlChanges`, `ChangeDetectionOptions`

## 1.1.0

### Minor Changes

- 16e7e05: Add repository detection utilities for identifying scannable repositories
  - Add `isScannableRepo()` to check if a repo has both repo-metadata.yaml and check.toml
  - Add `getRepoMetadata()` to parse tier and status from repo-metadata.yaml
  - Add `findCheckTomlFiles()` to discover check.toml files in monorepos
  - Add `hasMetadata()` and `hasCheckToml()` helper functions
  - Export new types: `RepoTier`, `RepoStatus`, `RepoMetadata`, `ScannabilityResult`

## 1.0.2

### Patch Changes

- 7544b32: Add BRANCH_PATTERNS constant for workflow validation reference

## 1.0.1

### Patch Changes

- 23e710e: Integrate check-my-toolkit for code quality checks
  - Simplify pre-push hook to only run branch name validation
  - Move linting, type checking, and code quality checks to CI via check-my-toolkit
  - Rename dashboard components to kebab-case for naming convention compliance
  - Update CI workflow to run cm code audit, cm code check, and cm process check

## 1.0.0

### Breaking Changes

- **CLI Restructure**: Commands are now nested under domain groups
  - `drift scan` → `drift code scan`
  - `drift fix` → `drift code fix`

### Features

- **Domain-based command structure**: Prepares for future `drift process` and `drift infra` domains
- **Nested config format**: New `code:` section for domain-aware configuration (legacy flat format still supported)
- **CodeDomainConfig type**: New type for domain-specific configuration

### Changes

- Add `src/commands/code/` directory structure
- Add `getCodeConfig()` helper for normalizing config formats
- Extract security validation to `src/config/security.ts`
- Update all tests for new command structure

## 0.0.4

### Patch Changes

- deeb010: Align ESLint config with typescript-internal registry and refactor long functions

## 0.0.3

### Minor Changes

- Add `if_file` for file existence conditions (replaces deprecated `if`)
- Add `if_command` for shell command conditions (run scan only if command exits 0)

## 0.0.2

### Patch Changes

- Update package description

## 0.0.1

Initial release of drift-toolkit.

### Features

- **Integrity Checks** - Compare files against approved "golden" versions using SHA-256 hashing
- **File Discovery** - Find new files matching patterns that may need protection
- **Custom Scans** - Run arbitrary shell commands against repositories with configurable conditions
- **Organization Scanning** - Scan all repositories across a GitHub org or user account
- **GitHub Action** - Run drift-toolkit as part of CI/CD workflows
- **Dashboard** - Web UI for exploring scan results
- **CLI Commands** - `drift scan` and `drift fix` for local and remote scanning
- **Repo Metadata** - Optional per-repo metadata for conditional scan filtering
- **JSON Output** - Machine-readable output format for integration with other tools
