// Main library exports
export { version } from "./version.js";
export { scan } from "./commands/code/scan.js";
export { registerCodeCommands } from "./commands/code/index.js";

// Types
export type {
  CodeDomainConfig,
  DriftConfig,
  DriftResults,
  ScanDefinition,
  ScanResult,
  IntegrityCheck,
  IntegrityResult,
  DiscoveryPattern,
  DiscoveryResult,
  MetadataSchema,
  RepoContext,
  Severity,
} from "./types.js";

// Config
export {
  loadConfig,
  findConfigPath,
  loadRepoMetadata,
  validateRepoMetadata,
  getCodeConfig,
} from "./config/loader.js";

// Integrity
export {
  checkIntegrity,
  checkAllIntegrity,
  discoverFiles,
} from "./integrity/checker.js";

// Scanner
export { runScan, runAllScans } from "./scanner/runner.js";

// Repo detection
export {
  findMetadataPath,
  parseRepoMetadata,
  getRepoMetadata,
  findCheckTomlFiles,
  hasCheckToml,
  hasMetadata,
  isScannableRepo,
} from "./repo/index.js";

export type {
  RepoTier,
  RepoStatus,
  RepoMetadata,
  ScannabilityResult,
} from "./repo/index.js";

// Change tracking
export {
  isGitRepo,
  getHeadCommit,
  detectCheckTomlChanges,
  getCheckTomlFilesAtCommit,
  compareCheckTomlFiles,
} from "./repo/index.js";

export type { CheckTomlChanges, ChangeDetectionOptions } from "./repo/index.js";
