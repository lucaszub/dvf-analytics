# SPEC.md — DVF Analytics Bretagne

> Ce document est lu par Claude Code avant tout développement. Aucune ligne de code ne doit être écrite sans que ce document soit complet.

---

# Livrable final

**Une seule commande suffit pour lancer l'intégralité du projet :**

```bash
docker compose up
```

Après quelques minutes (téléchargement des données + transformations dbt), l'application est accessible sur :

| Service | URL |
|---|---|
| Frontend (carte interactive) | http://localhost:5173 |
| API FastAPI | http://localhost:8000 |
| Swagger API docs | http://localhost:8000/docs |
| ClickHouse (optionnel) | http://localhost:8123 |

**Ce que Docker Compose orchestre automatiquement :**
1. `clickhouse` — démarre la base de données OLAP
2. `ingest` — attend ClickHouse, télécharge les données DVF géolocalisées + sections + parcelles cadastrales et les charge en bronze *(init container, s'arrête quand c'est fait)*
3. `dbt` — attend la fin de l'ingestion, lance `dbt run && dbt test` *(init container, s'arrête quand c'est fait)*
4. `api` — attend dbt, démarre FastAPI et expose les endpoints
5. `frontend` — démarre le frontend React servi par nginx

> L'ingestion (DVF ~200k lignes + géométries cadastrales) prend environ 5-15 minutes la première fois selon la connexion réseau. Les données sont persistées dans un volume Docker — les lancements suivants démarrent en quelques secondes.

---

# Vision

Pipeline data local de bout en bout sur les données DVF Bretagne, avec visualisation cartographique interactive à polygones à chaque niveau de zoom — similaire à explore.data.gouv.fr. Démonstration de pratiques data engineering production-grade sur stack open-source, transférable à Snowflake sans réécriture.

**Comportement de la carte :**
- Zoom < 8 → polygones des **départements** colorés par `prix_median_m2`
- Zoom 8–11 → polygones des **communes** colorés par `prix_median_m2`
- Zoom 11–14 → polygones des **sections cadastrales** colorés par `prix_median_m2`
- Zoom ≥ 14 → polygones des **parcelles cadastrales** colorés par `prix_median_m2` + clic → mutations individuelles

Chaque niveau est chargé à la demande depuis l'API lors du changement de zoom.

---

# Stack

| Couche | Outil | Version cible |
|---|---|---|
| Moteur OLAP | ClickHouse | 24.x (Docker) |
| Transformation | dbt-clickhouse | 1.8.x |
| Lint SQL | SQLFluff | 3.x |
| API | FastAPI | 0.111.x |
| Frontend | React 18 + Deck.gl • Recharts + shadcn/ui | Deck.gl 9.x |
| CI | GitLab CI | — |
| Containerisation | Docker Compose | v2 |

---

# Structure du repo

```
dvf-analytics/
├── SPEC.md                        ← ce document
├── README.md                      ← setup + workflow Claude Code
├── docker-compose.yml
├── .pre-commit-config.yaml        ← SQLFluff hook
├── .gitlab-ci.yml                 ← dbt build + test
│
├── ingestion/
│   ├── ingest.py                  ← script unique d'ingestion (DVF géo + cadastre)
│   ├── config.py                  ← URLs sources, params ClickHouse
│   └── requirements.txt
│
├── transform/                     ← projet dbt
│   ├── dbt_project.yml
│   ├── profiles.yml.example
│   ├── .sqlfluff
│   └── models/
│       ├── bronze/
│       │   └── sources.yml        ← raw_dvf_geo, raw_communes, raw_sections, raw_parcelles
│       ├── silver/
│       │   ├── stg_dvf.sql
│       │   ├── stg_communes.sql
│       │   ├── stg_sections.sql
│       │   ├── stg_parcelles.sql
│       │   └── schema.yml
│       └── gold/
│           ├── mart_prix_commune.sql
│           ├── mart_prix_departement.sql
│           ├── mart_prix_bretagne.sql
│           ├── mart_prix_section.sql
│           ├── mart_prix_parcelle.sql
│           └── schema.yml
│
├── api/
│   ├── main.py
│   ├── requirements.txt
│   └── routers/
│       ├── communes.py
│       ├── departements.py
│       ├── kpis.py
│       ├── sections.py
│       └── parcelles.py
│
└── frontend/
    ├── package.json
    └── src/
        ├── main.tsx
        ├── app/
        │   ├── App.tsx
        │   ├── data/
        │   │   └── api.ts           ← client FastAPI
        │   └── components/
        │       ├── Header.tsx
        │       ├── MapView.tsx      ← DeckGL GeoJsonLayer zoom-driven
        │       ├── ControlPanel.tsx
        │       ├── Filters.tsx
        │       ├── KPICards.tsx
        │       ├── TrendChart.tsx
        │       └── MutationPanel.tsx ← panneau latéral mutations au clic parcelle
        └── components/
            └── ui/                  ← shadcn/ui components
```

