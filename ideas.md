# Ideas

Future directions for drift-toolkit.

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
