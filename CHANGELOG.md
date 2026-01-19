# Changelog

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
