import { resolve, dirname } from "path";
import { existsSync } from "fs";
import {
  loadConfig,
  findConfigPath,
  loadRepoMetadata,
  validateConfigSecurity,
} from "../../config/loader.js";
import {
  checkAllIntegrity,
  discoverFiles,
  formatIntegrityResult,
} from "../../integrity/checker.js";
import { runAllScans, formatScanResult } from "../../scanner/runner.js";
import { scanOrg } from "../../github/org-scanner.js";
import { version } from "../../version.js";
import type { DriftResults } from "../../types.js";
import { DISPLAY_LIMITS } from "../../constants.js";
import {
  printWarnings,
  COLORS,
  STATUS_ICONS,
  createEmptyResults,
  updateIntegritySummary,
  updateScanSummary,
  actionsOutput,
} from "../../utils/index.js";
import {
  hasMetadata,
  hasCheckToml,
  getRepoMetadata,
} from "../../repo/detection.js";

export interface ScanOptions {
  org?: string;
  repo?: string;
  path?: string;
  config?: string;
  configRepo?: string;
  githubToken?: string;
  json?: boolean;
  dryRun?: boolean;
  all?: boolean; // Skip commit window filter (scan all repos)
  since?: number; // Hours to look back for commits (default: 24)
}

/**
 * Print metadata validation warnings to console
 */
function printMetadataWarnings(warnings: string[]): void {
  printWarnings("METADATA VALIDATION WARNINGS", warnings);
}

/**
 * Validate that required repo files exist and are valid.
 * Returns warnings for missing or empty files.
 */
function validateRepoFiles(targetPath: string): string[] {
  const warnings: string[] = [];

  // Check for repo-metadata.yaml
  if (!hasMetadata(targetPath)) {
    warnings.push(
      "repo-metadata.yaml not found. Create this file to define tier and team for conditional scans."
    );
  } else {
    // Check for empty metadata (has file but no content)
    const metadataResult = getRepoMetadata(targetPath);
    if (metadataResult.metadata === null) {
      // File exists but couldn't be parsed (empty or read error)
      if (metadataResult.warnings.length > 0) {
        warnings.push(...metadataResult.warnings);
      }
    } else if (metadataResult.warnings.length > 0) {
      // File parsed but has validation warnings (e.g., empty, invalid format)
      warnings.push(...metadataResult.warnings);
    }
  }

  // Check for check.toml
  if (!hasCheckToml(targetPath)) {
    warnings.push(
      "check.toml not found. Create this file to configure check-my-toolkit standards."
    );
  }

  return warnings;
}

/**
 * Print repo file warnings
 */
function printRepoFileWarnings(warnings: string[]): void {
  printWarnings("REPO CONFIGURATION WARNINGS", warnings);
}

/**
 * Print security warnings for dangerous commands
 */
function printSecurityWarnings(warnings: string[]): void {
  printWarnings(
    "SECURITY WARNING",
    warnings,
    "Only run scans from trusted configuration sources."
  );
}

/**
 * Print help message when no config is found
 */
function printNoConfigHelp(targetPath: string): void {
  console.log(`Drift v${version}`);
  console.log(`Target: ${targetPath}`);
  console.log("");
  console.log(
    "No drift.config.yaml found. Create one to define scans and integrity checks."
  );
  console.log("");
  console.log("Example drift.config.yaml:");
  console.log("  scans:");
  console.log("    - name: has-readme");
  console.log("      command: test -f README.md");
  console.log("");
  console.log("  integrity:");
  console.log("    protected:");
  console.log("      - file: CODEOWNERS");
  console.log("        approved: approved/CODEOWNERS");
  console.log("        severity: critical");
}

