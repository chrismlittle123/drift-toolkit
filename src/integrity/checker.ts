import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join, relative } from "path";
import { execFileSync } from "child_process";
import { globSync } from "glob";
import type {
  IntegrityCheck,
  IntegrityResult,
  DiscoveryPattern,
  DiscoveryResult,
} from "../types.js";
import { BUFFERS } from "../constants.js";
import {
  safeJoinPath,
  PathTraversalError,
  extractExecError,
  COLORS,
  STATUS_ICONS,
  getSeverityColor,
} from "../utils/index.js";

/**
 * Calculate SHA-256 hash of a file
 */
function hashFile(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Generate a unified diff between two files
 * Uses execFileSync to avoid shell injection vulnerabilities
 */
function generateDiff(approvedPath: string, currentPath: string): string {
  try {
    // Use diff command with execFileSync (no shell) for safety
    const result = execFileSync("diff", ["-u", approvedPath, currentPath], {
      encoding: "utf-8",
      maxBuffer: BUFFERS.diffOutput,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result || "(no differences)";
  } catch (error) {
    // diff returns exit code 1 when files differ, which throws
    const execError = extractExecError(error);
    if (execError.status === 1 && execError.stdout) {
      return execError.stdout;
    }
    return "(diff unavailable)";
  }
}

type ResolvedPaths = { current: string; approved: string };

function resolvePaths(
  check: IntegrityCheck,
  targetPath: string,
  approvedBasePath: string
): ResolvedPaths | { error: string } {
  try {
    return {
      current: safeJoinPath(targetPath, check.file),
      approved: safeJoinPath(approvedBasePath, check.approved),
    };
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return { error: `Security error: ${error.message}` };
    }
    throw error;
  }
}

function buildResult(
  check: IntegrityCheck,
  status: IntegrityResult["status"],
  timestamp: string,
  extra: Partial<IntegrityResult> = {}
): IntegrityResult {
  return {
    file: check.file,
    status,
    severity: check.severity,
    timestamp,
    ...extra,
  };
}

function compareFiles(
  check: IntegrityCheck,
  paths: ResolvedPaths,
  timestamp: string
): IntegrityResult {
  const approvedHash = hashFile(paths.approved);
  const currentHash = hashFile(paths.current);

  if (approvedHash === currentHash) {
    return buildResult(check, "match", timestamp, {
      approvedHash,
      currentHash,
    });
  }

  return buildResult(check, "drift", timestamp, {
    approvedHash,
    currentHash,
    diff: generateDiff(paths.approved, paths.current),
  });
}

/**
 * Check integrity of a single file against its approved version.
 */
export function checkIntegrity(
  check: IntegrityCheck,
  targetPath: string,
  approvedBasePath: string
): IntegrityResult {
  const timestamp = new Date().toISOString();
  const paths = resolvePaths(check, targetPath, approvedBasePath);

  if ("error" in paths) {
    return buildResult(check, "error", timestamp, { error: paths.error });
  }
  if (!existsSync(paths.approved)) {
    return buildResult(check, "error", timestamp, {
      error: `Approved file not found: ${check.approved}`,
    });
  }
  if (!existsSync(paths.current)) {
    return buildResult(check, "missing", timestamp, {
      approvedHash: hashFile(paths.approved),
    });
  }

  return compareFiles(check, paths, timestamp);
}

/**
 * Check all configured integrity rules against a repository.
 *
 * @param checks - Array of integrity check definitions
 * @param targetPath - The repository directory containing files to check
 * @param approvedBasePath - The directory containing approved/golden files
 * @returns Array of integrity results in the same order as input checks
 */
export function checkAllIntegrity(
  checks: IntegrityCheck[],
  targetPath: string,
  approvedBasePath: string
): IntegrityResult[] {
  return checks.map((check) =>
    checkIntegrity(check, targetPath, approvedBasePath)
  );
}

/**
 * Discover files matching patterns that might need protection.
 * Useful for finding new files that should be added to integrity checks.
 *
 * @param patterns - Array of glob patterns with suggestions
 * @param targetPath - The repository directory to search
 * @param protectedFiles - List of files already protected (for comparison)
 * @returns Array of discovered files with protection status
 */
export function discoverFiles(
  patterns: DiscoveryPattern[],
  targetPath: string,
  protectedFiles: string[]
): DiscoveryResult[] {
  const results: DiscoveryResult[] = [];
  const protectedSet = new Set(protectedFiles);

  for (const pattern of patterns) {
    try {
      // Use glob for safe pattern matching (no shell involved)
      const fullPattern = join(targetPath, pattern.pattern);
      const files = globSync(fullPattern, {
        nodir: true,
        absolute: true,
      });

      for (const absolutePath of files) {
        // Use path.relative for safe path manipulation
        const relativePath = relative(targetPath, absolutePath);

        results.push({
          file: relativePath,
          pattern: pattern.pattern,
          suggestion: pattern.suggestion,
          isProtected: protectedSet.has(relativePath),
        });
      }
    } catch (error) {
      // Log discovery errors for debugging (don't silently swallow)
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Warning: Failed to discover files for pattern "${pattern.pattern}": ${message}`
      );
    }
  }

  return results;
}

/**
 * Format an integrity result for terminal display with colored status indicators.
 *
 * @param result - The integrity result to format
 * @returns A formatted string with ANSI color codes for terminal output
 */
export function formatIntegrityResult(result: IntegrityResult): string {
  const color = getSeverityColor(result.severity);

  switch (result.status) {
    case "match":
      return `  ${STATUS_ICONS.match} ${result.file} - ok`;
    case "drift":
      return `  ${color}✗${COLORS.reset} ${result.file} - ${color}DRIFT DETECTED${COLORS.reset} (${result.severity})`;
    case "missing":
      return `  ${color}✗${COLORS.reset} ${result.file} - ${color}MISSING${COLORS.reset} (${result.severity})`;
    case "error":
      return `  ${STATUS_ICONS.error} ${result.file} - error: ${result.error}`;
    default:
      return `  ? ${result.file} - unknown status`;
  }
}
