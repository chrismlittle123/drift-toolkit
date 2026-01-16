# Contributing to drift-toolkit

## Development Setup

```bash
# Clone the repository
git clone https://github.com/chrismlittle123/drift-toolkit.git
cd drift-toolkit

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Branch Naming

All branches must follow this naming convention:

```
<type>/<description>
```

**Types:**

- `feature/` - New features
- `fix/` - Bug fixes
- `hotfix/` - Urgent fixes for production
- `docs/` - Documentation changes
- `chore/` - Maintenance tasks (dependencies, configs)

**Examples:**

- `feature/add-dark-mode`
- `fix/audit-bug`
- `hotfix/critical-security-fix`
- `docs/update-readme`
- `chore/update-dependencies`

**Rules:**

- Use lowercase letters, numbers, and hyphens only
- No underscores or uppercase letters
- Keep descriptions concise but descriptive

**Enforcement:**

- Pre-push hook validates branch name locally (immediate feedback)
- PR check validates branch name in CI (backup enforcement)

## Making Changes

### 1. Create a branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make your changes

Write your code, add tests, and ensure everything passes:

```bash
npm run build
npm test
npm run lint
npm run typecheck
```

### 3. Add a changeset

For any code changes (not docs/config only), you must add a changeset:

```bash
npx changeset
```

This will prompt you to:

1. Select the packages being changed (just press Enter for this repo)
2. Select the version bump type:
   - `patch` - Bug fixes, small changes (0.0.X)
   - `minor` - New features, non-breaking changes (0.X.0)
   - `major` - Breaking changes (X.0.0)
3. Write a summary of your changes

This creates a file in `.changeset/` that describes your changes. Commit this file with your PR.

**When is a changeset required?**

- Adding/changing/removing features
- Bug fixes
- Any changes to `src/` files

**When is a changeset NOT required?**

- Documentation changes (`docs/`, `README.md`)
- CI/workflow changes (`.github/`)
- Config file changes (`.eslintrc`, `.prettierrc`, etc.)

### 4. Create a Pull Request

Push your branch and open a PR against `main`.

**PR Checks:**

- Branch naming convention (required)
- PR size warning (if >500 lines changed)
- Changeset requirement (required for code changes)
- CI tests (required)

## Release Process

Releases are fully automated. Here's how it works:

### How releases happen

1. **Merge PR to main** - Your PR with a changeset is merged
2. **Release workflow runs** - GitHub Actions detects the changeset
3. **Version bump** - Package version is updated based on changeset type
4. **Changelog update** - CHANGELOG.md is auto-generated
5. **Publish to npm** - Package is published to npm registry
6. **Git tag created** - Version tag (e.g., `v1.2.0`) is pushed
7. **GitHub Release** - Release is created with changelog link

### Version bump types

| Changeset Type | Version Bump  | Example         |
| -------------- | ------------- | --------------- |
| `patch`        | 0.0.X → 0.0.Y | Bug fix         |
| `minor`        | 0.X.0 → 0.Y.0 | New feature     |
| `major`        | X.0.0 → Y.0.0 | Breaking change |

### Example workflow

```bash
# 1. Create branch
git checkout -b feature/add-export-csv

# 2. Make changes
# ... edit files ...

# 3. Add changeset
npx changeset
# Select: minor (new feature)
# Summary: "Add CSV export functionality for scan results"

# 4. Commit everything
git add -A
git commit -m "feat: add CSV export for scan results"

# 5. Push and create PR
git push -u origin feature/add-export-csv
# Open PR on GitHub

# 6. After PR is approved and merged
# → Release happens automatically
# → npm package updated
# → GitHub release created
```

## Code Style

- TypeScript with strict mode
- ESLint for linting
- Prettier for formatting

Run before committing:

```bash
npm run lint:fix
npm run format
```

## Testing

```bash
# Run all tests
npm test

# Run tests once (no watch)
npm run test:run

# Run with coverage
npm run test:coverage
```

## Questions?

Open an issue if you have questions or run into problems.
