import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import {
  isGitRepo,
  getHeadCommit,
  detectCheckTomlChanges,
  getCheckTomlFilesAtCommit,
  compareCheckTomlFiles,
} from "./changes.js";

describe("change tracking", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-changes-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function git(args: string): string {
    return execSync(`git ${args}`, {
      cwd: testDir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  }

  function initGitRepo(): void {
    git("init");
    git("config user.email 'test@test.com'");
    git("config user.name 'Test User'");
  }

  describe("isGitRepo", () => {
    it("returns false for non-git directory", () => {
      expect(isGitRepo(testDir)).toBe(false);
    });

    it("returns true for git repository", () => {
      initGitRepo();
      expect(isGitRepo(testDir)).toBe(true);
    });
  });

  describe("getHeadCommit", () => {
    it("returns null for non-git directory", () => {
      expect(getHeadCommit(testDir)).toBeNull();
    });

    it("returns null for empty git repo", () => {
      initGitRepo();
      expect(getHeadCommit(testDir)).toBeNull();
    });

    it("returns commit SHA after first commit", () => {
      initGitRepo();
      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");

      const sha = getHeadCommit(testDir);
      expect(sha).toMatch(/^[a-f0-9]{40}$/);
    });
  });

  describe("detectCheckTomlChanges", () => {
    it("returns empty for non-git directory", () => {
      const result = detectCheckTomlChanges(testDir);
      expect(result.hasChanges).toBe(false);
      expect(result.added).toEqual([]);
      expect(result.modified).toEqual([]);
      expect(result.deleted).toEqual([]);
    });

    it("detects added check.toml", () => {
      initGitRepo();

      // First commit without check.toml
      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit(testDir);

      // Second commit with check.toml
      writeFileSync(join(testDir, "check.toml"), "[code]");
      git("add check.toml");
      git("commit -m 'Add check.toml'");

      const result = detectCheckTomlChanges(testDir, {
        baseCommit: baseCommit as string,
      });
      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual(["check.toml"]);
      expect(result.modified).toEqual([]);
      expect(result.deleted).toEqual([]);
    });

    it("detects modified check.toml", () => {
      initGitRepo();

      // First commit with check.toml
      writeFileSync(join(testDir, "check.toml"), "[code]");
      git("add check.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit(testDir);

      // Second commit with modified check.toml
      writeFileSync(join(testDir, "check.toml"), "[code]\nenabled = true");
      git("add check.toml");
      git("commit -m 'Update check.toml'");

      const result = detectCheckTomlChanges(testDir, {
        baseCommit: baseCommit as string,
      });
      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual([]);
      expect(result.modified).toEqual(["check.toml"]);
      expect(result.deleted).toEqual([]);
    });

    it("detects deleted check.toml", () => {
      initGitRepo();

      // First commit with check.toml
      writeFileSync(join(testDir, "check.toml"), "[code]");
      git("add check.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit(testDir);

      // Second commit without check.toml
      git("rm check.toml");
      git("commit -m 'Remove check.toml'");

      const result = detectCheckTomlChanges(testDir, {
        baseCommit: baseCommit as string,
      });
      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual([]);
      expect(result.modified).toEqual([]);
      expect(result.deleted).toEqual(["check.toml"]);
    });

    it("ignores non-check.toml files", () => {
      initGitRepo();

      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit(testDir);

      writeFileSync(join(testDir, "package.json"), "{}");
      git("add package.json");
      git("commit -m 'Add package.json'");

      const result = detectCheckTomlChanges(testDir, {
        baseCommit: baseCommit as string,
      });
      expect(result.hasChanges).toBe(false);
    });

    it("detects check.toml in subdirectories", () => {
      initGitRepo();

      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit(testDir);

      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");
      git("add packages/api/check.toml");
      git("commit -m 'Add nested check.toml'");

      const result = detectCheckTomlChanges(testDir, {
        baseCommit: baseCommit as string,
      });
      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual(["packages/api/check.toml"]);
    });
  });

  describe("getCheckTomlFilesAtCommit", () => {
    it("returns empty for non-git directory", () => {
      expect(getCheckTomlFilesAtCommit(testDir)).toEqual([]);
    });

    it("returns check.toml files at HEAD", () => {
      initGitRepo();

      writeFileSync(join(testDir, "check.toml"), "[code]");
      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");
      git("add .");
      git("commit -m 'Initial commit'");

      const files = getCheckTomlFilesAtCommit(testDir);
      expect(files).toHaveLength(2);
      expect(files).toContain("check.toml");
      expect(files).toContain("packages/api/check.toml");
    });

    it("returns files at specific commit", () => {
      initGitRepo();

      // First commit with one check.toml
      writeFileSync(join(testDir, "check.toml"), "[code]");
      git("add check.toml");
      git("commit -m 'Initial commit'");
      const firstCommit = getHeadCommit(testDir);

      // Second commit adds another
      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");
      git("add .");
      git("commit -m 'Add nested'");

      // Check first commit only has one file
      const filesAtFirst = getCheckTomlFilesAtCommit(
        testDir,
        firstCommit as string
      );
      expect(filesAtFirst).toEqual(["check.toml"]);

      // HEAD has both
      const filesAtHead = getCheckTomlFilesAtCommit(testDir, "HEAD");
      expect(filesAtHead).toHaveLength(2);
    });
  });

  describe("compareCheckTomlFiles", () => {
    it("returns empty for non-git directory", () => {
      const result = compareCheckTomlFiles(testDir, "HEAD~1", "HEAD");
      expect(result.hasChanges).toBe(false);
    });

    it("detects all types of changes", () => {
      initGitRepo();

      // First commit: root check.toml and packages/web/check.toml
      writeFileSync(join(testDir, "check.toml"), "[code]");
      mkdirSync(join(testDir, "packages", "web"), { recursive: true });
      writeFileSync(join(testDir, "packages", "web", "check.toml"), "[code]");
      git("add .");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit(testDir);

      // Second commit: modify root, delete web, add api
      writeFileSync(join(testDir, "check.toml"), "[code]\nmodified = true");
      git("rm packages/web/check.toml");
      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");
      git("add .");
      git("commit -m 'Multiple changes'");

      const result = compareCheckTomlFiles(
        testDir,
        baseCommit as string,
        "HEAD"
      );
      expect(result.hasChanges).toBe(true);
      expect(result.added).toEqual(["packages/api/check.toml"]);
      expect(result.modified).toEqual(["check.toml"]);
      expect(result.deleted).toEqual(["packages/web/check.toml"]);
    });
  });
});
