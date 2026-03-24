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
2. `ingest` — attend ClickHouse, télécharge les données DVF + GeoJSON et les charge en bronze *(init container, s'arrête quand c'est fait)*
3. `dbt` — attend la fin de l'ingestion, lance `dbt run && dbt test` *(init container, s'arrête quand c'est fait)*
4. `api` — attend dbt, démarre FastAPI et expose les endpoints
5. `frontend` — démarre le frontend React servi par nginx

> L'ingestion (~200k lignes) prend environ 2-5 minutes la première fois. Les données sont persistées dans un volume Docker — les lancements suivants démarrent en quelques secondes.

---

# Vision

Pipeline data local de bout en bout sur les données DVF Bretagne, avec visualisation cartographique interactive. Démonstration de pratiques data engineering production-grade sur stack open-source, transférable à Snowflake sans réécriture.

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
├── docker-compose.yml             ← ClickHouse
├── .pre-commit-config.yaml        ← SQLFluff hook
├── .gitlab-ci.yml                 ← dbt build + test
│
├── ingestion/
│   ├── ingest.py                  ← script unique d'ingestion
│   ├── config.py                  ← URLs sources, params ClickHouse
│   └── requirements.txt
│
├── transform/                     ← projet dbt
│   ├── dbt_project.yml
│   ├── profiles.yml.example
│   ├── .sqlfluff
│   └── models/
│       ├── bronze/
│       │   └── sources.yml
│       ├── silver/
│       │   ├── stg_dvf.sql
│       │   ├── stg_communes.sql
│       │   └── schema.yml
│       └── gold/
│           ├── mart_prix_commune.sql
│           ├── mart_prix_departement.sql
│           ├── mart_prix_bretagne.sql
│           └── schema.yml
│
├── api/
│   ├── main.py
│   ├── requirements.txt
│   └── routers/
│       ├── communes.py
│       ├── departements.py
│       └── kpis.py
│
└── frontend/
    ├── package.json
    └── src/
        ├── main.tsx
        ├── app/
        │   ├── App.tsx
        │   ├── data/
        │   │   └── api.ts           ← client FastAPI (remplace brittanyData.ts statique)
        │   └── components/
        │       ├── Header.tsx
        │       ├── MapView.tsx      ← DeckGL ScatterplotLayer
        │       ├── ControlPanel.tsx
        │       ├── Filters.tsx
        │       ├── KPICards.tsx
        │       └── TrendChart.tsx
        └── components/
            └── ui/                  ← shadcn/ui components
```

---

# Sources de données

## DVF

- **URL** : `https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/departements/{dept}.csv.gz`
- **Départements** : 22, 29, 35, 56
- **Années** : 2018 à 2024
- **Format** : CSV compressé gzip

## GeoJSON communes

- **URL** : `https://geo.api.gouv.fr/departements/{dept}/communes?fields=nom,code,codesPostaux,centre&format=geojson`
- Utilisé pour enrichissement silver (coordonnées) ET rendu Deck.gl frontend

---

# Script d'ingestion — `ingest.py`

```bash
python ingestion/ingest.py
```

**Comportement attendu :**

- Télécharge les CSV DVF pour les 4 départements × 7 années
- Décompresse et insère dans `bronze.raw_dvf`
- Télécharge le GeoJSON communes et insère dans `bronze.raw_communes`
- Idempotent : `SELECT count()` sur la partition dept/année avant insertion
- Logs structurés : `[INFO] Chargement 35/2023 — 28 432 lignes`

## Schéma bronze cible

```sql
CREATE TABLE raw_dvf (
    id_mutation          String,
    date_mutation        Date,
    code_departement     String,
    code_commune         String,
    nom_commune          String,
    code_postal          String,
    type_local           String,
    surface_reelle_bati  Float32,
    valeur_fonciere      Float64,
    nombre_lots          UInt8,
    _loaded_at           DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (code_departement, date_mutation)
PARTITION BY (code_departement, toYear(date_mutation));

CREATE TABLE raw_communes (
    code_commune  String,
    nom_commune   String,
    code_dept     String,
    longitude     Float64,
    latitude      Float64
) ENGINE = MergeTree()
ORDER BY code_commune;
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
`id_mutation, date_mutation, annee, code_commune, nom_commune, code_departement, type_local, surface_reelle_bati, valeur_fonciere, prix_m2`

## Silver — `stg_communes`

**Transformations :**

- Jointure `raw_communes` sur `raw_dvf.code_commune`
- Dédoublonnage sur `code_commune`

**Colonnes output :**
`code_commune, nom_commune, code_dept, longitude, latitude`

## Gold — `mart_prix_commune`

```sql
SELECT
    code_commune,
    nom_commune,
    code_departement,
    annee,
    type_local,
    quantile(0.5)(prix_m2)   AS prix_median_m2,
    avg(prix_m2)             AS prix_moyen_m2,
    count()                  AS nb_transactions
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

---

# Tests dbt

| Modèle | Test |
|---|---|
| `stg_dvf` | `not_null` sur `id_mutation`, `prix_m2`, `code_commune` |
| `stg_dvf` | `unique` sur `id_mutation` |
| `stg_dvf` | `accepted_values` sur `type_local` |
| `stg_communes` | `not_null` + `unique` sur `code_commune` |
| `mart_prix_commune` | `not_null` sur `prix_median_m2`, `nb_transactions` |
| `mart_prix_commune` | `relationships` vers `stg_communes.code_commune` |
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
```

**Swagger** disponible automatiquement sur `/docs`.
**CORS** configuré pour `localhost:5173` (Vite dev server).

---

# Interface TypeScript — CommuneData

```typescript
export interface CommuneData {
  id: string;                     // code INSEE commune
  name: string;
  department: string;
  departmentCode: string;          // '22' | '29' | '35' | '56'
  pricePerSqm: number;             // prix médian au m²
  transactions: number;
  evolution: number;               // évolution % vs N-1
  coordinates: [number, number];   // [longitude, latitude] — ordre Deck.gl
}
```

---

# Frontend — Configuration Deck.gl

```typescript
const INITIAL_VIEW_STATE = {
  longitude: -2.8,
  latitude: 48.2,
  zoom: 7.5,
  pitch: 0,
  bearing: 0,
};

// Palette couleur prix
function getPriceColor(price: number): [number, number, number] {
  if (price < 2000) return [70, 130, 180];   // bleu
  if (price < 3000) return [100, 160, 150];  // teal
  if (price < 4000) return [220, 160, 80];   // amber
  return [230, 90, 70];                       // rouge
}
```

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
- **ScatterplotLayer** (cercles) plutôt que `GeoJsonLayer` (polygones) pour simplifier — taille du cercle = volume de transactions, couleur = prix médian.
- **Médiane via `quantile(0.5)`** ClickHouse — pas de moyenne arithmétique sur les prix.
- **Données réelles** uniquement — pas de mock en production. Les données mock (`brittanyData.ts`) servent uniquement pendant le dev frontend avant que l'API soit prête.
- **Cloud-agnostic** : changer `profiles.yml` de `clickhouse` à `snowflake` suffit pour migrer toute la couche dbt.
