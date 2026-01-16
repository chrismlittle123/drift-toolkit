/**
 * Utilities for creating and summarizing drift results.
 * Consolidates duplicate summary calculation logic.
 */

import type {
  DriftResults,
  IntegrityResult,
  ScanResult,
  OrgScanSummary,
} from "../types.js";

/**
 * Create an empty summary object with all counters at zero
 */
export function createEmptySummary(): DriftResults["summary"] {
  return {
    integrityPassed: 0,
    integrityFailed: 0,
    integrityMissing: 0,
    discoveredFiles: 0,
    scansPassed: 0,
    scansFailed: 0,
    scansSkipped: 0,
  };
}

/**
 * Create an empty drift results object
 *
 * @param path - The path being scanned
 * @returns A new DriftResults object with empty arrays and zero counters
 */
export function createEmptyResults(path: string): DriftResults {
  return {
    path,
    timestamp: new Date().toISOString(),
    integrity: [],
    discovered: [],
    scans: [],
    summary: createEmptySummary(),
  };
}

/**
 * Create an empty organization scan summary
 */
export function createEmptyOrgSummary(): OrgScanSummary {
  return {
    reposScanned: 0,
    reposWithIssues: 0,
    reposSkipped: 0,
    totalIntegrityPassed: 0,
    totalIntegrityFailed: 0,
    totalIntegrityMissing: 0,
    totalScansPassed: 0,
    totalScansFailed: 0,
  };
}

/**
 * Update summary counts from integrity results
 *
 * @param summary - The summary object to update (mutated in place)
 * @param results - Array of integrity results to count
 */
export function updateIntegritySummary(
  summary: DriftResults["summary"],
  results: IntegrityResult[]
): void {
  for (const result of results) {
    switch (result.status) {
      case "match":
        summary.integrityPassed++;
        break;
      case "drift":
        summary.integrityFailed++;
        break;
      case "missing":
        summary.integrityMissing++;
        break;
      case "error":
        // Errors are counted as failures
        summary.integrityFailed++;
        break;
    }
  }
}

/**
 * Update summary counts from scan results
 *
 * @param summary - The summary object to update (mutated in place)
 * @param results - Array of scan results to count
 */
export function updateScanSummary(
  summary: DriftResults["summary"],
  results: ScanResult[]
): void {
  for (const result of results) {
    switch (result.status) {
      case "pass":
        summary.scansPassed++;
        break;
      case "fail":
        summary.scansFailed++;
        break;
      case "skip":
        summary.scansSkipped++;
        break;
      case "error":
        // Errors are counted as failures
        summary.scansFailed++;
        break;
    }
  }
}

/**
 * Check if drift results have any issues (failures or missing files)
 */
export function hasIssues(results: DriftResults): boolean {
  return (
    results.summary.integrityFailed > 0 ||
    results.summary.integrityMissing > 0 ||
    results.summary.scansFailed > 0
  );
}

/**
 * Update organization summary totals from a single repo's results
 *
 * @param orgSummary - The org summary to update (mutated in place)
 * @param repoResults - The repo's drift results to add
 */
export function updateOrgSummaryFromRepo(
  orgSummary: OrgScanSummary,
  repoResults: DriftResults
): void {
  orgSummary.reposScanned++;
  orgSummary.totalIntegrityPassed += repoResults.summary.integrityPassed;
  orgSummary.totalIntegrityFailed += repoResults.summary.integrityFailed;
  orgSummary.totalIntegrityMissing += repoResults.summary.integrityMissing;
  orgSummary.totalScansPassed += repoResults.summary.scansPassed;
  orgSummary.totalScansFailed += repoResults.summary.scansFailed;
  if (hasIssues(repoResults)) {
    orgSummary.reposWithIssues++;
  }
}
