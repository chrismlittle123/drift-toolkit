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

## Rules

- Do NOT create issues for far-future work
- Do NOT add task checklists to spec files
- Do NOT modify spec files just to track progress
- DO check for existing epics before creating new ones
- DO create issues just before working on something
- DO close issues immediately when done
- DO add new issues to the project board
