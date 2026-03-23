---
name: dbt-migrate-sql
description: |
  Convertit du SQL legacy en modèles dbt modulaires. Utiliser quand :
  (1) Conversion de vues, procédures stockées, ou fichiers SQL en modèles dbt
  (2) Tâche mentionne "migrate", "convert", "legacy SQL", "transform to dbt"
  (3) Décomposition d'une requête monolithique en couches staging/mart
---

# dbt Migration SQL → dbt — DVF Analytics

**Ne pas tout convertir d'un coup. Construire et valider couche par couche.**

## Workflow

### 1. Analyser le SQL source
Identifier toutes les tables référencées et la logique métier.

### 2. Vérifier ce qui existe déjà
```bash
ls transform/models/silver/
ls transform/models/gold/
cat transform/models/bronze/sources.yml
```

### 3. Structure cible dans ce projet

```
bronze/sources.yml     ← déclarer les nouvelles tables sources
silver/stg_*.sql       ← 1 modèle par table source, nettoyage + filtres
gold/mart_*.sql        ← agrégations métier
```

### 4. Créer les sources manquantes (bronze/sources.yml)
```yaml
sources:
  - name: bronze
    schema: bronze
    tables:
      - name: raw_nouvelle_table
        description: "..."
```

### 5. Construire couche par couche
```bash
# Après chaque modèle créé :
docker compose build dbt && docker compose up dbt
```

### 6. Valider la migration
```bash
curl "http://localhost:8124/?query=SELECT+count()+FROM+gold.mart_nouveau"
# Comparer avec le résultat du SQL original
```

## Checklist migration
- [ ] Toutes les tables sources identifiées et déclarées
- [ ] Modèles staging : 1:1 avec les sources, colonnes renommées/typées
- [ ] Modèles gold : agrégations finales
- [ ] Chaque couche build avec succès
- [ ] Counts identiques entre SQL original et modèle dbt
- [ ] Tests ajoutés sur les colonnes clés

## Patterns de conversion

| SQL legacy | dbt pattern |
|-----------|-------------|
| Sous-requêtes imbriquées | Modèles séparés avec `ref()` |
| Tables temporaires | Matérialisation `ephemeral` |
| Valeurs hardcodées | Variables dbt (`{{ var('x') }}`) |
| UNION de même source | CTE dans un seul modèle |

## Anti-patterns
- Convertir toute la requête en un seul modèle
- Sauter la couche staging
- Ne pas valider chaque couche avant la suivante
- Garder des valeurs hardcodées
