import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";
import type { DriftConfig, MetadataSchema, RepoContext } from "../types.js";
import { FILE_PATTERNS } from "../constants.js";
import { safeJoinPath, PathTraversalError } from "../utils/paths.js";

/**
 * Zod schema for validating drift configuration
 */
const METADATA_SCHEMA_SCHEMA = z
  .object({
    tiers: z.array(z.string()).optional(),
    teams: z.array(z.string()).optional(),
  })
  .optional();

const DRIFT_CONFIG_SCHEMA = z.object({
  schema: METADATA_SCHEMA_SCHEMA,
  exclude: z.array(z.string()).optional(),
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
