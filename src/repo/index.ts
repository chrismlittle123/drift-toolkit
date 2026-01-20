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
  type FileChangeStatus,
  // Functions
  isGitRepo,
  getHeadCommit,
  getChangedFiles,
  detectCheckTomlChanges,
  getCheckTomlFilesAtCommit,
  compareCheckTomlFiles,
} from "./changes.js";

export {
  // Types
  type DependencyChangeStatus,
  type DependencyChange,
  type DependencyChanges,
  type DependencyChangeOptions,
  // Functions
  detectDependencyChanges,
  getTrackedDependencyFiles,
} from "./dependency-changes.js";

export {
  // Types
  type TimeWindowOptions,
  type RecentCommit,
  type RecentChanges,
  // Functions
  getRecentCommits,
  getChangedFilesInCommits,
  detectRecentChanges,
} from "./recent-changes.js";

export {
  // Types
  type DependencyMap,
  type CmDependenciesOutput,
  type GetDependenciesOptions,
  type GetDependenciesResult,
  // Functions
  isCmInstalled,
  parseCmOutput,
  getDependencies,
  clearDependencyCache,
} from "./dependencies.js";

export {
  // Types
  type FileDiff,
  type FileDiffOptions,
  // Functions
  generateFileDiff,
  generateMultipleDiffs,
  formatDiffForMarkdown,
} from "./diff.js";
