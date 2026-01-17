# CLI Refactor: Domain-Based Commands

This document outlines the restructure of drift-toolkit from flat commands to domain-based commands.

---

## Motivation

The current CLI has flat commands (`drift scan`, `drift fix`) that focus on code integrity. As drift expands to cover process compliance and infrastructure drift, a domain-based structure provides:

- **Clear organization** - Commands grouped by concern
- **Extensibility** - Easy to add new domains
- **Discoverability** - Users know where to look for features

---

## New Command Hierarchy

```
drift code scan          # Integrity checks, linting, tech debt
drift code fix           # Sync files from approved sources
drift code report        # Code health summary

drift process scan       # Docs, ownership, CI performance
drift process fix        # Generate missing templates
drift process report     # Process compliance summary

drift infra scan         # IaC drift, resources, secrets, cost
drift infra fix          # Tag resources, rotate keys
drift infra report       # Infra health summary
```

---

## Migration Guide

| Current Command | New Command |
|-----------------|-------------|
| `drift scan` | `drift code scan` |
| `drift fix` | `drift code fix` |

---

## Config File Changes

### Current Format (Legacy)

```yaml
integrity:
  protected:
    - file: .github/workflows/ci.yml
      approved: approved/ci.yml
      severity: high

scans:
  - name: typescript
    command: npx tsc --noEmit
```

### New Format (Domain-Based)

```yaml
code:
  integrity:
    protected:
      - file: .github/workflows/ci.yml
        approved: approved/ci.yml
        severity: high
  scans:
    - name: typescript
      command: npx tsc --noEmit
  tech_debt:
    max_todo_age_days: 90
    max_eslint_disables: 10

process:
  docs:
    require_readme: true
    require_contributing: true
    require_changelog: false
  ownership:
    require_codeowners: true
    codeowners_coverage: 80
  ci:
    max_workflow_duration_minutes: 30
    require_caching: true

infra:
  iac:
    provider: terraform
    detect_drift: true
  secrets:
    max_key_age_days: 90
    check_rotation: true
  cost:
    require_tags: [team, environment, service]
```

Both formats are supported for backward compatibility.

---

## Implementation Phases

### Phase 1: CLI Restructure ⬅️ **Current**

- [ ] Create `src/commands/code/` directory
- [ ] Move `scan.ts` → `src/commands/code/scan.ts`
- [ ] Move `fix.ts` → `src/commands/code/fix.ts`
- [ ] Create `src/commands/code/index.ts` command group
- [ ] Update `src/cli.ts` to use nested commands
- [ ] Update config loader for nested `code:` section
- [ ] Update types for domain-aware config
- [ ] Update all tests
- [ ] Bump to v1.0.0 (breaking change)

### Phase 2: Code Domain Enhancements

- [ ] Add `drift code report` command
- [ ] Tech debt scanning (TODO/FIXME age tracking)
- [ ] `eslint-disable` and `@ts-ignore` counts
- [ ] Skipped test detection
- [ ] Branch activity checks (stale branches, long PRs)

### Phase 3: Process Domain

- [ ] Add `drift process scan` command
- [ ] Documentation checks (README, CONTRIBUTING, CHANGELOG)
- [ ] CODEOWNERS validation and coverage
- [ ] Team metadata validation
- [ ] CI performance analysis (workflow duration, caching)
- [ ] Add `drift process fix` for template generation
- [ ] Add `drift process report` command

### Phase 4: Infra Domain

- [ ] Add `drift infra scan` command
- [ ] Terraform/Pulumi state drift detection
- [ ] Cloud resource scanning (AWS, GCP, Azure)
- [ ] Secret rotation checks
- [ ] Cost analysis and tagging validation
- [ ] Add `drift infra fix` for auto-remediation
- [ ] Add `drift infra report` command

---

## Directory Structure

```
src/
├── cli.ts                        # Main CLI entry, registers domains
├── commands/
│   ├── code/
│   │   ├── index.ts              # Register code commands
│   │   ├── scan.ts               # drift code scan
│   │   ├── fix.ts                # drift code fix
│   │   └── report.ts             # drift code report
│   ├── process/
│   │   ├── index.ts              # Register process commands
│   │   ├── scan.ts               # drift process scan
│   │   ├── fix.ts                # drift process fix
│   │   └── report.ts             # drift process report
│   └── infra/
│       ├── index.ts              # Register infra commands
│       ├── scan.ts               # drift infra scan
│       ├── fix.ts                # drift infra fix
│       └── report.ts             # drift infra report
├── config/
│   └── loader.ts                 # Supports flat + nested config
├── types.ts                      # Domain-aware types
└── ...
```

---

## CLI Implementation Pattern

Using Commander.js nested commands:

```typescript
// src/cli.ts
import { Command } from "commander";
import { registerCodeCommands } from "./commands/code/index.js";
import { registerProcessCommands } from "./commands/process/index.js";
import { registerInfraCommands } from "./commands/infra/index.js";

const program = new Command();

program
  .name("drift")
  .description("Monitor drift across code, process, and infrastructure")
  .version(version);

// Domain command groups
const codeCmd = program.command("code").description("Code quality and integrity");
const processCmd = program.command("process").description("Process compliance");
const infraCmd = program.command("infra").description("Infrastructure drift");

registerCodeCommands(codeCmd);
registerProcessCommands(processCmd);
registerInfraCommands(infraCmd);

program.parse();
```

```typescript
// src/commands/code/index.ts
import { Command } from "commander";
import { scan } from "./scan.js";
import { fix } from "./fix.js";

export function registerCodeCommands(program: Command): void {
  program
    .command("scan")
    .description("Scan for code integrity and run checks")
    .option("-p, --path <path>", "Directory to scan")
    .option("-c, --config <config>", "Config file path")
    .option("-o, --org <org>", "GitHub org to scan")
    .option("--json", "Output as JSON")
    .action(scan);

  program
    .command("fix")
    .description("Fix drifted files from approved sources")
    .option("-p, --path <path>", "Directory to fix")
    .option("-c, --config <config>", "Config file path")
    .option("-n, --dry-run", "Preview changes")
    .action(fix);
}
```

---

## Versioning

This is a **breaking change**. Version bump:

- Current: `0.0.x`
- After restructure: `1.0.0`

---

## Success Criteria

1. `drift code scan` works identically to current `drift scan`
2. `drift code fix` works identically to current `drift fix`
3. Legacy flat config still works
4. All existing tests pass
5. New tests cover nested command structure
6. Documentation updated
