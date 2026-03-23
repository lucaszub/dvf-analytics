---
name: dbt-incremental
description: |
  Développe ou débogue des modèles dbt incrémentaux. Utiliser quand :
  (1) Création d'un modèle incremental
  (2) Tâche mentionne "incremental", "append", "merge", "upsert", "late arriving data"
  (3) Optimisation de performance ou choix table vs incremental
---

# dbt Incremental Models — DVF Analytics (ClickHouse)

**Défaut : `table`. Passer en `incremental` seulement si la source > 10M lignes.**

## Quand utiliser incremental

| Scénario | Recommandation |
|----------|----------------|
| Source < 10M lignes | `table` (plus simple) |
| Source > 10M lignes | `incremental` |
| Données append-only (logs, events) | `incremental` + strategy `append` |
| Données mises à jour (upsert) | `incremental` + strategy `merge` |

Bronze DVF = ~1.2M lignes → `table` suffit.

## Config ClickHouse + dbt-clickhouse

```sql
{{ config(
    materialized='incremental',
    incremental_strategy='append',   -- ou 'merge' si upsert
    unique_key='id_mutation',
    engine='ReplacingMergeTree()',   -- pour merge en ClickHouse
    order_by='(code_departement, date_mutation)'
) }}

SELECT ...
FROM {{ source('bronze', 'raw_dvf') }}
{% if is_incremental() %}
WHERE date_mutation > (SELECT max(date_mutation) FROM {{ this }})
{% endif %}
```

## Règles critiques

1. **Toujours tester avec `--full-refresh` d'abord**
2. **Vérifier que le `unique_key` est vraiment unique** dans la source
3. Si merge échoue 3+ fois → vérifier les doublons sur `unique_key`
4. Planifier des `--full-refresh` périodiques pour éviter la dérive

## Problèmes fréquents

### Doublons sur unique_key
```sql
WITH deduplicated AS (
    SELECT *, row_number() OVER (PARTITION BY id_mutation ORDER BY date_mutation DESC) AS rn
    FROM {{ source('bronze', 'raw_dvf') }}
    {% if is_incremental() %}
    WHERE date_mutation > (SELECT max(date_mutation) FROM {{ this }})
    {% endif %}
)
SELECT * FROM deduplicated WHERE rn = 1
```

### Late-arriving data
```sql
{% if is_incremental() %}
WHERE date_mutation >= {{ dbt.dateadd('day', -3, dbt.current_timestamp()) }}
{% endif %}
```

## Anti-patterns
- Incremental sur petites tables (< 10M lignes)
- Ne pas tester avec `--full-refresh` d'abord
- Strategy `append` quand les données peuvent être mises à jour
- Ne jamais faire de `--full-refresh` (dérive des données)
