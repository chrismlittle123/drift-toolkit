import { describe, it, expect, beforeEach } from "vitest";
import {
  createEmptySummary,
  createEmptyResults,
  createEmptyOrgSummary,
  updateIntegritySummary,
  updateScanSummary,
  hasIssues,
  updateOrgSummaryFromRepo,
} from "./results.js";
import type {
  DriftResults,
  IntegrityResult,
  ScanResult,
  OrgScanSummary,
} from "../types.js";

describe("results utilities", () => {
  describe("createEmptySummary", () => {
    it("creates summary with all counters at zero", () => {
      const summary = createEmptySummary();
      expect(summary).toEqual({
        integrityPassed: 0,
        integrityFailed: 0,
        integrityMissing: 0,
        discoveredFiles: 0,
        scansPassed: 0,
        scansFailed: 0,
        scansSkipped: 0,
      });
    });

    it("returns a new object each time", () => {
      const summary1 = createEmptySummary();
      const summary2 = createEmptySummary();
      expect(summary1).not.toBe(summary2);
    });
  });

  describe("createEmptyResults", () => {
    it("creates results with given path", () => {
      const results = createEmptyResults("/test/path");
      expect(results.path).toBe("/test/path");
    });

    it("creates results with empty arrays", () => {
      const results = createEmptyResults("/test");
      expect(results.integrity).toEqual([]);
      expect(results.discovered).toEqual([]);
      expect(results.scans).toEqual([]);
    });

    it("creates results with empty summary", () => {
      const results = createEmptyResults("/test");
      expect(results.summary.integrityPassed).toBe(0);
      expect(results.summary.scansFailed).toBe(0);
    });

    it("creates results with ISO timestamp", () => {
      const results = createEmptyResults("/test");
      expect(results.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("createEmptyOrgSummary", () => {
    it("creates org summary with all counters at zero", () => {
      const summary = createEmptyOrgSummary();
      expect(summary).toEqual({
        reposScanned: 0,
        reposWithIssues: 0,
        reposSkipped: 0,
        totalIntegrityPassed: 0,
        totalIntegrityFailed: 0,
        totalIntegrityMissing: 0,
        totalScansPassed: 0,
        totalScansFailed: 0,
      });
    });
  });

  describe("updateIntegritySummary", () => {
    let summary: DriftResults["summary"];

    beforeEach(() => {
      summary = createEmptySummary();
    });

    it("increments integrityPassed for match status", () => {
      const results: IntegrityResult[] = [
        {
          file: "a.txt",
          status: "match",
          severity: "high",
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          file: "b.txt",
          status: "match",
          severity: "high",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateIntegritySummary(summary, results);
      expect(summary.integrityPassed).toBe(2);
    });

    it("increments integrityFailed for drift status", () => {
      const results: IntegrityResult[] = [
        {
          file: "a.txt",
          status: "drift",
          severity: "high",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateIntegritySummary(summary, results);
      expect(summary.integrityFailed).toBe(1);
    });

    it("increments integrityMissing for missing status", () => {
      const results: IntegrityResult[] = [
        {
          file: "a.txt",
          status: "missing",
          severity: "critical",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateIntegritySummary(summary, results);
      expect(summary.integrityMissing).toBe(1);
    });

    it("counts error status as failure", () => {
      const results: IntegrityResult[] = [
        {
          file: "a.txt",
          status: "error",
          severity: "medium",
          error: "failed",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateIntegritySummary(summary, results);
      expect(summary.integrityFailed).toBe(1);
    });

    it("handles mixed results", () => {
      const results: IntegrityResult[] = [
        {
          file: "a.txt",
          status: "match",
          severity: "high",
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          file: "b.txt",
          status: "drift",
          severity: "high",
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          file: "c.txt",
          status: "missing",
          severity: "high",
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          file: "d.txt",
          status: "error",
          severity: "high",
          error: "err",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateIntegritySummary(summary, results);
      expect(summary.integrityPassed).toBe(1);
      expect(summary.integrityFailed).toBe(2); // drift + error
      expect(summary.integrityMissing).toBe(1);
    });

    it("handles empty results array", () => {
      updateIntegritySummary(summary, []);
      expect(summary.integrityPassed).toBe(0);
      expect(summary.integrityFailed).toBe(0);
      expect(summary.integrityMissing).toBe(0);
    });
  });

  describe("updateScanSummary", () => {
    let summary: DriftResults["summary"];

    beforeEach(() => {
      summary = createEmptySummary();
    });

    it("increments scansPassed for pass status", () => {
      const results: ScanResult[] = [
        {
          scan: "lint",
          status: "pass",
          exitCode: 0,
          duration: 100,
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          scan: "test",
          status: "pass",
          exitCode: 0,
          duration: 200,
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateScanSummary(summary, results);
      expect(summary.scansPassed).toBe(2);
    });

    it("increments scansFailed for fail status", () => {
      const results: ScanResult[] = [
        {
          scan: "lint",
          status: "fail",
          exitCode: 1,
          duration: 100,
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateScanSummary(summary, results);
      expect(summary.scansFailed).toBe(1);
    });

    it("increments scansSkipped for skip status", () => {
      const results: ScanResult[] = [
        {
          scan: "optional",
          status: "skip",
          skippedReason: "no config",
          duration: 0,
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateScanSummary(summary, results);
      expect(summary.scansSkipped).toBe(1);
    });

    it("counts error status as failure", () => {
      const results: ScanResult[] = [
        {
          scan: "broken",
          status: "error",
          stderr: "command not found",
          duration: 0,
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateScanSummary(summary, results);
      expect(summary.scansFailed).toBe(1);
    });

    it("handles mixed results", () => {
      const results: ScanResult[] = [
        {
          scan: "lint",
          status: "pass",
          exitCode: 0,
          duration: 100,
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          scan: "test",
          status: "fail",
          exitCode: 1,
          duration: 200,
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          scan: "optional",
          status: "skip",
          skippedReason: "not needed",
          duration: 0,
          timestamp: "2024-01-01T00:00:00Z",
        },
        {
          scan: "broken",
          status: "error",
          stderr: "timeout",
          duration: 0,
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      updateScanSummary(summary, results);
      expect(summary.scansPassed).toBe(1);
      expect(summary.scansFailed).toBe(2); // fail + error
      expect(summary.scansSkipped).toBe(1);
    });

    it("handles empty results array", () => {
      updateScanSummary(summary, []);
      expect(summary.scansPassed).toBe(0);
      expect(summary.scansFailed).toBe(0);
      expect(summary.scansSkipped).toBe(0);
    });
  });

  describe("hasIssues", () => {
    it("returns false for clean results", () => {
      const results = createEmptyResults("/test");
      results.summary.integrityPassed = 5;
      results.summary.scansPassed = 3;
      expect(hasIssues(results)).toBe(false);
    });

    it("returns true when integrityFailed > 0", () => {
      const results = createEmptyResults("/test");
      results.summary.integrityFailed = 1;
      expect(hasIssues(results)).toBe(true);
    });

    it("returns true when integrityMissing > 0", () => {
      const results = createEmptyResults("/test");
      results.summary.integrityMissing = 1;
      expect(hasIssues(results)).toBe(true);
    });

    it("returns true when scansFailed > 0", () => {
      const results = createEmptyResults("/test");
      results.summary.scansFailed = 1;
      expect(hasIssues(results)).toBe(true);
    });

    it("returns true when multiple issues exist", () => {
      const results = createEmptyResults("/test");
      results.summary.integrityFailed = 2;
      results.summary.integrityMissing = 1;
      results.summary.scansFailed = 3;
      expect(hasIssues(results)).toBe(true);
    });

    it("ignores scansSkipped", () => {
      const results = createEmptyResults("/test");
      results.summary.scansSkipped = 5;
      expect(hasIssues(results)).toBe(false);
    });
  });

  describe("updateOrgSummaryFromRepo", () => {
    let orgSummary: OrgScanSummary;

    beforeEach(() => {
      orgSummary = createEmptyOrgSummary();
    });

    it("increments reposScanned", () => {
      const results = createEmptyResults("/repo");
      updateOrgSummaryFromRepo(orgSummary, results);
      expect(orgSummary.reposScanned).toBe(1);
    });

    it("accumulates integrity counts", () => {
      const results = createEmptyResults("/repo");
      results.summary.integrityPassed = 3;
      results.summary.integrityFailed = 1;
      results.summary.integrityMissing = 2;
      updateOrgSummaryFromRepo(orgSummary, results);
      expect(orgSummary.totalIntegrityPassed).toBe(3);
      expect(orgSummary.totalIntegrityFailed).toBe(1);
      expect(orgSummary.totalIntegrityMissing).toBe(2);
    });

    it("accumulates scan counts", () => {
      const results = createEmptyResults("/repo");
      results.summary.scansPassed = 5;
      results.summary.scansFailed = 2;
      updateOrgSummaryFromRepo(orgSummary, results);
      expect(orgSummary.totalScansPassed).toBe(5);
      expect(orgSummary.totalScansFailed).toBe(2);
    });

    it("increments reposWithIssues when repo has issues", () => {
      const results = createEmptyResults("/repo");
      results.summary.scansFailed = 1;
      updateOrgSummaryFromRepo(orgSummary, results);
      expect(orgSummary.reposWithIssues).toBe(1);
    });

    it("does not increment reposWithIssues for clean repo", () => {
      const results = createEmptyResults("/repo");
      results.summary.integrityPassed = 5;
      results.summary.scansPassed = 3;
      updateOrgSummaryFromRepo(orgSummary, results);
      expect(orgSummary.reposWithIssues).toBe(0);
    });

    it("accumulates across multiple repos", () => {
      const results1 = createEmptyResults("/repo1");
      results1.summary.integrityPassed = 2;
      results1.summary.scansPassed = 1;

      const results2 = createEmptyResults("/repo2");
      results2.summary.integrityPassed = 3;
      results2.summary.scansFailed = 1;

      updateOrgSummaryFromRepo(orgSummary, results1);
      updateOrgSummaryFromRepo(orgSummary, results2);

      expect(orgSummary.reposScanned).toBe(2);
      expect(orgSummary.totalIntegrityPassed).toBe(5);
      expect(orgSummary.totalScansPassed).toBe(1);
      expect(orgSummary.totalScansFailed).toBe(1);
      expect(orgSummary.reposWithIssues).toBe(1);
    });
  });
});
