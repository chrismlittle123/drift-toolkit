import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface TestCase {
  name: string;
  project: string;
  args?: string;
  expectedExitCode: number;
  expectedPatterns: string[];
  notExpectedPatterns?: string[];
  validateJson?: boolean;
}

const CLI_PATH = resolve(__dirname, "../../dist/cli.js");
const PROJECTS_PATH = resolve(__dirname, "projects");

// Strip ANSI color codes from output
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function runDrift(
  projectPath: string,
  args = ""
): { exitCode: number; output: string } {
  const fullPath = resolve(PROJECTS_PATH, projectPath);
  try {
    const output = execSync(
      `node ${CLI_PATH} code scan --path "${fullPath}" ${args}`,
      {
        encoding: "utf-8",
        env: { ...process.env, FORCE_COLOR: "0" },
      }
    );
    return { exitCode: 0, output: stripAnsi(output) };
  } catch (error: unknown) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    const rawOutput = (execError.stdout || "") + (execError.stderr || "");
    return {
      exitCode: execError.status ?? 1,
      output: stripAnsi(rawOutput),
    };
  }
}

function runDriftRaw(args: string): { exitCode: number; output: string } {
  try {
    const output = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    return { exitCode: 0, output: stripAnsi(output) };
  } catch (error: unknown) {
    const execError = error as {
      status?: number;
      stdout?: string;
      stderr?: string;
    };
    const rawOutput = (execError.stdout || "") + (execError.stderr || "");
    return {
      exitCode: execError.status ?? 1,
      output: stripAnsi(rawOutput),
    };
  }
}

const testCases: TestCase[] = [
  // =====================
  // Integrity: Should pass
  // =====================
  {
    name: "clean project with matching CODEOWNERS",
    project: "clean",
    expectedExitCode: 0,
    expectedPatterns: [
      "CODEOWNERS - ok",
      "has-readme - passed",
      "All checks passed",
    ],
    notExpectedPatterns: ["DRIFT", "failed", "MISSING"],
  },

  // =====================
  // Integrity: Should fail
  // =====================
  {
    name: "drifted CODEOWNERS file",
    project: "drifted",
    expectedExitCode: 1,
    expectedPatterns: [
      "CODEOWNERS",
      "DRIFT DETECTED",
      "critical",
      "INTEGRITY VIOLATIONS DETECTED",
    ],
  },
  {
    name: "missing protected file",
    project: "missing-file",
    expectedExitCode: 1,
    expectedPatterns: [
      "CODEOWNERS",
      "MISSING",
      "INTEGRITY VIOLATIONS DETECTED",
    ],
  },

  // =====================
  // Scans: Should pass
  // =====================
  {
    name: "all scans pass",
    project: "scan-pass",
    expectedExitCode: 0,
    expectedPatterns: [
      "has-readme - passed",
      "echo-test - passed",
      "All checks passed",
    ],
    notExpectedPatterns: ["failed"],
  },

  // =====================
  // Scans: Should fail
  // =====================
  {
    name: "scans fail with non-zero exit",
    project: "scan-fail",
    expectedExitCode: 1,
    expectedPatterns: [
      "missing-file-check - failed",
      "false-command - failed",
      "SCAN FAILURES DETECTED",
    ],
  },

  // =====================
  // Discovery
  // =====================
  {
    name: "discovers new workflow files",
    project: "discovery",
    expectedExitCode: 0,
    expectedPatterns: [
      "NEW FILES DETECTED",
      "ci.yml",
      "deploy.yml",
      "Workflow files should be reviewed",
    ],
  },

  // =====================
  // JSON Output
  // =====================
  {
    name: "json output for clean project",
    project: "clean",
    args: "--json",
    expectedExitCode: 0,
    validateJson: true,
    expectedPatterns: [
      '"path":',
      '"timestamp":',
      '"integrity":',
      '"scans":',
      '"summary":',
      '"integrityPassed":',
      '"scansPassed":',
    ],
    notExpectedPatterns: ["INTEGRITY CHECKS", "SCAN RESULTS"],
  },
  {
    name: "json output for drifted project",
    project: "drifted",
    args: "--json",
    expectedExitCode: 1,
    validateJson: true,
    expectedPatterns: [
      '"status": "drift"',
      '"severity": "critical"',
      '"diff":',
      '"integrityFailed": 1',
    ],
  },
  {
    name: "json output includes scan results",
    project: "scan-pass",
    args: "--json",
    expectedExitCode: 0,
    validateJson: true,
    expectedPatterns: [
      '"scan": "has-readme"',
      '"status": "pass"',
      '"scansPassed": 2',
    ],
  },

  // =====================
  // Conditional Scans
  // =====================
  {
    name: "conditional scan skips when file missing",
    project: "conditional-skip",
    expectedExitCode: 0,
    expectedPatterns: [
      "conditional-check - skipped",
      "file not found: nonexistent.txt",
      "always-run - passed",
      "1 skipped",
      "All checks passed",
    ],
    notExpectedPatterns: ["failed"],
  },

  // =====================
  // No Config
  // =====================
  {
    name: "shows helpful message when no config exists",
    project: "no-config",
    expectedExitCode: 0,
    expectedPatterns: [
      "No drift.config.yaml found",
      "Example drift.config.yaml:",
      "scans:",
      "has-readme",
      "integrity:",
      "protected:",
    ],
    notExpectedPatterns: ["INTEGRITY CHECKS", "SCAN RESULTS", "Error"],
  },

  // =====================
  // Multiple Severity Levels
  // =====================
  {
    name: "handles multiple severity levels",
    project: "multi-severity",
    expectedExitCode: 1,
    expectedPatterns: [
      "CODEOWNERS",
      "config.yml",
      "README.md",
      "high",
      "medium",
      "DRIFT DETECTED",
      "MISSING",
      "ok",
      "INTEGRITY VIOLATIONS DETECTED",
    ],
  },
];