---

# Sources de données

## DVF géolocalisées

- **URL** : `https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/departements/{dept}.csv.gz`
- **Départements** : 22, 29, 35, 56
- **Années** : 2020 à 2024 (2018–2019 optionnel)
- **Format** : CSV compressé gzip
- **Champs clés vs DVF brut** : `longitude`, `latitude`, `id_parcelle` (14 chars, ex. `35238000AB0068`)
- **Format `id_parcelle`** : `{code_commune_5}{prefixe_3}{section_2}{numero_4}`

## GeoJSON communes

- **URL** : `https://geo.api.gouv.fr/departements/{dept}/communes?fields=nom,code,codesPostaux,centre&format=geojson`
- Utilisé pour enrichissement silver (coordonnées centroïde) ET rendu Deck.gl département/commune

## Sections cadastrales

- **URL** : `https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/{dept}/cadastre-{dept}-sections.json.gz`
- **Format** : GeoJSON (MultiPolygon) compressé gzip
- **Id section** : 10 chars — `{code_commune_5}{prefixe_3}{section_2}` (ex. `35238000AB`)
- **Propriétés** : `id`, `commune` (code INSEE 5 chars), `prefixe`, `section` (lettre(s)), `contenance` (m²)

## Parcelles cadastrales

- **URL** : `https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/{dept}/cadastre-{dept}-parcelles.json.gz`
- **Format** : GeoJSON (Polygon) compressé gzip
- **Id parcelle** : 14 chars — correspond exactement à `id_parcelle` dans les DVF géolocalisées
- **Propriétés** : `id`, `commune`, `prefixe`, `section`, `numero`, `contenance` (m²)
- **Volume** : ~200 MB gz par département (4 × ~200 MB ≈ ~800 MB total gz)

---

# Script d'ingestion — `ingest.py`

```bash
python ingestion/ingest.py
```

**Comportement attendu :**

- Télécharge les CSV DVF géolocalisés pour les 4 départements × années configurées
- Décompresse et insère dans `bronze.raw_dvf_geo`
- Télécharge le GeoJSON communes et insère dans `bronze.raw_communes`
- Télécharge les sections cadastrales (GeoJSON) et insère dans `bronze.raw_sections`
- Télécharge les parcelles cadastrales (GeoJSON) et insère dans `bronze.raw_parcelles`
- Idempotent : vérifie `SELECT count()` sur la partition dept/année avant insertion pour `raw_dvf_geo` ; vérifie count sur `commune` pour sections/parcelles
- Logs structurés : `[INFO] Chargement DVF 35/2023 — 28 432 lignes` / `[INFO] Chargement sections 35 — 4 217 sections`

## Schéma bronze cible

```sql
-- Remplace raw_dvf — inclut géolocalisation et id_parcelle
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
    id_parcelle               String,   -- 14 chars, clé de jointure avec cadastre
    longitude                 Float64,
    latitude                  Float64,
    _loaded_at                DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (code_departement, date_mutation)
PARTITION BY (code_departement, toYear(date_mutation));

-- Inchangée
CREATE TABLE bronze.raw_communes (
    code_commune  String,
    nom_commune   String,
    code_dept     String,
    longitude     Float64,
    latitude      Float64
) ENGINE = MergeTree()
ORDER BY code_commune;

CREATE TABLE bronze.raw_sections (
    id          String,   -- 10 chars : code_commune(5) + prefixe(3) + section(2)
    commune     String,   -- code INSEE 5 chars
    prefixe     String,
    section     String,   -- lettre(s)
    contenance  UInt32,   -- superficie m²
    geometry    String,   -- géométrie GeoJSON en String (MultiPolygon)
    _loaded_at  DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (commune, id);

CREATE TABLE bronze.raw_parcelles (
    id          String,   -- 14 chars : correspond à id_parcelle dans raw_dvf_geo
    commune     String,   -- code INSEE 5 chars
    prefixe     String,
    section     String,
    numero      String,
    contenance  UInt32,   -- superficie m²
    geometry    String,   -- géométrie GeoJSON en String (Polygon)
    _loaded_at  DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (commune, id);
```

