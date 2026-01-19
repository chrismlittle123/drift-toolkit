#!/bin/bash
# Hook: Remind about project URL when using gh issues/projects

# Read the tool input from stdin
input=$(cat)

# Extract the command from the JSON input
command=$(echo "$input" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')

# Check if it's a gh issue or gh project command
if [[ "$command" == *"gh issue"* ]] || [[ "$command" == *"gh project"* ]]; then
  cat <<'REMINDER'
================================================================================
GH PROJECT REMINDER
================================================================================

Use this GitHub Project for all issues and tracking:
https://github.com/users/chrismlittle123/projects/1

Common commands:

View project items:
  gh project item-list 1 --owner chrismlittle123 --format json

Add issue to project:
  gh project item-add 1 --owner chrismlittle123 --url <issue-url>

List epics:
  gh issue list --repo chrismlittle123/check-my-toolkit --label epic --state open

Create issue:
  gh issue create --repo chrismlittle123/check-my-toolkit \
    --title "<title>" --body "<body>"

================================================================================
REMINDER
fi

exit 0