export async function scan(options: ScanOptions): Promise<void> {
  // GitHub org scanning mode
  if (options.org) {
    await scanOrg({
      org: options.org,
      repo: options.repo,
      configRepo: options.configRepo,
      token: options.githubToken,
      json: options.json,
      dryRun: options.dryRun,
      all: options.all,
      since: options.since,
    });
    return;
  }

  // Local scanning mode
  let targetPath: string;

  if (options.path) {
    targetPath = resolve(options.path);
  } else if (options.repo) {
    // --repo without --org is an error
    const errorMsg = "--repo requires --org to be specified";
    console.error(`Error: ${errorMsg}.`);
    console.error("Use --path to scan a local directory.");
    actionsOutput.error(errorMsg);
    process.exit(1);
    return;
  } else {
    // Default to current directory
    targetPath = process.cwd();
  }

  // Verify path exists
  if (!existsSync(targetPath)) {
    const errorMsg = `Path does not exist: ${targetPath}`;
    console.error(`Error: ${errorMsg}`);
    actionsOutput.error(errorMsg);
    process.exit(1);
    return; // For TypeScript and tests
  }

  // Load configuration
  const configPath = options.config
    ? resolve(options.config)
    : findConfigPath(targetPath);
  const config = configPath ? loadConfig(dirname(configPath)) : null;

  // Security validation - warn about potentially dangerous commands
  if (config && !options.json) {
    const securityWarnings = validateConfigSecurity(config);
    if (securityWarnings.length > 0) {
      printSecurityWarnings(securityWarnings);
    }
  }

  if (!config && !options.json) {
    printNoConfigHelp(targetPath);
    return;
  }

  // Validate required repo files (repo-metadata.yaml, check.toml)
  if (!options.json) {
    const repoFileWarnings = validateRepoFiles(targetPath);
    if (repoFileWarnings.length > 0) {
      printRepoFileWarnings(repoFileWarnings);
    }
  }

  // Initialize results
  const results = createEmptyResults(targetPath);

  // Determine approved files base path (same as config location or targetPath)
  const approvedBasePath = configPath ? dirname(configPath) : targetPath;

  // Run integrity checks
  if (config?.integrity?.protected && config.integrity.protected.length > 0) {
    results.integrity = checkAllIntegrity(
      config.integrity.protected,
      targetPath,
      approvedBasePath
    );
    updateIntegritySummary(results.summary, results.integrity);
  }

  // Run file discovery
  if (config?.integrity?.discover && config.integrity.discover.length > 0) {
    const protectedFiles = config.integrity.protected?.map((p) => p.file) || [];
    results.discovered = discoverFiles(
      config.integrity.discover,
      targetPath,
      protectedFiles
    );
    results.summary.discoveredFiles = results.discovered.filter(
      (d) => !d.isProtected
    ).length;
  }

  // Load repo metadata for conditional scans
  const metadataResult = loadRepoMetadata(targetPath, config?.schema);
  const hasMetadataWarnings =
    metadataResult?.warnings && metadataResult.warnings.length > 0;
  if (hasMetadataWarnings && !options.json) {
    printMetadataWarnings(metadataResult.warnings);
  }
  const repoContext = metadataResult?.context;

  // Run scans with context
  if (config?.scans && config.scans.length > 0) {
    results.scans = runAllScans(
      config.scans,
      targetPath,
      repoContext ?? undefined
    );
    updateScanSummary(results.summary, results.scans);
  }

  // Output results
  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printResults(results);
  }

  // Exit with error code if there are failures
  const hasIntegrityIssues =
    results.summary.integrityFailed > 0 || results.summary.integrityMissing > 0;
  if (hasIntegrityIssues || results.summary.scansFailed > 0) {
    process.exit(1);
  }
}

