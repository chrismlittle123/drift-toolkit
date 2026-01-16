// Scan definitions and results

export interface ScanDefinition {
  name: string;
  description?: string;
  command: string;
  if?: string | string[]; // file existence condition
  tiers?: string[];
  outputFormat?: "json" | "text" | "exitcode";
  severity?: Severity;
  timeout?: number; // seconds
}

export interface ScanResult {
  scan: string;
  status: "pass" | "fail" | "skip" | "error";
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  duration: number; // ms
  timestamp: string;
  skippedReason?: string;
}

// Integrity monitoring

export interface IntegrityCheck {
  file: string; // path in target repo
  approved: string; // path to golden version
  severity: Severity;
}

export interface IntegrityResult {
  file: string;
  status: "match" | "drift" | "missing" | "error";
  severity: Severity;
  approvedHash?: string;
  currentHash?: string;
  diff?: string;
  error?: string;
  timestamp: string;
}

export interface DiscoveryPattern {
  pattern: string;
  suggestion: string;
}

export interface DiscoveryResult {
  file: string;
  pattern: string;
  suggestion: string;
  isProtected: boolean;
}

// Metadata schema for validating repo-metadata.yaml

export interface MetadataSchema {
  tiers?: string[];
  teams?: string[];
}

// Configuration

export interface DriftConfig {
  schema?: MetadataSchema;
  integrity?: {
    protected?: IntegrityCheck[];
    discover?: DiscoveryPattern[];
  };
  scans?: ScanDefinition[];
  exclude?: string[]; // repo name patterns to exclude from org scanning
}

// Overall results

export interface DriftResults {
  path: string;
  timestamp: string;
  integrity: IntegrityResult[];
  discovered: DiscoveryResult[];
  scans: ScanResult[];
  summary: {
    integrityPassed: number;
    integrityFailed: number;
    integrityMissing: number;
    discoveredFiles: number;
    scansPassed: number;
    scansFailed: number;
    scansSkipped: number;
  };
}

export type Severity = "critical" | "high" | "medium" | "low";

// Repository context for conditional scans

export interface RepoContext {
  tier?: string;
  team?: string;
  metadata?: Record<string, unknown>;
}

// Organization scanning

export interface RepoScanResult {
  repo: string;
  results: DriftResults;
  error?: string;
}

export interface OrgScanSummary {
  reposScanned: number;
  reposWithIssues: number;
  reposSkipped: number;
  totalIntegrityPassed: number;
  totalIntegrityFailed: number;
  totalIntegrityMissing: number;
  totalScansPassed: number;
  totalScansFailed: number;
}

export interface OrgScanResults {
  org: string;
  configRepo: string;
  timestamp: string;
  repos: RepoScanResult[];
  summary: OrgScanSummary;
}
