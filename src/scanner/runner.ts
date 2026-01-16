import { execSync, ExecSyncOptionsWithStringEncoding } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import type { ScanDefinition, ScanResult, RepoContext } from "../types.js";
import { BUFFERS, DEFAULTS } from "../constants.js";
import { extractExecError, STATUS_ICONS, COLORS } from "../utils/index.js";

/**
 * Check if a scan should be skipped based on conditions
 */
function shouldSkip(
  scan: ScanDefinition,
  targetPath: string,
  context?: RepoContext
): string | null {
  // Check file existence conditions
  if (scan.if) {
    const conditions = Array.isArray(scan.if) ? scan.if : [scan.if];
    for (const condition of conditions) {
      const filePath = join(targetPath, condition);
      if (!existsSync(filePath)) {
        return `file not found: ${condition}`;
      }
    }
  }

  // Check tier conditions
  if (scan.tiers && scan.tiers.length > 0) {
    if (!context?.tier) {
      // No tier defined for this repo - skip if scan requires specific tiers
      return `no tier defined, scan requires: [${scan.tiers.join(", ")}]`;
    }
    if (!scan.tiers.includes(context.tier)) {
      return `tier '${context.tier}' not in [${scan.tiers.join(", ")}]`;
    }
  }

  return null;
}

/**
 * Run a single scan command against a repository.
 * Handles skip conditions (file existence, tier matching), timeouts, and error capture.
 *
 * @param scan - The scan definition containing command, conditions, and timeout
 * @param targetPath - The directory path to run the scan in
 * @param context - Optional repository context for tier/team filtering
 * @returns The scan result with status, output, and timing information
 */
export function runScan(
  scan: ScanDefinition,
  targetPath: string,
  context?: RepoContext
): ScanResult {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

  // Check skip conditions
  const skipReason = shouldSkip(scan, targetPath, context);
  if (skipReason) {
    return {
      scan: scan.name,
      status: "skip",
      duration: Date.now() - startTime,
      timestamp,
      skippedReason: skipReason,
    };
  }

  // Execute the command
  const timeout = (scan.timeout ?? DEFAULTS.scanTimeoutSeconds) * 1000;
  const options: ExecSyncOptionsWithStringEncoding = {
    cwd: targetPath,
    encoding: "utf-8",
    timeout,
    maxBuffer: BUFFERS.scanOutput,
    stdio: ["pipe", "pipe", "pipe"],
  };

  try {
    const stdout = execSync(scan.command, options);
    return {
      scan: scan.name,
      status: "pass",
      exitCode: 0,
      stdout: stdout.trim(),
      duration: Date.now() - startTime,
      timestamp,
    };
  } catch (error: unknown) {
    const execError = extractExecError(error);

    // Command failed with non-zero exit code (or was killed)
    if (execError.status !== undefined) {
      return {
        scan: scan.name,
        status: "fail",
        exitCode: execError.status ?? undefined,
        stdout: execError.stdout?.trim() ?? "",
        stderr: execError.stderr?.trim() ?? "",
        duration: Date.now() - startTime,
        timestamp,
      };
    }

    // Other error (timeout, etc.)
    return {
      scan: scan.name,
      status: "error",
      stdout: "",
      stderr: execError.message ?? "Unknown error",
      duration: Date.now() - startTime,
      timestamp,
    };
  }
}

/**
 * Run all configured scans against a repository.
 *
 * @param scans - Array of scan definitions to execute
 * @param targetPath - The directory path to run scans in
 * @param context - Optional repository context for tier/team filtering
 * @returns Array of scan results in the same order as input scans
 */
export function runAllScans(
  scans: ScanDefinition[],
  targetPath: string,
  context?: RepoContext
): ScanResult[] {
  return scans.map((scan) => runScan(scan, targetPath, context));
}

/**
 * Format a scan result for terminal display with colored status indicators.
 *
 * @param result - The scan result to format
 * @returns A formatted string with ANSI color codes for terminal output
 */
export function formatScanResult(result: ScanResult): string {
  const icon = STATUS_ICONS[result.status];
  const duration = `${result.duration}ms`;

  let line = `  ${icon} ${result.scan}`;

  switch (result.status) {
    case "pass":
      line += ` - passed (${duration})`;
      break;
    case "fail":
      line += ` - ${COLORS.red}failed${COLORS.reset} (exit ${result.exitCode}, ${duration})`;
      break;
    case "skip":
      line += ` - skipped (${result.skippedReason})`;
      break;
    case "error":
      line += ` - ${COLORS.red}error${COLORS.reset}: ${result.stderr}`;
      break;
  }

  return line;
}
