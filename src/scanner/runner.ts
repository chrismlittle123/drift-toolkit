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
  // Check file existence conditions (if_file or deprecated if)
  const fileConditions = scan.if_file ?? scan.if;
  if (fileConditions) {
    const conditions = Array.isArray(fileConditions)
      ? fileConditions
      : [fileConditions];
    for (const condition of conditions) {
      const filePath = join(targetPath, condition);
      if (!existsSync(filePath)) {
        return `file not found: ${condition}`;
      }
    }
  }

  // Check command conditions (if_command)
  if (scan.if_command) {
    try {
      execSync(scan.if_command, {
        cwd: targetPath,
        stdio: "pipe",
        timeout: 10000, // 10 second timeout for condition commands
      });
    } catch {
      return `condition failed: ${scan.if_command}`;
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
 * Execute scan command and return result
 */
function executeScan(
  scan: ScanDefinition,
  targetPath: string,
  startTime: number,
  timestamp: string
): ScanResult {
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
 * Run a single scan command against a repository.
 */
export function runScan(
  scan: ScanDefinition,
  targetPath: string,
  context?: RepoContext
): ScanResult {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();

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

  return executeScan(scan, targetPath, startTime, timestamp);
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
