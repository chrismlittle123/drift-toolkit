import { describe, it, expect } from "vitest";
import {
  formatDriftIssueBody,
  getDriftIssueTitle,
  getDriftIssueLabel,
  formatMissingProjectsIssueBody,
  getMissingProjectsIssueTitle,
  getMissingProjectsIssueLabel,
  formatTierMismatchIssueBody,
  getTierMismatchIssueTitle,
  getTierMismatchIssueLabel,
} from "./issue-formatter.js";
import type {
  DriftDetection,
  MissingProjectsDetection,
  TierMismatchDetection,
} from "../types.js";

describe("issue-formatter", () => {
  describe("formatDriftIssueBody", () => {
    it("formats basic drift detection", () => {
      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234567890",
        commitUrl: "https://github.com/org/repo/commit/abc1234567890",
        changes: [
          {
            file: "check.toml",
            status: "modified",
            diff: "- old\n+ new",
          },
        ],
      };

      const body = formatDriftIssueBody(detection);

      expect(body).toContain("Configuration Drift Detected");
      expect(body).toContain("`org/repo`");
      expect(body).toContain("2024-01-15 02:00 UTC");
      expect(body).toContain("[abc1234](");
      expect(body).toContain("check.toml");
      expect(body).toContain("```diff");
      expect(body).toContain("- old");
      expect(body).toContain("+ new");
      expect(body).toContain("Action Required");
      expect(body).toContain("Created by drift-toolkit");
    });

    it("handles multiple file changes", () => {
      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234",
        commitUrl: "https://github.com/org/repo/commit/abc1234",
        changes: [
          {
            file: "check.toml",
            status: "modified",
            diff: "- old\n+ new",
          },
          {
            file: ".eslintrc.js",
            status: "modified",
            diff: '- "warn"\n+ "off"',
          },
        ],
      };

      const body = formatDriftIssueBody(detection);

      expect(body).toContain("check.toml");
      expect(body).toContain(".eslintrc.js");
      expect(body).toContain("- old");
      expect(body).toContain('- "warn"');
    });

    it("truncates large diffs", () => {
      const largeDiff = Array(100).fill("+ line").join("\n");
      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234",
        commitUrl: "https://github.com/org/repo/commit/abc1234",
        changes: [{ file: "large.txt", status: "modified", diff: largeDiff }],
      };

      const body = formatDriftIssueBody(detection);

      expect(body).toContain("(truncated)");
      // Should only have first 20 lines (default DISPLAY_LIMITS.diffLines)
      const diffMatches = body.match(/\+ line/g);
      expect(diffMatches?.length).toBeLessThanOrEqual(20);
    });

    it("handles deleted files", () => {
      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234",
        commitUrl: "https://github.com/org/repo/commit/abc1234",
        changes: [{ file: "removed.txt", status: "deleted" }],
      };

      const body = formatDriftIssueBody(detection);

      expect(body).toContain("removed.txt");
      expect(body).toContain("(deleted)");
      expect(body).toContain("File was deleted");
    });

    it("handles added files", () => {
      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234",
        commitUrl: "https://github.com/org/repo/commit/abc1234",
        changes: [
          { file: "new-file.txt", status: "added", diff: "+ new content" },
        ],
      };

      const body = formatDriftIssueBody(detection);

      expect(body).toContain("new-file.txt");
      expect(body).toContain("(new)");
      expect(body).toContain("+ new content");
    });

    it("truncates extremely large issue bodies", () => {
      // Create a detection with many files to exceed the body limit
      const manyChanges = Array.from({ length: 500 }, (_, i) => ({
        file: `file${i}.txt`,
        status: "modified" as const,
        diff: "This is a really long diff content that repeats ".repeat(100),
      }));

      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234",
        commitUrl: "https://github.com/org/repo/commit/abc1234",
        changes: manyChanges,
      };

      const body = formatDriftIssueBody(detection);

      // Should be under 60000 characters
      expect(body.length).toBeLessThanOrEqual(60000);
      expect(body).toContain("(content truncated due to length)");
      expect(body).toContain("Created by drift-toolkit");
    });

    it("links commit hash to commit URL", () => {
      const detection: DriftDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        commit: "abc1234567890def",
        commitUrl: "https://github.com/org/repo/commit/abc1234567890def",
        changes: [{ file: "test.txt", status: "modified", diff: "diff" }],
      };

      const body = formatDriftIssueBody(detection);

      // Should show shortened commit hash as link
      expect(body).toContain(
        "[abc1234](https://github.com/org/repo/commit/abc1234567890def)"
      );
    });
  });

  describe("getDriftIssueTitle", () => {
    it("returns correct title", () => {
      expect(getDriftIssueTitle()).toBe(
        "[drift:code] Configuration changes detected"
      );
    });
  });

  describe("getDriftIssueLabel", () => {
    it("returns correct label", () => {
      expect(getDriftIssueLabel()).toBe("drift:code");
    });
  });

  describe("formatMissingProjectsIssueBody", () => {
    it("formats basic missing projects detection", () => {
      const detection: MissingProjectsDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        projects: [{ path: "packages/api", type: "typescript" }],
      };

      const body = formatMissingProjectsIssueBody(detection);

      expect(body).toContain("New Project Detected Without Standards");
      expect(body).toContain("`org/repo`");
      expect(body).toContain("2024-01-15 02:00 UTC");
      expect(body).toContain("Projects Missing check.toml");
      expect(body).toContain("| packages/api | typescript |");
      expect(body).toContain("Action Required");
      expect(body).toContain("`cm init`");
      expect(body).toContain("Created by drift-toolkit");
    });

    it("handles multiple missing projects", () => {
      const detection: MissingProjectsDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        projects: [
          { path: "packages/api", type: "typescript" },
          { path: "packages/web", type: "typescript" },
          { path: "lambdas/processor", type: "python" },
        ],
      };

      const body = formatMissingProjectsIssueBody(detection);

      expect(body).toContain("| packages/api | typescript |");
      expect(body).toContain("| packages/web | typescript |");
      expect(body).toContain("| lambdas/processor | python |");
    });

    it("handles root-level project", () => {
      const detection: MissingProjectsDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        projects: [{ path: ".", type: "typescript" }],
      };

      const body = formatMissingProjectsIssueBody(detection);

      expect(body).toContain("| . | typescript |");
    });

    it("truncates extremely large issue bodies", () => {
      const manyProjects = Array.from({ length: 1000 }, (_, i) => ({
        path: `very/long/nested/path/to/package${i}/that/is/really/deep`,
        type: "typescript",
      }));

      const detection: MissingProjectsDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        projects: manyProjects,
      };

      const body = formatMissingProjectsIssueBody(detection);

      expect(body.length).toBeLessThanOrEqual(60000);
      expect(body).toContain("(content truncated due to length)");
      expect(body).toContain("Created by drift-toolkit");
    });

    it("includes table headers", () => {
      const detection: MissingProjectsDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        projects: [{ path: "pkg", type: "go" }],
      };

      const body = formatMissingProjectsIssueBody(detection);

      expect(body).toContain("| Path | Type |");
      expect(body).toContain("|------|------|");
    });
  });

  describe("getMissingProjectsIssueTitle", () => {
    it("returns correct title", () => {
      expect(getMissingProjectsIssueTitle()).toBe(
        "[drift:code] New project detected without standards"
      );
    });
  });

  describe("getMissingProjectsIssueLabel", () => {
    it("returns correct label", () => {
      expect(getMissingProjectsIssueLabel()).toBe("drift:code");
    });
  });

  describe("formatTierMismatchIssueBody", () => {
    it("formats tier mismatch detection correctly", () => {
      const detection: TierMismatchDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        tier: "production",
        rulesets: ["typescript-internal"],
        expectedPattern: "*-production",
        error:
          "No ruleset matching pattern '*-production' found. Rulesets: [typescript-internal]",
      };

      const body = formatTierMismatchIssueBody(detection);

      expect(body).toContain("## Tier-Ruleset Mismatch Detected");
      expect(body).toContain("Repository: `org/repo`");
      expect(body).toContain("2024-01-15 02:00 UTC");
      expect(body).toContain("| **Tier** | production |");
      expect(body).toContain("| **Expected Pattern** | `*-production` |");
      expect(body).toContain("| **Current Rulesets** | `typescript-internal` |");
      expect(body).toContain("No ruleset matching pattern");
      expect(body).toContain("Action Required");
      expect(body).toContain("Created by drift-toolkit");
    });

    it("handles multiple rulesets", () => {
      const detection: TierMismatchDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        tier: "internal",
        rulesets: ["typescript-production", "security-production"],
        expectedPattern: "*-internal",
        error: "Mismatch detected",
      };

      const body = formatTierMismatchIssueBody(detection);

      expect(body).toContain(
        "| **Current Rulesets** | `typescript-production`, `security-production` |"
      );
    });

    it("handles empty rulesets", () => {
      const detection: TierMismatchDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        tier: "prototype",
        rulesets: [],
        expectedPattern: "*-prototype",
        error: "No rulesets found",
      };

      const body = formatTierMismatchIssueBody(detection);

      expect(body).toContain("| **Current Rulesets** | _none_ |");
    });

    it("includes remediation steps", () => {
      const detection: TierMismatchDetection = {
        repository: "org/repo",
        scanTime: "2024-01-15 02:00 UTC",
        tier: "production",
        rulesets: ["typescript-internal"],
        expectedPattern: "*-production",
        error: "Mismatch",
      };

      const body = formatTierMismatchIssueBody(detection);

      expect(body).toContain(
        "Update `check.toml` to use a ruleset matching `*-production`"
      );
      expect(body).toContain("update `repo-metadata.yaml` tier");
    });
  });

  describe("getTierMismatchIssueTitle", () => {
    it("returns correct title", () => {
      expect(getTierMismatchIssueTitle()).toBe(
        "[drift:code] Tier-ruleset mismatch detected"
      );
    });
  });

  describe("getTierMismatchIssueLabel", () => {
    it("returns correct label", () => {
      expect(getTierMismatchIssueLabel()).toBe("drift:code");
    });
  });
});
