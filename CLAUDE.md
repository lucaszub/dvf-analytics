# CLAUDE.md

DVF Analytics — pipeline data local (ClickHouse · dbt · FastAPI · React) pour les transactions DVF Bretagne.
Single deliverable: `docker compose up`.

**Before implementing any module: read `docs/SPEC.md` (structure exacte) and `docs/PLAN.md` (critères de validation).**

## Commands

```bash
docker compose up                              # full stack
docker compose up -d clickhouse               # ClickHouse only
docker compose up ingest                       # bronze (exits when done)
docker compose up dbt                          # transforms (exits when done)
docker compose up api                          # FastAPI :8000
docker compose up frontend                     # React :5173
docker compose down -v && docker compose up   # full reset

# Validate
curl "http://localhost:8123/?query=SELECT+count()+FROM+bronze.raw_dvf"
curl http://localhost:8000/docs
```

## Non-negotiable rules

- **Bronze = raw**: zero filtering in ingestion. Filters belong in dbt Silver.
- **SPEC.md is authoritative**: column names, types, endpoints, TS interfaces — follow exactly.
- **Idempotency**: ingestion and dbt must be re-runnable without duplicating data.
- **No mocks in production paths**: real ClickHouse only. Mock data = isolated UI dev only.
- **SQLFluff**: all `.sql` in `transform/` must pass (ClickHouse dialect, dbt templater, max 100 chars).

## Implementation status

| Module | Status |
|--------|--------|
| Docker Compose + ClickHouse | ✅ Done |
| ingestion/ (bronze) | ✅ Done |
| transform/ (dbt Silver + Gold) | ✅ Done |
| api/ (FastAPI) | ❌ Not started |
| frontend/ (React) | ❌ Not started |
| .gitlab-ci.yml | ❌ Not started |

## Agentic setup

Skills available (invoke with `/skill-name`):
- `/implement-step N` — implements step N from PLAN.md end-to-end
- `/dbt` — dbt-clickhouse patterns and run workflow (auto-loads when working in transform/)
- `/security-review` — security audit (SQL injection, CORS, credentials)
- `/docker-debug` — debug docker compose stack

dbt lifecycle skills:
- `/dbt-create-models` — créer/modifier un modèle Silver ou Gold
- `/dbt-debug` — déboguer une erreur dbt (Compilation/Database/test failure)
- `/dbt-incremental` — développer un modèle incremental
- `/dbt-document` — documenter modèles et colonnes dans schema.yml
- `/dbt-migrate-sql` — convertir du SQL legacy en modèles dbt
- `/dbt-refactor` — refactorer des modèles avec analyse downstream
- `/dbt-test` — ajouter ou déboguer des tests dbt

Subagents: `dbt-reviewer`, `security-reviewer` — use with "use a subagent to..."
