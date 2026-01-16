// Types mirrored from main drift project

export type Severity = "critical" | "high" | "medium" | "low";

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

export interface DiscoveryResult {
  file: string;
  pattern: string;
  suggestion: string;
  isProtected: boolean;
}

export interface ScanResult {
  scan: string;
  status: "pass" | "fail" | "skip" | "error";
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  duration: number;
  timestamp: string;
  skippedReason?: string;
}

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
