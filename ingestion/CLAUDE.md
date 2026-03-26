# ingestion/ — Bronze Layer

Télécharge les données DVF géolocalisées + cadastre et les charge dans ClickHouse bronze.
Contexte global : voir [CLAUDE.md racine](../CLAUDE.md) · Specs : [docs/SPEC.md](../docs/SPEC.md)

## Responsabilité

Charger **sans aucun filtrage** dans ClickHouse :
- `bronze.raw_dvf_geo` — transactions DVF géolocalisées (lat/lng + id_parcelle)
- `bronze.raw_communes` — communes avec coordonnées centroïdes
- `bronze.raw_sections` — sections cadastrales (géométries MultiPolygon)
- `bronze.raw_parcelles` — parcelles cadastrales (géométries Polygon)

## Règle absolue

**Bronze = raw.** Aucun filtre ici. Les filtres appartiennent au Silver dbt.

## Sources de données

### DVF géolocalisées (remplace l'ancien DVF raw)
```
URL: https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/departements/{dept}.csv.gz
Depts: 22, 29, 35, 56 — Années: 2020–2024
Format: CSV gzip, UTF-8, séparateur virgule
Champs clés ajoutés vs DVF raw: longitude, latitude, id_parcelle (14 chars)
```

### Sections cadastrales
```
URL: https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/{dept}/cadastre-{dept}-sections.json.gz
Taille: ~11–15 MB gz par département
Section id: 10 chars — {code_commune_5}{prefixe_3}{section_2} ex: 35238000AB
```

### Parcelles cadastrales
```
URL: https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/{dept}/cadastre-{dept}-parcelles.json.gz
Taille: ~190–265 MB gz par département (~800 MB total)
Parcelle id: 14 chars — {section_10}{numero_4} ex: 35238000AB0068
Correspond exactement à id_parcelle dans DVF géolocalisées
```

## Schéma des tables bronze

### raw_dvf_geo
```sql
CREATE TABLE bronze.raw_dvf_geo (
    id_mutation               String,
    date_mutation             Date,
    code_departement          String,
    code_commune              String,
    nom_commune               String,
    code_postal               String,
    adresse_nom_voie          String,
    type_local                String,
    surface_reelle_bati       Float32,
    nombre_pieces_principales UInt8,
    valeur_fonciere           Float64,
    nombre_lots               UInt8,
    id_parcelle               String,   -- clé de join avec cadastre
    longitude                 Float64,
    latitude                  Float64,
    _loaded_at                DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (code_departement, date_mutation)
PARTITION BY (code_departement, toYear(date_mutation));
```

### raw_sections
```sql
CREATE TABLE bronze.raw_sections (
    id         String,   -- 10 chars
    commune    String,
    prefixe    String,
    section    String,
    contenance UInt32,
    geometry   String,   -- GeoJSON geometry (MultiPolygon) en String
    _loaded_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (commune, id);
```

### raw_parcelles
```sql
CREATE TABLE bronze.raw_parcelles (
    id         String,   -- 14 chars = id_parcelle dans DVF
    commune    String,
    prefixe    String,
    section    String,
    numero     String,
    contenance UInt32,
    geometry   String,   -- GeoJSON geometry (Polygon) en String
    _loaded_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY (commune, id);
```

## Idempotence

- DVF : `SELECT count() FROM bronze.raw_dvf_geo WHERE code_departement=? AND toYear(date_mutation)=?` avant insert
- Sections/Parcelles : TRUNCATE + reload (données statiques, mise à jour trimestrielle)

## Connexion ClickHouse

```python
import clickhouse_connect
client = clickhouse_connect.get_client(
    host=os.getenv("CLICKHOUSE_HOST", "clickhouse"),
    port=int(os.getenv("CLICKHOUSE_PORT", "8123")),
)
```

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `ingest.py` | Orchestre les 4 tables bronze |
| `config.py` | URLs sources, ANNEES, DEPARTEMENTS, credentials env |
| `requirements.txt` | clickhouse-connect, requests |
| `Dockerfile` | Image ingest |

## Commandes

```bash
docker compose up ingest          # run complet (attend clickhouse healthy)

# Validation
curl "http://localhost:8123/?query=SELECT+count()+FROM+bronze.raw_dvf_geo"
curl "http://localhost:8123/?query=SELECT+count()+FROM+bronze.raw_sections"
curl "http://localhost:8123/?query=SELECT+count()+FROM+bronze.raw_parcelles"
```
