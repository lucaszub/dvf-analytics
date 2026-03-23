---
name: dbt-test
description: |
  Ajoute ou débogue des tests dbt. Utiliser quand :
  (1) Ajout de tests sur un modèle nouveau ou existant
  (2) Tâche mentionne "test", "validate", "quality", "schema.yml"
  (3) Test failure à déboguer
  (4) Vérification de la couverture de tests selon SPEC.md
---

# dbt Testing — DVF Analytics

**Chaque modèle mérite au moins un test. Les clés primaires ont besoin de `unique` + `not_null`.**

## Tests SPEC.md requis (non négociables)

| Modèle | Tests obligatoires |
|--------|-------------------|
| `stg_dvf` | `unique` + `not_null` sur `id_mutation` ; `not_null` sur `prix_m2`, `code_commune`, `type_local` ; `accepted_values` sur `type_local` |
| `stg_communes` | `unique` + `not_null` sur `code_commune` |
| `mart_prix_commune` | `not_null` sur clés ; `relationships` → `stg_communes.code_commune` |
| Tous les modèles gold | `positive_value` sur `prix_median_m2` (custom macro disponible) |

## Commandes

```bash
# Lancer tous les tests
docker compose run --rm dbt dbt test

# Tests d'un modèle spécifique
docker compose run --rm dbt dbt test --select stg_dvf

# Build + tests en une commande
docker compose run --rm dbt dbt build --select +mart_prix_commune
```

## Format schema.yml

```yaml
columns:
  - name: id_mutation
    tests:
      - not_null
      - unique

  - name: type_local
    tests:
      - accepted_values:
          values: ["Appartement", "Maison"]

  - name: code_commune
    tests:
      - not_null
      - relationships:
          to: ref('stg_communes')
          field: code_commune

  - name: prix_median_m2
    tests:
      - positive_value    # macro custom dans transform/macros/positive_value.sql
```

## Test custom disponible : `positive_value`

```sql
-- transform/macros/positive_value.sql
{% test positive_value(model, column_name) %}
SELECT {{ column_name }}
FROM {{ model }}
WHERE {{ column_name }} IS NOT NULL
  AND {{ column_name }} <= 0
{% endtest %}
```

## Déboguer un test qui échoue

```bash
# Voir les lignes en échec
docker compose run --rm dbt dbt test --select <model> 2>&1 | grep -A5 "FAIL"

# Inspecter manuellement
curl "http://localhost:8124/?query=SELECT+id_mutation,+count()+FROM+silver.stg_dvf+GROUP+BY+1+HAVING+count()>1+LIMIT+10"
```

## Anti-patterns
- Ignorer les patterns existants des schema.yml
- YAML mal indenté (dbt silently skip tests)
- Modèles sans aucun test
- Valider uniquement `unique` sans `not_null` (ou inversement)
- Oublier les tests `relationships` sur les clés étrangères
