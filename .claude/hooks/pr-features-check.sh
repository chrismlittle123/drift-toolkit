#!/bin/bash
# Hook: Check FEATURES.md update when creating a PR
# Triggers when `gh pr create` is detected

# Get the command from TOOL_INPUT
COMMAND=$(echo "$TOOL_INPUT" | jq -r '.command // ""' 2>/dev/null)

# Check if this is a PR creation command
if echo "$COMMAND" | grep -q "gh pr create"; then
  # Check if there are src/ changes in the current branch compared to main
  SRC_CHANGES=$(git diff --name-only main...HEAD 2>/dev/null | grep "^src/" | head -1)

  if [ -n "$SRC_CHANGES" ]; then
    # Check if FEATURES.md was modified in this branch
    FEATURES_UPDATED=$(git diff --name-only main...HEAD 2>/dev/null | grep "docs/FEATURES.md")

    if [ -z "$FEATURES_UPDATED" ]; then
      echo ""
      echo "=================================================="
      echo "REMINDER: docs/FEATURES.md may need updating!"
      echo "=================================================="
      echo ""
      echo "This PR includes changes to src/ files."
      echo "Please ensure docs/FEATURES.md is updated if:"
      echo "  - New functions were exported"
      echo "  - New CLI options were added"
      echo "  - New types were exported"
      echo "  - API signatures changed"
      echo ""
      echo "To update, read the current FEATURES.md and add/modify"
      echo "the relevant sections to document the new functionality."
      echo "=================================================="
      echo ""
    fi
  fi
fi

# Always allow the command to proceed
exit 0
