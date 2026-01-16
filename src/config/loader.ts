import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { z } from "zod";
import type { DriftConfig, MetadataSchema, RepoContext } from "../types.js";
import { FILE_PATTERNS, DISPLAY_LIMITS } from "../constants.js";

/**
 * Dangerous command patterns that indicate potential security risks.
 * These patterns are checked against scan commands to warn users.
 */
const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\brm\s+(-[rf]+\s+)*\//,
    reason: "removes files from root directory",
  },
  { pattern: /\brm\s+-[rf]*\s+\*/, reason: "recursive deletion with wildcard" },
  { pattern: />\s*\/etc\//, reason: "writes to system configuration" },
  { pattern: /\bcurl\b.*\|\s*(bash|sh|zsh)/, reason: "executes remote code" },
  { pattern: /\bwget\b.*\|\s*(bash|sh|zsh)/, reason: "executes remote code" },
  { pattern: /\beval\s+\$/, reason: "evaluates dynamic code" },
  { pattern: /\b(sudo|doas)\s+/, reason: "runs with elevated privileges" },
  {
    pattern: /\bchmod\s+[0-7]*777\b/,
    reason: "sets world-writable permissions",
  },
  { pattern: /\bchown\s+root\b/, reason: "changes ownership to root" },
  { pattern: />\s*\/dev\/(sda|hda|nvme)/, reason: "writes to block device" },
  { pattern: /\bmkfs\b/, reason: "formats filesystem" },
  { pattern: /\bdd\s+.*of=\/dev\//, reason: "writes directly to device" },
  { pattern: /\/\/[^/]*:[^/]*@/, reason: "may contain embedded credentials" },
  { pattern: /\bpasswd\b|\bshadow\b/, reason: "accesses password files" },
  {
    pattern: /\bnc\s+-[el]/,
    reason: "opens network listener (potential backdoor)",
  },
  { pattern: /\breverse.{0,20}shell/i, reason: "potential reverse shell" },
];

/**
 * Check if a command contains potentially dangerous patterns.
 * Returns an array of warning messages for any matches.
 *
 * @param command - The shell command to validate
 * @returns Array of warning messages (empty if command appears safe)
 */
export function validateScanCommand(command: string): string[] {
  const warnings: string[] = [];

  for (const { pattern, reason } of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      const preview = command.slice(0, DISPLAY_LIMITS.commandPreview);
      const truncated =
        command.length > DISPLAY_LIMITS.commandPreview ? "..." : "";
      warnings.push(`Command "${preview}${truncated}" ${reason}`);
    }
  }

  return warnings;
}

/**
 * Validate all scan commands in a config and return warnings.
 *
 * @param config - The drift configuration to validate
 * @returns Array of warning messages for dangerous commands
 */
export function validateConfigSecurity(config: DriftConfig): string[] {
  const warnings: string[] = [];

  if (config.scans) {
    for (const scan of config.scans) {
      const commandWarnings = validateScanCommand(scan.command);
      for (const warning of commandWarnings) {
        warnings.push(`[${scan.name}] ${warning}`);
      }
    }
  }

  return warnings;
}

/**
 * Zod schema for validating drift configuration
 */
const SEVERITY_SCHEMA = z.enum(["critical", "high", "medium", "low"]);

const INTEGRITY_CHECK_SCHEMA = z.object({
  file: z.string().min(1, "file path is required"),
  approved: z.string().min(1, "approved path is required"),
  severity: SEVERITY_SCHEMA,
});

const DISCOVERY_PATTERN_SCHEMA = z.object({
  pattern: z.string().min(1, "pattern is required"),
  suggestion: z.string().min(1, "suggestion is required"),
});

const SCAN_DEFINITION_SCHEMA = z.object({
  name: z.string().min(1, "scan name is required"),
  description: z.string().optional(),
  command: z.string().min(1, "command is required"),
  if: z.union([z.string(), z.array(z.string())]).optional(), // deprecated
  if_file: z.union([z.string(), z.array(z.string())]).optional(),
  if_command: z.string().optional(),
  tiers: z.array(z.string()).optional(),
  outputFormat: z.enum(["json", "text", "exitcode"]).optional(),
  severity: SEVERITY_SCHEMA.optional(),
  timeout: z.number().positive().optional(),
});