describe("e2e tests", () => {
  for (const testCase of testCases) {
    it(testCase.name, () => {
      const { exitCode, output } = runDrift(testCase.project, testCase.args);

      // Check exit code
      expect(
        exitCode,
        `Expected exit code ${testCase.expectedExitCode}, got ${exitCode}\nOutput:\n${output}`
      ).toBe(testCase.expectedExitCode);

      // Validate JSON if requested
      if (testCase.validateJson) {
        expect(
          () => JSON.parse(output),
          `Expected valid JSON output\nOutput:\n${output}`
        ).not.toThrow();
      }

      // Check expected patterns
      for (const pattern of testCase.expectedPatterns) {
        expect(
          output,
          `Expected output to contain "${pattern}"\nOutput:\n${output}`
        ).toContain(pattern);
      }

      // Check not expected patterns
      if (testCase.notExpectedPatterns) {
        for (const pattern of testCase.notExpectedPatterns) {
          expect(
            output,
            `Expected output NOT to contain "${pattern}"\nOutput:\n${output}`
          ).not.toContain(pattern);
        }
      }
    });
  }
});

// =====================
// GitHub Org Scanning CLI Tests
// =====================
describe("org scanning cli", () => {
  it("errors when --repo is used without --org", () => {
    const { exitCode, output } = runDriftRaw("code scan --repo some-repo");

    expect(exitCode).toBe(1);
    expect(output).toContain("--repo requires --org");
  });

  it("shows help with --help flag", () => {
    const { exitCode, output } = runDriftRaw("code scan --help");

    expect(exitCode).toBe(0);
    expect(output).toContain("--org");
    expect(output).toContain("--repo");
    expect(output).toContain("--config-repo");
    expect(output).toContain("--github-token");
    expect(output).toContain("GitHub organization or username to scan");
  });

  it("shows config-repo default in help", () => {
    const { exitCode, output } = runDriftRaw("code scan --help");

    expect(exitCode).toBe(0);
    expect(output).toContain("drift-config");
  });
});
