import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runScan, runAllScans, formatScanResult } from "./runner.js";
import type { ScanDefinition, ScanResult, RepoContext } from "../types.js";

describe("scanner runner", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-runner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("runScan", () => {
    it("returns pass status for successful command", () => {
      const scan: ScanDefinition = {
        name: "echo-test",
        command: "echo hello",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("pass");
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("hello");
    });

    it("returns fail status for failing command", () => {
      const scan: ScanDefinition = {
        name: "false-test",
        command: "exit 1",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("fail");
      expect(result.exitCode).toBe(1);
    });

    it("skips scan when if_file condition not met", () => {
      const scan: ScanDefinition = {
        name: "conditional-test",
        command: "echo should-not-run",
        if_file: "nonexistent.txt",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("file not found");
    });

    it("runs scan when if_file condition is met", () => {
      writeFileSync(join(testDir, "exists.txt"), "content");
      const scan: ScanDefinition = {
        name: "conditional-test",
        command: "echo file-exists",
        if_file: "exists.txt",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("pass");
      expect(result.stdout).toBe("file-exists");
    });

    it("handles array of if_file conditions", () => {
      writeFileSync(join(testDir, "file1.txt"), "");
      // file2.txt doesn't exist
      const scan: ScanDefinition = {
        name: "multi-condition",
        command: "echo all-exist",
        if_file: ["file1.txt", "file2.txt"],
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("file2.txt");
    });

    it("runs scan when all if_file conditions are met", () => {
      writeFileSync(join(testDir, "file1.txt"), "");
      writeFileSync(join(testDir, "file2.txt"), "");
      const scan: ScanDefinition = {
        name: "multi-condition",
        command: "echo all-exist",
        if_file: ["file1.txt", "file2.txt"],
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("pass");
    });

    it("skips scan when if_command fails", () => {
      const scan: ScanDefinition = {
        name: "command-condition",
        command: "echo should-not-run",
        if_command: "exit 1",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("condition failed");
    });

    it("runs scan when if_command succeeds", () => {
      const scan: ScanDefinition = {
        name: "command-condition",
        command: "echo command-passed",
        if_command: "exit 0",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("pass");
    });

    it("skips scan when tier not in allowed list", () => {
      const scan: ScanDefinition = {
        name: "tier-test",
        command: "echo should-not-run",
        tiers: ["production"],
      };
      const context: RepoContext = { tier: "internal" };
      const result = runScan(scan, testDir, context);
      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("tier 'internal' not in");
    });

    it("runs scan when tier matches", () => {
      const scan: ScanDefinition = {
        name: "tier-test",
        command: "echo tier-matches",
        tiers: ["production", "internal"],
      };
      const context: RepoContext = { tier: "production" };
      const result = runScan(scan, testDir, context);
      expect(result.status).toBe("pass");
    });

    it("skips scan when no tier defined but scan requires tiers", () => {
      const scan: ScanDefinition = {
        name: "tier-required",
        command: "echo should-not-run",
        tiers: ["production"],
      };
      const result = runScan(scan, testDir); // no context
      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("no tier defined");
    });

    it("includes duration in result", () => {
      const scan: ScanDefinition = {
        name: "duration-test",
        command: "echo quick",
      };
      const result = runScan(scan, testDir);
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("includes timestamp in result", () => {
      const scan: ScanDefinition = {
        name: "timestamp-test",
        command: "echo test",
      };
      const result = runScan(scan, testDir);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("captures stderr on failure", () => {
      const scan: ScanDefinition = {
        name: "stderr-test",
        command: "echo error-message >&2 && exit 1",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("fail");
      expect(result.stderr).toContain("error-message");
    });

    it("handles deprecated if property same as if_file", () => {
      const scan: ScanDefinition = {
        name: "deprecated-if",
        command: "echo test",
        if: "missing-file.txt",
      };
      const result = runScan(scan, testDir);
      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("file not found");
    });
  });

  describe("runAllScans", () => {
    it("runs all scans and returns results", () => {
      const scans: ScanDefinition[] = [
        { name: "scan1", command: "echo one" },
        { name: "scan2", command: "echo two" },
      ];
      const results = runAllScans(scans, testDir);
      expect(results).toHaveLength(2);
      expect(results[0].scan).toBe("scan1");
      expect(results[1].scan).toBe("scan2");
    });

    it("returns results in same order as input", () => {
      const scans: ScanDefinition[] = [
        { name: "third", command: "echo 3" },
        { name: "first", command: "echo 1" },
        { name: "second", command: "echo 2" },
      ];
      const results = runAllScans(scans, testDir);
      expect(results.map((r) => r.scan)).toEqual(["third", "first", "second"]);
    });

    it("handles empty scans array", () => {
      const results = runAllScans([], testDir);
      expect(results).toEqual([]);
    });

    it("passes context to each scan", () => {
      const scans: ScanDefinition[] = [
        { name: "tier-scan", command: "echo prod", tiers: ["production"] },
      ];
      const context: RepoContext = { tier: "production" };
      const results = runAllScans(scans, testDir, context);
      expect(results[0].status).toBe("pass");
    });
  });

  describe("formatScanResult", () => {
    it("formats pass result", () => {
      const result: ScanResult = {
        scan: "test-scan",
        status: "pass",
        exitCode: 0,
        duration: 100,
        timestamp: new Date().toISOString(),
      };
      const formatted = formatScanResult(result);
      expect(formatted).toContain("test-scan");
      expect(formatted).toContain("passed");
      expect(formatted).toContain("100ms");
    });

    it("formats fail result with exit code", () => {
      const result: ScanResult = {
        scan: "failing-scan",
        status: "fail",
        exitCode: 1,
        duration: 50,
        timestamp: new Date().toISOString(),
      };
      const formatted = formatScanResult(result);
      expect(formatted).toContain("failing-scan");
      expect(formatted).toContain("failed");
      expect(formatted).toContain("exit 1");
    });

    it("formats skip result with reason", () => {
      const result: ScanResult = {
        scan: "skipped-scan",
        status: "skip",
        duration: 1,
        timestamp: new Date().toISOString(),
        skippedReason: "file not found: config.json",
      };
      const formatted = formatScanResult(result);
      expect(formatted).toContain("skipped-scan");
      expect(formatted).toContain("skipped");
      expect(formatted).toContain("file not found");
    });

    it("formats error result with message", () => {
      const result: ScanResult = {
        scan: "error-scan",
        status: "error",
        duration: 10,
        timestamp: new Date().toISOString(),
        stderr: "command not found",
      };
      const formatted = formatScanResult(result);
      expect(formatted).toContain("error-scan");
      expect(formatted).toContain("error");
      expect(formatted).toContain("command not found");
    });
  });
});
