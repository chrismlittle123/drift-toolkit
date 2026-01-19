#!/bin/bash
# Post-merge branch cleanup hook
# Triggered after successful PR merge to clean up stale branches

# Read the tool input from stdin
INPUT=$(cat)

# Check if this was a gh pr merge command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if [[ -z "$COMMAND" ]]; then
    exit 0
fi

# Only trigger on gh pr merge commands
if [[ ! "$COMMAND" =~ ^gh\ pr\ merge ]]; then
    exit 0
fi

# Output reminder for Claude to clean up branches
cat << 'EOF'
<reminder>
PR merge detected. Please clean up branches:
1. Run `git fetch --prune` to remove deleted remote tracking branches
2. Run `git branch -vv | grep ': gone]'` to find local branches with deleted remotes
3. Delete any stale local branches with `git branch -D <branch-name>`
</reminder>
EOF
