---
paths: transform/**
---
# Rules — dbt / ClickHouse (transform/)

- ClickHouse SQL dialect: `quantile(0.5)(col)` for median, `toYear(date)` for year extraction, `argMax(col, order)` for value at max
- Never use ANSI SQL functions not supported in ClickHouse (`PERCENTILE_CONT`, `YEAR()`, `EXTRACT`)
- Use `{{ ref('model') }}` for cross-model references, `{{ source('bronze', 'table') }}` for raw sources
- Column names and types must match `docs/SPEC.md` exactly — no improvising
- Max line length: 100 chars (SQLFluff enforced)
- Each model must have corresponding tests in `schema.yml` as per SPEC.md
- Window functions use ClickHouse frame syntax: `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`
