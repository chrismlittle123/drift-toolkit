import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock all dependencies before importing org-scanner
vi.mock("../github/client.js", () => ({
  listRepos: vi.fn(),
  cloneRepo: vi.fn(),
  createTempDir: vi.fn(),
  removeTempDir: vi.fn(),
  getGitHubToken: vi.fn(),
  repoExists: vi.fn(),
}));

vi.mock("../config/loader.js", () => ({
  loadConfig: vi.fn(),
  loadRepoMetadata: vi.fn(),
}));

vi.mock("../integrity/checker.js", () => ({
  checkAllIntegrity: vi.fn(),
  discoverFiles: vi.fn(),
}));

vi.mock("../scanner/runner.js", () => ({
  runAllScans: vi.fn(),
}));

// Import after mocks are set up
import { scanOrg } from "../github/org-scanner.js";
import {
  listRepos,
  cloneRepo,
  createTempDir,
  removeTempDir,
  getGitHubToken,
  repoExists,
} from "../github/client.js";
import { loadConfig, loadRepoMetadata } from "../config/loader.js";
import { checkAllIntegrity, discoverFiles } from "../integrity/checker.js";
import { runAllScans } from "../scanner/runner.js";

describe("org-scanner", () => {
  let mockExit: any;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console and process.exit
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as () => never);

    // Default mock implementations
    vi.mocked(getGitHubToken).mockReturnValue("test-token");
    vi.mocked(createTempDir).mockImplementation(
      (prefix) => `/tmp/drift-${prefix}-123`
    );
    vi.mocked(removeTempDir).mockImplementation(() => {});
    vi.mocked(loadRepoMetadata).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("config repo validation", () => {
    it("errors when config repo does not exist", async () => {
      vi.mocked(repoExists).mockResolvedValue(false);

      await expect(scanOrg({ org: "test-org" })).rejects.toThrow(
        "process.exit called"
      );

      expect(repoExists).toHaveBeenCalledWith(
        "test-org",
        "drift-config",
        "test-token"
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Config repo test-org/drift-config not found")
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("uses custom config repo name when provided", async () => {
      vi.mocked(repoExists).mockResolvedValue(false);

      await expect(
        scanOrg({ org: "test-org", configRepo: "custom-config" })
      ).rejects.toThrow("process.exit called");

      expect(repoExists).toHaveBeenCalledWith(
        "test-org",
        "custom-config",
        "test-token"
      );
    });
  });

  describe("config loading", () => {
    it("errors when config repo has no drift.config.yaml", async () => {
      vi.mocked(repoExists).mockResolvedValue(true);
      vi.mocked(cloneRepo).mockImplementation(() => {});
      vi.mocked(loadConfig).mockReturnValue(null);

      await expect(scanOrg({ org: "test-org" })).rejects.toThrow(
        "process.exit called"
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("No drift.config.yaml found")
      );
      expect(removeTempDir).toHaveBeenCalled(); // Cleanup should happen
    });
  });

  describe("repo scanning", () => {
    const mockConfig = {
      integrity: {
        protected: [
          {
            file: "CODEOWNERS",
            approved: "approved/CODEOWNERS",
            severity: "critical" as const,
          },
        ],
      },
      scans: [{ name: "test-scan", command: "echo test" }],
    };

    beforeEach(() => {
      vi.mocked(repoExists).mockResolvedValue(true);
      vi.mocked(cloneRepo).mockImplementation(() => {});
      vi.mocked(loadConfig).mockReturnValue(mockConfig);
      vi.mocked(checkAllIntegrity).mockReturnValue([]);
      vi.mocked(discoverFiles).mockReturnValue([]);
      vi.mocked(runAllScans).mockReturnValue([]);
    });

    it("scans single repo when --repo is provided", async () => {
      const results = await scanOrg({
        org: "test-org",
        repo: "my-repo",
        json: true,
      });

      expect(listRepos).not.toHaveBeenCalled(); // Should not list all repos
      expect(cloneRepo).toHaveBeenCalledTimes(2); // Config repo + target repo
      expect(results.repos).toHaveLength(1);
      expect(results.repos[0].repo).toBe("my-repo");
    });

    it("scans all repos in org when --repo is not provided", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "repo1",
            full_name: "test-org/repo1",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "repo2",
            full_name: "test-org/repo2",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "drift-config",
            full_name: "test-org/drift-config",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(listRepos).toHaveBeenCalledWith("test-org", "test-token");
      // Should scan repo1 and repo2, but NOT drift-config (excluded)
      expect(results.repos).toHaveLength(2);
      expect(results.repos.map((r) => r.repo)).toEqual(["repo1", "repo2"]);
    });

    it("aggregates passing results across repos", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "repo1",
            full_name: "test-org/repo1",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "repo2",
            full_name: "test-org/repo2",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      // Both repos pass integrity
      vi.mocked(checkAllIntegrity)
        .mockReturnValueOnce([
          {
            file: "CODEOWNERS",
            status: "match",
            severity: "critical",
            timestamp: "",
          },
        ])
        .mockReturnValueOnce([
          {
            file: "CODEOWNERS",
            status: "match",
            severity: "critical",
            timestamp: "",
          },
        ]);

      // Both repos pass scans
      vi.mocked(runAllScans)
        .mockReturnValueOnce([
          { scan: "test", status: "pass", duration: 100, timestamp: "" },
        ])
        .mockReturnValueOnce([
          { scan: "test", status: "pass", duration: 100, timestamp: "" },
        ]);

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.summary.reposScanned).toBe(2);
      expect(results.summary.reposWithIssues).toBe(0);
      expect(results.summary.totalIntegrityPassed).toBe(2);
      expect(results.summary.totalScansPassed).toBe(2);
    });

    it("aggregates failures across repos", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "repo1",
            full_name: "test-org/repo1",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "repo2",
            full_name: "test-org/repo2",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      // repo1 has integrity drift, repo2 passes integrity
      vi.mocked(checkAllIntegrity)
        .mockReturnValueOnce([
          {
            file: "CODEOWNERS",
            status: "drift",
            severity: "critical",
            timestamp: "",
          },
        ])
        .mockReturnValueOnce([
          {
            file: "CODEOWNERS",
            status: "match",
            severity: "critical",
            timestamp: "",
          },
        ]);

      // repo1 passes scans, repo2 fails scans
      vi.mocked(runAllScans)
        .mockReturnValueOnce([
          { scan: "test", status: "pass", duration: 100, timestamp: "" },
        ])
        .mockReturnValueOnce([
          {
            scan: "test",
            status: "fail",
            exitCode: 1,
            duration: 100,
            timestamp: "",
          },
        ]);

      // Since repos have issues, scanOrg calls process.exit(1) which our mock throws
      await expect(scanOrg({ org: "test-org", json: true })).rejects.toThrow(
        "process.exit called"
      );
      expect(mockExit).toHaveBeenCalledWith(1);

      // Verify JSON output contains the aggregated results
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"reposScanned": 2')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"reposWithIssues": 2')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"totalIntegrityFailed": 1')
      );
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('"totalScansFailed": 1')
      );
    });

    it("handles clone failures gracefully", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "good-repo",
            full_name: "test-org/good-repo",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "bad-repo",
            full_name: "test-org/bad-repo",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      // First clone (config) succeeds, second (good-repo) succeeds, third (bad-repo) fails
      vi.mocked(cloneRepo).mockImplementation((_org, repo) => {
        if (repo === "bad-repo") {
          throw new Error("Clone failed: repository not found");
        }
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.summary.reposScanned).toBe(1);
      expect(results.summary.reposSkipped).toBe(1);
      expect(results.repos.find((r) => r.repo === "bad-repo")?.error).toContain(
        "Clone failed"
      );
    });

    it("cleans up temp directories after scanning", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "repo1",
            full_name: "test-org/repo1",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      await scanOrg({ org: "test-org", json: true });

      // Should clean up config dir and repo dir
      expect(removeTempDir).toHaveBeenCalledTimes(2);
    });
  });

  describe("output formatting", () => {
    const mockConfig = {
      integrity: {
        protected: [
          {
            file: "CODEOWNERS",
            approved: "approved/CODEOWNERS",
            severity: "critical" as const,
          },
        ],
      },
    };

    beforeEach(() => {
      vi.mocked(repoExists).mockResolvedValue(true);
      vi.mocked(cloneRepo).mockImplementation(() => {});
      vi.mocked(loadConfig).mockReturnValue(mockConfig);
      vi.mocked(checkAllIntegrity).mockReturnValue([]);
      vi.mocked(discoverFiles).mockReturnValue([]);
      vi.mocked(runAllScans).mockReturnValue([]);
      vi.mocked(listRepos).mockResolvedValue({ repos: [], isOrg: true });
    });

    it("outputs JSON when --json flag is set", async () => {
      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.org).toBe("test-org");
      expect(results.configRepo).toBe("drift-config");
      expect(results.timestamp).toBeDefined();
      expect(results.repos).toBeInstanceOf(Array);
      expect(results.summary).toBeDefined();
    });

    it("includes org and configRepo in results", async () => {
      const results = await scanOrg({
        org: "my-org",
        configRepo: "custom-config",
        json: true,
      });

      expect(results.org).toBe("my-org");
      expect(results.configRepo).toBe("custom-config");
    });
  });

  describe("repo exclusion", () => {
    const mockConfig = {
      integrity: {
        protected: [
          {
            file: "CODEOWNERS",
            approved: "approved/CODEOWNERS",
            severity: "critical" as const,
          },
        ],
      },
      exclude: ["*-deprecated", "archived-*", "test-repo"],
    };

    beforeEach(() => {
      vi.mocked(repoExists).mockResolvedValue(true);
      vi.mocked(cloneRepo).mockImplementation(() => {});
      vi.mocked(loadConfig).mockReturnValue(mockConfig);
      vi.mocked(checkAllIntegrity).mockReturnValue([]);
      vi.mocked(discoverFiles).mockReturnValue([]);
      vi.mocked(runAllScans).mockReturnValue([]);
    });

    it("excludes repos matching exact names", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "test-repo",
            full_name: "test-org/test-repo",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "other-repo",
            full_name: "test-org/other-repo",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.repos).toHaveLength(1);
      expect(results.repos[0].repo).toBe("other-repo");
    });

    it("excludes repos matching suffix patterns (*-deprecated)", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "old-api-deprecated",
            full_name: "test-org/old-api-deprecated",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "new-api",
            full_name: "test-org/new-api",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.repos).toHaveLength(1);
      expect(results.repos[0].repo).toBe("new-api");
    });

    it("excludes repos matching prefix patterns (archived-*)", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "archived-old-service",
            full_name: "test-org/archived-old-service",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "active-service",
            full_name: "test-org/active-service",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.repos).toHaveLength(1);
      expect(results.repos[0].repo).toBe("active-service");
    });

    it("excludes multiple repos matching different patterns", async () => {
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "archived-old",
            full_name: "test-org/archived-old",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "api-deprecated",
            full_name: "test-org/api-deprecated",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "test-repo",
            full_name: "test-org/test-repo",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "production-api",
            full_name: "test-org/production-api",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.repos).toHaveLength(1);
      expect(results.repos[0].repo).toBe("production-api");
    });

    it("scans all repos when no exclude patterns configured", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        integrity: mockConfig.integrity,
        // No exclude field
      });

      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "repo1",
            full_name: "test-org/repo1",
            clone_url: "",
            archived: false,
            disabled: false,
          },
          {
            name: "repo2",
            full_name: "test-org/repo2",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });

      const results = await scanOrg({ org: "test-org", json: true });

      expect(results.repos).toHaveLength(2);
    });
  });

  describe("exit codes", () => {
    const mockConfig = {
      integrity: {
        protected: [
          {
            file: "CODEOWNERS",
            approved: "approved/CODEOWNERS",
            severity: "critical" as const,
          },
        ],
      },
    };

    beforeEach(() => {
      vi.mocked(repoExists).mockResolvedValue(true);
      vi.mocked(cloneRepo).mockImplementation(() => {});
      vi.mocked(loadConfig).mockReturnValue(mockConfig);
      vi.mocked(discoverFiles).mockReturnValue([]);
      vi.mocked(runAllScans).mockReturnValue([]);
      vi.mocked(listRepos).mockResolvedValue({
        repos: [
          {
            name: "repo1",
            full_name: "test-org/repo1",
            clone_url: "",
            archived: false,
            disabled: false,
          },
        ],
        isOrg: true,
      });
    });

    it("exits with 1 when repos have issues", async () => {
      vi.mocked(checkAllIntegrity).mockReturnValue([
        {
          file: "CODEOWNERS",
          status: "drift",
          severity: "critical",
          timestamp: "",
        },
      ]);

      await expect(scanOrg({ org: "test-org", json: true })).rejects.toThrow(
        "process.exit called"
      );
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("exits with 0 when all repos pass", async () => {
      vi.mocked(checkAllIntegrity).mockReturnValue([
        {
          file: "CODEOWNERS",
          status: "match",
          severity: "critical",
          timestamp: "",
        },
      ]);

      // Should not throw (no exit called)
      const results = await scanOrg({ org: "test-org", json: true });
      expect(results.summary.reposWithIssues).toBe(0);
    });
  });
});
