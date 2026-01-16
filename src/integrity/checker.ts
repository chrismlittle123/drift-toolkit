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

/**
 * Check integrity of a single file against its approved version.
 * Compares file hashes and generates a diff if they differ.
 *
 * @param check - The integrity check definition with file path and severity
 * @param targetPath - The repository directory containing the file to check
 * @param approvedBasePath - The directory containing approved/golden files
 * @returns The integrity result with status, hashes, and optional diff
 */
export function checkIntegrity(
  check: IntegrityCheck,
  targetPath: string,
  approvedBasePath: string
): IntegrityResult {
  const timestamp = new Date().toISOString();

  // Safely join paths to prevent path traversal attacks
  let currentFilePath: string;
  let approvedFilePath: string;
  try {
    currentFilePath = safeJoinPath(targetPath, check.file);
    approvedFilePath = safeJoinPath(approvedBasePath, check.approved);
  } catch (error) {
    if (error instanceof PathTraversalError) {
      return {
        file: check.file,
        status: "error",
        severity: check.severity,
        error: `Security error: ${error.message}`,
        timestamp,
      };
    }
    throw error;
  }

  // Check if approved file exists
  if (!existsSync(approvedFilePath)) {
    return {
      file: check.file,
      status: "error",
      severity: check.severity,
      error: `Approved file not found: ${check.approved}`,
      timestamp,
    };
  }

  // Check if current file exists
  if (!existsSync(currentFilePath)) {
    return {
      file: check.file,
      status: "missing",
      severity: check.severity,
      approvedHash: hashFile(approvedFilePath),
      timestamp,
    };
  }

  // Compare hashes
  const approvedHash = hashFile(approvedFilePath);
  const currentHash = hashFile(currentFilePath);

  if (approvedHash === currentHash) {
    return {
      file: check.file,
      status: "match",
      severity: check.severity,
      approvedHash,
      currentHash,
      timestamp,
    };
  }

  // Files differ - generate diff
  const diff = generateDiff(approvedFilePath, currentFilePath);

  return {
    file: check.file,
    status: "drift",
    severity: check.severity,
    approvedHash,
    currentHash,
    diff,
    timestamp,
  };
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
