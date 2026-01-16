#!/usr/bin/env node

import { program } from "commander";
import { version } from "./version.js";
import { scan } from "./commands/scan.js";
import { fix } from "./commands/fix.js";

program
  .name("drift")
  .description(
    "Monitor repository standards and detect drift across your GitHub organization"
  )
  .version(version);

program
  .command("scan")
  .description("Scan repositories for drift")
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

program.parse();
