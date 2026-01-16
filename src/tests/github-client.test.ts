import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getGitHubToken,
  listOrgRepos,
  createTempDir,
  removeTempDir,
  repoExists,
  cloneRepo,
} from "../github/client.js";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock child_process for cloneRepo tests
vi.mock("child_process", async () => {
  const actual = await vi.importActual("child_process");
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

import { execSync } from "child_process";

describe("github client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  describe("getGitHubToken", () => {
    it("returns CLI option when provided", () => {
      process.env.GITHUB_TOKEN = "env-token";
      expect(getGitHubToken("cli-token")).toBe("cli-token");
    });

    it("returns env var when CLI option not provided", () => {
      process.env.GITHUB_TOKEN = "env-token";
      expect(getGitHubToken()).toBe("env-token");
    });

    it("returns undefined when neither is set", () => {
      expect(getGitHubToken()).toBeUndefined();
    });
  });

  describe("listOrgRepos", () => {
    it("fetches repos from GitHub API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              name: "repo1",
              full_name: "org/repo1",
              clone_url: "https://github.com/org/repo1.git",
              archived: false,
              disabled: false,
            },
            {
              name: "repo2",
              full_name: "org/repo2",
              clone_url: "https://github.com/org/repo2.git",
              archived: false,
              disabled: false,
            },
          ]),
      });

      const repos = await listOrgRepos("testorg");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/orgs/testorg/repos?per_page=100&page=1&type=all",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github+json",
          }),
        })
      );
      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe("repo1");
    });

    it("filters out archived repos", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              name: "active",
              full_name: "org/active",
              clone_url: "https://github.com/org/active.git",
              archived: false,
              disabled: false,
            },
            {
              name: "archived",
              full_name: "org/archived",
              clone_url: "https://github.com/org/archived.git",
              archived: true,
              disabled: false,
            },
          ]),
      });

      const repos = await listOrgRepos("testorg");

      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe("active");
    });

    it("includes auth header when token provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await listOrgRepos("testorg", "my-token");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-token",
          }),
        })
      );
    });

    it("throws on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve("Not Found"),
      });

      await expect(listOrgRepos("badorg")).rejects.toThrow(
        "GitHub API error: 404"
      );
    });

    it("handles pagination", async () => {
      // First page - full
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            Array(100)
              .fill(null)
              .map((_, i) => ({
                name: `repo${i}`,
                full_name: `org/repo${i}`,
                clone_url: `https://github.com/org/repo${i}.git`,
                archived: false,
                disabled: false,
              }))
          ),
      });

      // Second page - partial
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              name: "repo100",
              full_name: "org/repo100",
              clone_url: "https://github.com/org/repo100.git",
              archived: false,
              disabled: false,
            },
          ]),
      });

      const repos = await listOrgRepos("testorg");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(repos).toHaveLength(101);
    });
  });

  describe("repoExists", () => {
    it("returns true when repo exists", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const exists = await repoExists("org", "repo");

      expect(exists).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/org/repo",
        expect.any(Object)
      );
    });

    it("returns false when repo does not exist", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const exists = await repoExists("org", "nonexistent");

      expect(exists).toBe(false);
    });
  });

  describe("createTempDir and removeTempDir", () => {
    it("creates and removes temp directory", () => {
      const dir = createTempDir("test");

      expect(dir).toContain("drift-test-");

      // Should not throw
      removeTempDir(dir);
    });
  });

  describe("cloneRepo", () => {
    beforeEach(() => {
      vi.mocked(execSync).mockReset();
    });

    it("clones repo without token using HTTPS", () => {
      vi.mocked(execSync).mockReturnValue("");

      cloneRepo("myorg", "myrepo", "/tmp/target");

      expect(execSync).toHaveBeenCalledWith(
        'git clone --depth 1 --quiet "https://github.com/myorg/myrepo.git" "/tmp/target"',
        expect.objectContaining({
          encoding: "utf-8",
          timeout: 60000,
        })
      );
    });

    it("clones repo with token using authenticated URL", () => {
      vi.mocked(execSync).mockReturnValue("");

      cloneRepo("myorg", "myrepo", "/tmp/target", "ghp_testtoken");

      expect(execSync).toHaveBeenCalledWith(
        'git clone --depth 1 --quiet "https://x-access-token:ghp_testtoken@github.com/myorg/myrepo.git" "/tmp/target"',
        expect.objectContaining({
          encoding: "utf-8",
          timeout: 60000,
        })
      );
    });

    it("throws error on clone failure", () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("Command failed") as Error & { stderr: string };
        error.stderr = "fatal: repository not found";
        throw error;
      });

      expect(() => cloneRepo("myorg", "badrepo", "/tmp/target")).toThrow(
        "Failed to clone myorg/badrepo"
      );
    });

    it("sanitizes token from error messages", () => {
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("Command failed") as Error & { stderr: string };
        error.stderr =
          "fatal: could not read from https://x-access-token:ghp_secret123@github.com/org/repo.git";
        throw error;
      });

      expect(() =>
        cloneRepo("myorg", "repo", "/tmp/target", "ghp_secret123")
      ).toThrow(/x-access-token:\*\*\*@/);
      expect(() =>
        cloneRepo("myorg", "repo", "/tmp/target", "ghp_secret123")
      ).not.toThrow(/ghp_secret123/);
    });

    it("uses shallow clone for speed", () => {
      vi.mocked(execSync).mockReturnValue("");

      cloneRepo("myorg", "myrepo", "/tmp/target");

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("--depth 1"),
        expect.any(Object)
      );
    });

    it("uses quiet mode", () => {
      vi.mocked(execSync).mockReturnValue("");

      cloneRepo("myorg", "myrepo", "/tmp/target");

      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining("--quiet"),
        expect.any(Object)
      );
    });

    it("sets 60 second timeout", () => {
      vi.mocked(execSync).mockReturnValue("");

      cloneRepo("myorg", "myrepo", "/tmp/target");

      expect(execSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 60000 })
      );
    });
  });
});
