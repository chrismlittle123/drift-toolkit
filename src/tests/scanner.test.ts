import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runScan, formatScanResult } from "../scanner/runner.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { ScanResult } from "../types.js";

describe("scan runner", () => {
  const testDir = join(tmpdir(), "drift-scanner-test-" + Date.now());

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should pass when command succeeds", () => {
    const result = runScan(
      { name: "echo-test", command: "echo hello" },
      testDir
    );

    expect(result.status).toBe("pass");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("hello");
  });

  it("should fail when command fails", () => {
    const result = runScan({ name: "false-test", command: "exit 1" }, testDir);

    expect(result.status).toBe("fail");
    expect(result.exitCode).toBe(1);
  });

  it("should skip when condition file does not exist", () => {
    const result = runScan(
      { name: "conditional", command: "echo hello", if: "nonexistent.txt" },
      testDir
    );

    expect(result.status).toBe("skip");
    expect(result.skippedReason).toContain("file not found");
  });

  it("should run when condition file exists", () => {
    writeFileSync(join(testDir, "exists.txt"), "content");

    const result = runScan(
      { name: "conditional", command: "echo found", if: "exists.txt" },
      testDir
    );

    expect(result.status).toBe("pass");
    expect(result.stdout).toBe("found");
  });

  it("should capture stderr on failure", () => {
    const result = runScan(
      { name: "stderr-test", command: "echo 'error message' >&2 && exit 1" },
      testDir
    );

    expect(result.status).toBe("fail");
    expect(result.stderr).toContain("error message");
  });

  it("should handle multiple condition files (array)", () => {
    writeFileSync(join(testDir, "file1.txt"), "content");
    writeFileSync(join(testDir, "file2.txt"), "content");

    const result = runScan(
      {
        name: "multi-condition",
        command: "echo success",
        if: ["file1.txt", "file2.txt"],
      },
      testDir
    );

    expect(result.status).toBe("pass");
  });

  it("should skip if any condition file is missing", () => {
    writeFileSync(join(testDir, "present.txt"), "content");

    const result = runScan(
      {
        name: "multi-condition",
        command: "echo success",
        if: ["present.txt", "missing.txt"],
      },
      testDir
    );

    expect(result.status).toBe("skip");
    expect(result.skippedReason).toContain("missing.txt");
  });

  it("should include duration in result", () => {
    const result = runScan(
      { name: "duration-test", command: "echo test" },
      testDir
    );

    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe("number");
  });

  it("should include timestamp in result", () => {
    const result = runScan(
      { name: "timestamp-test", command: "echo test" },
      testDir
    );

    expect(result.timestamp).toBeDefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it("should use custom timeout when specified", () => {
    // Test that a quick command completes within custom timeout
    const result = runScan(
      { name: "timeout-test", command: "echo fast", timeout: 1 },
      testDir
    );

    expect(result.status).toBe("pass");
  });

  it("should fail when command times out", () => {
    // Use a very short timeout with a sleep command
    // When killed by timeout, the process has an exit status (from SIGTERM/SIGKILL)
    const result = runScan(
      { name: "timeout-fail", command: "sleep 10", timeout: 0.1 },
      testDir
    );

    // Timeout causes process to be killed, which gives a non-zero exit code
    expect(result.status).toBe("fail");
    expect(result.exitCode).not.toBe(0);
  });

  it("should trim stdout output", () => {
    const result = runScan(
      { name: "trim-test", command: "echo '  padded  '" },
      testDir
    );

    expect(result.stdout).toBe("padded");
  });

  describe("if_file conditions", () => {
    it("should skip when if_file does not exist", () => {
      const result = runScan(
        {
          name: "if-file-test",
          command: "echo hello",
          if_file: "nonexistent.txt",
        },
        testDir
      );

      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("file not found");
    });

    it("should run when if_file exists", () => {
      writeFileSync(join(testDir, "if-file-exists.txt"), "content");

      const result = runScan(
        {
          name: "if-file-test",
          command: "echo found",
          if_file: "if-file-exists.txt",
        },
        testDir
      );

      expect(result.status).toBe("pass");
      expect(result.stdout).toBe("found");
    });

    it("should handle array of files for if_file", () => {
      writeFileSync(join(testDir, "if-file-a.txt"), "content");
      writeFileSync(join(testDir, "if-file-b.txt"), "content");

      const result = runScan(
        {
          name: "if-file-array",
          command: "echo success",
          if_file: ["if-file-a.txt", "if-file-b.txt"],
        },
        testDir
      );

      expect(result.status).toBe("pass");
    });
  });

  describe("if_command conditions", () => {
    it("should skip when if_command fails", () => {
      const result = runScan(
        {
          name: "if-command-fail",
          command: "echo should not run",
          if_command: "exit 1",
        },
        testDir
      );

      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("condition failed");
    });

    it("should run when if_command succeeds", () => {
      const result = runScan(
        {
          name: "if-command-pass",
          command: "echo success",
          if_command: "exit 0",
        },
        testDir
      );

      expect(result.status).toBe("pass");
      expect(result.stdout).toBe("success");
    });

    it("should run if_command with shell features", () => {
      writeFileSync(join(testDir, "metadata.yml"), "tier: internal\n");

      const result = runScan(
        {
          name: "grep-condition",
          command: "echo matched",
          if_command: "grep -q 'tier: internal' metadata.yml",
        },
        testDir
      );

      expect(result.status).toBe("pass");
      expect(result.stdout).toBe("matched");
    });

    it("should skip when grep condition fails", () => {
      writeFileSync(join(testDir, "metadata2.yml"), "tier: production\n");

      const result = runScan(
        {
          name: "grep-condition-fail",
          command: "echo should not run",
          if_command: "grep -q 'tier: internal' metadata2.yml",
        },
        testDir
      );

      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("condition failed");
    });
  });

  describe("tier-based conditions", () => {
    it("should skip when repo tier not in scan tiers", () => {
      const result = runScan(
        { name: "tier-test", command: "echo hello", tiers: ["production"] },
        testDir,
        { tier: "prototype" }
      );

      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain(
        "tier 'prototype' not in [production]"
      );
    });

    it("should run when repo tier matches scan tiers", () => {
      const result = runScan(
        {
          name: "tier-test",
          command: "echo hello",
          tiers: ["production", "internal"],
        },
        testDir,
        { tier: "production" }
      );

      expect(result.status).toBe("pass");
      expect(result.stdout).toBe("hello");
    });

    it("should skip when no tier defined but scan requires tiers", () => {
      const result = runScan(
        { name: "tier-test", command: "echo hello", tiers: ["production"] },
        testDir,
        {} // No tier defined
      );

      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("no tier defined");
    });

    it("should skip when context is undefined but scan requires tiers", () => {
      const result = runScan(
        { name: "tier-test", command: "echo hello", tiers: ["production"] },
        testDir
        // No context passed
      );

      expect(result.status).toBe("skip");
      expect(result.skippedReason).toContain("no tier defined");
    });

    it("should run when scan has no tier requirement", () => {
      const result = runScan(
        { name: "no-tier-test", command: "echo hello" },
        testDir,
        { tier: "prototype" }
      );

      expect(result.status).toBe("pass");
    });

    it("should run when scan has empty tiers array", () => {
      const result = runScan(
        { name: "empty-tier-test", command: "echo hello", tiers: [] },
        testDir,
        { tier: "prototype" }
      );

      expect(result.status).toBe("pass");
    });
  });
});

