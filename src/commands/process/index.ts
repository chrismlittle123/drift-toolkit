import { Command } from "commander";
import { scan } from "./scan.js";

/**
 * Register process domain commands on the given program
 */
export function registerProcessCommands(program: Command): void {
  program
    .command("scan")
    .description("Scan repository for process standard violations")
    .option("-r, --repo <owner/repo>", "Repository to scan (owner/repo format)")
    .option(
      "-o, --org <org>",
      "Organization or user to discover repos with check.toml"
    )
    .option("-c, --config <path>", "Path to check.toml config file")
    .option("--json", "Output results as JSON")
    .option(
      "-n, --dry-run",
      "Show what issues would be created without creating them"
    )
    .action(scan);
}
