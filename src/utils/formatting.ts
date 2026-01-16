/**
 * Centralized formatting utilities for terminal output.
 * Provides consistent styling across the codebase.
 */

/**
 * ANSI color codes for terminal output
 */
export const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
} as const;

/**
 * Status icons with colors for terminal display
 */
export const STATUS_ICONS = {
  pass: `${COLORS.green}✓${COLORS.reset}`,
  fail: `${COLORS.red}✗${COLORS.reset}`,
  skip: `${COLORS.yellow}○${COLORS.reset}`,
  error: `${COLORS.red}!${COLORS.reset}`,
  warning: `${COLORS.yellow}!${COLORS.reset}`,
  info: `${COLORS.yellow}→${COLORS.reset}`,
  match: `${COLORS.green}✓${COLORS.reset}`,
  drift: `${COLORS.red}✗${COLORS.reset}`,
  missing: `${COLORS.yellow}?${COLORS.reset}`,
} as const;

/**
 * Severity level to color mapping
 */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: COLORS.red,
  high: COLORS.yellow,
  medium: COLORS.cyan,
  low: COLORS.white,
};

/**
 * Get the color code for a severity level
 */
export function getSeverityColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? COLORS.reset;
}

/**
 * Print a warning section with consistent formatting
 *
 * @param title - The warning section title
 * @param warnings - Array of warning messages to display
 * @param additionalMessage - Optional message to show after warnings
 */
/* eslint-disable no-console */
export function printWarnings(
  title: string,
  warnings: string[],
  additionalMessage?: string
): void {
  console.log(`${COLORS.yellow}⚠ ${title}${COLORS.reset}`);
  console.log("─".repeat(50));
  for (const warning of warnings) {
    console.log(`  ${STATUS_ICONS.warning} ${warning}`);
  }
  if (additionalMessage) {
    console.log("");
    console.log(additionalMessage);
  }
  console.log("");
}
/* eslint-enable no-console */
