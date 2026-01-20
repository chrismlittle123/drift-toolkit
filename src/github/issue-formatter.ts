/**
 * Formats drift detection results into GitHub issue body.
 */

import { DISPLAY_LIMITS, GITHUB_ISSUES } from "../constants.js";
import type {
  DriftDetection,
  FileChange,
  MissingProjectsDetection,
  TierMismatchDetection,
} from "../types.js";

/**
 * Truncate diff if it exceeds max lines.
 */
function truncateDiff(
  diff: string,
  maxLines: number = DISPLAY_LIMITS.diffLines
): string {
  const lines = diff.split("\n");
  if (lines.length <= maxLines) {
    return diff;
  }
  return lines.slice(0, maxLines).join("\n") + "\n... (truncated)";
}

/**
 * Format a single file change as markdown.
 */
function formatFileChange(change: FileChange): string {
  const statusLabel =
    change.status === "deleted"
      ? " (deleted)"
      : change.status === "added"
        ? " (new)"
        : "";

  let section = `#### ${change.file}${statusLabel}\n\n`;

  if (change.diff) {
    section += "```diff\n";
    section += truncateDiff(change.diff);
    section += "\n```\n";
  } else if (change.status === "deleted") {
    section += "_File was deleted_\n";
  }

  return section;
}

/**
 * Build the complete issue body for drift detection.
 */
export function formatDriftIssueBody(detection: DriftDetection): string {
  const parts: string[] = [];

  // Header
  parts.push("## Configuration Drift Detected\n");
  parts.push(`Repository: \`${detection.repository}\``);
  parts.push(`Scan time: ${detection.scanTime}`);
  parts.push(
    `Commit: [${detection.commit.slice(0, 7)}](${detection.commitUrl})\n`
  );

  // Changed files section
  parts.push("### Changed Files\n");

  for (const change of detection.changes) {
    parts.push(formatFileChange(change));
  }

  // Action required
  parts.push("### Action Required\n");
  parts.push(
    "Review these configuration changes and close this issue once investigated.\n"
  );

  // Footer
  parts.push("---\n_Created by drift-toolkit_");

  let body = parts.join("\n");

  // Ensure we don't exceed GitHub's limit
  if (body.length > GITHUB_ISSUES.maxBodyLength) {
    body =
      body.slice(0, GITHUB_ISSUES.maxBodyLength - 100) +
      "\n\n... (content truncated due to length)\n\n---\n_Created by drift-toolkit_";
  }

  return body;
}

/**
 * Build the issue title for drift detection.
 */
export function getDriftIssueTitle(): string {
  return GITHUB_ISSUES.driftTitle;
}

/**
 * Get the label for drift issues.
 */
export function getDriftIssueLabel(): string {
  return GITHUB_ISSUES.driftLabel;
}

/**
 * Build the complete issue body for missing projects detection.
 */
export function formatMissingProjectsIssueBody(
  detection: MissingProjectsDetection
): string {
  const parts: string[] = [];

  // Header
  parts.push("## New Project Detected Without Standards\n");
  parts.push(`Repository: \`${detection.repository}\``);
  parts.push(`Scan time: ${detection.scanTime}\n`);

  // Projects table
  parts.push("### Projects Missing check.toml\n");
  parts.push("| Path | Type |");
  parts.push("|------|------|");

  for (const project of detection.projects) {
    parts.push(`| ${project.path} | ${project.type} |`);
  }

  parts.push("");

  // Action required
  parts.push("### Action Required\n");
  parts.push(
    "These projects should have a check.toml file to enforce code standards.\n"
  );
  parts.push("1. Run `cm init` in each project directory");
  parts.push("2. Configure appropriate rulesets for the project tier");
  parts.push("3. Close this issue once standards are applied\n");

  // Footer
  parts.push("---\n_Created by drift-toolkit_");

  let body = parts.join("\n");

  // Ensure we don't exceed GitHub's limit
  if (body.length > GITHUB_ISSUES.maxBodyLength) {
    body =
      body.slice(0, GITHUB_ISSUES.maxBodyLength - 100) +
      "\n\n... (content truncated due to length)\n\n---\n_Created by drift-toolkit_";
  }

  return body;
}

/**
 * Build the issue title for missing projects detection.
 */
export function getMissingProjectsIssueTitle(): string {
  return GITHUB_ISSUES.missingProjectsTitle;
}

/**
 * Get the label for missing projects issues.
 */
export function getMissingProjectsIssueLabel(): string {
  return GITHUB_ISSUES.missingProjectsLabel;
}

/**
 * Build the complete issue body for tier-ruleset mismatch detection.
 */
export function formatTierMismatchIssueBody(
  detection: TierMismatchDetection
): string {
  const parts: string[] = [];

  // Header
  parts.push("## Tier-Ruleset Mismatch Detected\n");
  parts.push(`Repository: \`${detection.repository}\``);
  parts.push(`Scan time: ${detection.scanTime}\n`);

  // Mismatch details
  parts.push("### Mismatch Details\n");
  parts.push(`| Field | Value |`);
  parts.push(`|-------|-------|`);
  parts.push(`| **Tier** | ${detection.tier} |`);
  parts.push(`| **Expected Pattern** | \`${detection.expectedPattern}\` |`);
  parts.push(`| **Current Rulesets** | ${detection.rulesets.map((r) => `\`${r}\``).join(", ") || "_none_"} |`);
  parts.push("");

  // Error message
  parts.push("### Issue\n");
  parts.push(`${detection.error}\n`);

  // Action required
  parts.push("### Action Required\n");
  parts.push(
    "The repository tier does not match the rulesets being used. This can cause:\n"
  );
  parts.push("- Production repositories running with non-production standards");
  parts.push("- Missing security or quality checks appropriate for the tier\n");
  parts.push("**To fix:**\n");
  parts.push(
    `1. Update \`check.toml\` to use a ruleset matching \`${detection.expectedPattern}\``
  );
  parts.push(
    "2. Or update `repo-metadata.yaml` tier if the current rulesets are correct"
  );
  parts.push("3. Close this issue once the mismatch is resolved\n");

  // Footer
  parts.push("---\n_Created by drift-toolkit_");

  let body = parts.join("\n");

  // Ensure we don't exceed GitHub's limit
  if (body.length > GITHUB_ISSUES.maxBodyLength) {
    body =
      body.slice(0, GITHUB_ISSUES.maxBodyLength - 100) +
      "\n\n... (content truncated due to length)\n\n---\n_Created by drift-toolkit_";
  }

  return body;
}

/**
 * Build the issue title for tier mismatch detection.
 */
export function getTierMismatchIssueTitle(): string {
  return GITHUB_ISSUES.tierMismatchTitle;
}

/**
 * Get the label for tier mismatch issues.
 */
export function getTierMismatchIssueLabel(): string {
  return GITHUB_ISSUES.tierMismatchLabel;
}
