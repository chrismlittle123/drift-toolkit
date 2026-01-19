/**
 * Centralized constants for the drift scanner.
 * Consolidates all hardcoded values for easier maintenance and configuration.
 */

/**
 * Timeout values in milliseconds
 */
export const TIMEOUTS = {
  /** Default scan command timeout (60 seconds) */
  scanCommand: 60 * 1000,
  /** Git clone operation timeout (60 seconds) */
  gitClone: 60 * 1000,
} as const;

/**
 * Buffer sizes in bytes
 */
export const BUFFERS = {
  /** Maximum buffer for scan command output (10MB) */
  scanOutput: 10 * 1024 * 1024,
  /** Maximum buffer for diff output (1MB) */
  diffOutput: 1 * 1024 * 1024,
} as const;

/**
 * Display limits for terminal output
 */
export const DISPLAY_LIMITS = {
  /** Maximum diff lines to show before truncating */
  diffLines: 20,
  /** Maximum command length to show in warnings */
  commandPreview: 50,
} as const;

/**
 * GitHub API configuration
 */
export const GITHUB_API = {
  /** Base URL for GitHub API */
  baseUrl: "https://api.github.com",
  /** API version header value */
  version: "2022-11-28",
  /** Number of items per page for pagination */
  perPage: 100,
} as const;

/**
 * Concurrency limits
 */
export const CONCURRENCY = {
  /** Maximum repos to scan in parallel */
  maxRepoScans: 5,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  /** Default config repository name for org scanning */
  configRepo: "drift-config",
  /** Default scan timeout in seconds (before conversion to ms) */
  scanTimeoutSeconds: 60,
} as const;

/**
 * File patterns for configuration and metadata
 */
export const FILE_PATTERNS = {
  /** Config file names in order of precedence */
  config: ["drift.config.yaml", "drift.config.yml", "drift.yaml"] as const,
  /** Metadata file names in order of precedence */
  metadata: ["repo-metadata.yaml", "repo-metadata.yml"] as const,
} as const;

/**
 * Branch naming patterns for workflow validation
 */
export const BRANCH_PATTERNS = {
  /** Valid branch types */
  types: ["feature", "fix", "hotfix", "docs"] as const,
  /** Branches excluded from naming validation */
  excluded: ["main", "docs/*"] as const,
} as const;
