---
name: implement-step
description: Implements a build step from PLAN.md end-to-end — reads spec, plans, codes, validates
disable-model-invocation: true
---
Implement step $ARGUMENTS from PLAN.md.

Follow this workflow exactly:

1. **Read the spec** — read `docs/PLAN.md` step $ARGUMENTS and `docs/SPEC.md` sections relevant to it
2. **Check status** — inspect what already exists (existing files, docker compose status if relevant)
3. **Enter Plan Mode** — explore codebase, identify all files to create/modify, draft implementation plan
4. **Confirm the plan** — list files to create with their purpose before coding
5. **Implement** following these constraints:
   - Follow SPEC.md column names, types, endpoints, interfaces exactly — no improvising
   - Bronze = raw (no filtering in ingestion layer)
   - Idempotency required for all data operations
   - SQL files must pass SQLFluff (ClickHouse dialect, max 100 chars)
   - No hardcoded credentials
6. **Validate** using the exact commands in PLAN.md for this step — fix all failures
7. **Commit** with a descriptive message (conventional commits: `feat(transform): ...`)
8. **Update CLAUDE.md** implementation status table to ✅ Done for completed module

Do not proceed to the next step. Stop after validation and report results.
