import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("scan command", () => {
  let mockLog: ReturnType<typeof vi.spyOn>;
  let mockError: ReturnType<typeof vi.spyOn>;
  let mockExit: any;

  beforeEach(() => {
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should show help message when no config found", async () => {
    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: "/tmp" });
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining("No drift.config.yaml found")
    );
  });

  it("should error on non-existent path", async () => {
    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: "/nonexistent/path/that/does/not/exist" });
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("Path does not exist")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should error when --repo is used without --org", async () => {
    const { scan } = await import("../commands/code/scan.js");
    await scan({ repo: "some-repo" });
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("--repo requires --org")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});

describe("scan output formatting", () => {
  let tempDir: string;
  let mockExit: any;
  let logOutput: string[];

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "drift-scan-test-"));
    logOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      logOutput.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as () => never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should display version and target path", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      "scans:\n  - name: test\n    command: echo hello"
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("Drift v");
    expect(output).toContain("Target:");
  });

  it("should display SCAN RESULTS header for scans", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      "scans:\n  - name: echo-test\n    command: echo hello"
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("SCAN RESULTS");
    expect(output).toContain("echo-test");
    expect(output).toContain("passed");
  });

  it("should display failing scan with exit code", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      "scans:\n  - name: fail-test\n    command: exit 42"
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("fail-test");
    expect(output).toContain("failed");
    expect(output).toContain("42");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should display INTEGRITY CHECKS header for integrity checks", async () => {
    mkdirSync(join(tempDir, "approved"), { recursive: true });
    writeFileSync(join(tempDir, "approved", "test.txt"), "approved content");
    writeFileSync(join(tempDir, "test.txt"), "approved content");
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: test.txt
      approved: approved/test.txt
      severity: high`
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("INTEGRITY CHECKS");
    expect(output).toContain("test.txt");
    expect(output).toContain("ok");
  });

  it("should display drift detected for mismatched files", async () => {
    mkdirSync(join(tempDir, "approved"), { recursive: true });
    writeFileSync(join(tempDir, "approved", "test.txt"), "approved content");
    writeFileSync(join(tempDir, "test.txt"), "different content");
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: test.txt
      approved: approved/test.txt
      severity: critical`
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("DRIFT DETECTED");
    expect(output).toContain("critical");
    expect(output).toContain("INTEGRITY VIOLATIONS DETECTED");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should display missing file status", async () => {
    mkdirSync(join(tempDir, "approved"), { recursive: true });
    writeFileSync(join(tempDir, "approved", "test.txt"), "approved content");
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: test.txt
      approved: approved/test.txt
      severity: high`
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("MISSING");
    expect(output).toContain("high");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should display SUMMARY section with totals", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      "scans:\n  - name: test1\n    command: echo 1\n  - name: test2\n    command: echo 2"
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("SUMMARY");
    expect(output).toContain("Scans:");
    expect(output).toContain("2/2 passed");
  });

  it("should display All checks passed when no failures", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      "scans:\n  - name: pass-test\n    command: echo success"
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("All checks passed");
  });

  it("should output valid JSON in json mode", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      "scans:\n  - name: json-test\n    command: echo json"
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir, json: true });

    const output = logOutput.join("\n");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("path");
    expect(parsed).toHaveProperty("timestamp");
    expect(parsed).toHaveProperty("scans");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.scans[0].scan).toBe("json-test");
  });

  it("should include skipped scans in summary", async () => {
    writeFileSync(
      join(tempDir, "drift.config.yaml"),
      `scans:
  - name: conditional-test
    command: echo test
    if: nonexistent-file.txt`
    );

    const { scan } = await import("../commands/code/scan.js");
    await scan({ path: tempDir });

    const output = logOutput.join("\n");
    expect(output).toContain("skipped");
    expect(output).toContain("1 skipped");
  });
});
