import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("fix command", () => {
  let tempDir: string;
  let configDir: string;
  let targetDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "drift-fix-test-"));
    configDir = join(tempDir, "config");
    targetDir = join(tempDir, "target");
    mkdirSync(configDir, { recursive: true });
    mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function runFix(args: string[] = []): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } {
    const cmd = `node ${join(process.cwd(), "dist", "cli.js")} code fix ${args.join(" ")}`;
    try {
      const stdout = execSync(cmd, {
        encoding: "utf-8",
        cwd: targetDir,
        env: { ...process.env },
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error) {
      const execError = error as {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      return {
        stdout: execError.stdout || "",
        stderr: execError.stderr || "",
        exitCode: execError.status || 1,
      };
    }
  }

  it("should show error when no config found", () => {
    const result = runFix();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No drift config found");
  });

  it("should show no files message when no protected files configured", () => {
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      "integrity:\n  discover: []\n"
    );
    const result = runFix([`--config ${join(configDir, "drift.config.yaml")}`]);
    expect(result.stdout).toContain("No protected files configured");
  });

  it("should skip files that already match", () => {
    // Create approved file
    const approvedContent = "# Approved CODEOWNERS\n* @platform-team\n";
    mkdirSync(join(configDir, "files"), { recursive: true });
    writeFileSync(join(configDir, "files", "CODEOWNERS"), approvedContent);

    // Create matching target file
    writeFileSync(join(targetDir, "CODEOWNERS"), approvedContent);

    // Create config
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: CODEOWNERS
      approved: files/CODEOWNERS
      severity: critical
`
    );

    const result = runFix([`--config ${join(configDir, "drift.config.yaml")}`]);
    expect(result.stdout).toContain("already matches");
    expect(result.stdout).toContain("already up to date");
  });

  it("should fix drifted files", () => {
    // Create approved file
    const approvedContent = "# Approved CODEOWNERS\n* @platform-team\n";
    mkdirSync(join(configDir, "files"), { recursive: true });
    writeFileSync(join(configDir, "files", "CODEOWNERS"), approvedContent);

    // Create drifted target file
    writeFileSync(
      join(targetDir, "CODEOWNERS"),
      "# Wrong content\n* @wrong-team\n"
    );

    // Create config
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: CODEOWNERS
      approved: files/CODEOWNERS
      severity: critical
`
    );

    const result = runFix([`--config ${join(configDir, "drift.config.yaml")}`]);
    expect(result.stdout).toContain("fixed");

    // Verify file was fixed
    const fixedContent = readFileSync(join(targetDir, "CODEOWNERS"), "utf-8");
    expect(fixedContent).toBe(approvedContent);
  });

  it("should create missing files", () => {
    // Create approved file
    const approvedContent = "# Approved CODEOWNERS\n* @platform-team\n";
    mkdirSync(join(configDir, "files"), { recursive: true });
    writeFileSync(join(configDir, "files", "CODEOWNERS"), approvedContent);

    // Don't create target file (missing)

    // Create config
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: CODEOWNERS
      approved: files/CODEOWNERS
      severity: critical
`
    );

    const result = runFix([`--config ${join(configDir, "drift.config.yaml")}`]);
    expect(result.stdout).toContain("created");

    // Verify file was created
    expect(existsSync(join(targetDir, "CODEOWNERS"))).toBe(true);
    const createdContent = readFileSync(join(targetDir, "CODEOWNERS"), "utf-8");
    expect(createdContent).toBe(approvedContent);
  });

  it("should not make changes in dry-run mode", () => {
    // Create approved file
    const approvedContent = "# Approved CODEOWNERS\n* @platform-team\n";
    mkdirSync(join(configDir, "files"), { recursive: true });
    writeFileSync(join(configDir, "files", "CODEOWNERS"), approvedContent);

    // Create drifted target file
    const driftedContent = "# Wrong content\n* @wrong-team\n";
    writeFileSync(join(targetDir, "CODEOWNERS"), driftedContent);

    // Create config
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: CODEOWNERS
      approved: files/CODEOWNERS
      severity: critical
`
    );

    const result = runFix([
      `--config ${join(configDir, "drift.config.yaml")}`,
      "--dry-run",
    ]);
    expect(result.stdout).toContain("Dry run mode");
    expect(result.stdout).toContain("would be");
    expect(result.stdout).toContain("Run without --dry-run");

    // Verify file was NOT changed
    const unchangedContent = readFileSync(
      join(targetDir, "CODEOWNERS"),
      "utf-8"
    );
    expect(unchangedContent).toBe(driftedContent);
  });

  it("should fix only specified file with --file option", () => {
    // Create approved files
    mkdirSync(join(configDir, "files"), { recursive: true });
    writeFileSync(
      join(configDir, "files", "CODEOWNERS"),
      "approved codeowners"
    );
    writeFileSync(join(configDir, "files", "README.md"), "approved readme");

    // Create drifted target files
    writeFileSync(join(targetDir, "CODEOWNERS"), "drifted codeowners");
    writeFileSync(join(targetDir, "README.md"), "drifted readme");

    // Create config
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: CODEOWNERS
      approved: files/CODEOWNERS
      severity: critical
    - file: README.md
      approved: files/README.md
      severity: low
`
    );

    const result = runFix([
      `--config ${join(configDir, "drift.config.yaml")}`,
      "--file CODEOWNERS",
    ]);
    expect(result.stdout).toContain("fixed");

    // Verify only CODEOWNERS was fixed
    expect(readFileSync(join(targetDir, "CODEOWNERS"), "utf-8")).toBe(
      "approved codeowners"
    );
    expect(readFileSync(join(targetDir, "README.md"), "utf-8")).toBe(
      "drifted readme"
    );
  });

  it("should create nested directories for missing files", () => {
    // Create approved file in nested directory
    mkdirSync(join(configDir, "files", ".github", "workflows"), {
      recursive: true,
    });
    writeFileSync(
      join(configDir, "files", ".github", "workflows", "ci.yml"),
      "name: CI\non: push\n"
    );

    // Create config
    writeFileSync(
      join(configDir, "drift.config.yaml"),
      `integrity:
  protected:
    - file: .github/workflows/ci.yml
      approved: files/.github/workflows/ci.yml
      severity: high
`
    );

    const result = runFix([`--config ${join(configDir, "drift.config.yaml")}`]);
    expect(result.stdout).toContain("created");

    // Verify file was created with directories
    expect(existsSync(join(targetDir, ".github", "workflows", "ci.yml"))).toBe(
      true
    );
  });
});
