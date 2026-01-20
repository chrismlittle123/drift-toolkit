import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import {
  generateFileDiff,
  generateMultipleDiffs,
  formatDiffForMarkdown,
} from "./diff.js";

describe("diff", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-diff-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

  function getHeadCommit(): string {
    return git("rev-parse HEAD");
  }

  describe("generateFileDiff", () => {
    it("returns empty diff for non-git directory", () => {
      const result = generateFileDiff(testDir, "file.txt");

      expect(result.diff).toBe("");
      expect(result.truncated).toBe(false);
      expect(result.totalLines).toBe(0);
    });

    it("generates diff for modified file", () => {
      initGitRepo();

      // Create initial file
      writeFileSync(join(testDir, "config.toml"), "enabled = false\n");
      git("add config.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      // Modify file
      writeFileSync(join(testDir, "config.toml"), "enabled = true\n");
      git("add config.toml");
      git("commit -m 'Enable feature'");

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("-enabled = false");
      expect(result.diff).toContain("+enabled = true");
      expect(result.truncated).toBe(false);
    });

    it("generates diff for new file", () => {
      initGitRepo();

      // Create initial commit without the file
      writeFileSync(join(testDir, "README.md"), "# Test");
      git("add README.md");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      // Add new file
      writeFileSync(join(testDir, "config.toml"), "enabled = true\nname = 'test'\n");
      git("add config.toml");
      git("commit -m 'Add config'");

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("+enabled = true");
      expect(result.diff).toContain("+name = 'test'");
      expect(result.truncated).toBe(false);
    });

    it("generates diff for deleted file", () => {
      initGitRepo();

      // Create file
      writeFileSync(join(testDir, "config.toml"), "enabled = true\nname = 'test'\n");
      git("add config.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      // Delete file
      git("rm config.toml");
      git("commit -m 'Remove config'");

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("-enabled = true");
      expect(result.diff).toContain("-name = 'test'");
      expect(result.truncated).toBe(false);
    });

    it("truncates large diffs", () => {
      initGitRepo();

      // Create initial file
      writeFileSync(join(testDir, "large.txt"), "line0\n");
      git("add large.txt");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      // Add many lines
      const lines = Array.from({ length: 200 }, (_, i) => `line${i + 1}`).join(
        "\n"
      );
      writeFileSync(join(testDir, "large.txt"), lines);
      git("add large.txt");
      git("commit -m 'Add many lines'");

      const result = generateFileDiff(testDir, "large.txt", {
        fromCommit: baseCommit,
        maxLines: 10,
      });

      expect(result.truncated).toBe(true);
      expect(result.totalLines).toBeGreaterThan(10);
      expect(result.diff).toContain("...");
    });

    it("includes full diff URL when repoUrl provided", () => {
      initGitRepo();

      writeFileSync(join(testDir, "config.toml"), "enabled = false\n");
      git("add config.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, "config.toml"), "enabled = true\n");
      git("add config.toml");
      git("commit -m 'Enable feature'");
      const headCommit = getHeadCommit();

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
        repoUrl: "https://github.com/owner/repo",
      });

      expect(result.fullDiffUrl).toContain("https://github.com/owner/repo/commit/");
      expect(result.fullDiffUrl).toContain(headCommit);
    });

    it("uses default commits (HEAD~1 to HEAD)", () => {
      initGitRepo();

      // First commit
      writeFileSync(join(testDir, "config.toml"), "version = 1\n");
      git("add config.toml");
      git("commit -m 'Initial commit'");

      // Second commit
      writeFileSync(join(testDir, "config.toml"), "version = 2\n");
      git("add config.toml");
      git("commit -m 'Update version'");

      // Should diff between HEAD~1 and HEAD by default
      const result = generateFileDiff(testDir, "config.toml");

      expect(result.diff).toContain("-version = 1");
      expect(result.diff).toContain("+version = 2");
    });

    it("handles file with multiple changes", () => {
      initGitRepo();

      writeFileSync(
        join(testDir, "config.toml"),
        "[section1]\nenabled = false\n\n[section2]\nname = 'old'\n"
      );
      git("add config.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      writeFileSync(
        join(testDir, "config.toml"),
        "[section1]\nenabled = true\n\n[section2]\nname = 'new'\n"
      );
      git("add config.toml");
      git("commit -m 'Update config'");

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("-enabled = false");
      expect(result.diff).toContain("+enabled = true");
      expect(result.diff).toContain("-name = 'old'");
      expect(result.diff).toContain("+name = 'new'");
    });

    it("returns empty diff for unchanged file", () => {
      initGitRepo();

      writeFileSync(join(testDir, "config.toml"), "enabled = true\n");
      git("add config.toml");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      // Commit something else, but not this file
      writeFileSync(join(testDir, "other.txt"), "other content");
      git("add other.txt");
      git("commit -m 'Add other file'");

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
      });

      expect(result.diff).toBe("");
      expect(result.totalLines).toBe(0);
    });
  });

  describe("generateMultipleDiffs", () => {
    it("generates diffs for multiple files", () => {
      initGitRepo();

      writeFileSync(join(testDir, "file1.txt"), "content1\n");
      writeFileSync(join(testDir, "file2.txt"), "content2\n");
      git("add .");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, "file1.txt"), "modified1\n");
      writeFileSync(join(testDir, "file2.txt"), "modified2\n");
      git("add .");
      git("commit -m 'Update files'");

      const result = generateMultipleDiffs(
        testDir,
        ["file1.txt", "file2.txt"],
        { fromCommit: baseCommit }
      );

      expect(result.size).toBe(2);
      expect(result.get("file1.txt")?.diff).toContain("-content1");
      expect(result.get("file1.txt")?.diff).toContain("+modified1");
      expect(result.get("file2.txt")?.diff).toContain("-content2");
      expect(result.get("file2.txt")?.diff).toContain("+modified2");
    });

    it("handles mix of changed and unchanged files", () => {
      initGitRepo();

      writeFileSync(join(testDir, "changed.txt"), "original\n");
      writeFileSync(join(testDir, "unchanged.txt"), "same\n");
      git("add .");
      git("commit -m 'Initial commit'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, "changed.txt"), "modified\n");
      git("add changed.txt");
      git("commit -m 'Update changed file'");

      const result = generateMultipleDiffs(
        testDir,
        ["changed.txt", "unchanged.txt"],
        { fromCommit: baseCommit }
      );

      expect(result.get("changed.txt")?.diff).toContain("+modified");
      expect(result.get("unchanged.txt")?.diff).toBe("");
    });
  });

  describe("formatDiffForMarkdown", () => {
    it("wraps diff in code block", () => {
      const diff = "-old line\n+new line";
      const result = formatDiffForMarkdown(diff);

      expect(result).toBe("```diff\n-old line\n+new line\n```");
    });

    it("returns empty string for empty diff", () => {
      expect(formatDiffForMarkdown("")).toBe("");
    });

    it("preserves diff content exactly", () => {
      const diff = "- removed\n+ added\n  context";
      const result = formatDiffForMarkdown(diff);

      expect(result).toContain("- removed");
      expect(result).toContain("+ added");
      expect(result).toContain("  context");
    });
  });

  describe("edge cases", () => {
    it("handles files with special characters in name", () => {
      initGitRepo();

      const fileName = "config-test.toml";
      writeFileSync(join(testDir, fileName), "old\n");
      git(`add "${fileName}"`);
      git("commit -m 'Initial'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, fileName), "new\n");
      git(`add "${fileName}"`);
      git("commit -m 'Update'");

      const result = generateFileDiff(testDir, fileName, {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("-old");
      expect(result.diff).toContain("+new");
    });

    it("handles nested file paths", () => {
      initGitRepo();

      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      const filePath = "packages/api/config.toml";
      writeFileSync(join(testDir, filePath), "old\n");
      git("add .");
      git("commit -m 'Initial'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, filePath), "new\n");
      git("add .");
      git("commit -m 'Update'");

      const result = generateFileDiff(testDir, filePath, {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("-old");
      expect(result.diff).toContain("+new");
    });

    it("handles empty file becoming non-empty", () => {
      initGitRepo();

      writeFileSync(join(testDir, "config.toml"), "");
      git("add config.toml");
      git("commit -m 'Initial'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, "config.toml"), "content\n");
      git("add config.toml");
      git("commit -m 'Add content'");

      const result = generateFileDiff(testDir, "config.toml", {
        fromCommit: baseCommit,
      });

      expect(result.diff).toContain("+content");
    });

    it("handles binary-like content gracefully", () => {
      initGitRepo();

      // Create a text file that looks like it might have binary content
      writeFileSync(join(testDir, "data.txt"), "line1\n");
      git("add data.txt");
      git("commit -m 'Initial'");
      const baseCommit = getHeadCommit();

      writeFileSync(join(testDir, "data.txt"), "line2\n");
      git("add data.txt");
      git("commit -m 'Update'");

      const result = generateFileDiff(testDir, "data.txt", {
        fromCommit: baseCommit,
      });

      // Should still produce a diff
      expect(result.diff).toBeTruthy();
    });
  });
});
