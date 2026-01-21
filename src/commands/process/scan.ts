import { validateProcess, type ValidateProcessResult } from "check-my-toolkit";
import { version } from "../../version.js";
import { actionsOutput, COLORS } from "../../utils/index.js";
import { createIssue, getGitHubToken } from "../../github/client.js";
import { discoverProcessRepos } from "../../github/process-repo-discovery.js";
import {
  formatProcessViolationsIssueBody,
  getProcessViolationsIssueTitle,
  getProcessViolationsIssueLabel,
} from "../../github/process-issue-formatter.js";
import type {
  ProcessViolationsDetection,
  ProcessCheckSummary,
  ProcessViolation,
} from "../../types.js";

export interface ProcessScanOptions {
  repo?: string;
  org?: string;
  config?: string;
  json?: boolean;
  dryRun?: boolean;
}

/**
 * Map check-my-toolkit ValidateProcessResult to drift-toolkit ProcessViolationsDetection
 */
function mapToDetection(
  result: ValidateProcessResult,
  repo: string
): ProcessViolationsDetection {
  // Group checks by category (extract from check name, e.g., "branches.protection" -> "branches")
  const categoryMap = new Map<string, { passed: number; failed: number }>();
  const violations: ProcessViolation[] = [];

  for (const check of result.checks) {
    // Extract category from check name (e.g., "branches.protection" -> "branches")
    const category = check.name.split(".")[0] || check.name;

    // Update category counts
    const stats = categoryMap.get(category) || { passed: 0, failed: 0 };
    if (check.passed) {
      stats.passed++;
    } else {
      stats.failed++;
    }
    categoryMap.set(category, stats);

    // Collect violations from failed checks
    if (!check.passed && check.violations) {
      for (const v of check.violations) {
        violations.push({
          category,
          check: check.name,
          rule: v.rule,
          message: v.message,
          severity: v.severity,
          file: v.file,
        });
      }
    }
  }

  // Convert category map to summary array
  const summary: ProcessCheckSummary[] = [];
  for (const [category, stats] of categoryMap) {
    summary.push({
      category,
      passed: stats.passed,
      failed: stats.failed,
    });
  }

  return {
    repository: repo,
    scanTime: new Date().toISOString(),
    summary,
    violations,
  };
}

/**
 * Print scan results to console
 */
function printResults(detection: ProcessViolationsDetection): void {
  console.log(`\n${COLORS.bold}Process Scan Results${COLORS.reset}`);
  console.log(`Repository: ${detection.repository}`);
  console.log(`Scan time: ${detection.scanTime}\n`);

  // Print summary table
  console.log(`${COLORS.bold}Summary${COLORS.reset}`);
  console.log("─".repeat(40));
  console.log(
    `${"Category".padEnd(20)} ${"Passed".padEnd(8)} ${"Failed".padEnd(8)}`
  );
  console.log("─".repeat(40));

  for (const cat of detection.summary) {
    const passedColor = cat.passed > 0 ? COLORS.green : "";
    const failedColor = cat.failed > 0 ? COLORS.red : "";
    console.log(
      `${cat.category.padEnd(20)} ${passedColor}${String(cat.passed).padEnd(8)}${COLORS.reset} ${failedColor}${String(cat.failed).padEnd(8)}${COLORS.reset}`
    );
  }
  console.log("─".repeat(40));

  // Print violations if any
  if (detection.violations.length > 0) {
    console.log(`\n${COLORS.bold}${COLORS.red}Violations${COLORS.reset}`);
    console.log("─".repeat(60));

    for (const v of detection.violations) {
      const severityColor = v.severity === "error" ? COLORS.red : COLORS.yellow;
      const severityIcon = v.severity === "error" ? "✗" : "⚠";
      console.log(
        `${severityColor}${severityIcon}${COLORS.reset} [${v.category}] ${v.check}`
      );
      console.log(`  ${v.message}`);
      if (v.file) {
        console.log(`  File: ${v.file}`);
      }
      console.log("");
    }
  } else {
    console.log(`\n${COLORS.green}✓ All process checks passed${COLORS.reset}`);
  }
}

/**
 * Discover repos with check.toml in an organization.
 * This is the first step of org-wide scanning.
 */