describe("formatScanResult", () => {
  it("should format pass status with green checkmark", () => {
    const result: ScanResult = {
      scan: "test-scan",
      status: "pass",
      exitCode: 0,
      duration: 150,
      timestamp: "",
    };

    const formatted = formatScanResult(result);

    expect(formatted).toContain("✓");
    expect(formatted).toContain("test-scan");
    expect(formatted).toContain("passed");
    expect(formatted).toContain("150ms");
    expect(formatted).toContain("\x1b[32m"); // green color
  });

  it("should format fail status with red X and exit code", () => {
    const result: ScanResult = {
      scan: "failing-scan",
      status: "fail",
      exitCode: 1,
      duration: 200,
      timestamp: "",
    };

    const formatted = formatScanResult(result);

    expect(formatted).toContain("✗");
    expect(formatted).toContain("failing-scan");
    expect(formatted).toContain("failed");
    expect(formatted).toContain("exit 1");
    expect(formatted).toContain("200ms");
    expect(formatted).toContain("\x1b[31m"); // red color
  });

  it("should format skip status with yellow circle and reason", () => {
    const result: ScanResult = {
      scan: "skipped-scan",
      status: "skip",
      duration: 5,
      timestamp: "",
      skippedReason: "file not found: package.json",
    };

    const formatted = formatScanResult(result);

    expect(formatted).toContain("○");
    expect(formatted).toContain("skipped-scan");
    expect(formatted).toContain("skipped");
    expect(formatted).toContain("file not found: package.json");
    expect(formatted).toContain("\x1b[33m"); // yellow color
  });

  it("should format error status with red exclamation", () => {
    const result: ScanResult = {
      scan: "error-scan",
      status: "error",
      duration: 1000,
      timestamp: "",
      stderr: "Command timed out",
    };

    const formatted = formatScanResult(result);

    expect(formatted).toContain("!");
    expect(formatted).toContain("error-scan");
    expect(formatted).toContain("error");
    expect(formatted).toContain("Command timed out");
    expect(formatted).toContain("\x1b[31m"); // red color
  });
});
