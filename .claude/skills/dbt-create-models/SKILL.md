---
name: dbt-create-models
description: |
  Crée ou modifie des modèles dbt dans ce projet. Utiliser quand :
  (1) Création d'un nouveau modèle Silver ou Gold
  (2) Modification d'un modèle existant
  (3) Besoin de respecter les conventions du projet (ClickHouse, SPEC.md)
---

# dbt Model Development — DVF Analytics

## Phases

### 1. Discovery
Avant d'écrire du SQL, lire :
```bash
cat transform/dbt_project.yml
cat docs/SPEC.md            # source de vérité pour colonnes et types
ls transform/models/silver/ # conventions de nommage existantes
```

### 2. Développement
- Toujours utiliser le dialecte ClickHouse (voir skill `/dbt`)
- `{{ source('bronze', 'raw_dvf') }}` pour les tables bronze
- `{{ ref('model') }}` pour les références inter-modèles
- Config obligatoire : `engine='MergeTree()'` + `order_by`
- Éviter `curr.*` dans les CTEs — ClickHouse ne supporte pas les références qualifiées sur alias de CTE
- Pour N-1 : utiliser `lagInFrame` plutôt qu'un self-join
- Pour dédoublonnage simple : `any(col)` plutôt que `argMax(col, col)`

### 3. Vérification (OBLIGATOIRE)
```bash
docker compose build dbt && docker compose up dbt
# compile seul ne suffit PAS — toujours faire un build complet
```

## Règle absolue
**`dbt build` après chaque création/modification — `dbt compile` ne suffit pas.**

Si le build échoue 3+ fois, repartir de zéro plutôt que de patcher.

## Anti-patterns
- Déclarer la tâche terminée après compilation
- Oublier de vérifier les données avec une query après build
- Utiliser `curr.*` dans un self-join CTE (bug ClickHouse)
- Ne pas lire SPEC.md avant d'écrire les colonnes
