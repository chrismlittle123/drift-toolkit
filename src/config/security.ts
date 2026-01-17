import type { DriftConfig } from "../types.js";
import { DISPLAY_LIMITS } from "../constants.js";

/**
 * Dangerous command patterns that indicate potential security risks.
 * These patterns are checked against scan commands to warn users.
 */
const DANGEROUS_COMMAND_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\brm\s+(-[rf]+\s+)*\//,
    reason: "removes files from root directory",
  },
  { pattern: /\brm\s+-[rf]*\s+\*/, reason: "recursive deletion with wildcard" },
  { pattern: />\s*\/etc\//, reason: "writes to system configuration" },
  { pattern: /\bcurl\b.*\|\s*(bash|sh|zsh)/, reason: "executes remote code" },
  { pattern: /\bwget\b.*\|\s*(bash|sh|zsh)/, reason: "executes remote code" },
  { pattern: /\beval\s+\$/, reason: "evaluates dynamic code" },
  { pattern: /\b(sudo|doas)\s+/, reason: "runs with elevated privileges" },
  {
    pattern: /\bchmod\s+[0-7]*777\b/,
    reason: "sets world-writable permissions",
  },
  { pattern: /\bchown\s+root\b/, reason: "changes ownership to root" },
  { pattern: />\s*\/dev\/(sda|hda|nvme)/, reason: "writes to block device" },
  { pattern: /\bmkfs\b/, reason: "formats filesystem" },
  { pattern: /\bdd\s+.*of=\/dev\//, reason: "writes directly to device" },
  { pattern: /\/\/[^/]*:[^/]*@/, reason: "may contain embedded credentials" },
  { pattern: /\bpasswd\b|\bshadow\b/, reason: "accesses password files" },
  {
    pattern: /\bnc\s+-[el]/,
    reason: "opens network listener (potential backdoor)",
  },
  { pattern: /\breverse.{0,20}shell/i, reason: "potential reverse shell" },
];

/**
 * Check if a command contains potentially dangerous patterns.
 * Returns an array of warning messages for any matches.
 */
export function validateScanCommand(command: string): string[] {
  const warnings: string[] = [];

  for (const { pattern, reason } of DANGEROUS_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      const preview = command.slice(0, DISPLAY_LIMITS.commandPreview);
      const truncated =
        command.length > DISPLAY_LIMITS.commandPreview ? "..." : "";
      warnings.push(`Command "${preview}${truncated}" ${reason}`);
    }
  }

  return warnings;
}

/**
 * Validate all scan commands in a config and return warnings.
 * Checks both legacy flat format and new nested code: format.
 */
export function validateConfigSecurity(config: DriftConfig): string[] {
  const warnings: string[] = [];

  // Check legacy flat format
  if (config.scans) {
    for (const scan of config.scans) {
      const commandWarnings = validateScanCommand(scan.command);
      for (const warning of commandWarnings) {
        warnings.push(`[${scan.name}] ${warning}`);
      }
    }
  }

  // Check new nested code: format
  if (config.code?.scans) {
    for (const scan of config.code.scans) {
      const commandWarnings = validateScanCommand(scan.command);
      for (const warning of commandWarnings) {
        warnings.push(`[code.${scan.name}] ${warning}`);
      }
    }
  }

  return warnings;
}
