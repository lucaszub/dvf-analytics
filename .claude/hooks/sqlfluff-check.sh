#!/bin/bash
# PostToolUse hook: run SQLFluff on modified SQL files in transform/
# Provides feedback to Claude if lint fails so it can fix immediately

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // .path // empty' 2>/dev/null)

# Only lint SQL files inside transform/
if [[ "$FILE_PATH" != *"transform/"* ]] || [[ "$FILE_PATH" != *.sql ]]; then
  exit 0
fi

# Skip silently if sqlfluff not installed locally (it runs in Docker)
if ! command -v sqlfluff &>/dev/null; then
  exit 0
fi

OUTPUT=$(sqlfluff lint "$FILE_PATH" --dialect clickhouse --templater dbt 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  # Return feedback so Claude sees lint errors and can fix them
  echo "$OUTPUT"
  exit 1
fi

exit 0
