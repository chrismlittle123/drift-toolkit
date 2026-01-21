// Metadata schema for validating repo-metadata.yaml

export interface MetadataSchema {
  tiers?: string[];
  teams?: string[];
}

// Configuration

export interface DriftConfig {
  schema?: MetadataSchema;
  exclude?: string[]; // repo name patterns to exclude from org scanning
}

// Repository context for metadata validation

export interface RepoContext {
  tier?: string;
  team?: string;
  metadata?: Record<string, unknown>;
}

// Overall results

export interface DriftResults {
  path: string;
  timestamp: string;
}

// Organization scanning

export interface RepoScanResult {
  repo: string;
  results: DriftResults;
  missingProjects?: MissingProject[];
  tierValidation?: TierValidationResult;
  dependencyChanges?: DependencyChangesDetection;
  error?: string;
}

export interface OrgScanSummary {
  reposScanned: number;
  reposWithIssues: number;
  reposSkipped: number;
}

export interface OrgScanResults {
  org: string;
  configRepo: string;
  timestamp: string;
  repos: RepoScanResult[];
  summary: OrgScanSummary;
}

// GitHub issue creation

export interface DriftIssueResult {
  created: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}

// New project detection (projects missing check.toml)

export interface MissingProject {
  path: string;
  type: string; // "typescript", "python", etc.
}

export interface MissingProjectsDetection {
  repository: string;
  scanTime: string;
  projects: MissingProject[];
}

// Tier validation (tier-ruleset alignment)

export interface TierValidationResult {
  valid: boolean;
  tier: string;
  rulesets: string[];
  expectedPattern: string;
  matchedRulesets: string[];
  error?: string;
}

export interface TierMismatchDetection {
  repository: string;
  scanTime: string;
  tier: string;
  rulesets: string[];
  expectedPattern: string;
  error: string;
}

// Dependency file changes detection

export interface DependencyFileChange {
  file: string;
  status: "added" | "modified" | "deleted";
  checkType: string | null;
  diff?: string;
}

export interface DependencyChangesDetection {
  repository: string;
  scanTime: string;
  commit: string;
  commitUrl: string;
  changes: DependencyFileChange[];
  byCheck: Record<string, DependencyFileChange[]>;
}
