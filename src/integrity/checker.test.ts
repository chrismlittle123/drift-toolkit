import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  checkIntegrity,
  checkAllIntegrity,
  discoverFiles,
  formatIntegrityResult,
} from "./checker.js";
import type {
  IntegrityCheck,
  IntegrityResult,
  DiscoveryPattern,
} from "../types.js";

describe("integrity checker", () => {
  let testDir: string;
  let repoDir: string;
  let approvedDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-integrity-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    repoDir = join(testDir, "repo");
    approvedDir = join(testDir, "approved");
    mkdirSync(repoDir, { recursive: true });
    mkdirSync(approvedDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("checkIntegrity", () => {
    it("returns match when files are identical", () => {
      const content = "identical content";
      writeFileSync(join(repoDir, "config.json"), content);
      writeFileSync(join(approvedDir, "config.json"), content);

      const check: IntegrityCheck = {
        file: "config.json",
        approved: "config.json",
        severity: "high",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("match");
      expect(result.approvedHash).toBe(result.currentHash);
    });

    it("returns drift when files differ", () => {
      writeFileSync(join(repoDir, "config.json"), "current content");
      writeFileSync(join(approvedDir, "config.json"), "approved content");

      const check: IntegrityCheck = {
        file: "config.json",
        approved: "config.json",
        severity: "high",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("drift");
      expect(result.approvedHash).not.toBe(result.currentHash);
      expect(result.diff).toBeDefined();
    });

    it("returns missing when current file does not exist", () => {
      writeFileSync(join(approvedDir, "config.json"), "approved content");
      // Don't create the repo file

      const check: IntegrityCheck = {
        file: "config.json",
        approved: "config.json",
        severity: "critical",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("missing");
      expect(result.severity).toBe("critical");
    });

    it("returns error when approved file does not exist", () => {
      writeFileSync(join(repoDir, "config.json"), "current content");
      // Don't create the approved file

      const check: IntegrityCheck = {
        file: "config.json",
        approved: "config.json",
        severity: "high",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("error");
      expect(result.error).toContain("Approved file not found");
    });

    it("handles different file paths for repo and approved", () => {
      mkdirSync(join(repoDir, "src"), { recursive: true });
      writeFileSync(join(repoDir, "src/config.json"), "content");
      mkdirSync(join(approvedDir, "golden"), { recursive: true });
      writeFileSync(join(approvedDir, "golden/config.json"), "content");

      const check: IntegrityCheck = {
        file: "src/config.json",
        approved: "golden/config.json",
        severity: "medium",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("match");
    });

    it("includes timestamp in result", () => {
      writeFileSync(join(repoDir, "file.txt"), "content");
      writeFileSync(join(approvedDir, "file.txt"), "content");

      const check: IntegrityCheck = {
        file: "file.txt",
        approved: "file.txt",
        severity: "low",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("returns error for path traversal attempts", () => {
      const check: IntegrityCheck = {
        file: "../../../etc/passwd",
        approved: "config.json",
        severity: "critical",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("error");
      expect(result.error).toContain("Security error");
    });

    it("includes diff output for drifted files", () => {
      writeFileSync(join(repoDir, "file.txt"), "line1\nline2\n");
      writeFileSync(join(approvedDir, "file.txt"), "line1\nline3\n");

      const check: IntegrityCheck = {
        file: "file.txt",
        approved: "file.txt",
        severity: "high",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("drift");
      expect(result.diff).toBeDefined();
      // Diff should show the difference
      expect(result.diff).toMatch(/-line2|-line3|\+line2|\+line3/);
    });

    it("handles binary files", () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff]);
      writeFileSync(join(repoDir, "binary.bin"), binaryContent);
      writeFileSync(join(approvedDir, "binary.bin"), binaryContent);

      const check: IntegrityCheck = {
        file: "binary.bin",
        approved: "binary.bin",
        severity: "high",
      };
      const result = checkIntegrity(check, repoDir, approvedDir);
      expect(result.status).toBe("match");
    });
  });

  describe("checkAllIntegrity", () => {
    it("checks multiple files and returns results", () => {
      writeFileSync(join(repoDir, "file1.txt"), "content1");
      writeFileSync(join(approvedDir, "file1.txt"), "content1");
      writeFileSync(join(repoDir, "file2.txt"), "different");
      writeFileSync(join(approvedDir, "file2.txt"), "content2");

      const checks: IntegrityCheck[] = [
        { file: "file1.txt", approved: "file1.txt", severity: "high" },
        { file: "file2.txt", approved: "file2.txt", severity: "medium" },
      ];
      const results = checkAllIntegrity(checks, repoDir, approvedDir);
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe("match");
      expect(results[1].status).toBe("drift");
    });

    it("returns results in same order as input", () => {
      writeFileSync(join(repoDir, "a.txt"), "a");
      writeFileSync(join(approvedDir, "a.txt"), "a");
      writeFileSync(join(repoDir, "b.txt"), "b");
      writeFileSync(join(approvedDir, "b.txt"), "b");

      const checks: IntegrityCheck[] = [
        { file: "b.txt", approved: "b.txt", severity: "low" },
        { file: "a.txt", approved: "a.txt", severity: "low" },
      ];
      const results = checkAllIntegrity(checks, repoDir, approvedDir);
      expect(results[0].file).toBe("b.txt");
      expect(results[1].file).toBe("a.txt");
    });

    it("handles empty checks array", () => {
      const results = checkAllIntegrity([], repoDir, approvedDir);
      expect(results).toEqual([]);
    });
  });

  describe("discoverFiles", () => {
    it("discovers files matching glob pattern", () => {
      writeFileSync(join(repoDir, "config.json"), "{}");
      writeFileSync(join(repoDir, "package.json"), "{}");

      const patterns: DiscoveryPattern[] = [
        { pattern: "*.json", suggestion: "Add to integrity checks" },
      ];
      const results = discoverFiles(patterns, repoDir, []);
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((r) => r.file === "config.json")).toBe(true);
      expect(results.some((r) => r.file === "package.json")).toBe(true);
    });

    it("marks protected files correctly", () => {
      writeFileSync(join(repoDir, "protected.json"), "{}");
      writeFileSync(join(repoDir, "unprotected.json"), "{}");

      const patterns: DiscoveryPattern[] = [
        { pattern: "*.json", suggestion: "Check this" },
      ];
      const results = discoverFiles(patterns, repoDir, ["protected.json"]);
      const protectedResult = results.find((r) => r.file === "protected.json");
      const unprotectedResult = results.find(
        (r) => r.file === "unprotected.json"
      );

      expect(protectedResult?.isProtected).toBe(true);
      expect(unprotectedResult?.isProtected).toBe(false);
    });

    it("includes pattern and suggestion in results", () => {
      writeFileSync(join(repoDir, "test.yml"), "key: value");

      const patterns: DiscoveryPattern[] = [
        { pattern: "*.yml", suggestion: "YAML files should be protected" },
      ];
      const results = discoverFiles(patterns, repoDir, []);
      expect(results[0].pattern).toBe("*.yml");
      expect(results[0].suggestion).toBe("YAML files should be protected");
    });

    it("handles nested directory patterns", () => {
      mkdirSync(join(repoDir, "src/config"), { recursive: true });
      writeFileSync(join(repoDir, "src/config/app.json"), "{}");

      const patterns: DiscoveryPattern[] = [
        { pattern: "**/*.json", suggestion: "Check all JSON" },
      ];
      const results = discoverFiles(patterns, repoDir, []);
      expect(results.some((r) => r.file.includes("app.json"))).toBe(true);
    });

    it("handles multiple patterns", () => {
      writeFileSync(join(repoDir, "config.json"), "{}");
      writeFileSync(join(repoDir, "config.yml"), "key: value");

      const patterns: DiscoveryPattern[] = [
        { pattern: "*.json", suggestion: "JSON files" },
        { pattern: "*.yml", suggestion: "YAML files" },
      ];
      const results = discoverFiles(patterns, repoDir, []);
      expect(results.some((r) => r.file === "config.json")).toBe(true);
      expect(results.some((r) => r.file === "config.yml")).toBe(true);
    });

    it("returns empty array when no files match", () => {
      const patterns: DiscoveryPattern[] = [
        { pattern: "*.nonexistent", suggestion: "Nothing here" },
      ];
      const results = discoverFiles(patterns, repoDir, []);
      expect(results).toEqual([]);
    });
  });

  describe("formatIntegrityResult", () => {
    it("formats match result", () => {
      const result: IntegrityResult = {
        file: "config.json",
        status: "match",
        severity: "high",
        timestamp: new Date().toISOString(),
      };
      const formatted = formatIntegrityResult(result);
      expect(formatted).toContain("config.json");
      expect(formatted).toContain("ok");
    });

    it("formats drift result with severity", () => {
      const result: IntegrityResult = {
        file: "config.json",
        status: "drift",
        severity: "critical",
        timestamp: new Date().toISOString(),
      };
      const formatted = formatIntegrityResult(result);
      expect(formatted).toContain("config.json");
      expect(formatted).toContain("DRIFT DETECTED");
      expect(formatted).toContain("critical");
    });

    it("formats missing result", () => {
      const result: IntegrityResult = {
        file: "missing.json",
        status: "missing",
        severity: "high",
        timestamp: new Date().toISOString(),
      };
      const formatted = formatIntegrityResult(result);
      expect(formatted).toContain("missing.json");
      expect(formatted).toContain("MISSING");
    });

    it("formats error result with message", () => {
      const result: IntegrityResult = {
        file: "error.json",
        status: "error",
        severity: "medium",
        timestamp: new Date().toISOString(),
        error: "File not readable",
      };
      const formatted = formatIntegrityResult(result);
      expect(formatted).toContain("error.json");
      expect(formatted).toContain("error");
      expect(formatted).toContain("File not readable");
    });
  });
});
