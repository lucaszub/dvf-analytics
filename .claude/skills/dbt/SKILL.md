---
name: dbt
description: dbt-clickhouse patterns, ClickHouse SQL dialect quirks, run/test commands for this project
paths: ["transform/**"]
---
# dbt — DVF Analytics

## Run commands

```bash
# Via Docker (preferred)
docker compose up dbt                                         # dbt run + dbt test
docker compose run --rm dbt dbt run                           # run models only
docker compose run --rm dbt dbt test                          # tests only
docker compose run --rm dbt dbt run --select stg_dvf         # single model
docker compose run --rm dbt dbt compile                       # compile without running
docker compose run --rm dbt dbt docs generate                 # generate docs

# SQLFluff (if installed locally)
sqlfluff lint transform/models/ --dialect clickhouse
sqlfluff fix transform/models/ --dialect clickhouse
```

## ClickHouse SQL dialect — critical differences from standard SQL

| Task | Wrong (ANSI) | Correct (ClickHouse) |
|------|-------------|---------------------|
| Median | `PERCENTILE_CONT(0.5)` | `quantile(0.5)(col)` |
| Year from date | `YEAR(date)` / `EXTRACT(YEAR FROM date)` | `toYear(date)` |
| Value at max | `FIRST_VALUE` with ORDER BY | `argMax(col, order_col)` |
| String lower | `LOWER(col)` | `lower(col)` (same, fine) |
| Current timestamp | `NOW()` | `now()` |

## dbt-clickhouse adapter config

Model materialization in `dbt_project.yml` or model header:
```sql
{{ config(
    materialized='table',
    engine='MergeTree()',
    order_by='(code_commune, annee, type_local)'
) }}
```

- Default schema = ClickHouse database (bronze, silver, gold)
- `profiles.yml` must be at `transform/profiles.yml` (non-standard location)
- Use `{{ source('bronze', 'raw_dvf') }}` for bronze tables
- Use `{{ ref('stg_dvf') }}` for silver → gold references

## Model structure (from SPEC.md)

```
transform/models/
├── bronze/sources.yml         ← declares raw_dvf, raw_communes as sources
├── silver/
│   ├── stg_dvf.sql            ← filter, prix_m2, deduplicate
│   ├── stg_communes.sql       ← join raw_communes + raw_dvf
│   └── schema.yml             ← tests: not_null, unique, accepted_values
└── gold/
    ├── mart_prix_commune.sql
    ├── mart_prix_departement.sql
    ├── mart_prix_bretagne.sql
    └── schema.yml
```

## SQLFluff config (`.sqlfluff` at transform root)

```ini
[sqlfluff]
dialect = clickhouse
templater = dbt
max_line_length = 100

[sqlfluff:rules:layout.indent]
indent_unit = space
tab_space_size = 4
```
