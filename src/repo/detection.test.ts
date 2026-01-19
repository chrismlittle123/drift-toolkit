import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  findMetadataPath,
  parseRepoMetadata,
  getRepoMetadata,
  findCheckTomlFiles,
  hasCheckToml,
  hasMetadata,
  isScannableRepo,
} from "./detection.js";

describe("repo detection", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(
      tmpdir(),
      `drift-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("findMetadataPath", () => {
    it("returns null when no metadata file exists", () => {
      expect(findMetadataPath(testDir)).toBeNull();
    });

    it("finds repo-metadata.yaml", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "tier: production");
      expect(findMetadataPath(testDir)).toBe(
        join(testDir, "repo-metadata.yaml")
      );
    });

    it("finds repo-metadata.yml", () => {
      writeFileSync(join(testDir, "repo-metadata.yml"), "tier: production");
      expect(findMetadataPath(testDir)).toBe(
        join(testDir, "repo-metadata.yml")
      );
    });

    it("prefers .yaml over .yml", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "tier: production");
      writeFileSync(join(testDir, "repo-metadata.yml"), "tier: internal");
      expect(findMetadataPath(testDir)).toBe(
        join(testDir, "repo-metadata.yaml")
      );
    });
  });

  describe("parseRepoMetadata", () => {
    it("returns null for invalid YAML", () => {
      expect(parseRepoMetadata("{{invalid")).toBeNull();
    });

    it("returns null for non-object YAML", () => {
      expect(parseRepoMetadata("just a string")).toBeNull();
    });

    it("parses valid metadata with all fields", () => {
      const result = parseRepoMetadata(`
tier: production
status: active
team: backend
`);
      expect(result).not.toBeNull();
      expect(result?.metadata.tier).toBe("production");
      expect(result?.metadata.status).toBe("active");
      expect(result?.metadata.team).toBe("backend");
      expect(result?.warnings).toHaveLength(0);
    });

    it("applies defaults for missing fields", () => {
      const result = parseRepoMetadata("team: frontend");
      expect(result).not.toBeNull();
      expect(result?.metadata.tier).toBe("internal");
      expect(result?.metadata.status).toBe("active");
      expect(result?.metadata.team).toBe("frontend");
    });

    it("warns about invalid tier", () => {
      const result = parseRepoMetadata("tier: invalid-tier");
      expect(result).not.toBeNull();
      expect(result?.metadata.tier).toBe("internal"); // default
      expect(result?.warnings).toHaveLength(1);
      expect(result?.warnings[0]).toContain("Invalid tier");
    });

    it("warns about invalid status", () => {
      const result = parseRepoMetadata("status: invalid-status");
      expect(result).not.toBeNull();
      expect(result?.metadata.status).toBe("active"); // default
      expect(result?.warnings).toHaveLength(1);
      expect(result?.warnings[0]).toContain("Invalid status");
    });

    it("preserves raw metadata", () => {
      const result = parseRepoMetadata(`
tier: production
custom_field: custom_value
`);
      expect(result?.metadata.raw).toEqual({
        tier: "production",
        custom_field: "custom_value",
      });
    });
  });

  describe("getRepoMetadata", () => {
    it("returns null when no metadata file exists", () => {
      expect(getRepoMetadata(testDir)).toBeNull();
    });

    it("loads and parses metadata file", () => {
      writeFileSync(
        join(testDir, "repo-metadata.yaml"),
        "tier: production\nstatus: pre-release"
      );
      const result = getRepoMetadata(testDir);
      expect(result).not.toBeNull();
      expect(result?.metadata.tier).toBe("production");
      expect(result?.metadata.status).toBe("pre-release");
    });
  });

  describe("findCheckTomlFiles", () => {
    it("returns empty array when no check.toml exists", () => {
      expect(findCheckTomlFiles(testDir)).toEqual([]);
    });

    it("finds check.toml at root", () => {
      writeFileSync(join(testDir, "check.toml"), "[code]");
      expect(findCheckTomlFiles(testDir)).toEqual(["check.toml"]);
    });

    it("finds check.toml in subdirectories", () => {
      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      mkdirSync(join(testDir, "packages", "web"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");
      writeFileSync(join(testDir, "packages", "web", "check.toml"), "[code]");

      const files = findCheckTomlFiles(testDir);
      expect(files).toHaveLength(2);
      expect(files).toContain(join("packages", "api", "check.toml"));
      expect(files).toContain(join("packages", "web", "check.toml"));
    });

    it("finds check.toml at root and in subdirectories", () => {
      mkdirSync(join(testDir, "packages", "lib"), { recursive: true });
      writeFileSync(join(testDir, "check.toml"), "[code]");
      writeFileSync(join(testDir, "packages", "lib", "check.toml"), "[code]");

      const files = findCheckTomlFiles(testDir);
      expect(files).toHaveLength(2);
      expect(files).toContain("check.toml");
      expect(files).toContain(join("packages", "lib", "check.toml"));
    });

    it("skips node_modules", () => {
      mkdirSync(join(testDir, "node_modules", "some-pkg"), { recursive: true });
      writeFileSync(
        join(testDir, "node_modules", "some-pkg", "check.toml"),
        "[code]"
      );
      expect(findCheckTomlFiles(testDir)).toEqual([]);
    });

    it("skips .git directory", () => {
      mkdirSync(join(testDir, ".git", "hooks"), { recursive: true });
      writeFileSync(join(testDir, ".git", "hooks", "check.toml"), "[code]");
      expect(findCheckTomlFiles(testDir)).toEqual([]);
    });

    it("respects maxDepth", () => {
      mkdirSync(join(testDir, "a", "b", "c", "d"), { recursive: true });
      writeFileSync(join(testDir, "a", "check.toml"), "[code]");
      writeFileSync(join(testDir, "a", "b", "c", "d", "check.toml"), "[code]");

      // With default maxDepth=3, should find the one at depth 1 but not depth 4
      const files = findCheckTomlFiles(testDir, 2);
      expect(files).toHaveLength(1);
      expect(files).toContain(join("a", "check.toml"));
    });
  });

  describe("hasCheckToml", () => {
    it("returns false when no check.toml exists", () => {
      expect(hasCheckToml(testDir)).toBe(false);
    });

    it("returns true when check.toml exists at root", () => {
      writeFileSync(join(testDir, "check.toml"), "[code]");
      expect(hasCheckToml(testDir)).toBe(true);
    });

    it("returns true when check.toml exists in subdirectory", () => {
      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");
      expect(hasCheckToml(testDir)).toBe(true);
    });
  });

  describe("hasMetadata", () => {
    it("returns false when no metadata file exists", () => {
      expect(hasMetadata(testDir)).toBe(false);
    });

    it("returns true when repo-metadata.yaml exists", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "tier: production");
      expect(hasMetadata(testDir)).toBe(true);
    });
  });

  describe("isScannableRepo", () => {
    it("returns not scannable when both files are missing", () => {
      const result = isScannableRepo(testDir);
      expect(result.scannable).toBe(false);
      expect(result.hasMetadata).toBe(false);
      expect(result.hasCheckToml).toBe(false);
      expect(result.checkTomlPaths).toEqual([]);
      expect(result.metadata).toBeUndefined();
    });

    it("returns not scannable when only metadata exists", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "tier: production");
      const result = isScannableRepo(testDir);
      expect(result.scannable).toBe(false);
      expect(result.hasMetadata).toBe(true);
      expect(result.hasCheckToml).toBe(false);
      expect(result.metadata).toBeDefined();
    });

    it("returns not scannable when only check.toml exists", () => {
      writeFileSync(join(testDir, "check.toml"), "[code]");
      const result = isScannableRepo(testDir);
      expect(result.scannable).toBe(false);
      expect(result.hasMetadata).toBe(false);
      expect(result.hasCheckToml).toBe(true);
      expect(result.checkTomlPaths).toEqual(["check.toml"]);
    });

    it("returns scannable when both files exist", () => {
      writeFileSync(
        join(testDir, "repo-metadata.yaml"),
        "tier: production\nstatus: active"
      );
      writeFileSync(join(testDir, "check.toml"), "[code]");
      const result = isScannableRepo(testDir);
      expect(result.scannable).toBe(true);
      expect(result.hasMetadata).toBe(true);
      expect(result.hasCheckToml).toBe(true);
      expect(result.checkTomlPaths).toEqual(["check.toml"]);
      expect(result.metadata?.tier).toBe("production");
      expect(result.metadata?.status).toBe("active");
    });

    it("returns scannable for monorepo with check.toml in subdirectory", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "tier: internal");
      mkdirSync(join(testDir, "packages", "api"), { recursive: true });
      writeFileSync(join(testDir, "packages", "api", "check.toml"), "[code]");

      const result = isScannableRepo(testDir);
      expect(result.scannable).toBe(true);
      expect(result.checkTomlPaths).toContain(
        join("packages", "api", "check.toml")
      );
    });

    it("handles errors gracefully", () => {
      const result = isScannableRepo("/nonexistent/path/that/does/not/exist");
      expect(result.scannable).toBe(false);
      // Should not throw, just return not scannable
    });
  });
});
