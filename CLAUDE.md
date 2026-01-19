# Claude Code Instructions

## Project Management Workflow

This project uses a split workflow for planning and tracking:

### Spec Files (`docs/specs/*.md`) - Design Reference

- Document HOW features should work
- CLI interfaces, schemas, issue formats
- Architecture decisions, risks, success criteria
- **Rarely updated** - only when design changes
- **Do NOT add task lists here** - use GitHub Issues instead

### GitHub Issues - Task Tracking

- Track WHAT needs to be done
- Create issues just-in-time (one milestone at a time)
- Use epics to group related tasks
- Reference spec files for design details

### GitHub Project Board

- View: https://github.com/users/chrismlittle123/projects/1
- Columns: Backlog, Ready, Done
- Use for progress visibility

## Before Starting Work

1. Check the GitHub Project Board for current priorities
2. If starting a new milestone, create an epic first
3. Create specific issues for the tasks you'll work on
4. Reference the relevant spec file in issue descriptions

## Creating Issues

### Step 1: Check for Existing Epics

Before creating anything, check what already exists:

```bash
# View all items in the project board
gh project item-list 1 --owner chrismlittle123 --format json

# List open issues with epic label
gh issue list --repo chrismlittle123/check-my-toolkit --label epic --state open
```

### Step 2: Create an Epic (if needed)

Only create an epic when starting a new milestone that doesn't have one:

```bash
gh issue create --repo chrismlittle123/check-my-toolkit \
  --title "Epic: <Milestone Name>" \
  --label "epic" \
  --body "$(cat <<'EOF'
<Brief description of milestone goal>

**Spec:** See docs/specs/<domain>.md - Milestone X

## Tasks

- [ ] #XX (link to sub-issues once created)
EOF
)"
```

Then add it to the project board:

```bash
gh project item-add 1 --owner chrismlittle123 --url <issue-url>
```

### Step 3: Create Sub-Issues

Create specific, actionable issues that reference the epic:

```bash
gh issue create --repo chrismlittle123/check-my-toolkit \
  --title "<Specific task>" \
  --body "Part of #<epic-number>"
```

Then add to project board:

```bash
gh project item-add 1 --owner chrismlittle123 --url <issue-url>
```

### Step 4: Update Epic with Sub-Issue Links

Edit the epic to link the sub-issues in its task list:

```bash
gh issue edit <epic-number> --repo chrismlittle123/check-my-toolkit --body "..."
```

## Release Planning with Milestones

### How Milestones and Changesets Work Together

| Tool           | Purpose                       | When Used                 |
| -------------- | ----------------------------- | ------------------------- |
| **Milestones** | Plan what goes into a release | Before/during development |
| **Changesets** | Determine version number      | When PR is ready          |

**Milestones** = your _intent_ ("I want these features in v1.2.0")
**Changesets** = the _mechanism_ (calculates actual version from bump types)

### Creating a Milestone

```bash
# Create milestone for next release
gh api repos/chrismlittle123/drift-toolkit/milestones \
  --method POST \
  -f title="v1.2.0" \
  -f description="Description of release goals"

# List existing milestones
gh api repos/chrismlittle123/drift-toolkit/milestones
```

### Assigning Issues to Milestones

```bash
# Assign issue to milestone (use milestone number, not title)
gh issue edit 123 --milestone "v1.2.0"

# View issues in a milestone
gh issue list --milestone "v1.2.0"
```

### Release Workflow

```
1. Create milestone "v1.2.0" for planned release
2. Create issues for planned work
3. Assign issues to milestone
4. Create branches: feature/v1.2.0/123/description (milestone + issue number required)
5. Add changeset to PR: pnpm changeset (pick patch/minor/major)
6. PR must include "Closes #123" in description
7. Merge PRs to main
8. Release workflow runs → version calculated from changesets
9. Close milestone when release ships
```

## Branch and PR Requirements

### Branch Naming (Enforced by pre-push hook)

Format: `<type>/<milestone>/<issue-number>/<description>`

```
feature/v1.2.0/123/add-dark-mode    ✓
fix/v1.2.0/456/broken-button        ✓
hotfix/v1.2.0/789/security-patch    ✓
docs/v1.2.0/42/update-readme        ✓

feature/123/add-dark-mode           ✗ (missing milestone)
feature/v1.2.0/add-dark-mode        ✗ (missing issue number)
123/add-dark-mode                   ✗ (missing type and milestone)
```

Excluded: `main`, `docs/*`

### PR Requirements (Enforced by GitHub Actions)

1. **Issue link required**: PR description must contain `Closes #123`, `Fixes #123`, or `Resolves #123`
2. **Changeset required**: For code changes, run `pnpm changeset` and commit the file
3. **Milestone recommended**: Assign PR to target release milestone

## Rules

- Do NOT create issues for far-future work
- Do NOT add task checklists to spec files
- Do NOT modify spec files just to track progress
- DO check for existing epics before creating new ones
- DO create issues just before working on something
- DO close issues immediately when done
- DO add new issues to the project board
- DO assign issues to milestones for release planning
- DO use milestone and issue numbers in branch names (e.g., `feature/v1.2.0/123/description`)

## Release Process

When asked to "release", "publish", or "create a release", ALWAYS follow this process:

1. **Create Issue** - Document the changes being released
2. **Create Branch** - Use format: `<type>/<milestone>/<issue-number>/<description>`
3. **Commit Changes** - Include `Closes #<issue>` in commit message
4. **Add Changeset** - Create `.changeset/<name>.md` with patch/minor/major bump
5. **Push & Create PR** - Push branch and create PR linking the issue
6. **Merge PR** - Use squash merge via `gh pr merge <number> --squash --delete-branch`
7. **Wait for CI** - Changesets workflow automatically:
   - Runs `changeset version` to bump package.json
   - Creates "chore: release" commit
   - Creates git tag (e.g., `v1.3.4`)
   - Creates GitHub release
   - Publishes to npm
8. **Verify** - Check `gh release list` and `npm view drift-toolkit version`

### NEVER do these manually:

- Commit directly to main
- Create version tags before CI runs
- Run `npm publish` manually (CI handles this)
- Skip creating an issue/PR for changes
