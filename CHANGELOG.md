# Changelog

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
