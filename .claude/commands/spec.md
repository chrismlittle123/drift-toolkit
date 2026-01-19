# Spec Writing Assistant

Help the user write a detailed specification by asking clarifying questions.

## Arguments

- `$ARGUMENTS` - The feature name or description (any format: natural language, kebab-case, etc.)

## Instructions

You are helping write a specification for: **$ARGUMENTS**

### Step 1: Determine the Domain

First, ask which spec file this belongs to using AskUserQuestion:

- `docs/specs/code.md` - Code quality, linting, testing, drift detection
- `docs/specs/process.md` - Workflows, CI/CD, branching, commits, PRs
- `docs/specs/infra.md` - Infrastructure, deployment, cloud resources

### Step 2: Gather Requirements

Ask clarifying questions ONE AT A TIME using AskUserQuestion. Adapt questions based on previous answers. Cover these areas:

**Problem & Context:**

- What problem does this feature solve?
- Who is affected by this problem? (developers, CI, end users)
- What happens today without this feature?

**Desired Behavior:**

- What should happen when this feature works correctly?
- What are the success criteria?
- Are there any edge cases to handle?

**Technical Details:**

- What inputs does this feature need?
- What outputs should it produce?
- Are there dependencies on other features or external tools?
- Are there any constraints (performance, security, compatibility)?

**Scope & Milestones:**

- Should this be broken into milestones?
- What's the minimum viable version?
- What can be deferred to later iterations?

**Risks & Considerations:**

- What could go wrong?
- Are there any breaking changes?
- What needs to be documented?

### Step 3: Read Existing Spec

Before writing, read the target spec file to understand:

- Current format and style
- Existing milestones and features
- How to integrate the new spec section

### Step 4: Draft the Specification

Based on answers, draft a spec section following the existing format:

- Use tables for tasks/milestones
- Include clear goals and outputs
- Add prerequisites if blocked on other work
- Be specific and actionable

### Step 5: Review and Confirm

Show the draft to the user and ask for approval before editing the spec file.

Only edit the spec file after explicit user approval.

## Example Interaction

User: `/spec dependency caching`

Claude: "I'll help you write a spec for dependency caching. First, which domain does this belong to?"
[Shows options: code.md, process.md, infra.md]

User selects: code.md

Claude: "What problem does dependency caching solve?"

User: "CI builds are slow because we reinstall dependencies every time"

Claude: "Who is affected - just CI, or also local development?"

... continues gathering requirements ...

Claude: "Here's the draft spec section: [shows draft]. Should I add this to docs/specs/code.md?"

User: "Yes"

Claude: [Edits the file]
