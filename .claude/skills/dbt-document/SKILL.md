---
name: dbt-document
description: |
  Documente des modèles dbt dans schema.yml. Utiliser quand :
  (1) Ajout de descriptions de modèles ou de colonnes
  (2) Tâche mentionne "document", "describe", "description", "dbt docs", "schema.yml"
  (3) Explication du contexte métier, du grain, des règles de gestion
  (4) Préparation de `dbt docs generate`
---

# dbt Documentation — DVF Analytics

**Documenter le POURQUOI, pas juste le QUOI. Inclure le grain, les règles métier, les cas particuliers.**

## Workflow

### 1. Lire les patterns existants
```bash
cat transform/models/silver/schema.yml
cat transform/models/gold/schema.yml
cat docs/SPEC.md   # source de vérité
```

### 2. Lire le SQL du modèle
```bash
cat transform/models/<layer>/<model>.sql
```

### 3. Format schema.yml (à respecter)

```yaml
version: 2

models:
  - name: stg_dvf
    description: |
      Une ligne par mutation immobilière (vente Appartement/Maison).
      Agrégation des surfaces multi-lots : plusieurs lignes bronze → 1 ligne silver.

      **Règles métier :**
      - Filtré sur nature_mutation = 'Vente' uniquement
      - prix_m2 = valeur_fonciere / sum(surface_reelle_bati) par mutation
      - Outliers exclus : prix_m2 BETWEEN 100 AND 50000

      **Grain :** 1 ligne par id_mutation

    columns:
      - name: id_mutation
        description: Identifiant unique de la vente (source DVF)
        tests:
          - not_null
          - unique
      - name: prix_m2
        description: |
          Prix au m² calculé sur la surface totale de la mutation.
          Formule : valeur_fonciere / sum(surface_reelle_bati).
          NULL si surface = 0 ou prix hors range 100-50000.
```

### 4. Patterns par type de colonne

| Type | Documenter |
|------|-----------|
| Clé primaire | Source, garantie d'unicité |
| Clé étrangère | Table cible, gestion des NULL |
| Métrique | Formule, unité, exclusions |
| Date | Timezone, événement représenté |
| Statut/Catégorie | Toutes les valeurs possibles |

### 5. Générer et visualiser
```bash
docker compose up dbt-docs   # http://localhost:8080
```

## Anti-patterns
- Décrire le QUOI au lieu du POURQUOI/contexte
- Oublier de documenter le grain du modèle
- Ne pas documenter la gestion des NULL
- Copier-coller le nom de la colonne comme description
