#!/bin/bash
# Hook: Remind about workflow when editing spec files

# Read the tool input from stdin
input=$(cat)

# Extract the file path from the JSON input
file_path=$(echo "$input" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')

# Check if it's a spec file
if [[ "$file_path" == *"docs/specs/"* ]]; then
  cat <<'REMINDER'
================================================================================
WORKFLOW REMINDER: You are editing a spec file
================================================================================

Spec files are for DESIGN REFERENCE only:
- CLI interfaces, schemas, issue formats
- Architecture decisions, risks, success criteria
- Rarely updated - only when design changes

DO NOT add task lists or progress tracking to spec files.

For TASK TRACKING, use GitHub Issues:

1. Check existing epics first:
   gh project item-list 1 --owner chrismlittle123 --format json
   gh issue list --repo chrismlittle123/check-my-toolkit --label epic --state open

2. Create an epic (if needed):
   gh issue create --repo chrismlittle123/check-my-toolkit \
     --title "Epic: <Milestone Name>" \
     --label "epic" \
     --body "Description. See docs/specs/<domain>.md"

3. Create sub-issues:
   gh issue create --repo chrismlittle123/check-my-toolkit \
     --title "<Specific task>" \
     --body "Part of #<epic-number>"

4. Add to project board:
   gh project item-add 1 --owner chrismlittle123 --url <issue-url>

Project Board: https://github.com/users/chrismlittle123/projects/1
================================================================================
REMINDER
fi

exit 0
