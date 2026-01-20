import { minimatch } from "minimatch";
import {
  listRepos,
  cloneRepo,
  createTempDir,
  removeTempDir,
  getGitHubToken,
  repoExists,
  createIssue,
  isRepoScannable,
} from "./client.js";
import { hasRecentCommits } from "./repo-checks.js";
import {
  formatDriftIssueBody,
  getDriftIssueTitle,
  getDriftIssueLabel,
  formatMissingProjectsIssueBody,
  getMissingProjectsIssueTitle,
  getMissingProjectsIssueLabel,
  formatTierMismatchIssueBody,
  getTierMismatchIssueTitle,
  getTierMismatchIssueLabel,
} from "./issue-formatter.js";
import { detectMissingProjects } from "../repo/project-detection.js";
import {
  validateTierRuleset,
  hasTierMismatch,
} from "../repo/tier-validation.js";
import {
  loadConfig,
  loadRepoMetadata,
  validateConfigSecurity,
} from "../config/loader.js";
import { checkAllIntegrity, discoverFiles } from "../integrity/checker.js";
import { runAllScans } from "../scanner/runner.js";
import { version } from "../version.js";
import type {
  DriftConfig,
  DriftResults,
  OrgScanResults,
  RepoScanResult,
  DriftDetection,
  FileChange,
  DriftIssueResult,
  MissingProject,
  MissingProjectsDetection,
  TierValidationResult,
  TierMismatchDetection,
} from "../types.js";
import { CONCURRENCY, DEFAULTS } from "../constants.js";
import {
  printWarnings,
  COLORS,
  STATUS_ICONS,
  createEmptyResults,
  createEmptyOrgSummary,
  updateIntegritySummary,
  updateScanSummary,
  updateOrgSummaryFromRepo,
  hasIssues,
  getErrorMessage,
} from "../utils/index.js";

export interface OrgScanOptions {
  org: string;
  repo?: string; // Single repo or all if not specified
  configRepo?: string; // Default: drift-config
  token?: string;
  json?: boolean;
  dryRun?: boolean; // Log but don't create issues
  all?: boolean; // Skip commit window filter (scan all repos)
  since?: number; // Hours to look back for commits (default: 24)
}

/**
 * Run async tasks with a concurrency limit.
 * Executes tasks in parallel while respecting the max concurrent limit.
 *
 * @param items - Array of items to process
 * @param fn - Async function to run on each item
 * @param concurrency - Maximum concurrent operations
 * @returns Promise resolving to array of results in original order
 */