function printResults(results: DriftResults): void {
  console.log(`Drift v${version}`);
  console.log(`Target: ${results.path}`);
  console.log("");

  // Integrity results
  if (results.integrity.length > 0) {
    console.log(`${COLORS.bold}INTEGRITY CHECKS${COLORS.reset}`);
    console.log("─".repeat(50));

    for (const result of results.integrity) {
      console.log(formatIntegrityResult(result));

      // Show diff for drifted files
      if (result.status === "drift" && result.diff) {
        console.log("");
        console.log(`    ${COLORS.dim}Diff:${COLORS.reset}`);
        const diffLines = result.diff
          .split("\n")
          .slice(0, DISPLAY_LIMITS.diffLines);
        for (const line of diffLines) {
          if (line.startsWith("+") && !line.startsWith("+++")) {
            console.log(`    ${COLORS.green}${line}${COLORS.reset}`);
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            console.log(`    ${COLORS.red}${line}${COLORS.reset}`);
          } else {
            console.log(`    ${line}`);
          }
        }
        if (result.diff.split("\n").length > DISPLAY_LIMITS.diffLines) {
          console.log("    ... (truncated)");
        }
        console.log("");
      }
    }
    console.log("");
  }

  // Discovered files
  const unprotectedDiscovered = results.discovered.filter(
    (d) => !d.isProtected
  );
  if (unprotectedDiscovered.length > 0) {
    console.log(
      `${COLORS.bold}NEW FILES DETECTED${COLORS.reset} (may need protection)`
    );
    console.log("─".repeat(50));
    for (const file of unprotectedDiscovered) {
      console.log(`  ${STATUS_ICONS.info} ${file.file}`);
      console.log(`    ${COLORS.dim}${file.suggestion}${COLORS.reset}`);
    }
    console.log("");
  }

  // Scan results
  if (results.scans.length > 0) {
    console.log(`${COLORS.bold}SCAN RESULTS${COLORS.reset}`);
    console.log("─".repeat(50));

    for (const result of results.scans) {
      console.log(formatScanResult(result));
    }
    console.log("");
  }

  // Summary
  console.log(`${COLORS.bold}SUMMARY${COLORS.reset}`);
  console.log("─".repeat(50));

  if (results.integrity.length > 0) {
    const integrityTotal =
      results.summary.integrityPassed +
      results.summary.integrityFailed +
      results.summary.integrityMissing;
    console.log(
      `  Integrity: ${results.summary.integrityPassed}/${integrityTotal} passed` +
        (results.summary.integrityFailed > 0
          ? `, ${COLORS.red}${results.summary.integrityFailed} drifted${COLORS.reset}`
          : "") +
        (results.summary.integrityMissing > 0
          ? `, ${COLORS.yellow}${results.summary.integrityMissing} missing${COLORS.reset}`
          : "")
    );
  }

  if (results.discovered.length > 0) {
    console.log(
      `  Discovery: ${results.summary.discoveredFiles} new files found` +
        (results.summary.discoveredFiles > 0 ? " (review for protection)" : "")
    );
  }

  if (results.scans.length > 0) {
    const scansTotal =
      results.summary.scansPassed +
      results.summary.scansFailed +
      results.summary.scansSkipped;
    console.log(
      `  Scans: ${results.summary.scansPassed}/${scansTotal} passed` +
        (results.summary.scansFailed > 0
          ? `, ${COLORS.red}${results.summary.scansFailed} failed${COLORS.reset}`
          : "") +
        (results.summary.scansSkipped > 0
          ? `, ${results.summary.scansSkipped} skipped`
          : "")
    );
  }

  console.log("");

  // Final status
  if (
    results.summary.integrityFailed > 0 ||
    results.summary.integrityMissing > 0
  ) {
    console.log(`${COLORS.red}✗ INTEGRITY VIOLATIONS DETECTED${COLORS.reset}`);
    actionsOutput.error(
      `Integrity violations: ${results.summary.integrityFailed} drifted, ${results.summary.integrityMissing} missing`
    );
  } else if (results.summary.scansFailed > 0) {
    console.log(`${COLORS.red}✗ SCAN FAILURES DETECTED${COLORS.reset}`);
    actionsOutput.error(`Scan failures: ${results.summary.scansFailed} failed`);
  } else {
    console.log(`${COLORS.green}✓ All checks passed${COLORS.reset}`);
    actionsOutput.notice("All checks passed");
  }
}
