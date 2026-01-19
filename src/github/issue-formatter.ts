/**
 * Formats drift detection results into GitHub issue body.
 */

import { DISPLAY_LIMITS, GITHUB_ISSUES } from "../constants.js";
import type { DriftDetection, FileChange } from "../types.js";

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
