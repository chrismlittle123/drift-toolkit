import { Command } from "commander";
import { scan } from "./scan.js";
import { fix } from "./fix.js";

/**
 * Register code domain commands on the given program
 */
export function registerCodeCommands(program: Command): void {
  program
    .command("scan")
    .description("Scan for code integrity and run checks")
    .option(
      "-p, --path <path>",
      "Local directory to scan (default: current directory)"
    )
    .option("-c, --config <config>", "Path to drift.config.yaml")
    .option("-o, --org <org>", "GitHub organization or username to scan")
    .option("-r, --repo <repo>", "Single repository to scan (requires --org)")
    .option("--config-repo <repo>", "Config repo name (default: drift-config)")
    .option(
      "--github-token <token>",
      "GitHub token (or set GITHUB_TOKEN env var)"
    )
    .option("--json", "Output results as JSON")
    .option(
      "-n, --dry-run",
      "Show what issues would be created without creating them"
    )
    .action(scan);

  program
    .command("fix")
    .description("Fix drifted files by syncing from approved sources")
    .option(
      "-p, --path <path>",
      "Local directory to fix (default: current directory)"
    )
    .option("-c, --config <config>", "Path to drift.config.yaml")
    .option("-f, --file <file>", "Fix a specific file only")
    .option("-n, --dry-run", "Show what would be fixed without making changes")
    .action(fix);
}
