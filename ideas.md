# Ideas

Future directions for drift-toolkit.

---

## CLI Restructure: Domain-Based Commands

### New Command Hierarchy

```
drift code scan          # Integrity checks, linting, tech debt
drift code fix           # Auto-fix code issues (sync files, format)
drift code report        # Code health summary

drift process scan       # Docs, ownership, CI, tickets
drift process fix        # Auto-fix process issues (generate templates)
drift process report     # Process compliance summary

drift infra scan         # IaC drift, resources, secrets, cost
drift infra fix          # Auto-fix infra issues (tag resources)
drift infra report       # Infra health summary
```

### Migration from Current Commands

| Current | New |
|---------|-----|
| `drift scan` | `drift code scan` |
| `drift fix` | `drift code fix` |

### Config File Structure

```yaml
# drift.config.yaml

code:
  integrity:
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
  ownership:
    require_codeowners: true
  ci:
    max_workflow_duration_minutes: 30

infra:
  iac:
    provider: terraform
    state_bucket: my-tf-state
  secrets:
    max_key_age_days: 90
  cost:
    require_tags: [team, environment, service]
```

### Implementation Phases

**Phase 1: Restructure CLI (breaking change)**
- Move `scan` → `drift code scan`
- Move `fix` → `drift code fix`
- Update config schema to nest under `code:`

**Phase 2: Code domain enhancements**
- Tech debt scanning (TODO/FIXME age, eslint-disable counts)
- Branch activity checks
- `drift code report` command

**Phase 3: Process domain**
- Documentation checks
- Ownership validation
- CI performance analysis
- Linear integration (optional)

**Phase 4: Infra domain**
- Terraform state drift
- Cloud resource scanning (AWS/GCP)
- Secret rotation checks
- Cost analysis

---

## Code

### Tech Debt

- TODO/FIXME/HACK comments with age tracking
- `eslint-disable` and `@ts-ignore` comment counts
- Skipped tests

### Branches & Activity

- Stale branches (no merges in N days)
- Repos with no commits in N months
- Long-open PRs

---

## Process

### Documentation

- README exists with required sections
- CONTRIBUTING and CHANGELOG present
- API docs for libraries

### Ownership

- CODEOWNERS file exists and covers critical paths
- Team declared in repo metadata
- No orphan repos

### Linear

- Tickets with no activity in 60+ days
- In-progress tickets that are stale
- Backlog items not triaged in 6+ months
- Orphan tickets (no assignee, no project)

### CI Performance

- Slow GitHub Actions workflows (total duration)
- Slowest individual steps/jobs
- Workflows with no caching
- Redundant dependency installs
- Workflows running unnecessarily (on every push vs. PR only)

---

## Infra

### IaC

- Resources exist outside Terraform/Pulumi
- Terraform state drift
- Unapproved module versions

### Unused Resources

- Instances with no traffic
- Orphaned volumes and IPs
- Stale environments (staging nobody uses)
- Old container images in production

### Credentials & Secrets

- API keys not rotated in 90+ days
- Expiring SSL certificates
- Stale service account keys

### Cost & Waste

- Resources with no cost allocation tag
- Oversized instances (low utilization)
- Reserved instances expiring unused
- Idle resources still incurring cost
