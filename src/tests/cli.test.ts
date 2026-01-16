import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(currentDir, "../../dist/cli.js");

// Helper to run CLI and capture output
function runCli(args: string): {
  exitCode: number;
  stdout: string;
  stderr: string;
} {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (error: unknown) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    return {
      exitCode: execError.status ?? 1,
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
    };
  }
}

describe("cli", () => {
  describe("--help", () => {
    it("should display program name and description", () => {
      const { exitCode, stdout } = runCli("--help");

      expect(exitCode).toBe(0);
      expect(stdout).toContain("drift");
      expect(stdout).toContain("Monitor repository standards");
    });

    it("should show available commands", () => {
      const { stdout } = runCli("--help");

      expect(stdout).toContain("scan");
      expect(stdout).toContain("Scan repositories for drift");
    });
  });

  describe("--version", () => {
    it("should display version number", () => {
      const { exitCode, stdout } = runCli("--version");

      expect(exitCode).toBe(0);
      // Version should match semver pattern
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("scan command", () => {
    it("should show scan command help", () => {
      const { exitCode, stdout } = runCli("scan --help");

      expect(exitCode).toBe(0);
      expect(stdout).toContain("--path");
      expect(stdout).toContain("--config");
      expect(stdout).toContain("--org");
      expect(stdout).toContain("--repo");
      expect(stdout).toContain("--config-repo");
      expect(stdout).toContain("--github-token");
      expect(stdout).toContain("--json");
    });

    it("should show path option description", () => {
      const { stdout } = runCli("scan --help");

      expect(stdout).toContain("Local directory to scan");
    });

    it("should show org option description", () => {
      const { stdout } = runCli("scan --help");

      expect(stdout).toContain("GitHub organization or username to scan");
    });

    it("should show config-repo default value", () => {
      const { stdout } = runCli("scan --help");

      expect(stdout).toContain("drift-config");
    });

    it("should mention GITHUB_TOKEN env var", () => {
      const { stdout } = runCli("scan --help");

      expect(stdout).toContain("GITHUB_TOKEN");
    });
  });

  describe("unknown command", () => {
    it("should show error for unknown command", () => {
      const { exitCode, stderr } = runCli("unknown-command");

      expect(exitCode).toBe(1);
      expect(stderr).toContain("unknown command");
    });
  });
});
