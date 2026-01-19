import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadConfig,
  findConfigPath,
  getCodeConfig,
  validateRepoMetadata,
  loadRepoMetadata,
} from "./loader.js";
import type { DriftConfig, RepoContext, MetadataSchema } from "../types.js";

describe("config loader", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("findConfigPath", () => {
    it("returns null when no config file exists", () => {
      expect(findConfigPath(testDir)).toBeNull();
    });

    it("finds drift.config.yaml", () => {
      writeFileSync(join(testDir, "drift.config.yaml"), "scans: []\n");
      expect(findConfigPath(testDir)).toBe(join(testDir, "drift.config.yaml"));
    });

    it("finds drift.config.yml", () => {
      writeFileSync(join(testDir, "drift.config.yml"), "scans: []\n");
      expect(findConfigPath(testDir)).toBe(join(testDir, "drift.config.yml"));
    });

    it("finds drift.yaml", () => {
      writeFileSync(join(testDir, "drift.yaml"), "scans: []\n");
      expect(findConfigPath(testDir)).toBe(join(testDir, "drift.yaml"));
    });

    it("prefers drift.config.yaml over drift.config.yml", () => {
      writeFileSync(join(testDir, "drift.config.yaml"), "scans: []\n");
      writeFileSync(join(testDir, "drift.config.yml"), "scans: []\n");
      expect(findConfigPath(testDir)).toBe(join(testDir, "drift.config.yaml"));
    });

    it("prefers drift.config.yml over drift.yaml", () => {
      writeFileSync(join(testDir, "drift.config.yml"), "scans: []\n");
      writeFileSync(join(testDir, "drift.yaml"), "scans: []\n");
      expect(findConfigPath(testDir)).toBe(join(testDir, "drift.config.yml"));
    });
  });

  describe("loadConfig", () => {
    it("returns null when no config file exists", () => {
      expect(loadConfig(testDir)).toBeNull();
    });

    it("loads valid config with scans", () => {
      const configContent = `
scans:
  - name: test-scan
    command: echo hello
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.scans).toHaveLength(1);
      expect(config?.scans?.[0].name).toBe("test-scan");
      expect(config?.scans?.[0].command).toBe("echo hello");
    });

    it("loads valid config with integrity checks", () => {
      const configContent = `
integrity:
  protected:
    - file: CODEOWNERS
      approved: approved/CODEOWNERS
      severity: critical
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.integrity?.protected).toHaveLength(1);
      expect(config?.integrity?.protected?.[0].file).toBe("CODEOWNERS");
      expect(config?.integrity?.protected?.[0].severity).toBe("critical");
    });

    it("loads config with discovery patterns", () => {
      const configContent = `
integrity:
  discover:
    - pattern: "*.yml"
      suggestion: "YAML files should be reviewed"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.integrity?.discover).toHaveLength(1);
      expect(config?.integrity?.discover?.[0].pattern).toBe("*.yml");
    });

    it("loads config with exclude patterns", () => {
      const configContent = `
exclude:
  - "archived-*"
  - "test-*"
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.exclude).toHaveLength(2);
      expect(config?.exclude).toContain("archived-*");
      expect(config?.exclude).toContain("test-*");
    });

    it("loads nested code domain config", () => {
      const configContent = `
code:
  integrity:
    protected:
      - file: README.md
        approved: approved/README.md
        severity: high
  scans:
    - name: lint
      command: npm run lint
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.code?.integrity?.protected).toHaveLength(1);
      expect(config?.code?.scans).toHaveLength(1);
    });

    it("loads config with schema definition", () => {
      const configContent = `
schema:
  tiers:
    - production
    - internal
    - prototype
  teams:
    - backend
    - frontend
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.schema?.tiers).toHaveLength(3);
      expect(config?.schema?.teams).toHaveLength(2);
    });

    it("returns null for invalid YAML syntax", () => {
      writeFileSync(
        join(testDir, "drift.config.yaml"),
        "{{invalid yaml syntax"
      );

      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const config = loadConfig(testDir);
      consoleSpy.mockRestore();

      expect(config).toBeNull();
    });

    it("returns null for config with invalid scan definition", () => {
      const configContent = `
scans:
  - name: ""
    command: echo hello
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const config = loadConfig(testDir);
      consoleSpy.mockRestore();

      expect(config).toBeNull();
    });

    it("returns null for config with missing required fields", () => {
      const configContent = `
scans:
  - name: test-scan
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const config = loadConfig(testDir);
      consoleSpy.mockRestore();

      expect(config).toBeNull();
    });

    it("loads config with all scan options", () => {
      const configContent = `
scans:
  - name: full-scan
    description: A full scan
    command: npm test
    if_file: package.json
    if_command: which npm
    tiers:
      - production
    outputFormat: json
    severity: high
    timeout: 120
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      const scan = config?.scans?.[0];
      expect(scan?.description).toBe("A full scan");
      expect(scan?.if_file).toBe("package.json");
      expect(scan?.if_command).toBe("which npm");
      expect(scan?.tiers).toEqual(["production"]);
      expect(scan?.outputFormat).toBe("json");
      expect(scan?.severity).toBe("high");
      expect(scan?.timeout).toBe(120);
    });

    it("loads config with if_file as array", () => {
      const configContent = `
scans:
  - name: multi-file-check
    command: npm test
    if_file:
      - package.json
      - tsconfig.json
`;
      writeFileSync(join(testDir, "drift.config.yaml"), configContent);

      const config = loadConfig(testDir);
      expect(config).not.toBeNull();
      expect(config?.scans?.[0].if_file).toEqual([
        "package.json",
        "tsconfig.json",
      ]);
    });
  });

  describe("getCodeConfig", () => {
    it("returns null for empty config", () => {
      const config: DriftConfig = {};
      expect(getCodeConfig(config)).toBeNull();
    });

    it("returns nested code config when present", () => {
      const config: DriftConfig = {
        code: {
          integrity: {
            protected: [
              {
                file: "test.txt",
                approved: "approved/test.txt",
                severity: "low",
              },
            ],
          },
        },
      };
      const codeConfig = getCodeConfig(config);
      expect(codeConfig).not.toBeNull();
      expect(codeConfig?.integrity?.protected).toHaveLength(1);
    });

    it("constructs code config from legacy flat format", () => {
      const config: DriftConfig = {
        integrity: {
          protected: [
            {
              file: "legacy.txt",
              approved: "approved/legacy.txt",
              severity: "medium",
            },
          ],
        },
        scans: [{ name: "legacy-scan", command: "echo legacy" }],
      };
      const codeConfig = getCodeConfig(config);
      expect(codeConfig).not.toBeNull();
      expect(codeConfig?.integrity?.protected).toHaveLength(1);
      expect(codeConfig?.scans).toHaveLength(1);
    });

    it("prefers nested code config over legacy format", () => {
      const config: DriftConfig = {
        code: {
          scans: [{ name: "nested-scan", command: "echo nested" }],
        },
        scans: [{ name: "legacy-scan", command: "echo legacy" }],
      };
      const codeConfig = getCodeConfig(config);
      expect(codeConfig?.scans?.[0].name).toBe("nested-scan");
    });
  });

  describe("validateRepoMetadata", () => {
    it("returns valid with empty warnings when no schema", () => {
      const metadata: RepoContext = { tier: "production", team: "backend" };
      const result = validateRepoMetadata(metadata, undefined);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("returns valid when tier matches schema", () => {
      const metadata: RepoContext = { tier: "production" };
      const schema: MetadataSchema = { tiers: ["production", "internal"] };
      const result = validateRepoMetadata(metadata, schema);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("returns warning for unknown tier", () => {
      const metadata: RepoContext = { tier: "unknown-tier" };
      const schema: MetadataSchema = { tiers: ["production", "internal"] };
      const result = validateRepoMetadata(metadata, schema);
      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Unknown tier");
    });

    it("returns valid when team matches schema", () => {
      const metadata: RepoContext = { team: "backend" };
      const schema: MetadataSchema = { teams: ["backend", "frontend"] };
      const result = validateRepoMetadata(metadata, schema);
      expect(result.valid).toBe(true);
    });

    it("returns warning for unknown team", () => {
      const metadata: RepoContext = { team: "unknown-team" };
      const schema: MetadataSchema = { teams: ["backend", "frontend"] };
      const result = validateRepoMetadata(metadata, schema);
      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("Unknown team");
    });

    it("returns multiple warnings for unknown tier and team", () => {
      const metadata: RepoContext = { tier: "unknown", team: "unknown" };
      const schema: MetadataSchema = {
        tiers: ["production"],
        teams: ["backend"],
      };
      const result = validateRepoMetadata(metadata, schema);
      expect(result.valid).toBe(false);
      expect(result.warnings).toHaveLength(2);
    });
  });

  describe("loadRepoMetadata", () => {
    it("returns null when no metadata file exists", () => {
      expect(loadRepoMetadata(testDir)).toBeNull();
    });

    it("loads metadata from repo-metadata.yaml", () => {
      const metadataContent = `
tier: production
team: backend
`;
      writeFileSync(join(testDir, "repo-metadata.yaml"), metadataContent);

      const result = loadRepoMetadata(testDir);
      expect(result).not.toBeNull();
      expect(result?.context.tier).toBe("production");
      expect(result?.context.team).toBe("backend");
    });

    it("loads metadata from repo-metadata.yml", () => {
      const metadataContent = `
tier: internal
team: frontend
`;
      writeFileSync(join(testDir, "repo-metadata.yml"), metadataContent);

      const result = loadRepoMetadata(testDir);
      expect(result).not.toBeNull();
      expect(result?.context.tier).toBe("internal");
    });

    it("returns warnings when metadata doesn't match schema", () => {
      const metadataContent = `
tier: unknown-tier
team: backend
`;
      writeFileSync(join(testDir, "repo-metadata.yaml"), metadataContent);

      const schema: MetadataSchema = { tiers: ["production"] };
      const result = loadRepoMetadata(testDir, schema);
      expect(result).not.toBeNull();
      expect(result?.warnings).toHaveLength(1);
    });

    it("returns null for invalid YAML", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "{{invalid");
      expect(loadRepoMetadata(testDir)).toBeNull();
    });

    it("returns null for non-object YAML", () => {
      writeFileSync(join(testDir, "repo-metadata.yaml"), "just a string");
      expect(loadRepoMetadata(testDir)).toBeNull();
    });

    it("includes raw metadata in context", () => {
      const metadataContent = `
tier: production
custom_field: custom_value
`;
      writeFileSync(join(testDir, "repo-metadata.yaml"), metadataContent);

      const result = loadRepoMetadata(testDir);
      expect(result?.context.metadata).toEqual({
        tier: "production",
        custom_field: "custom_value",
      });
    });
  });
});
