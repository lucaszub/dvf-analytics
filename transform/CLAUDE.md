# transform/ — dbt Silver + Gold

Transformations dbt sur ClickHouse. Silver filtre et nettoie ; Gold agrège par dimension géographique.
Contexte global : voir [CLAUDE.md racine](../CLAUDE.md) · Specs : [docs/SPEC.md](../docs/SPEC.md)

## Modèles

### Silver (schema `silver`)
| Modèle | Source | Rôle |
|--------|--------|------|
| `stg_dvf` | bronze.raw_dvf_geo | Filtre, calcule prix_m2, déduplique |
| `stg_communes` | bronze.raw_communes + stg_dvf | Communes avec centroïdes |
| `stg_sections` | bronze.raw_sections | Sections cadastrales déduplicées |
| `stg_parcelles` | bronze.raw_parcelles | Parcelles cadastrales déduplicées |

Filtres Silver (`stg_dvf`) :
- `nature_mutation IN ('Vente', 'Vente en l'état futur d'achèvement', 'Adjudication')`
- `type_local IN ('Appartement', 'Maison')`
- `valeur_fonciere > 0` et `surface_reelle_bati > 0`
- `prix_m2 = valeur_fonciere / surface_reelle_bati`
- `prix_m2 <= 100000` (seuil outliers officiel data.gouv.fr)

Colonnes output `stg_dvf` :
`id_mutation, date_mutation, annee, code_commune, nom_commune, code_departement, code_postal, adresse_nom_voie, type_local, surface_reelle_bati, nombre_pieces_principales, valeur_fonciere, prix_m2, id_parcelle, longitude, latitude`

### Gold (schema `gold`, materialized=table, engine=MergeTree)
| Modèle | Granularité | Clé de join |
|--------|-------------|-------------|
| `mart_prix_bretagne` | Bretagne entière | — |
| `mart_prix_departement` | Par département | code_departement |
| `mart_prix_commune` | Par commune | code_commune |
| `mart_prix_section` | Par section cadastrale | id_parcelle[:10] = section.id |
| `mart_prix_parcelle` | Par parcelle cadastrale | id_parcelle = parcelle.id |

## Clé de join DVF ↔ Cadastre

```
id_parcelle (14 chars): 35238000AB0068
                        ↑────────────┘  ↑──────┘
                        section_id       numero
                        (10 chars)       (4 chars)

Join section:  substring(stg_dvf.id_parcelle, 1, 10) = stg_sections.id
Join parcelle: stg_dvf.id_parcelle = stg_parcelles.id
```

## SQL des nouveaux modèles Gold

### mart_prix_section
```sql
SELECT
    s.id                          AS section_id,
    s.commune                     AS code_commune,
    s.geometry,
    d.annee,
    d.type_local,
    quantile(0.5)(d.prix_m2)     AS prix_median_m2,
    count()                       AS nb_transactions
FROM {{ ref('stg_sections') }} s
LEFT JOIN {{ ref('stg_dvf') }} d
    ON substring(d.id_parcelle, 1, 10) = s.id
GROUP BY s.id, s.commune, s.geometry, d.annee, d.type_local
```

### mart_prix_parcelle
```sql
SELECT
    p.id                          AS parcelle_id,
    p.commune                     AS code_commune,
    p.geometry,
    d.annee,
    d.type_local,
    quantile(0.5)(d.prix_m2)     AS prix_median_m2,
    count()                       AS nb_transactions
FROM {{ ref('stg_parcelles') }} p
LEFT JOIN {{ ref('stg_dvf') }} d ON d.id_parcelle = p.id
GROUP BY p.id, p.commune, p.geometry, d.annee, d.type_local
```

## ClickHouse SQL — Dialecte

| ANSI standard | ClickHouse |
|---------------|------------|
| `PERCENTILE_CONT(0.5)` | `quantile(0.5)(col)` |
| `YEAR(date)` | `toYear(date)` |
| `FIRST_VALUE(col) OVER (ORDER BY x)` | `argMax(col, x)` |
| `SUBSTRING(col, 1, 10)` | `substring(col, 1, 10)` ✅ identique |
| `COUNT(DISTINCT col)` | `uniq(col)` |

## Structure fichiers

```
transform/
├── dbt_project.yml
├── profiles.yml
├── .sqlfluff
└── models/
    ├── bronze/sources.yml
    ├── silver/
    │   ├── stg_dvf.sql
    │   ├── stg_communes.sql
    │   ├── stg_sections.sql      ← nouveau
    │   ├── stg_parcelles.sql     ← nouveau
    │   └── schema.yml
    └── gold/
        ├── mart_prix_bretagne.sql
        ├── mart_prix_departement.sql
        ├── mart_prix_commune.sql
        ├── mart_prix_section.sql   ← nouveau
        ├── mart_prix_parcelle.sql  ← nouveau
        └── schema.yml
```

## Règles

- `{{ ref() }}` et `{{ source() }}` — jamais de noms de tables hardcodés
- Colonnes et types = SPEC.md exactement
- `geometry` stocké en String (GeoJSON serialisé) — pas de type spatial ClickHouse
- Chaque modèle doit avoir des tests dans `schema.yml`
- Max 100 chars par ligne (SQLFluff enforced)

## Commandes

```bash
docker compose up dbt
docker compose run --rm dbt dbt run
docker compose run --rm dbt dbt test
docker compose run --rm dbt dbt run --select stg_sections
docker compose run --rm dbt dbt run --select mart_prix_section mart_prix_parcelle

sqlfluff lint transform/models/ --dialect clickhouse
```

## Skills disponibles

- `/dbt` — entry point principal (commandes, debug, création modèles, tests)
- Subagent `dbt-reviewer` — valide les modèles Silver/Gold contre SPEC.md
