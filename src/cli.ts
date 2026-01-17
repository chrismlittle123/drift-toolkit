#!/usr/bin/env node

import { program } from "commander";
import { version } from "./version.js";
import { registerCodeCommands } from "./commands/code/index.js";

program
  .name("drift")
  .description(
    "Monitor repository standards and detect drift across your GitHub organization"
  )
  .version(version);

// Domain command groups
const codeCmd = program
  .command("code")
  .description("Code quality and integrity");

registerCodeCommands(codeCmd);

program.parse();