---

# Modèles dbt

## Silver — `stg_dvf`

**Transformations (méthodologie officielle data.gouv.fr) :**

- Filtre `nature_mutation IN ('Vente', 'Vente en l'état futur d'achèvement', 'Adjudication')`
- Filtre bien unique par mutation (hors dépendances) — mutations multi-biens exclues
- Filtre type : `type_local IN ('Appartement', 'Maison')`
- Filtre `valeur_fonciere > 0` et `surface_reelle_bati > 0`
- Calcul `prix_m2 = valeur_fonciere / surface_reelle_bati`
- Filtre outliers : `prix_m2 <= 100 000 €/m²` (seuil officiel)
- Extraction `annee = toYear(date_mutation)`

**Colonnes output :**
`id_mutation, date_mutation, annee, code_commune, nom_commune, code_departement, code_postal, adresse_nom_voie, type_local, surface_reelle_bati, nombre_pieces_principales, valeur_fonciere, prix_m2, id_parcelle, longitude, latitude`

## Silver — `stg_communes`

**Transformations :**

- Source : `bronze.raw_communes`
- Dédoublonnage sur `code_commune`

**Colonnes output :**
`code_commune, nom_commune, code_dept, longitude, latitude`

## Silver — `stg_sections`

**Transformations :**

- Source : `bronze.raw_sections`
- Dédoublonnage sur `id`

**Colonnes output :**
`id, commune, section, contenance, geometry`

## Silver — `stg_parcelles`

**Transformations :**

- Source : `bronze.raw_parcelles`
- Dédoublonnage sur `id`

**Colonnes output :**
`id, commune, section, numero, contenance, geometry`

## Gold — `mart_prix_commune`

```sql
SELECT
    code_commune,
    nom_commune,
    code_departement,
    annee,
    type_local,
    quantile(0.5)(prix_m2)              AS prix_median_m2,
    avg(prix_m2)                        AS prix_moyen_m2,
    count()                             AS nb_transactions,
    argMax(longitude, date_mutation)    AS longitude,
    argMax(latitude, date_mutation)     AS latitude
FROM {{ ref('stg_dvf') }}
GROUP BY code_commune, nom_commune, code_departement, annee, type_local
```

Évolution N-1 calculée via `lagInFrame` ou jointure sur `annee - 1`.

## Gold — `mart_prix_departement`

Agrégation de `mart_prix_commune` par `code_departement, annee, type_local`.
Inclut `commune_plus_chere` et `commune_moins_chere` via `argMax` / `argMin`.

## Gold — `mart_prix_bretagne`

Agrégation globale par `annee, type_local`.
Prix médian breton via `quantile(0.5)` sur l'ensemble des communes.

## Gold — `mart_prix_section`

```sql
SELECT
    s.id              AS section_id,
    s.commune         AS code_commune,
    s.geometry,
    d.annee,
    d.type_local,
    quantile(0.5)(d.prix_m2)  AS prix_median_m2,
    count()                    AS nb_transactions
FROM {{ ref('stg_sections') }} s
LEFT JOIN {{ ref('stg_dvf') }} d
    ON substring(d.id_parcelle, 1, 10) = s.id
GROUP BY s.id, s.commune, s.geometry, d.annee, d.type_local
```

## Gold — `mart_prix_parcelle`

```sql
SELECT
    p.id              AS parcelle_id,
    p.commune         AS code_commune,
    p.geometry,
    d.annee,
    d.type_local,
    quantile(0.5)(d.prix_m2)  AS prix_median_m2,
    count()                    AS nb_transactions
FROM {{ ref('stg_parcelles') }} p
LEFT JOIN {{ ref('stg_dvf') }} d ON d.id_parcelle = p.id
GROUP BY p.id, p.commune, p.geometry, d.annee, d.type_local
```

---

# Tests dbt

