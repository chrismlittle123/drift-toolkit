import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { loadConfig, findConfigPath } from "../../config/loader.js";
import { checkIntegrity } from "../../integrity/checker.js";
import type { IntegrityResult } from "../../types.js";

export interface FixOptions {
  path?: string;
  config?: string;
  dryRun?: boolean;
  file?: string;
}

interface FixResult {
  file: string;
  action: "fixed" | "created" | "skipped" | "error";
  reason?: string;
}

/**
 * Copy a file from source to destination, creating directories as needed
 */
function copyFile(src: string, dest: string): void {
  const content = readFileSync(src);
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  writeFileSync(dest, content);
}

/**
 * Fix drifted files by copying from the approved source
 */
export function fix(options: FixOptions): void {
  const targetPath = resolve(options.path || process.cwd());
  const configBasePath = options.config
    ? dirname(resolve(options.config))
    : targetPath;

  // Load config
  const configPath = options.config
    ? resolve(options.config)
    : findConfigPath(configBasePath);
  if (!configPath) {
    console.error("\x1b[31mNo drift config found.\x1b[0m");
    console.error("Create a drift.config.yaml or specify with --config");
    process.exit(1);
  }

  const config = loadConfig(dirname(configPath));
  if (!config) {
    console.error("\x1b[31mFailed to load config.\x1b[0m");
    process.exit(1);
  }

  const protectedFiles = config.integrity?.protected || [];
  if (protectedFiles.length === 0) {
    console.log("No protected files configured.");
    return;
  }

  const approvedBasePath = dirname(configPath);
  const results: FixResult[] = [];
  const filesToFix = options.file ? [options.file] : null;

  console.log(
    options.dryRun
      ? "\n\x1b[33mDry run mode - no files will be changed\x1b[0m\n"
      : ""
  );
  console.log("\x1b[1mChecking integrity...\x1b[0m\n");

  // Check each protected file
  for (const check of protectedFiles) {
    // Skip if specific file requested and this isn't it
    if (filesToFix && !filesToFix.includes(check.file)) {
      continue;
    }

    const integrityResult = checkIntegrity(check, targetPath, approvedBasePath);
    const result = processIntegrityResult(integrityResult, {
      check,
      targetPath,
      approvedBasePath,
      dryRun: options.dryRun || false,
    });
    results.push(result);
  }

  // Print results
  printResults(results, options.dryRun || false);
}

interface ProcessContext {
  check: { file: string; approved: string };
  targetPath: string;
  approvedBasePath: string;
  dryRun: boolean;
}

function processIntegrityResult(
  integrityResult: IntegrityResult,
  context: ProcessContext
): FixResult {
  const { check, targetPath, approvedBasePath, dryRun } = context;
  const currentFilePath = join(targetPath, check.file);
  const approvedFilePath = join(approvedBasePath, check.approved);

  switch (integrityResult.status) {
    case "match":
      return {
        file: check.file,
        action: "skipped",
        reason: "already matches approved version",
      };

    case "drift": {
      if (!dryRun) {
        try {
          copyFile(approvedFilePath, currentFilePath);
          return { file: check.file, action: "fixed" };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          return { file: check.file, action: "error", reason: message };
        }
      }
      return { file: check.file, action: "fixed", reason: "(dry run)" };
    }

    case "missing": {
      if (!dryRun) {
        try {
          copyFile(approvedFilePath, currentFilePath);
          return { file: check.file, action: "created" };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          return { file: check.file, action: "error", reason: message };
        }
      }
      return { file: check.file, action: "created", reason: "(dry run)" };
    }

    case "error":
      return {
        file: check.file,
        action: "error",
        reason: integrityResult.error || "Unknown error",
      };

    default:
      return {
        file: check.file,
        action: "error",
        reason: "Unknown status",
      };
  }
}

function printResults(results: FixResult[], dryRun: boolean): void {
  const fixed = results.filter((r) => r.action === "fixed");
  const created = results.filter((r) => r.action === "created");
  const skipped = results.filter((r) => r.action === "skipped");
  const errors = results.filter((r) => r.action === "error");

  // Print each result
  for (const result of results) {
    const icon = getIcon(result.action);
    const color = getColor(result.action);
    const reason = result.reason ? ` - ${result.reason}` : "";
    console.log(`  ${color}${icon}\x1b[0m ${result.file}${reason}`);
  }

  // Print summary
  console.log("\n\x1b[1mSummary:\x1b[0m");
  if (fixed.length > 0) {
    console.log(
      `  \x1b[32m✓\x1b[0m ${fixed.length} file(s) ${dryRun ? "would be " : ""}fixed`
    );
  }
  if (created.length > 0) {
    console.log(
      `  \x1b[32m+\x1b[0m ${created.length} file(s) ${dryRun ? "would be " : ""}created`
    );
  }
  if (skipped.length > 0) {
    console.log(
      `  \x1b[90m-\x1b[0m ${skipped.length} file(s) already up to date`
    );
  }
  if (errors.length > 0) {
    console.log(`  \x1b[31m!\x1b[0m ${errors.length} error(s)`);
  }

  if (dryRun && (fixed.length > 0 || created.length > 0)) {
    console.log("\n\x1b[33mRun without --dry-run to apply changes\x1b[0m");
  }
}

function getIcon(action: FixResult["action"]): string {
  switch (action) {
    case "fixed":
      return "✓";
    case "created":
      return "+";
    case "skipped":
      return "-";
    case "error":
      return "!";
    default:
      return "?";
  }
}

function getColor(action: FixResult["action"]): string {
  switch (action) {
    case "fixed":
      return "\x1b[32m"; // green
    case "created":
      return "\x1b[32m"; // green
    case "skipped":
      return "\x1b[90m"; // gray
    case "error":
      return "\x1b[31m"; // red
    default:
      return "\x1b[0m"; // reset
  }
}
