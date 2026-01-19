# Changelog

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