async function parallelLimit<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = CONCURRENCY.maxRepoScans
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  // Start workers up to concurrency limit
  const workers = Array(Math.min(concurrency, items.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Check if a repo name matches any of the exclude patterns.
 * Supports glob patterns via minimatch.
 *
 * @param repoName - The repository name to check
 * @param patterns - Array of glob patterns to match against
 * @returns True if the repo should be excluded
 */
function matchesExcludePattern(repoName: string, patterns: string[]): boolean {
  return patterns.some((pattern) => minimatch(repoName, pattern));
}

/**
 * Print scan header with org/user info
 */
function printScanHeader(
  org: string,
  configRepoName: string,
  repoCount: number,
  isOrg: boolean
): void {
  console.log(`\nDrift v${version}`);
  console.log(`${isOrg ? "Organization" : "User"}: ${org}`);
  console.log(`Config repo: ${configRepoName}`);
  console.log(`Repos to scan: ${repoCount}`);
  console.log("");
}

/**
 * Convert DriftResults to DriftDetection format for issue creation
 */
function buildDriftDetection(
  org: string,
  repoName: string,
  results: DriftResults
): DriftDetection | null {
  const changes: FileChange[] = [];

  // Add integrity failures as file changes
  for (const integrity of results.integrity) {
    if (integrity.status === "drift" || integrity.status === "missing") {
      changes.push({
        file: integrity.file,
        status: integrity.status === "drift" ? "modified" : "deleted",
        diff: integrity.diff,
      });
    }
  }

  if (changes.length === 0) {
    return null;
  }

  return {
    repository: `${org}/${repoName}`,
    scanTime: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    commit: "HEAD", // Could enhance to get actual commit
    commitUrl: `https://github.com/${org}/${repoName}/commits/main`,
    changes,
  };
}

interface CreateDriftIssueOptions {
  org: string;
  repoName: string;
  results: DriftResults;
  token: string;
  dryRun: boolean;
  json: boolean;
}

/**
 * Create a GitHub issue for drift detection with error handling
 */
async function createDriftIssue(
  options: CreateDriftIssueOptions
): Promise<DriftIssueResult> {
  const { org, repoName, results, token, dryRun, json } = options;
  const detection = buildDriftDetection(org, repoName, results);

  if (!detection) {
    return { created: false };
  }

  if (dryRun) {
    if (!json) {
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Would create issue: ${getDriftIssueTitle()}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Repository: ${org}/${repoName}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Labels: ${getDriftIssueLabel()}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Changed files: ${detection.changes.map((c) => c.file).join(", ")}${COLORS.reset}`
      );
    }
    return { created: false };
  }

  try {
    const body = formatDriftIssueBody(detection);
    const issue = await createIssue(
      {
        owner: org,
        repo: repoName,
        title: getDriftIssueTitle(),
        body,
        labels: [getDriftIssueLabel()],
      },
      token
    );

    if (!json) {
      console.log(
        `  ${COLORS.green}✓ Created issue #${issue.number}: ${issue.html_url}${COLORS.reset}`
      );
    }

    return {
      created: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (!json) {
      console.log(
        `  ${COLORS.yellow}⚠ Failed to create issue: ${errorMessage}${COLORS.reset}`
      );
    }
    return {
      created: false,
      error: errorMessage,
    };
  }
}

interface CreateMissingProjectsIssueOptions {
  org: string;
  repoName: string;
  missingProjects: MissingProject[];
  token: string;
  dryRun: boolean;
  json: boolean;
}

/**
 * Create a GitHub issue for missing projects detection with error handling
 */
async function createMissingProjectsIssue(
  options: CreateMissingProjectsIssueOptions
): Promise<DriftIssueResult> {
  const { org, repoName, missingProjects, token, dryRun, json } = options;

  if (missingProjects.length === 0) {
    return { created: false };
  }

  const detection: MissingProjectsDetection = {
    repository: `${org}/${repoName}`,
    scanTime: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    projects: missingProjects,
  };

  if (dryRun) {
    if (!json) {
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Would create issue: ${getMissingProjectsIssueTitle()}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Repository: ${org}/${repoName}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Labels: ${getMissingProjectsIssueLabel()}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Missing projects: ${missingProjects.map((p) => p.path).join(", ")}${COLORS.reset}`
      );
    }
    return { created: false };
  }

  try {
    const body = formatMissingProjectsIssueBody(detection);
    const issue = await createIssue(
      {
        owner: org,
        repo: repoName,
        title: getMissingProjectsIssueTitle(),
        body,
        labels: [getMissingProjectsIssueLabel()],
      },
      token
    );

    if (!json) {
      console.log(
        `  ${COLORS.green}✓ Created issue #${issue.number}: ${issue.html_url}${COLORS.reset}`
      );
    }

    return {
      created: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (!json) {
      console.log(
        `  ${COLORS.yellow}⚠ Failed to create missing projects issue: ${errorMessage}${COLORS.reset}`
      );
    }
    return {
      created: false,
      error: errorMessage,
    };
  }
}

interface CreateTierMismatchIssueOptions {
  org: string;
  repoName: string;
  tierValidation: TierValidationResult;
  token: string;
  dryRun: boolean;
  json: boolean;
}

/**
 * Create a GitHub issue for tier-ruleset mismatch detection with error handling
 */
async function createTierMismatchIssue(
  options: CreateTierMismatchIssueOptions
): Promise<DriftIssueResult> {
  const { org, repoName, tierValidation, token, dryRun, json } = options;

  if (tierValidation.valid || !tierValidation.error) {
    return { created: false };
  }

  const detection: TierMismatchDetection = {
    repository: `${org}/${repoName}`,
    scanTime: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    tier: tierValidation.tier,
    rulesets: tierValidation.rulesets,
    expectedPattern: tierValidation.expectedPattern,
    error: tierValidation.error,
  };

  if (dryRun) {
    if (!json) {
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Would create issue: ${getTierMismatchIssueTitle()}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Repository: ${org}/${repoName}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Labels: ${getTierMismatchIssueLabel()}${COLORS.reset}`
      );
      console.log(
        `  ${COLORS.cyan}[DRY-RUN] Tier: ${tierValidation.tier}, Expected: ${tierValidation.expectedPattern}${COLORS.reset}`
      );
    }
    return { created: false };
  }

  try {
    const body = formatTierMismatchIssueBody(detection);
    const issue = await createIssue(
      {
        owner: org,
        repo: repoName,
        title: getTierMismatchIssueTitle(),
        body,
        labels: [getTierMismatchIssueLabel()],
      },
      token
    );

    if (!json) {
      console.log(
        `  ${COLORS.green}✓ Created tier mismatch issue #${issue.number}: ${issue.html_url}${COLORS.reset}`
      );
    }

    return {
      created: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    if (!json) {
      console.log(
        `  ${COLORS.yellow}⚠ Failed to create tier mismatch issue: ${errorMessage}${COLORS.reset}`
      );
    }
    return {
      created: false,
      error: errorMessage,
    };
  }
}

/**
 * Scan a single repository
 */
function scanRepo(
  repoPath: string,
  config: DriftConfig,
  approvedBasePath: string
): DriftResults {
  const results = createEmptyResults(repoPath);

  // Run integrity checks
  if (config.integrity?.protected && config.integrity.protected.length > 0) {
    results.integrity = checkAllIntegrity(
      config.integrity.protected,
      repoPath,
      approvedBasePath
    );
    updateIntegritySummary(results.summary, results.integrity);
  }

  // Run file discovery
  if (config.integrity?.discover && config.integrity.discover.length > 0) {
    const protectedFiles = config.integrity.protected?.map((p) => p.file) || [];
    results.discovered = discoverFiles(
      config.integrity.discover,
      repoPath,
      protectedFiles
    );
    results.summary.discoveredFiles = results.discovered.filter(
      (d) => !d.isProtected
    ).length;
  }

  // Load repo metadata for conditional scans
  const metadataResult = loadRepoMetadata(repoPath, config.schema);
  const repoContext = metadataResult?.context;

  // Run scans with context
  if (config.scans && config.scans.length > 0) {
    results.scans = runAllScans(
      config.scans,
      repoPath,
      repoContext ?? undefined
    );
    updateScanSummary(results.summary, results.scans);
  }

  return results;
}

/**
 * Scan all repositories in an organization
 */

export async function scanOrg(
  options: OrgScanOptions
): Promise<OrgScanResults> {
  const token = getGitHubToken(options.token);
  const configRepoName = options.configRepo ?? DEFAULTS.configRepo;
  const org = options.org;

  // Initialize results
  const orgResults: OrgScanResults = {
    org,
    configRepo: configRepoName,
    timestamp: new Date().toISOString(),
    repos: [],
    summary: createEmptyOrgSummary(),
  };

  // Check if config repo exists
  const configRepoExists = await repoExists(org, configRepoName, token);
  if (!configRepoExists) {
    console.error(`Error: Config repo ${org}/${configRepoName} not found.`);
    console.error(
      `Create a '${configRepoName}' repo with drift.config.yaml and approved/ folder.`
    );
    process.exit(1);
  }

  // Clone config repo - use try-finally for guaranteed cleanup
  const configDir = createTempDir("config");

  try {
    // Clone the config repo
    try {
      if (!options.json) {
        console.log(`Cloning config repo ${org}/${configRepoName}...`);
      }
      cloneRepo(org, configRepoName, configDir, token);
    } catch (error) {
      console.error(
        `Error: Failed to clone config repo: ${getErrorMessage(error)}`
      );
      process.exit(1);
    }

    // Load config - will exit if not found, so config is guaranteed non-null after this
    const loadedConfig = loadConfig(configDir);
    if (!loadedConfig) {
      console.error(
        `Error: No drift.config.yaml found in ${org}/${configRepoName}`
      );
      process.exit(1);
      return orgResults; // Never reached, but helps TypeScript understand control flow
    }
    // Create a const that TypeScript knows is non-null
    const config: DriftConfig = loadedConfig;

    // Security validation - warn about potentially dangerous commands
    if (!options.json) {
      const securityWarnings = validateConfigSecurity(config);
      if (securityWarnings.length > 0) {
        printWarnings(
          "SECURITY WARNING",
          securityWarnings,
          "Only run scans from trusted configuration sources."
        );
      }
    }

    const approvedBasePath = configDir;

    // Get list of repos to scan
    let reposToScan: string[];
    let isOrg = true;

    if (options.repo) {
      // Single repo mode
      reposToScan = [options.repo];
    } else {
      // List all repos (auto-detects org vs user)
      if (!options.json) {
        console.log(`Fetching repos for ${org}...`);
      }
      const result = await listRepos(org, token);
      isOrg = result.isOrg;
      // Exclude the config repo and any repos matching exclude patterns
      reposToScan = result.repos
        .map((r) => r.name)
        .filter((name) => name !== configRepoName)
        .filter(
          (name) =>
            !config.exclude || !matchesExcludePattern(name, config.exclude)
        );
    }

    if (!options.json) {
      printScanHeader(org, configRepoName, reposToScan.length, isOrg);
      console.log(
        `Scanning with concurrency: ${Math.min(CONCURRENCY.maxRepoScans, reposToScan.length)}\n`
      );
    }

    /**
     * Scan a single repository and return the result.
     * Handles cloning, scanning, and cleanup.
     * Note: This function is synchronous but wrapped in Promise for use with parallelLimit.
     */
    function scanSingleRepo(repoName: string): RepoScanResult {
      const repoResult: RepoScanResult = {
        repo: repoName,
        results: createEmptyResults(`${org}/${repoName}`),
      };

      const repoDir = createTempDir(repoName);

      try {
        // Clone and scan the repo
        cloneRepo(org, repoName, repoDir, token);
        repoResult.results = scanRepo(repoDir, config, approvedBasePath);
        repoResult.results.path = `${org}/${repoName}`;

        // Detect projects missing check.toml
        repoResult.missingProjects = detectMissingProjects(repoDir);

        // Validate tier-ruleset alignment
        repoResult.tierValidation = validateTierRuleset(repoDir) ?? undefined;
      } catch (error) {
        repoResult.error = getErrorMessage(error);
      } finally {
        removeTempDir(repoDir);
      }

      return repoResult;
    }

    // Scan repos in parallel with concurrency limit
    const repoResults = await parallelLimit(reposToScan, async (repoName) => {
      if (!options.json) {
        process.stdout.write(`Scanning ${org}/${repoName}... `);
      }

      // Check if repo has required files before cloning
      const scannable = await isRepoScannable(org, repoName, token);
      if (!scannable) {
        if (!options.json) {
          console.log(
            `${COLORS.dim}○ skipped (missing required files)${COLORS.reset}`
          );
        }
        return {
          repo: repoName,
          results: createEmptyResults(`${org}/${repoName}`),
          error: "missing required files",
        } as RepoScanResult;
      }

      // Check for recent commits (unless --all flag is set)
      if (!options.all) {
        const hours = options.since ?? DEFAULTS.commitWindowHours;
        const hasActivity = await hasRecentCommits(org, repoName, hours, token);
        if (!hasActivity) {
          if (!options.json) {
            console.log(
              `${COLORS.dim}○ skipped (no recent activity)${COLORS.reset}`
            );
          }
          return {
            repo: repoName,
            results: createEmptyResults(`${org}/${repoName}`),
            error: "no recent activity",
          } as RepoScanResult;
        }
      }

      // scanSingleRepo is sync but we wrap in promise for parallelLimit
      const result = await Promise.resolve(scanSingleRepo(repoName));

      // Print status immediately after each scan completes
      if (!options.json) {
        if (result.error) {
          console.log(
            `${COLORS.yellow}⚠ skipped (${result.error})${COLORS.reset}`
          );
        } else if (hasIssues(result.results)) {
          console.log(`${COLORS.red}✗ issues found${COLORS.reset}`);
        } else {
          console.log(`${COLORS.green}✓ ok${COLORS.reset}`);
        }
      }

      // Create GitHub issue for repos with drift (integrity failures)
      if (!result.error && hasIssues(result.results) && token) {
        await createDriftIssue({
          org,
          repoName,
          results: result.results,
          token,
          dryRun: options.dryRun ?? false,
          json: options.json ?? false,
        });
      }

      // Create GitHub issue for repos with missing projects
      if (
        !result.error &&
        result.missingProjects &&
        result.missingProjects.length > 0 &&
        token
      ) {
        await createMissingProjectsIssue({
          org,
          repoName,
          missingProjects: result.missingProjects,
          token,
          dryRun: options.dryRun ?? false,
          json: options.json ?? false,
        });
      }

      // Create GitHub issue for repos with tier-ruleset mismatch
      if (
        !result.error &&
        result.tierValidation &&
        hasTierMismatch(result.tierValidation) &&
        token
      ) {
        await createTierMismatchIssue({
          org,
          repoName,
          tierValidation: result.tierValidation,
          token,
          dryRun: options.dryRun ?? false,
          json: options.json ?? false,
        });
      }

      return result;
    });

    // Aggregate results
    for (const repoResult of repoResults) {
      if (repoResult.error) {
        orgResults.summary.reposSkipped++;
      } else {
        updateOrgSummaryFromRepo(orgResults.summary, repoResult.results);
      }
      orgResults.repos.push(repoResult);
    }

    // Output results
    if (options.json) {
      console.log(JSON.stringify(orgResults, null, 2));
    } else {
      printOrgResults(orgResults);
    }

    // Exit with error code if there are issues
    if (orgResults.summary.reposWithIssues > 0) {
      process.exit(1);
    }

    return orgResults;
  } finally {
    // Always cleanup config repo, even if errors occur
    removeTempDir(configDir);
  }
}

/**
 * Print organization scan results
 */
function printOrgResults(results: OrgScanResults): void {
  console.log("");
  console.log(`${COLORS.bold}RESULTS BY REPOSITORY${COLORS.reset}`);
  console.log("═".repeat(60));

  for (const repoResult of results.repos) {
    if (repoResult.error) {
      console.log(`\n${repoResult.repo}`);
      console.log("─".repeat(60));
      console.log(
        `  ${COLORS.yellow}⚠ Skipped: ${repoResult.error}${COLORS.reset}`
      );
      continue;
    }

    const r = repoResult.results;
    const repoHasIssues = hasIssues(r);

    if (!repoHasIssues && r.integrity.length === 0 && r.scans.length === 0) {
      // Skip repos with no checks
      continue;
    }

    console.log(`\n${repoResult.repo}`);
    console.log("─".repeat(60));

    // Integrity results
    for (const integrity of r.integrity) {
      const icon =
        integrity.status === "match"
          ? STATUS_ICONS.match
          : integrity.status === "drift"
            ? STATUS_ICONS.drift
            : STATUS_ICONS.missing;
      const status =
        integrity.status === "match"
          ? "ok"
          : integrity.status === "drift"
            ? `DRIFT DETECTED (${integrity.severity})`
            : `MISSING (${integrity.severity})`;
      console.log(`  ${icon} ${integrity.file} - ${status}`);
    }

    // Scan results
    for (const scan of r.scans) {
      const icon =
        scan.status === "pass"
          ? STATUS_ICONS.pass
          : scan.status === "fail"
            ? STATUS_ICONS.fail
            : STATUS_ICONS.skip;
      const status =
        scan.status === "pass"
          ? "passed"
          : scan.status === "fail"
            ? `failed (exit ${scan.exitCode})`
            : `skipped`;
      console.log(`  ${icon} ${scan.scan} - ${status}`);
    }

    if (!repoHasIssues) {
      console.log(`  ${COLORS.green}✓ All checks passed${COLORS.reset}`);
    }
  }

  // Summary
  console.log("");
  console.log(`${COLORS.bold}SUMMARY${COLORS.reset}`);
  console.log("═".repeat(60));
  console.log(`  Organization: ${results.org}`);
  console.log(`  Config repo: ${results.configRepo}`);
  console.log(
    `  Repos: ${results.summary.reposScanned} scanned` +
      (results.summary.reposSkipped > 0
        ? `, ${results.summary.reposSkipped} skipped`
        : "") +
      (results.summary.reposWithIssues > 0
        ? `, ${COLORS.red}${results.summary.reposWithIssues} with issues${COLORS.reset}`
        : "")
  );

  const totalIntegrity =
    results.summary.totalIntegrityPassed +
    results.summary.totalIntegrityFailed +
    results.summary.totalIntegrityMissing;
  if (totalIntegrity > 0) {
    console.log(
      `  Integrity: ${results.summary.totalIntegrityPassed}/${totalIntegrity} passed` +
        (results.summary.totalIntegrityFailed > 0
          ? `, ${COLORS.red}${results.summary.totalIntegrityFailed} drifted${COLORS.reset}`
          : "") +
        (results.summary.totalIntegrityMissing > 0
          ? `, ${COLORS.yellow}${results.summary.totalIntegrityMissing} missing${COLORS.reset}`
          : "")
    );
  }

  const totalScans =
    results.summary.totalScansPassed + results.summary.totalScansFailed;
  if (totalScans > 0) {
    console.log(
      `  Scans: ${results.summary.totalScansPassed}/${totalScans} passed` +
        (results.summary.totalScansFailed > 0
          ? `, ${COLORS.red}${results.summary.totalScansFailed} failed${COLORS.reset}`
          : "")
    );
  }

  console.log("");

  if (results.summary.reposWithIssues > 0) {
    console.log(
      `${COLORS.red}✗ ISSUES DETECTED IN ${results.summary.reposWithIssues} REPO${results.summary.reposWithIssues > 1 ? "S" : ""}${COLORS.reset}`
    );
  } else {
    console.log(`${COLORS.green}✓ All repos passed${COLORS.reset}`);
  }
}