| Modèle | Test |
|---|---|
| `stg_dvf` | `not_null` sur `id_mutation`, `prix_m2`, `code_commune`, `id_parcelle` |
| `stg_dvf` | `unique` sur `id_mutation` |
| `stg_dvf` | `accepted_values` sur `type_local` |
| `stg_communes` | `not_null` + `unique` sur `code_commune` |
| `stg_sections` | `not_null` + `unique` sur `id` |
| `stg_parcelles` | `not_null` + `unique` sur `id` |
| `mart_prix_commune` | `not_null` sur `prix_median_m2`, `nb_transactions` |
| `mart_prix_commune` | `relationships` vers `stg_communes.code_commune` |
| `mart_prix_section` | `not_null` sur `section_id`, `nb_transactions` |
| `mart_prix_parcelle` | `not_null` sur `parcelle_id`, `nb_transactions` |
| Custom | `prix_median_m2 > 0` sur tous les modèles gold |

---

# API FastAPI — Endpoints

```
GET /communes
  ?dept=35
  &type=appartement   (optionnel, défaut: all)
  &annee=2023         (optionnel, défaut: 2024)
  → Liste CommuneData[] avec coordinates, prix_median_m2, nb_transactions, evolution_pct_n1

GET /departements
  ?annee=2023
  → Liste DepartementData[] avec prix_median_m2_regional, commune_plus_chere, commune_moins_chere

GET /bretagne/kpis
  ?dept=35            (optionnel)
  &type=appartement   (optionnel)
  &annee=2023         (optionnel)
  → KPIs agrégés : prix_median_bretagne, prix_median_selection, commune_plus_chere, nb_transactions_total

GET /bretagne/historique
  → Évolution prix médian par année [{annee, prix_median_m2}]

GET /communes/{code_commune}/sections
  ?type=appartement   (optionnel)
  &annee=2023         (optionnel)
  → GeoJSON FeatureCollection — une Feature par section :
    { section_id, geometry (MultiPolygon), prix_median_m2, nb_transactions }

GET /sections/{section_id}/parcelles
  ?type=appartement   (optionnel)
  &annee=2023         (optionnel)
  → GeoJSON FeatureCollection — une Feature par parcelle :
    { parcelle_id, geometry (Polygon), prix_median_m2, nb_transactions }

GET /parcelles/{parcelle_id}/mutations
  → Liste des mutations individuelles sur cette parcelle :
    [{ id_mutation, date_mutation, type_local, valeur_fonciere,
       surface_reelle_bati, prix_m2, adresse_nom_voie }]
```

**Swagger** disponible automatiquement sur `/docs`.
**CORS** configuré pour `localhost:5173` (Vite dev server).

---

# Interfaces TypeScript

```typescript
// Réponse /communes/{code}/sections et /sections/{id}/parcelles
export interface GeoFeatureResponse {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: GeoJSON.Geometry;   // MultiPolygon (sections) | Polygon (parcelles)
    properties: {
      id: string;                 // section_id ou parcelle_id
      code_commune: string;
      prix_median_m2: number | null;   // null si aucune transaction
      nb_transactions: number;
      annee?: number;
      type_local?: string;
    };
  }>;
}

export interface MutationData {
  id_mutation: string;
  date_mutation: string;        // ISO date
  type_local: string;
  valeur_fonciere: number;
  surface_reelle_bati: number;
  prix_m2: number;
  adresse_nom_voie: string;
}

// CommuneData — longitude/latitude ajoutés (centroïde depuis stg_dvf)
export interface CommuneData {
  id: string;                   // code INSEE commune
  name: string;
  department: string;
  departmentCode: string;       // '22' | '29' | '35' | '56'
  pricePerSqm: number;          // prix médian au m²
  transactions: number;
  evolution: number;            // évolution % vs N-1
  longitude: number;
  latitude: number;
}
```

---

# Frontend — Configuration Deck.gl

```typescript
// Seuils de zoom (identiques à explore.data.gouv.fr)
const ZOOM_DEPT = 8;       // < 8 → département
const ZOOM_COMMUNE = 11;   // 8–11 → commune
const ZOOM_SECTION = 14;   // 11–14 → section cadastrale
// ≥ 14 → parcelle + mutations au clic

// Vue initiale (Bretagne)
const INITIAL_VIEW_STATE = {
  longitude: -2.8,
  latitude: 48.2,
  zoom: 7.5,
  pitch: 0,
  bearing: 0,
};

// Palette couleur prix_m2
function getPriceColor(price: number | null): [number, number, number, number] {
  if (price === null) return [180, 180, 180, 100];  // gris = pas de données
  if (price < 2000) return [70, 130, 180, 200];     // bleu
  if (price < 3000) return [100, 160, 150, 200];    // teal
  if (price < 4000) return [220, 160, 80, 200];     // amber
  return [230, 90, 70, 200];                         // rouge
}
```