const METADATA_SCHEMA_SCHEMA = z
  .object({
    tiers: z.array(z.string()).optional(),
    teams: z.array(z.string()).optional(),
  })
  .optional();

const DRIFT_CONFIG_SCHEMA = z.object({
  schema: METADATA_SCHEMA_SCHEMA,
  integrity: z
    .object({
      protected: z.array(INTEGRITY_CHECK_SCHEMA).optional(),
      discover: z.array(DISCOVERY_PATTERN_SCHEMA).optional(),
    })
    .optional(),
  scans: z.array(SCAN_DEFINITION_SCHEMA).optional(),
  exclude: z.array(z.string()).optional(),
});

/**
 * Load drift configuration from the specified path.
 * Searches for config files in order: drift.config.yaml, drift.config.yml, drift.yaml.
 * Validates the config against the Zod schema to catch errors early.
 *
 * @param basePath - The directory path to search for config files
 * @returns The parsed and validated config, or null if not found or invalid
 */
export function loadConfig(basePath: string): DriftConfig | null {
  for (const filename of FILE_PATTERNS.config) {
    const configPath = join(basePath, filename);
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, "utf-8");
        const parsed: unknown = parse(content);

        // Validate against schema
        const result = DRIFT_CONFIG_SCHEMA.safeParse(parsed);
        if (!result.success) {
          const errors = result.error.issues
            .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
          console.error(`Invalid config in ${configPath}:\n${errors}`);
          return null;
        }

        return result.data as DriftConfig;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Error parsing ${configPath}: ${message}`);
        return null;
      }
    }
  }
  return null;
}

/**
 * Find the config file path if it exists.
 * Searches for config files in order: drift.config.yaml, drift.config.yml, drift.yaml.
 *
 * @param basePath - The directory path to search for config files
 * @returns The absolute path to the config file, or null if not found
 */
export function findConfigPath(basePath: string): string | null {
  for (const filename of FILE_PATTERNS.config) {
    const configPath = join(basePath, filename);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Validation result for repo metadata
 */
export interface MetadataValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate repo metadata against a schema definition.
 * Returns warnings for unknown tier/team values.
 *
 * @param metadata - The repo context to validate
 * @param schema - The schema definition from drift.config.yaml
 * @returns Validation result with any warnings
 */
export function validateRepoMetadata(
  metadata: RepoContext,
  schema: MetadataSchema | undefined
): MetadataValidationResult {
  const warnings: string[] = [];

  if (!schema) {
    // No schema defined, everything is valid
    return { valid: true, warnings: [] };
  }

  // Validate tier
  if (metadata.tier && schema.tiers) {
    if (!schema.tiers.includes(metadata.tier)) {
      warnings.push(
        `Unknown tier "${metadata.tier}". Valid tiers: ${schema.tiers.join(", ")}`
      );
    }
  }

  // Validate team
  if (metadata.team && schema.teams) {
    if (!schema.teams.includes(metadata.team)) {
      warnings.push(
        `Unknown team "${metadata.team}". Valid teams: ${schema.teams.join(", ")}`
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Load repository metadata from repo-metadata.yaml or repo-metadata.yml.
 * Used for conditional scan filtering by tier/team.
 * Optionally validates against a schema if provided.
 *
 * @param repoPath - The repository root directory to search for metadata
 * @param schema - Optional schema to validate against
 * @returns The parsed metadata context with validation warnings, or null if not found
 */
export function loadRepoMetadata(
  repoPath: string,
  schema?: MetadataSchema
): { context: RepoContext; warnings: string[] } | null {
  for (const filename of FILE_PATTERNS.metadata) {
    const metadataPath = join(repoPath, filename);
    if (existsSync(metadataPath)) {
      try {
        const content = readFileSync(metadataPath, "utf-8");
        const parsed = parse(content) as Record<string, unknown> | null;

        // Handle empty or non-object metadata files
        if (!parsed || typeof parsed !== "object") {
          return null;
        }

        const context: RepoContext = {
          tier: typeof parsed.tier === "string" ? parsed.tier : undefined,
          team: typeof parsed.team === "string" ? parsed.team : undefined,
          metadata: parsed,
        };

        // Validate against config schema if provided
        const validation = validateRepoMetadata(context, schema);

        return {
          context,
          warnings: validation.warnings,
        };
      } catch {
        // Parse error - return null but don't fail the scan
        return null;
      }
    }
  }
  return null;
}
