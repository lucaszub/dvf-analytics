---
name: dbt-refactor
description: |
  Refactorise des modèles dbt en analysant l'impact downstream. Utiliser quand :
  (1) Tâche mentionne "refactor", "restructure", "extract", "split", "reorganize"
  (2) Extraction de CTEs en modèles intermédiaires ou création de macros
  (3) Modification de modèles qui ont des consommateurs downstream
  (4) Renommage de colonnes, changement de types, réorganisation des dépendances
  Analyse TOUTES les dépendances downstream avant de toucher quoi que ce soit.
---

# dbt Refactoring — DVF Analytics

**Trouver TOUTES les dépendances downstream avant de modifier. Refactorer par petites étapes.**

## Workflow

### 1. Analyser le modèle actuel
```bash
cat transform/models/<layer>/<model>.sql
```
Identifier : CTEs > 50 lignes, logique répétée, jointures multiples.

### 2. Trouver toutes les dépendances downstream
```bash
grep -r "ref('<model>')" transform/models/ --include="*.sql"
```
Signaler à l'utilisateur : "X modèles downstream affectés : [liste]"

### 3. Vérifier quelles colonnes utilisent les modèles downstream
```bash
grep -E "alias\.\w+" transform/models/gold/<downstream>.sql
```

### 4. Stratégie de refactoring

| Symptôme | Action |
|----------|--------|
| Modèle > 200 lignes | Extraire des CTEs en modèles séparés |
| Même logique dans 3+ modèles | Créer une macro dans `transform/macros/` |
| 5+ jointures dans un modèle | Créer des modèles intermédiaires |
| Self-join CTE avec `curr.*` | Remplacer par `lagInFrame` (bug ClickHouse) |

### 5. Extraire une CTE en macro (exemple)
```sql
-- transform/macros/null_guard_median.sql
{% macro null_guard_median(col, min_count=5) %}
multiIf(count() >= {{ min_count }}, round(quantile(0.5)({{ col }}), 0), NULL)
{% endmacro %}
```

### 6. Valider après chaque changement
```bash
docker compose build dbt && docker compose up dbt
curl "http://localhost:8124/?query=SELECT+count()+FROM+gold.<model>"
```

## Checklist refactoring
- [ ] Toutes les dépendances downstream identifiées
- [ ] Utilisateur informé de la portée des changements
- [ ] Un seul changement à la fois
- [ ] Build passe après chaque changement
- [ ] Row counts identiques avant/après
- [ ] schema.yml mis à jour si colonnes changées
- [ ] Tests toujours verts

## Anti-patterns
- Refactorer sans vérifier l'impact downstream
- Plusieurs changements en même temps
- Ne pas valider que l'output correspond après refactoring
- Extraire prématurément (attendre 3+ usages pour une macro)
- Casser les tests existants sans les mettre à jour
