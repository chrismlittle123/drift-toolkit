import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { scan, type ScanOptions } from "./scan.js";

describe("scan command", () => {
  let testDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-scan-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });

    // Mock console methods
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock process.exit to prevent actual exit
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe("local scanning mode", () => {
    it("shows help message when no config found", async () => {
      const options: ScanOptions = { path: testDir };
      await scan(options);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("No drift.config.yaml found");
    });

    it("outputs JSON when json option is set and no config found", async () => {
      const options: ScanOptions = { path: testDir, json: true };
      await scan(options);

      // Should not output help message in JSON mode
      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).not.toContain("No drift.config.yaml found");
    });

    it("scans with valid config and passing scans", async () => {
      const configContent = `
scans:
  - name: always-pass
    command: "true"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const options: ScanOptions = { path: testDir };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("passed");
      expect(output).toContain("All checks passed");
    });

    it("exits with code 1 when scan fails", async () => {
      const configContent = `
scans:
  - name: always-fail
    command: "false"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const options: ScanOptions = { path: testDir };

      await expect(scan(options)).rejects.toThrow("process.exit(1)");
    });

    it("outputs JSON results when json option is set", async () => {
      const configContent = `
scans:
  - name: test-scan
    command: "true"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const options: ScanOptions = { path: testDir, json: true };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("path");
      expect(parsed).toHaveProperty("scans");
      expect(parsed).toHaveProperty("summary");
    });

    it("skips scan when if_file condition not met", async () => {
      const configContent = `
scans:
  - name: conditional-scan
    command: "false"
    if_file: nonexistent-file.txt
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const options: ScanOptions = { path: testDir };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("skipped");
    });

    it("runs scan when if_file condition is met", async () => {
      const configContent = `
scans:
  - name: conditional-scan
    command: "true"
    if_file: package.json
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);
      writeFileSync(join(testDir, "package.json"), "{}");

      const options: ScanOptions = { path: testDir };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("passed");
    });

    it("exits with code 1 for non-existent path", async () => {
      const options: ScanOptions = { path: "/nonexistent/path/12345" };

      await expect(scan(options)).rejects.toThrow("process.exit(1)");
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.flat().join("\n");
      expect(errorOutput).toContain("does not exist");
    });

    it("uses custom config path when specified", async () => {
      const customConfigDir = join(testDir, "custom-config");
      mkdirSync(customConfigDir, { recursive: true });

      const configContent = `
scans:
  - name: custom-config-scan
    command: "true"
`;
      writeFileSync(join(customConfigDir, "drift.config.yaml"), configContent);

      const options: ScanOptions = {
        path: testDir,
        config: join(customConfigDir, "drift.config.yaml"),
      };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("passed");
    });

    it("defaults to current directory when no path specified", async () => {
      // This test verifies the default path behavior
      const options: ScanOptions = {};

      // Should use cwd, which won't have drift config
      await scan(options);

      // Just verify it doesn't crash
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("errors when --repo specified without --org", async () => {
      const options: ScanOptions = { repo: "some-repo" };

      await expect(scan(options)).rejects.toThrow("process.exit(1)");
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorOutput = consoleErrorSpy.mock.calls.flat().join("\n");
      expect(errorOutput).toContain("--repo requires --org");
    });
  });

  describe("integrity checks", () => {
    it("reports match for identical files", async () => {
      const configContent = `
integrity:
  protected:
    - file: README.md
      approved: approved/README.md
      severity: high
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);
      writeFileSync(join(testDir, "README.md"), "# Hello");
      mkdirSync(join(testDir, "approved"), { recursive: true });
      writeFileSync(join(testDir, "approved", "README.md"), "# Hello");

      const options: ScanOptions = { path: testDir };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("README.md");
      expect(output).toContain("All checks passed");
    });

    it("reports drift for different files", async () => {
      const configContent = `
integrity:
  protected:
    - file: README.md
      approved: approved/README.md
      severity: critical
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);
      writeFileSync(join(testDir, "README.md"), "# Modified");
      mkdirSync(join(testDir, "approved"), { recursive: true });
      writeFileSync(join(testDir, "approved", "README.md"), "# Original");

      const options: ScanOptions = { path: testDir };

      await expect(scan(options)).rejects.toThrow("process.exit(1)");
      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("DRIFT");
    });

    it("reports missing for non-existent target file", async () => {
      const configContent = `
integrity:
  protected:
    - file: MISSING.md
      approved: approved/MISSING.md
      severity: medium
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);
      mkdirSync(join(testDir, "approved"), { recursive: true });
      writeFileSync(join(testDir, "approved", "MISSING.md"), "content");

      const options: ScanOptions = { path: testDir };

      await expect(scan(options)).rejects.toThrow("process.exit(1)");
      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("MISSING");
    });
  });

  describe("file discovery", () => {
    it("discovers files matching patterns", async () => {
      const configContent = `
integrity:
  discover:
    - pattern: "*.yml"
      suggestion: "YAML files should be reviewed"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);
      writeFileSync(join(testDir, "config.yml"), "key: value");

      const options: ScanOptions = { path: testDir };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("config.yml");
    });
  });

  describe("metadata validation", () => {
    it("validates repo metadata against schema", async () => {
      const configContent = `
schema:
  tiers:
    - production
    - internal
scans:
  - name: test
    command: "true"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);
      writeFileSync(join(testDir, "repo-metadata.yaml"), "tier: unknown-tier");

      const options: ScanOptions = { path: testDir };
      await scan(options);

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("METADATA VALIDATION");
    });
  });

  describe("security warnings", () => {
    it("warns about potentially dangerous commands", async () => {
      const configContent = `
scans:
  - name: dangerous-scan
    command: "rm -rf /"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const options: ScanOptions = { path: testDir };

      // The scan will fail but security warning should be shown first
      try {
        await scan(options);
      } catch {
        // Expected to fail
      }

      const output = consoleLogSpy.mock.calls.flat().join("\n");
      expect(output).toContain("SECURITY WARNING");
    });
  });
});
