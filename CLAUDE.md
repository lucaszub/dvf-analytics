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

### Structure

```
dvf-analytics/
├── CLAUDE.md                    # ce fichier
└── .claude/
    ├── settings.json            # permissions, env vars, hooks
    ├── agents/                  # subagents projet
    │   ├── dbt-reviewer.md
    │   └── security-reviewer.md
    ├── hooks/                   # sqlfluff-check.sh, block-dangerous-sql.sh
    ├── rules/                   # règles chargées par chemin de fichier
    │   ├── api.md               # → appliqué sur api/**
    │   ├── frontend.md          # → appliqué sur frontend/**
    │   └── transform.md         # → appliqué sur transform/**
    └── skills/                  # toutes les skills
        ├── dbt/                 # skill principale dbt (SKILL.md = entry point)
        │   ├── SKILL.md         # commandes, dialect ClickHouse, structure modèles
        │   ├── create-models/   # créer/modifier un modèle Silver ou Gold
        │   ├── debug/           # déboguer erreurs dbt
        │   ├── document/        # schema.yml, descriptions
        │   ├── incremental/     # modèles incrémentaux
        │   ├── migrate-sql/     # SQL legacy → dbt
        │   ├── refactor/        # refactoring avec analyse downstream
        │   └── test/            # tests et couverture
        ├── docker-debug/
        ├── implement-step/
        ├── security-review/
        ├── fastapi/             # best practices FastAPI (tiangolo officiel)
        ├── fastapi-templates/   # structure routes/services/repos, pytest
        └── shadcn/              # composants shadcn/ui
```

### Skills disponibles (`/skill-name`)

**dbt :** `/dbt` (entry point principal — les sous-dossiers sont des guides de référence)

**infra :** `/implement-step N` · `/docker-debug` · `/security-review`

**frontend/api :** `/fastapi` · `/fastapi-templates` · `/shadcn`

### Subagents

`dbt-reviewer`, `security-reviewer` — invoquer avec "use a subagent to..."
