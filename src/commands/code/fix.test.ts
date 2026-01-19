import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { fix } from "./fix.js";

describe("fix command", () => {
  let testDir: string;
  let repoDir: string;
  let configDir: string;
  let originalCwd: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-fix-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    repoDir = join(testDir, "repo");
    configDir = join(testDir, "config");
    mkdirSync(repoDir, { recursive: true });
    mkdirSync(join(configDir, "approved"), { recursive: true });

    originalCwd = process.cwd();
    process.chdir(repoDir);

    // Mock process.exit to prevent test from exiting
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createConfig(content: string): string {
    const configPath = join(configDir, "drift.config.yaml");
    writeFileSync(configPath, content);
    return configPath;
  }

  function createApprovedFile(name: string, content: string): void {
    const filePath = join(configDir, "approved", name);
    const dirPath = join(configDir, "approved");
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    writeFileSync(filePath, content);
  }

  function createRepoFile(name: string, content: string): void {
    const filePath = join(repoDir, name);
    writeFileSync(filePath, content);
  }

  describe("fix with dryRun", () => {
    it("reports files that would be fixed without changing them", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: config.json
      approved: approved/config.json
      severity: high
`);
      createApprovedFile("config.json", '{"approved": true}');
      createRepoFile("config.json", '{"drifted": true}');

      fix({
        path: repoDir,
        config: configPath,
        dryRun: true,
      });

      // File should not be changed
      const content = readFileSync(join(repoDir, "config.json"), "utf-8");
      expect(content).toBe('{"drifted": true}');

      // Should log dry run message
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Dry run")
      );
    });

    it("reports files that would be created without creating them", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: missing.json
      approved: approved/missing.json
      severity: high
`);
      createApprovedFile("missing.json", '{"new": true}');
      // Don't create the repo file

      fix({
        path: repoDir,
        config: configPath,
        dryRun: true,
      });

      // File should not be created
      expect(existsSync(join(repoDir, "missing.json"))).toBe(false);
    });
  });

  describe("fix without dryRun", () => {
    it("fixes drifted files by copying from approved", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: config.json
      approved: approved/config.json
      severity: high
`);
      createApprovedFile("config.json", '{"approved": true}');
      createRepoFile("config.json", '{"drifted": true}');

      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      const content = readFileSync(join(repoDir, "config.json"), "utf-8");
      expect(content).toBe('{"approved": true}');
    });

    it("creates missing files from approved", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: new-file.json
      approved: approved/new-file.json
      severity: medium
`);
      createApprovedFile("new-file.json", '{"created": true}');
      // Don't create the repo file

      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      expect(existsSync(join(repoDir, "new-file.json"))).toBe(true);
      const content = readFileSync(join(repoDir, "new-file.json"), "utf-8");
      expect(content).toBe('{"created": true}');
    });

    it("skips files that already match", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: matching.json
      approved: approved/matching.json
      severity: low
`);
      const content = '{"identical": true}';
      createApprovedFile("matching.json", content);
      createRepoFile("matching.json", content);

      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      // Should log that file was skipped
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("matching.json")
      );
    });

    it("creates nested directories when needed", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: deep/nested/config.json
      approved: approved/config.json
      severity: high
`);
      createApprovedFile("config.json", '{"deep": true}');
      // Don't create nested directories

      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      expect(existsSync(join(repoDir, "deep/nested/config.json"))).toBe(true);
    });
  });

  describe("fix with --file option", () => {
    it("only processes specified file", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: file1.json
      approved: approved/file1.json
      severity: high
    - file: file2.json
      approved: approved/file2.json
      severity: high
`);
      createApprovedFile("file1.json", '{"file": 1}');
      createApprovedFile("file2.json", '{"file": 2}');
      createRepoFile("file1.json", '{"drifted": 1}');
      createRepoFile("file2.json", '{"drifted": 2}');

      fix({
        path: repoDir,
        config: configPath,
        file: "file1.json",
        dryRun: false,
      });

      // file1 should be fixed
      expect(readFileSync(join(repoDir, "file1.json"), "utf-8")).toBe(
        '{"file": 1}'
      );
      // file2 should NOT be fixed
      expect(readFileSync(join(repoDir, "file2.json"), "utf-8")).toBe(
        '{"drifted": 2}'
      );
    });
  });

  describe("error handling", () => {
    it("exits when no config found", () => {
      expect(() => fix({ path: repoDir })).toThrow("process.exit");
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("No drift config found")
      );
    });

    it("exits when config fails to load", () => {
      // Create invalid config
      writeFileSync(join(repoDir, "drift.config.yaml"), "invalid: yaml: :");

      expect(() => fix({ path: repoDir })).toThrow("process.exit");
    });

    it("handles empty protected files list", () => {
      const configPath = createConfig(`
integrity: {}
`);
      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "No protected files configured."
      );
    });

    it("reports errors for inaccessible approved files", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: config.json
      approved: approved/nonexistent.json
      severity: high
`);
      createRepoFile("config.json", '{"exists": true}');
      // Don't create the approved file

      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      // Should log an error for the file
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("config.json")
      );
    });
  });

  describe("multiple files", () => {
    it("processes all protected files", () => {
      const configPath = createConfig(`
integrity:
  protected:
    - file: a.json
      approved: approved/a.json
      severity: high
    - file: b.json
      approved: approved/b.json
      severity: medium
    - file: c.json
      approved: approved/c.json
      severity: low
`);
      createApprovedFile("a.json", '{"a": true}');
      createApprovedFile("b.json", '{"b": true}');
      createApprovedFile("c.json", '{"c": true}');
      createRepoFile("a.json", '{"a": false}');
      createRepoFile("b.json", '{"b": true}'); // matches
      // c.json is missing

      fix({
        path: repoDir,
        config: configPath,
        dryRun: false,
      });

      // a.json should be fixed
      expect(readFileSync(join(repoDir, "a.json"), "utf-8")).toBe(
        '{"a": true}'
      );
      // b.json should stay the same
      expect(readFileSync(join(repoDir, "b.json"), "utf-8")).toBe(
        '{"b": true}'
      );
      // c.json should be created
      expect(readFileSync(join(repoDir, "c.json"), "utf-8")).toBe(
        '{"c": true}'
      );
    });
  });
});
