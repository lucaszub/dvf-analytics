#!/bin/bash
# PreToolUse hook: block destructive ClickHouse operations on named tables
# Protects silver/gold/bronze data from accidental drops during development

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block DROP on named production-data tables
if echo "$COMMAND" | grep -qiE "DROP\s+(DATABASE|TABLE)\s+(IF\s+EXISTS\s+)?(silver|gold|bronze\.raw_dvf|bronze\.raw_communes)"; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Dropping silver/gold/bronze tables requires explicit confirmation. Use `docker compose down -v` for full reset, or ask the user before proceeding."}}'
  exit 0
fi

exit 0
