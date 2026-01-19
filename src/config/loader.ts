import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";
import type {
  CodeDomainConfig,
  DriftConfig,
  MetadataSchema,
  RepoContext,
} from "../types.js";
import { FILE_PATTERNS } from "../constants.js";
import { safeJoinPath, PathTraversalError } from "../utils/paths.js";

// Re-export security functions for backward compatibility
export { validateScanCommand, validateConfigSecurity } from "./security.js";

/**
 * Get the code domain config from a DriftConfig.
 * Normalizes both legacy flat format and new nested format.
 */
export function getCodeConfig(config: DriftConfig): CodeDomainConfig | null {
  // New nested format takes precedence
  if (config.code) {
    return config.code;
  }

  // Legacy flat format - construct CodeDomainConfig from flat structure
  if (config.integrity || config.scans) {
    return {
      integrity: config.integrity,
      scans: config.scans,
    };
  }

  return null;
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

const INTEGRITY_SCHEMA = z
  .object({
    protected: z.array(INTEGRITY_CHECK_SCHEMA).optional(),
    discover: z.array(DISCOVERY_PATTERN_SCHEMA).optional(),
  })
  .optional();

const CODE_DOMAIN_SCHEMA = z
  .object({
    integrity: INTEGRITY_SCHEMA,
    scans: z.array(SCAN_DEFINITION_SCHEMA).optional(),
  })
  .optional();

const DRIFT_CONFIG_SCHEMA = z.object({
  schema: METADATA_SCHEMA_SCHEMA,
  integrity: INTEGRITY_SCHEMA,
  scans: z.array(SCAN_DEFINITION_SCHEMA).optional(),
  exclude: z.array(z.string()).optional(),
  code: CODE_DOMAIN_SCHEMA,
});

/**
 * Load and parse a config file, returning the validated config or null on error.
 */
function loadConfigFile(configPath: string): DriftConfig | null {
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed: unknown = parse(content);

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
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error parsing ${configPath}: ${message}`);
    return null;
  }
}

/**
 * Load drift configuration from the specified path.
 * Searches for config files in order: drift.config.yaml, drift.config.yml, drift.yaml.
 * Validates the config against the Zod schema to catch errors early.
 * Uses safe path joining to prevent path traversal attacks.
 */
export function loadConfig(basePath: string): DriftConfig | null {
  for (const filename of FILE_PATTERNS.config) {
    try {
      const configPath = safeJoinPath(basePath, filename);
      if (existsSync(configPath)) {
        return loadConfigFile(configPath);
      }
    } catch (error) {
      if (error instanceof PathTraversalError) {
        console.error(`Security error: ${error.message}`);
        return null;
      }
      throw error;
    }
  }
  return null;
}

/**
 * Find the config file path if it exists.
 * Searches for config files in order: drift.config.yaml, drift.config.yml, drift.yaml.
 * Uses safe path joining to prevent path traversal attacks.
 */
export function findConfigPath(basePath: string): string | null {
  for (const filename of FILE_PATTERNS.config) {
    try {
      const configPath = safeJoinPath(basePath, filename);
      if (existsSync(configPath)) {
        return configPath;
      }
    } catch (error) {
      if (error instanceof PathTraversalError) {
        console.error(`Security error: ${error.message}`);
        return null;
      }
      throw error;
    }
  }
  return null;
}

/** Validation result for repo metadata */
export interface MetadataValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validate repo metadata against a schema definition.
 * Returns warnings for unknown tier/team values.
 */
export function validateRepoMetadata(
  metadata: RepoContext,
  schema: MetadataSchema | undefined
): MetadataValidationResult {
  const warnings: string[] = [];

  if (!schema) {
    return { valid: true, warnings: [] };
  }

  if (metadata.tier && schema.tiers) {
    if (!schema.tiers.includes(metadata.tier)) {
      warnings.push(
        `Unknown tier "${metadata.tier}". Valid tiers: ${schema.tiers.join(", ")}`
      );
    }
  }

  if (metadata.team && schema.teams) {
    if (!schema.teams.includes(metadata.team)) {
      warnings.push(
        `Unknown team "${metadata.team}". Valid teams: ${schema.teams.join(", ")}`
      );
    }
  }

  return { valid: warnings.length === 0, warnings };
}

/**
 * Parse metadata file content and return context with validation.
 */
function parseMetadataFile(
  metadataPath: string,
  schema?: MetadataSchema
): { context: RepoContext; warnings: string[] } | null {
  try {
    const content = readFileSync(metadataPath, "utf-8");
    const parsed = parse(content) as Record<string, unknown> | null;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const context: RepoContext = {
      tier: typeof parsed.tier === "string" ? parsed.tier : undefined,
      team: typeof parsed.team === "string" ? parsed.team : undefined,
      metadata: parsed,
    };

    const validation = validateRepoMetadata(context, schema);
    return { context, warnings: validation.warnings };
  } catch {
    return null;
  }
}

/**
 * Load repository metadata from repo-metadata.yaml or repo-metadata.yml.
 * Used for conditional scan filtering by tier/team.
 * Uses safe path joining to prevent path traversal attacks.
 */
export function loadRepoMetadata(
  repoPath: string,
  schema?: MetadataSchema
): { context: RepoContext; warnings: string[] } | null {
  for (const filename of FILE_PATTERNS.metadata) {
    try {
      const metadataPath = safeJoinPath(repoPath, filename);
      if (existsSync(metadataPath)) {
        return parseMetadataFile(metadataPath, schema);
      }
    } catch (error) {
      if (error instanceof PathTraversalError) {
        return null;
      }
      throw error;
    }
  }
  return null;
}
