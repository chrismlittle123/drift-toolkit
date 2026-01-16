// Main library exports
export { version } from "./version.js";
export { scan } from "./commands/scan.js";

// Types
export type {
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
} from "./config/loader.js";

// Integrity
export {
  checkIntegrity,
  checkAllIntegrity,
  discoverFiles,
} from "./integrity/checker.js";

// Scanner
export { runScan, runAllScans } from "./scanner/runner.js";
