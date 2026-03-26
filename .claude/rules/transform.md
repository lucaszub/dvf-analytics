# Rules — transform/

- ClickHouse dialect only: `quantile(0.5)(col)` pas `PERCENTILE_CONT`, `toYear(date)` pas `YEAR()`, `argMax(col, x)` pas `FIRST_VALUE`
- Toujours `{{ ref() }}` et `{{ source() }}` — jamais de noms de tables hardcodés
- Noms de colonnes et types : correspondre exactement à `docs/SPEC.md`
- Max 100 chars par ligne — SQLFluff vérifie automatiquement
- Chaque nouveau modèle doit avoir des tests dans `schema.yml`
