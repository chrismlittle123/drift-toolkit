/**
 * Repository utilities for drift-toolkit
 */

export {
  // Types
  type RepoTier,
  type RepoStatus,
  type RepoMetadata,
  type ScannabilityResult,
  // Functions
  findMetadataPath,
  parseRepoMetadata,
  getRepoMetadata,
  findCheckTomlFiles,
  hasCheckToml,
  hasMetadata,
  isScannableRepo,
} from "./detection.js";

export {
  // Types
  type CheckTomlChanges,
  type ChangeDetectionOptions,
  // Functions
  isGitRepo,
  getHeadCommit,
  detectCheckTomlChanges,
  getCheckTomlFilesAtCommit,
  compareCheckTomlFiles,
} from "./changes.js";
