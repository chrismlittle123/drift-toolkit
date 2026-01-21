/**
 * Formats process violation results into GitHub issue body.
 */

import { GITHUB_ISSUES } from "../constants.js";
import type { ProcessViolationsDetection } from "../types.js";

/** Truncate issue body if it exceeds GitHub's max length. */
function truncateBody(body: string): string {
  if (body.length <= GITHUB_ISSUES.maxBodyLength) {
    return body;
  }
  return (
    body.slice(0, GITHUB_ISSUES.maxBodyLength - 100) +
    "\n\n... (truncated)\n\n---\n_Created by drift-toolkit_"
  );
}

/**
 * Build the complete issue body for process violations detection.
 */
export function formatProcessViolationsIssueBody(
  detection: ProcessViolationsDetection
): string {
  const parts: string[] = [];

  // Header
  parts.push("## Process Violations Detected\n");
  parts.push(`Repository: \`${detection.repository}\``);
  parts.push(`Scan time: ${detection.scanTime}\n`);

  // Summary table
  parts.push("### Summary\n");
  parts.push("| Category | Passed | Failed |");
  parts.push("|----------|--------|--------|");

  for (const cat of detection.summary) {
    parts.push(`| ${cat.category} | ${cat.passed} | ${cat.failed} |`);
  }

  parts.push("");

  // Violations by category
  if (detection.violations.length > 0) {
    parts.push("### Violations\n");

    // Group violations by category
    const byCategory = new Map<
      string,
      typeof detection.violations
    >();
    for (const v of detection.violations) {
      const existing = byCategory.get(v.category) || [];
      existing.push(v);
      byCategory.set(v.category, existing);
    }

    // Output each category
    for (const [category, violations] of byCategory) {
      parts.push(`#### ${formatCategoryName(category)}\n`);

      // Table of violations
      parts.push("| Check | Message | Severity |");
      parts.push("|-------|---------|----------|");

      for (const v of violations) {
        const severity = v.severity === "error" ? ":x:" : ":warning:";
        const message = v.file ? `${v.message} (${v.file})` : v.message;
        parts.push(`| ${v.check} | ${message} | ${severity} |`);
      }

      parts.push("");
    }
  }

  // How to fix section
  parts.push("### How to Fix\n");
  parts.push(
    "Review each violation above and take corrective action. Common fixes include:\n"
  );
  parts.push("1. **Branch protection**: Go to Settings > Branches > Branch protection rules");
  parts.push("2. **Required files**: Add missing files like CODEOWNERS or PR templates");
  parts.push("3. **CI checks**: Ensure required status checks are configured");
  parts.push("4. **Repository settings**: Update visibility, security settings as needed\n");
  parts.push("Close this issue once all violations are resolved.\n");

  // Footer
  parts.push("---\n_Created by drift-toolkit_");

  return truncateBody(parts.join("\n"));
}

/**
 * Format category name for display (e.g., "branches" -> "Branch Protection")
 */
function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    branches: "Branch Protection",
    required_files: "Required Files",
    forbidden_files: "Forbidden Files",
    commits: "Commit Standards",
    pull_requests: "Pull Request Requirements",
    ci: "CI/CD Configuration",
    repo: "Repository Settings",
    codeowners: "CODEOWNERS",
    hooks: "Git Hooks",
    docs: "Documentation",
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Build the issue title for process violations detection.
 */
export function getProcessViolationsIssueTitle(): string {
  return GITHUB_ISSUES.processViolationsTitle;
}

/**
 * Get the label for process violations issues.
 */
export function getProcessViolationsIssueLabel(): string {
  return GITHUB_ISSUES.processViolationsLabel;
}