**Layers Deck.gl par niveau :**

- Département / Commune / Section / Parcelle → `GeoJsonLayer` avec `getFillColor` basé sur `prix_median_m2`
- Chargement à la demande : chaque changement de niveau de zoom déclenche un fetch vers l'API pour le niveau suivant
- Au clic sur une parcelle (zoom ≥ 14) → panneau latéral `MutationPanel` affichant la liste des mutations individuelles via `GET /parcelles/{parcelle_id}/mutations`
- Pas de `ScatterplotLayer` (cercles) — uniquement des `GeoJsonLayer` (polygones) à tous les niveaux

---

# SQLFluff — Config

```ini
[sqlfluff]
dialect = clickhouse
templater = dbt
max_line_length = 100

[sqlfluff:rules:layout.indent]
indent_unit = space
tab_space_size = 4
```

---

# GitLab CI — `.gitlab-ci.yml`

```yaml
stages:
  - lint
  - transform

lint-sql:
  stage: lint
  script:
    - pip install sqlfluff sqlfluff-templater-dbt
    - sqlfluff lint transform/models/

dbt-build:
  stage: transform
  script:
    - pip install dbt-clickhouse
    - cd transform && dbt deps
    - dbt build --profiles-dir .
```

---

# Structure `docker-compose.yml`

```yaml
services:

  clickhouse:
    image: clickhouse/clickhouse-server:24
    ports: ["8123:8123", "9000:9000"]
    volumes:
      - clickhouse-data:/var/lib/clickhouse
    healthcheck:
      test: ["CMD", "clickhouse-client", "--query", "SELECT 1"]
      interval: 5s
      retries: 10

  ingest:
    build: ./ingestion
    depends_on:
      clickhouse: { condition: service_healthy }
    environment:
      CLICKHOUSE_HOST: clickhouse

  dbt:
    build: ./transform
    depends_on:
      ingest: { condition: service_completed_successfully }
    environment:
      CLICKHOUSE_HOST: clickhouse

  api:
    build: ./api
    ports: ["8000:8000"]
    depends_on:
      dbt: { condition: service_completed_successfully }
    environment:
      CLICKHOUSE_HOST: clickhouse

  frontend:
    build: ./frontend
    ports: ["5173:80"]
    depends_on:
      - api

volumes:
  clickhouse-data:
```

---

# Contraintes & décisions d'architecture

- **`docker compose up` = livrable complet** : l'utilisateur n'a rien à installer hors Docker.
- **Init containers** : `ingest` et `dbt` sont des services qui s'arrêtent quand ils ont fini (`service_completed_successfully`). C'est le pattern Docker Compose pour les jobs one-shot.
- **Volume persistant** : les données ClickHouse survivent aux redémarrages — pas besoin de réingérer à chaque fois.
- **Frontend buildé** : le frontend React est buildé pendant le `docker build` (via Vite) et servi par nginx en static — pas de node en runtime.
- **GeoJsonLayer uniquement** : tous les niveaux de zoom utilisent des `GeoJsonLayer` (polygones) — aucun `ScatterplotLayer` (cercles). La couleur encode toujours le `prix_median_m2`.
- **Chargement à la demande** : les géométries ne sont pas toutes chargées au démarrage. Chaque niveau (département/commune/section/parcelle) est fetché depuis l'API au changement de seuil de zoom.
- **Géométries stockées en String** : les géométries GeoJSON sont stockées en `String` dans ClickHouse et renvoyées telles quelles par l'API dans les FeatureCollection — pas de conversion intermédiaire.
- **Join key cadastre–DVF** : `substring(id_parcelle, 1, 10) = section.id` pour les sections ; `id_parcelle = parcelle.id` pour les parcelles.
- **Médiane via `quantile(0.5)`** ClickHouse — pas de moyenne arithmétique sur les prix.
- **Données réelles uniquement** — pas de mock en production. Les données mock servent uniquement pendant le dev frontend avant que l'API soit prête.
- **Cloud-agnostic** : changer `profiles.yml` de `clickhouse` à `snowflake` suffit pour migrer toute la couche dbt.
- **Bronze = raw** : zéro filtrage dans l'ingestion. Les filtres (nature_mutation, type_local, outliers) appartiennent à la couche Silver dbt.
- **Idempotence** : l'ingestion et dbt doivent être relançables sans dupliquer les données.
