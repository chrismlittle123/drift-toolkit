# Dashboard Roadmap

The Dashboard is a React/Next.js web UI for exploring drift status across all repositories. It provides visibility into organization-wide compliance and trends.

---

## Phase 1: Project Setup

- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Tailwind CSS for styling
- [ ] Configure ESLint and Prettier
- [ ] Create basic layout (header, sidebar, main content)
- [ ] Set up data loading from `repos.json`
- [ ] Deploy to Vercel or GitHub Pages (static export)

---

## Phase 2: Overview Dashboard

- [ ] Total repos count (registered vs unregistered)
- [ ] Pass/fail breakdown by scan
- [ ] Repos by tier pie chart
- [ ] Repos by team breakdown
- [ ] Last scan timestamp
- [ ] Quick stats cards (critical issues, stale repos)

---

## Phase 3: Repository List

- [ ] Table of all repositories
- [ ] Columns: name, tier, team, scan status, last scanned
- [ ] Sort by any column
- [ ] Filter by tier
- [ ] Filter by team
- [ ] Filter by scan status (passing, failing, unregistered)
- [ ] Search by repo name
- [ ] Pagination for large lists

---

## Phase 4: Repository Detail View

- [ ] Repo metadata display (tier, team, custom fields)
- [ ] All scan results for this repo
- [ ] Scan output viewer (expandable)
- [ ] Link to GitHub repo
- [ ] Link to open PRs
- [ ] Last N scan runs history
- [ ] Status badges

---

## Phase 5: Scan Views

- [ ] List all defined scans
- [ ] Per-scan results across all repos
- [ ] Pass rate percentage per scan
- [ ] Failing repos list per scan
- [ ] Scan definition viewer
- [ ] Scan output explorer

---

## Phase 6: Trends & History

- [ ] Drift over time chart (are we improving?)
- [ ] Pass rate trend per scan
- [ ] New failures this week
- [ ] Fixed issues this week
- [ ] Compliance score over time
- [ ] Date range selector

---

## Phase 7: Team Views

- [ ] Team-level dashboard
- [ ] Repos owned by team
- [ ] Team compliance score
- [ ] Team-specific issues
- [ ] Cross-team comparison

---

## Phase 8: Advanced Features

- [ ] Dark mode
- [ ] Bookmark/favorite repos
- [ ] Export data (CSV, JSON)
- [ ] Shareable links to filtered views
- [ ] Real-time updates (webhook trigger rebuild)
- [ ] Authentication (GitHub OAuth)
- [ ] Role-based access (view own team only)

---

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS
- **Charts**: Recharts or Chart.js
- **Tables**: TanStack Table
- **Icons**: Lucide React
- **Deployment**: Vercel (or static export to GitHub Pages)

---

## Data Flow

```
GitHub Actions (scheduled)
    │
    ▼
Drift Scanner (TypeScript)
    │
    ▼
repos.json (committed to repo)
    │
    ▼
Next.js Static Build
    │
    ▼
Dashboard (hosted on Vercel)
```

---

## File Structure

```
dashboard/
├── app/
│   ├── page.tsx              # Overview
│   ├── repos/
│   │   ├── page.tsx          # Repo list
│   │   └── [name]/
│   │       └── page.tsx      # Repo detail
│   ├── scans/
│   │   ├── page.tsx          # Scan list
│   │   └── [name]/
│   │       └── page.tsx      # Scan detail
│   └── teams/
│       └── [name]/
│           └── page.tsx      # Team view
├── components/
│   ├── StatsCard.tsx
│   ├── RepoTable.tsx
│   ├── ScanBadge.tsx
│   └── TrendChart.tsx
├── lib/
│   ├── data.ts               # Load repos.json
│   └── types.ts              # TypeScript interfaces
└── public/
    └── repos.json            # Or fetched from URL
```

---

## Configuration

```yaml
# drift.config.yaml
dashboard:
  title: "Drift Dashboard"
  reposJsonUrl: "./repos.json" # or remote URL
  refreshInterval: 300 # seconds (for dynamic mode)
  features:
    trends: true
    teams: true
    export: true
```
