---
paths: api/**
---
# Rules — FastAPI / ClickHouse (api/)

- Use `clickhouse-driver` with parameterized queries — NEVER f-strings with user input in SQL
- CORS: `allow_origins=["http://localhost:5173"]` only, no wildcards
- All query parameters must be typed (FastAPI type annotations or Pydantic models)
- Response shapes must match TypeScript interfaces in `docs/SPEC.md` exactly
- No hardcoded credentials — use environment variables (`CLICKHOUSE_HOST`, etc.)
- Endpoints: `/communes`, `/departements`, `/bretagne/kpis`, `/bretagne/historique` — see SPEC.md
