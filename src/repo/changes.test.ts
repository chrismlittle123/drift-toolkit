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
import {
  getRecentCommits,
  getChangedFilesInCommits,
  detectRecentChanges,
} from "./recent-changes.js";

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

  describe("getRecentCommits", () => {
    it("returns empty for non-git directory", () => {
      const result = getRecentCommits(testDir);
      expect(result).toEqual([]);
    });

    it("returns empty for repo with no commits", () => {
      initGitRepo();
      const result = getRecentCommits(testDir);
      expect(result).toEqual([]);
    });

    it("returns commits within time window", () => {
      initGitRepo();

      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");

      writeFileSync(join(testDir, "file2.txt"), "content");
      git("add file2.txt");
      git("commit -m 'Second commit'");

      // Should find commits from the last 24 hours (our commits were just made)
      const result = getRecentCommits(testDir, { hours: 24 });
      expect(result).toHaveLength(2);
      expect(result[0].message).toBe("Second commit");
      expect(result[1].message).toBe("Initial commit");
      expect(result[0].sha).toMatch(/^[a-f0-9]{40}$/);
      expect(result[0].author).toBe("test@test.com");
      expect(result[0].date).toBeInstanceOf(Date);
    });

    it("returns empty when no commits in time window", () => {
      initGitRepo();

      // Create a commit with an old date (48 hours ago)
      // Must set both author date and committer date for --since to work
      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      execSync(
        `git commit -m 'Old commit' --date="${oldDate}"`,
        {
          cwd: testDir,
          encoding: "utf-8",
          env: { ...process.env, GIT_COMMITTER_DATE: oldDate },
        }
      );

      // Look for commits in the last 24 hours - should find none
      const result = getRecentCommits(testDir, { hours: 24 });
      expect(result).toEqual([]);
    });

    it("works with master branch", () => {
      initGitRepo();
      // Rename main to master
      git("branch -m master");

      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");

      const result = getRecentCommits(testDir, { hours: 24 });
      expect(result).toHaveLength(1);
    });

    it("respects explicit branch parameter", () => {
      initGitRepo();

      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Main commit'");

      git("checkout -b feature");
      writeFileSync(join(testDir, "feature.txt"), "feature");
      git("add feature.txt");
      git("commit -m 'Feature commit'");

      // Check main branch only
      const mainResult = getRecentCommits(testDir, { hours: 24, branch: "main" });
      expect(mainResult).toHaveLength(1);
      expect(mainResult[0].message).toBe("Main commit");

      // Check feature branch
      const featureResult = getRecentCommits(testDir, { hours: 24, branch: "feature" });
      expect(featureResult).toHaveLength(2);
    });
  });

  describe("getChangedFilesInCommits", () => {
    it("returns empty for empty commits array", () => {
      const result = getChangedFilesInCommits(testDir, []);
      expect(result).toEqual({
        files: [],
        commits: [],
        authors: [],
        hasCommits: false,
      });
    });

    it("returns changed files for single commit", () => {
      initGitRepo();

      writeFileSync(join(testDir, "README.md"), "# Test");
      writeFileSync(join(testDir, "check.toml"), "[code]");
      git("add .");
      git("commit -m 'Initial commit'");

      const commits = getRecentCommits(testDir, { hours: 24 });
      const result = getChangedFilesInCommits(testDir, commits);

      expect(result.hasCommits).toBe(true);
      expect(result.files).toContain("README.md");
      expect(result.files).toContain("check.toml");
      expect(result.commits).toHaveLength(1);
      expect(result.authors).toEqual(["test@test.com"]);
    });

    it("aggregates files from multiple commits", () => {
      initGitRepo();

      writeFileSync(join(testDir, "file1.txt"), "content1");
      git("add file1.txt");
      git("commit -m 'First commit'");

      writeFileSync(join(testDir, "file2.txt"), "content2");
      git("add file2.txt");
      git("commit -m 'Second commit'");

      writeFileSync(join(testDir, "file3.txt"), "content3");
      git("add file3.txt");
      git("commit -m 'Third commit'");

      const commits = getRecentCommits(testDir, { hours: 24 });
      const result = getChangedFilesInCommits(testDir, commits);

      expect(result.files).toContain("file1.txt");
      expect(result.files).toContain("file2.txt");
      expect(result.files).toContain("file3.txt");
      expect(result.commits).toHaveLength(3);
    });

    it("captures multiple authors", () => {
      initGitRepo();

      writeFileSync(join(testDir, "file1.txt"), "content1");
      git("add file1.txt");
      git("commit -m 'First commit'");

      // Change author for second commit
      git("config user.email 'other@test.com'");
      writeFileSync(join(testDir, "file2.txt"), "content2");
      git("add file2.txt");
      git("commit -m 'Second commit'");

      const commits = getRecentCommits(testDir, { hours: 24 });
      const result = getChangedFilesInCommits(testDir, commits);

      expect(result.authors).toContain("test@test.com");
      expect(result.authors).toContain("other@test.com");
      expect(result.authors).toHaveLength(2);
    });
  });

  describe("detectRecentChanges", () => {
    it("returns empty for non-git directory", () => {
      const result = detectRecentChanges(testDir);
      expect(result).toEqual({
        files: [],
        commits: [],
        authors: [],
        hasCommits: false,
      });
    });

    it("detects recent changes in one call", () => {
      initGitRepo();

      writeFileSync(join(testDir, "check.toml"), "[code]");
      writeFileSync(join(testDir, ".eslintrc.js"), "module.exports = {}");
      git("add .");
      git("commit -m 'Add config files'");

      const result = detectRecentChanges(testDir, { hours: 24 });

      expect(result.hasCommits).toBe(true);
      expect(result.files).toContain("check.toml");
      expect(result.files).toContain(".eslintrc.js");
      expect(result.commits).toHaveLength(1);
      expect(result.authors).toEqual(["test@test.com"]);
    });

    it("returns empty when no recent activity", () => {
      initGitRepo();

      // Create a commit with an old date (48 hours ago)
      // Must set both author date and committer date for --since to work
      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      execSync(
        `git commit -m 'Old commit' --date="${oldDate}"`,
        {
          cwd: testDir,
          encoding: "utf-8",
          env: { ...process.env, GIT_COMMITTER_DATE: oldDate },
        }
      );

      // Look for changes in the last 24 hours - should find none
      const result = detectRecentChanges(testDir, { hours: 24 });
      expect(result.hasCommits).toBe(false);
      expect(result.files).toEqual([]);
    });
  });
});
