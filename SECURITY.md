# Security Policy

## Security Model

Drift executes shell commands defined in configuration files (`drift.config.yaml`). Understanding the security model is crucial for safe usage.

### Trust Boundaries

1. **Configuration Source**: The `drift.config.yaml` file is trusted. Scan commands defined in this file are executed with full shell capabilities. **Only use configuration from trusted sources.**

2. **Organization Scanning**: When scanning a GitHub organization, the configuration is loaded from a central `drift-config` repository. Ensure this repository has appropriate access controls:
   - Limit write access to trusted maintainers
   - Enable branch protection rules
   - Require code review for configuration changes

3. **Local Scanning**: When running `drift scan` locally, the configuration is loaded from the current directory or a specified path. Be cautious when running drift in untrusted directories.

### Command Execution

Scan commands are executed using Node.js `execSync` with shell interpretation enabled. This means:

- Shell features (pipes, redirects, subshells) work as expected
- Command injection is possible if configuration is untrusted
- Commands run with the same permissions as the drift process

### Automatic Security Validation

Drift includes automatic security validation that warns about potentially dangerous command patterns:

- Commands that delete files from root directories
- Commands that execute remote code (`curl | bash`)
- Commands that require elevated privileges (`sudo`)
- Commands with embedded credentials
- Commands that modify system files

These warnings are displayed before execution. **Review warnings carefully before proceeding.**

### Mitigations

1. **Token Sanitization**: GitHub tokens are automatically removed from error messages to prevent accidental exposure in logs.

2. **Webhook Validation**: Slack webhook URLs are validated to ensure they point to legitimate Slack endpoints.

3. **Rate Limiting**: GitHub API calls include automatic retry with exponential backoff to handle rate limits gracefully.

4. **Shallow Cloning**: Repositories are cloned with `--depth 1` to minimize data exposure and improve performance.

5. **Temp Directory Cleanup**: Cloned repositories are stored in temp directories and cleaned up after scanning.

## Reporting Security Issues

If you discover a security vulnerability, please report it by:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly with details
3. Allow reasonable time for a fix before public disclosure

## Best Practices

### For Configuration Authors

```yaml
# GOOD: Simple, safe commands
scans:
  - name: has-readme
    command: test -f README.md

  - name: npm-test
    command: npm test
    if: package.json

# BAD: Avoid these patterns
scans:
  - name: dangerous
    command: curl https://example.com/script.sh | bash  # Executes remote code!

  - name: destructive
    command: rm -rf /tmp/*  # Could affect other processes
```

### For Organization Administrators

1. **Protect the drift-config repository**:

   ```
   Settings > Branches > Add rule
   - Branch name pattern: main
   - Require pull request reviews
   - Require status checks
   - Restrict who can push
   ```

2. **Use a dedicated GitHub token** with minimal permissions:
   - `repo` scope for private repositories
   - `public_repo` scope for public repositories only

3. **Audit configuration changes** regularly

4. **Review security warnings** in CI/CD output

### For CI/CD Integration

1. Store tokens as secrets, never in code
2. Use the official GitHub Action with proper input handling
3. Consider running in a sandboxed environment
4. Review scan output for security warnings

## Security Changelog

### v0.2.0

- Added command security validation with pattern detection
- Implemented GitHub API rate limiting with retry
- Fixed command injection in GitHub Action
- Added parallel scanning with concurrency limits

### v0.1.0

- Initial release with token sanitization
- Webhook URL validation
- Safe file operations using execFileSync for diffs
