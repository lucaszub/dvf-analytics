# DVF Analytics

Pipeline data local pour les transactions immobilières DVF Bretagne.
Stack : ClickHouse · dbt · FastAPI · React. Livrable unique : `docker compose up`.

Specs : `docs/SPEC.md` · Plan de validation : `docs/PLAN.md`

## Architecture

| Service | Rôle | Port |
|---------|------|------|
| clickhouse | OLAP database | 8123 |
| ingest | DVF géolocalisées + sections + parcelles → bronze | — |
| dbt | Transforms Silver + Gold | — |
| api | FastAPI REST | 8000 |
| frontend | React + Deck.gl carte prix | 5173 |

Ordre de démarrage : clickhouse → ingest → dbt → api → frontend

## Règles non-négociables

- **Bronze = raw** : zéro filtrage en ingestion. Les filtres appartiennent au Silver dbt.
- **SPEC.md est autoritaire** : noms de colonnes, types, endpoints, interfaces TS — suivre exactement.
- **Idempotence** : ingestion et dbt re-exécutables sans dupliquer les données.
- **Pas de mocks en production** : ClickHouse réel uniquement.
- **SQLFluff** : tout `.sql` dans `transform/` doit passer (dialecte ClickHouse, max 100 chars).

## Statut

| Module | Statut |
|--------|--------|
| Docker Compose + ClickHouse | ✅ Done |
| ingestion/ | ✅ Done — 4 tables bronze : raw_dvf_geo, raw_communes, raw_sections, raw_parcelles |
| transform/ Silver | ✅ Done — stg_dvf, stg_communes, stg_sections, stg_parcelles |
| transform/ Gold | ✅ Done — mart_prix_commune, mart_prix_departement, mart_prix_bretagne, mart_prix_section, mart_prix_parcelle |
| api/ (FastAPI) | ✅ Done — tous les endpoints SPEC implémentés (drill-down sections/parcelles/mutations) |
| frontend/ (React) | 🔄 À finir — brancher sections/parcelles sur l'API, MutationPanel |
| .gitlab-ci.yml | ❌ À faire |

## Modules — contexte détaillé

- `ingestion/` → [ingestion/CLAUDE.md](ingestion/CLAUDE.md)
- `transform/` → [transform/CLAUDE.md](transform/CLAUDE.md)
- `api/` → [api/CLAUDE.md](api/CLAUDE.md)
- `frontend/` → [frontend/CLAUDE.md](frontend/CLAUDE.md)

## Agentic setup

Skills : `/implement-step N` · `/docker-debug` · `/security-review` · `/dbt` · `/fastapi` · `/fastapi-templates` · `/shadcn`

Subagents : `dbt-reviewer` (modèles Silver/Gold), `security-reviewer` (FastAPI + SQL)

Hooks actifs : sqlfluff-check.sh (post-write sur `.sql`), block-dangerous-sql.sh (pre-bash)
