/**
 * Repository detection utilities for drift-toolkit.
 *
 * A repository is scannable if it has:
 * 1. A repo-metadata.yaml file (defines tier and status)
 * 2. At least one check.toml file (defines standards)
 */

import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative } from "path";
import { parse as parseYaml } from "yaml";
import { FILE_PATTERNS } from "../constants.js";

/**
 * Valid repository tiers
 */
export type RepoTier = "production" | "internal" | "prototype";

/**
 * Valid repository statuses
 */
export type RepoStatus = "active" | "pre-release" | "deprecated";

/**
 * Parsed repository metadata from repo-metadata.yaml
 */
export interface RepoMetadata {
  /** Repository tier (production, internal, prototype) */
  tier: RepoTier;
  /** Repository status (active, pre-release, deprecated) */
  status: RepoStatus;
  /** Optional team ownership */
  team?: string;
  /** Raw metadata for additional fields */
  raw: Record<string, unknown>;
}

/**
 * Result of scanning a repository for scannability
 */
export interface ScannabilityResult {
  /** Whether the repo can be scanned */
  scannable: boolean;
  /** Whether repo-metadata.yaml exists */
  hasMetadata: boolean;
  /** Whether at least one check.toml exists */
  hasCheckToml: boolean;
  /** Paths to all check.toml files found */
  checkTomlPaths: string[];
  /** Parsed metadata if available */
  metadata?: RepoMetadata;
  /** Error message if something went wrong */
  error?: string;
}

/**
 * Default values for metadata fields
 */
const DEFAULTS = {
  tier: "internal" as RepoTier,
  status: "active" as RepoStatus,
};

/**
 * Check if a value is a valid RepoTier
 */
function isValidTier(value: unknown): value is RepoTier {
  return (
    typeof value === "string" &&
    ["production", "internal", "prototype"].includes(value)
  );
}

/**
 * Check if a value is a valid RepoStatus
 */
function isValidStatus(value: unknown): value is RepoStatus {
  return (
    typeof value === "string" &&
    ["active", "pre-release", "deprecated"].includes(value)
  );
}

/**
 * Extract and validate tier from parsed metadata
 */
function extractTier(
  parsed: Record<string, unknown>,
  warnings: string[]
): RepoTier {
  if (parsed.tier === undefined) {
    return DEFAULTS.tier;
  }
  if (isValidTier(parsed.tier)) {
    return parsed.tier;
  }
  warnings.push(
    `Invalid tier "${parsed.tier}", using default "${DEFAULTS.tier}"`
  );
  return DEFAULTS.tier;
}

/**
 * Extract and validate status from parsed metadata
 */
function extractStatus(
  parsed: Record<string, unknown>,
  warnings: string[]
): RepoStatus {
  if (parsed.status === undefined) {
    return DEFAULTS.status;
  }
  if (isValidStatus(parsed.status)) {
    return parsed.status;
  }
  warnings.push(
    `Invalid status "${parsed.status}", using default "${DEFAULTS.status}"`
  );
  return DEFAULTS.status;
}

/**
 * Find the repo-metadata.yaml file path if it exists.
 */
export function findMetadataPath(repoPath: string): string | null {
  for (const filename of FILE_PATTERNS.metadata) {
    const metadataPath = join(repoPath, filename);
    if (existsSync(metadataPath)) {
      return metadataPath;
    }
  }
  return null;
}

/**
 * Parse and validate repo-metadata.yaml contents.
 * Returns metadata with defaults applied for missing fields.
 */
export function parseRepoMetadata(
  content: string
): { metadata: RepoMetadata; warnings: string[] } | null {
  try {
    const parsed = parseYaml(content) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const warnings: string[] = [];
    const tier = extractTier(parsed, warnings);
    const status = extractStatus(parsed, warnings);
    const team = typeof parsed.team === "string" ? parsed.team : undefined;

    return {
      metadata: { tier, status, team, raw: parsed },
      warnings,
    };
  } catch {
    return null;
  }
}

/**
 * Load and parse repository metadata from repo-metadata.yaml.
 * Returns null if the file doesn't exist or can't be parsed.
 */
export function getRepoMetadata(
  repoPath: string
): { metadata: RepoMetadata; warnings: string[] } | null {
  const metadataPath = findMetadataPath(repoPath);
  if (!metadataPath) {
    return null;
  }

  try {
    const content = readFileSync(metadataPath, "utf-8");
    return parseRepoMetadata(content);
  } catch {
    return null;
  }
}

/**
 * Find all check.toml files in a repository.
 * Searches the root and all subdirectories (for monorepos).
 *
 * @param repoPath - Path to the repository root
 * @param maxDepth - Maximum directory depth to search (default: 3)
 * @returns Array of relative paths to check.toml files
 */
export function findCheckTomlFiles(
  repoPath: string,
  maxDepth: number = 3
): string[] {
  const checkTomlFiles: string[] = [];
  const checkTomlName = FILE_PATTERNS.checkToml;

  function searchDirectory(dirPath: string, depth: number): void {
    if (depth > maxDepth) {
      return;
    }

    // Check for check.toml in current directory
    const checkTomlPath = join(dirPath, checkTomlName);
    if (existsSync(checkTomlPath)) {
      const relativePath = relative(repoPath, checkTomlPath);
      checkTomlFiles.push(relativePath || checkTomlName);
    }

    // Skip node_modules and other common non-project directories
    const skipDirs = new Set([
      "node_modules",
      ".git",
      "dist",
      "build",
      "coverage",
      ".next",
      ".turbo",
      "vendor",
      "__pycache__",
      ".venv",
      "venv",
    ]);

    // Search subdirectories
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !skipDirs.has(entry.name)) {
          searchDirectory(join(dirPath, entry.name), depth + 1);
        }
      }
    } catch {
      // Ignore permission errors or other issues reading directories
    }
  }

  searchDirectory(repoPath, 0);
  return checkTomlFiles;
}

/**
 * Check if a repository has at least one check.toml file.
 */
export function hasCheckToml(repoPath: string): boolean {
  // Quick check at root level first
  const rootCheckToml = join(repoPath, FILE_PATTERNS.checkToml);
  if (existsSync(rootCheckToml)) {
    return true;
  }

  // Search for check.toml in subdirectories (monorepo case)
  return findCheckTomlFiles(repoPath).length > 0;
}

/**
 * Check if a repository has a repo-metadata.yaml file.
 */
export function hasMetadata(repoPath: string): boolean {
  return findMetadataPath(repoPath) !== null;
}

/**
 * Determine if a repository is scannable by drift-toolkit.
 * A repository is scannable if it has both:
 * 1. A repo-metadata.yaml file
 * 2. At least one check.toml file
 *
 * @param repoPath - Path to the repository root
 * @returns ScannabilityResult with details about the repository
 */
export function isScannableRepo(repoPath: string): ScannabilityResult {
  try {
    // Check for repo-metadata.yaml
    const metadataResult = getRepoMetadata(repoPath);
    const hasMetadataFile = metadataResult !== null;

    // Find all check.toml files
    const checkTomlPaths = findCheckTomlFiles(repoPath);
    const hasCheckTomlFile = checkTomlPaths.length > 0;

    // Both required for scannability
    const scannable = hasMetadataFile && hasCheckTomlFile;

    return {
      scannable,
      hasMetadata: hasMetadataFile,
      hasCheckToml: hasCheckTomlFile,
      checkTomlPaths,
      metadata: metadataResult?.metadata,
    };
  } catch (error) {
    return {
      scannable: false,
      hasMetadata: false,
      hasCheckToml: false,
      checkTomlPaths: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
