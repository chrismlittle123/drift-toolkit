import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  checkIntegrity,
  discoverFiles,
  formatIntegrityResult,
} from "../integrity/checker.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { IntegrityResult } from "../types.js";

describe("integrity checker", () => {
  const testDir = join(tmpdir(), "drift-integrity-test-" + Date.now());
  const targetDir = join(testDir, "target");
  const approvedDir = join(testDir, "approved");

  beforeAll(() => {
    mkdirSync(targetDir, { recursive: true });
    mkdirSync(approvedDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should return match when files are identical", () => {
    const content = "same content";
    writeFileSync(join(targetDir, "test.txt"), content);
    writeFileSync(join(approvedDir, "test.txt"), content);

    const result = checkIntegrity(
      { file: "test.txt", approved: "test.txt", severity: "high" },
      targetDir,
      approvedDir
    );

    expect(result.status).toBe("match");
    expect(result.approvedHash).toBe(result.currentHash);
  });

  it("should return drift when files differ", () => {
    writeFileSync(join(targetDir, "drift.txt"), "current content");
    writeFileSync(join(approvedDir, "drift.txt"), "approved content");

    const result = checkIntegrity(
      { file: "drift.txt", approved: "drift.txt", severity: "critical" },
      targetDir,
      approvedDir
    );

    expect(result.status).toBe("drift");
    expect(result.approvedHash).not.toBe(result.currentHash);
    expect(result.diff).toBeDefined();
  });

  it("should return missing when target file does not exist", () => {
    writeFileSync(join(approvedDir, "missing.txt"), "approved content");

    const result = checkIntegrity(
      { file: "nonexistent.txt", approved: "missing.txt", severity: "high" },
      targetDir,
      approvedDir
    );

    expect(result.status).toBe("missing");
  });

  it("should return error when approved file does not exist", () => {
    writeFileSync(join(targetDir, "exists.txt"), "content");

    const result = checkIntegrity(
      { file: "exists.txt", approved: "does-not-exist.txt", severity: "high" },
      targetDir,
      approvedDir
    );

    expect(result.status).toBe("error");
    expect(result.error).toContain("Approved file not found");
  });
});

describe("discoverFiles", () => {
  const testDir = join(tmpdir(), "drift-discover-test-" + Date.now());

  beforeAll(() => {
    // Create test directory structure
    mkdirSync(join(testDir, ".github", "workflows"), { recursive: true });
    writeFileSync(join(testDir, ".github", "workflows", "ci.yml"), "name: CI");
    writeFileSync(
      join(testDir, ".github", "workflows", "deploy.yml"),
      "name: Deploy"
    );
    writeFileSync(join(testDir, "README.md"), "# Test");
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should discover files matching glob patterns", () => {
    const results = discoverFiles(
      [{ pattern: ".github/workflows/*.yml", suggestion: "Review workflow" }],
      testDir,
      []
    );

    expect(results.length).toBe(2);
    expect(results.map((r) => r.file)).toContain(".github/workflows/ci.yml");
    expect(results.map((r) => r.file)).toContain(
      ".github/workflows/deploy.yml"
    );
  });

  it("should mark protected files as isProtected", () => {
    const results = discoverFiles(
      [{ pattern: ".github/workflows/*.yml", suggestion: "Review workflow" }],
      testDir,
      [".github/workflows/ci.yml"]
    );

    const ciFile = results.find((r) => r.file === ".github/workflows/ci.yml");
    const deployFile = results.find(
      (r) => r.file === ".github/workflows/deploy.yml"
    );

    expect(ciFile?.isProtected).toBe(true);
    expect(deployFile?.isProtected).toBe(false);
  });

  it("should include suggestion from pattern", () => {
    const results = discoverFiles(
      [
        {
          pattern: ".github/workflows/*.yml",
          suggestion: "Workflow files should be reviewed",
        },
      ],
      testDir,
      []
    );

    expect(results[0].suggestion).toBe("Workflow files should be reviewed");
  });

  it("should return empty array when no files match", () => {
    const results = discoverFiles(
      [{ pattern: "*.nonexistent", suggestion: "Test" }],
      testDir,
      []
    );

    expect(results).toEqual([]);
  });

  it("should handle multiple patterns", () => {
    const results = discoverFiles(
      [
        { pattern: ".github/workflows/*.yml", suggestion: "Review workflow" },
        { pattern: "*.md", suggestion: "Review docs" },
      ],
      testDir,
      []
    );

    expect(results.length).toBe(3); // 2 yml + 1 md
  });
});

describe("formatIntegrityResult", () => {
  it("should format match status with green checkmark", () => {
    const result: IntegrityResult = {
      file: "CODEOWNERS",
      status: "match",
      severity: "critical",
      timestamp: "",
    };

    const formatted = formatIntegrityResult(result);

    expect(formatted).toContain("✓");
    expect(formatted).toContain("CODEOWNERS");
    expect(formatted).toContain("ok");
    expect(formatted).toContain("\x1b[32m"); // green color
  });

  it("should format drift status with severity color", () => {
    const result: IntegrityResult = {
      file: "CODEOWNERS",
      status: "drift",
      severity: "critical",
      timestamp: "",
    };

    const formatted = formatIntegrityResult(result);

    expect(formatted).toContain("✗");
    expect(formatted).toContain("CODEOWNERS");
    expect(formatted).toContain("DRIFT DETECTED");
    expect(formatted).toContain("critical");
    expect(formatted).toContain("\x1b[31m"); // red for critical
  });

  it("should format missing status", () => {
    const result: IntegrityResult = {
      file: "CODEOWNERS",
      status: "missing",
      severity: "high",
      timestamp: "",
    };

    const formatted = formatIntegrityResult(result);

    expect(formatted).toContain("✗");
    expect(formatted).toContain("MISSING");
    expect(formatted).toContain("high");
    expect(formatted).toContain("\x1b[33m"); // yellow for high
  });

  it("should format error status", () => {
    const result: IntegrityResult = {
      file: "CODEOWNERS",
      status: "error",
      severity: "critical",
      error: "Approved file not found",
      timestamp: "",
    };

    const formatted = formatIntegrityResult(result);

    expect(formatted).toContain("!");
    expect(formatted).toContain("error");
    expect(formatted).toContain("Approved file not found");
  });

  it("should use cyan color for medium severity", () => {
    const result: IntegrityResult = {
      file: "config.yml",
      status: "drift",
      severity: "medium",
      timestamp: "",
    };

    const formatted = formatIntegrityResult(result);

    expect(formatted).toContain("\x1b[36m"); // cyan for medium
  });

  it("should use white color for low severity", () => {
    const result: IntegrityResult = {
      file: "readme.md",
      status: "drift",
      severity: "low",
      timestamp: "",
    };

    const formatted = formatIntegrityResult(result);

    expect(formatted).toContain("\x1b[37m"); // white for low
  });
});