async function discoverOrgRepos(
  org: string,
  token: string,
  json: boolean
): Promise<string[]> {
  if (!json) {
    console.log(`Discovering repos with check.toml in ${org}...`);
  }

  const result = await discoverProcessRepos({
    org,
    token,
    onProgress: (checked, total) => {
      if (!json) {
        process.stdout.write(`\rChecking repos: ${checked}/${total}`);
      }
    },
  });

  if (!json) {
    // Clear the progress line
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  }

  const repoNames = result.repos.map((r) => r.full_name);

  if (json) {
    console.log(
      JSON.stringify(
        {
          org,
          isOrg: result.isOrg,
          totalRepos: result.totalRepos,
          reposWithCheckToml: repoNames.length,
          repos: repoNames,
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `Found ${repoNames.length}/${result.totalRepos} repos with check.toml`
    );
    if (repoNames.length > 0) {
      console.log("");
      for (const name of repoNames) {
        console.log(`  ${name}`);
      }
    }
  }

  return repoNames;
}

interface SingleRepoScanOptions {
  repo: string;
  config?: string;
  json: boolean;
  dryRun: boolean;
  token: string;
}

/**
 * Scan a single repository for process violations.
 */
async function scanSingleRepo(
  options: SingleRepoScanOptions
): Promise<boolean> {
  const { repo, config, json, dryRun, token } = options;
  const [owner, repoName] = repo.split("/");

  if (!json) {
    console.log(`Scanning process standards for: ${repo}`);
    if (config) {
      console.log(`Using config: ${config}`);
    }
  }

  // Call check-my-toolkit's validateProcess
  const result = await validateProcess({
    repo,
    config,
  });

  // Map to drift-toolkit detection format
  const detection = mapToDetection(result, repo);

  // Output results
  if (json) {
    console.log(JSON.stringify(detection, null, 2));
  } else {
    printResults(detection);
  }

  // Create issue if there are violations
  if (detection.violations.length > 0) {
    if (dryRun) {
      console.log(
        `\n${COLORS.yellow}[DRY RUN] Would create issue in ${repo}${COLORS.reset}`
      );
      actionsOutput.warning(`Process violations detected in ${repo}`);
    } else {
      const issueResult = await createIssue(
        {
          owner,
          repo: repoName,
          title: getProcessViolationsIssueTitle(),
          body: formatProcessViolationsIssueBody(detection),
          labels: [getProcessViolationsIssueLabel()],
        },
        token
      );
      console.log(
        `\n${COLORS.green}✓ Created issue #${issueResult.number}${COLORS.reset}`
      );
      console.log(`  ${issueResult.html_url}`);
      actionsOutput.notice(
        `Created issue #${issueResult.number} for process violations`
      );
    }
    return true; // violations found
  }

  actionsOutput.notice(`Process scan passed for ${repo}`);
  return false; // no violations
}

export async function scan(options: ProcessScanOptions): Promise<void> {
  const { repo, org, config, json, dryRun } = options;

  // Validate options: need either --repo or --org
  if (!repo && !org) {
    const errorMsg = "Either --repo or --org must be specified";
    console.error(`Error: ${errorMsg}`);
    actionsOutput.error(errorMsg);
    process.exit(1);
    return;
  }

  // Get GitHub token (required for validateProcess to fetch repo data)
  const token = getGitHubToken();
  if (!token) {
    const errorMsg =
      "GitHub token required. Set GITHUB_TOKEN environment variable or use --github-token";
    console.error(`Error: ${errorMsg}`);
    actionsOutput.error(errorMsg);
    process.exit(1);
    return;
  }

  if (!json) {
    console.log(`Drift v${version}`);
  }

  try {
    // Case 1: Single repo scan (--repo without --org, or --org with --repo)
    if (repo) {
      // Validate repo format
      if (!repo.includes("/")) {
        const errorMsg = "Repository must be in owner/repo format";
        console.error(`Error: ${errorMsg}`);
        actionsOutput.error(errorMsg);
        process.exit(1);
        return;
      }

      const hasViolations = await scanSingleRepo({
        repo,
        config,
        json: json ?? false,
        dryRun: dryRun ?? false,
        token,
      });

      if (hasViolations) {
        process.exit(1);
      }
      return;
    }

    // Case 2: Org-wide discovery (--org without --repo)
    // This discovers repos with check.toml - actual scanning is done in #118
    if (org) {
      const repoNames = await discoverOrgRepos(org, token, json ?? false);

      // For now, just discover. Parallel scanning will be added in #118.
      // If user wants to scan, they should use --repo to scan individual repos.
      if (!json && repoNames.length > 0) {
        console.log(
          `\n${COLORS.dim}To scan these repos, use: drift process scan --repo <owner/repo>${COLORS.reset}`
        );
        console.log(
          `${COLORS.dim}Parallel org-wide scanning coming soon.${COLORS.reset}`
        );
      }
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(`\n${COLORS.red}Error: ${errorMsg}${COLORS.reset}`);
    actionsOutput.error(errorMsg);
    process.exit(1);
  }
}
