---
name: dbt-debug
description: |
  Débogue les erreurs dbt. Utiliser quand :
  (1) Erreur de compilation, Database Error, ou test failure
  (2) Tâche mentionne "fix", "error", "broken", "failing", "debug"
  (3) Modèle produit un résultat incorrect
  Lit l'erreur en entier, vérifie upstream, fait toujours un dbt build pour confirmer le fix.
---

# dbt Debugging — DVF Analytics

**Lire l'erreur complète. Vérifier upstream. TOUJOURS faire `dbt build` après le fix.**

## Workflow

### 1. Lire l'erreur complète
```bash
docker compose up dbt 2>&1 | grep -A10 "Database Error\|Error\|FAIL"
```

### 2. Inspecter le SQL compilé
```bash
docker compose run --rm dbt cat target/compiled/dvf_analytics/models/<path>/<model>.sql
```

### 3. Types d'erreurs ClickHouse fréquents

| Code | Erreur | Fix |
|------|--------|-----|
| 184 | Aggregate function in WHERE | Séparer le filtre dans une CTE `filtered` avant l'agrégation |
| 47  | Unknown identifier `alias.col` | Éviter `curr.*` dans CTEs — lister les colonnes explicitement |
| 47  | Column from JOIN not visible | Sortir le JOIN de la CTE, le faire dans le SELECT final |
| 81  | Database does not exist | Vérifier `generate_schema_name.sql` macro et `profiles.yml` |

### 4. Vérifier les colonnes upstream
```bash
curl "http://localhost:8124/?query=SELECT+*+FROM+silver.stg_dvf+LIMIT+3+FORMAT+Vertical"
```

### 5. Appliquer le fix puis rebuild (OBLIGATOIRE)
```bash
docker compose build dbt && docker compose up dbt
```

**Règle des 3 échecs** : si le build échoue 3+ fois, tout relire depuis le début.

### 6. Vérifier les données après fix
```bash
curl "http://localhost:8124/?query=SELECT+count()+FROM+gold.mart_prix_bretagne"
```

## Anti-patterns
- Patcher sans comprendre l'erreur
- Déclarer "fixed" sans relancer le build
- Ignorer les modèles upstream
- Ne pas lire le message d'erreur en entier
