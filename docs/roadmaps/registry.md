# Registry Roadmap

The Registry is the central database of all repositories in your GitHub organization, tracking metadata, ownership, and registration status.

---

## Phase 1: Core Discovery (MVP)

- [x] Connect to GitHub API with org-level access
- [x] Fetch all repositories in organization
- [x] Detect `repo-metadata.yaml` in each repo
- [x] Parse tier and team from metadata file
- [x] Generate `repos.json` with discovered repos
- [x] Flag repos without `repo-metadata.yaml` as unregistered

---

## Phase 2: Enhanced Metadata

- [ ] Support additional metadata fields (description, contacts, dependencies)
- [ ] Validate `repo-metadata.yaml` schema
- [ ] Support multiple metadata file locations (root, `.github/`, `docs/`)
- [ ] Add last-updated timestamp per repo
- [ ] Track repo visibility (public/private/internal)
- [ ] Capture default branch name

---

## Phase 3: Ownership & Teams

- [ ] Map teams to Slack channels for routing alerts
- [ ] Support multiple team owners per repo
- [ ] Define team hierarchies (team -> org unit)
- [ ] Track CODEOWNERS file presence and contents
- [ ] Generate team-level rollup reports

---

## Phase 4: Advanced Discovery

- [ ] Incremental sync (only fetch changed repos since last run)
- [ ] Handle GitHub API pagination for large orgs (200+ repos)
- [ ] Cache GitHub API responses to reduce rate limiting
- [ ] Support multiple GitHub orgs in single registry
- [ ] Detect archived/disabled repos and handle appropriately
- [ ] Track repo creation/deletion over time

---

## Phase 5: Registry Health

- [ ] Age tracking (how long has repo been unregistered?)
- [ ] Compliance scoring per repo
- [ ] Auto-generate PRs to add `repo-metadata.yaml` to unregistered repos
- [ ] Detect stale repos (no commits in X days)
- [ ] Repository lifecycle status (active, maintenance, deprecated)

---

## Data Model

```typescript
interface Repository {
  name: string;
  fullName: string; // org/repo
  url: string;
  defaultBranch: string;
  visibility: "public" | "private" | "internal";

  // From repo-metadata.yaml
  registered: boolean;
  tier?: "production" | "internal" | "prototype" | "archived";
  team?: string;
  metadata?: Record<string, unknown>; // extensible

  // Tracking
  lastScanned: string; // ISO timestamp
  registeredSince?: string;
}
```

---

## Configuration

```yaml
# drift.config.yaml
registry:
  org: my-github-org
  metadataFile: repo-metadata.yaml # or array of paths
  requiredFields:
    - tier
    - team
  tiers:
    - production
    - internal
    - prototype
    - archived
```
