# api/ — FastAPI

API REST qui expose les données Gold ClickHouse avec GeoJSON pour le rendu polygonal.
Contexte global : voir [CLAUDE.md racine](../CLAUDE.md) · Specs endpoints : [docs/SPEC.md](../docs/SPEC.md)

## Endpoints (tous implémentés ✅)

| Route | Router | Source |
|-------|--------|--------|
| `GET /communes` | communes.py | mart_prix_commune |
| `GET /departements` | departements.py | mart_prix_departement |
| `GET /bretagne/kpis` | kpis.py | mart_prix_bretagne |
| `GET /bretagne/historique` | kpis.py | mart_prix_bretagne |
| `GET /code-postaux` | code_postaux.py | mart_prix_code_postal |
| `GET /mutations` | mutations.py | silver.stg_dvf |
| `GET /communes/{code}/sections` | sections.py | mart_prix_section → GeoJSON FeatureCollection |
| `GET /sections/{id}/parcelles` | sections.py | mart_prix_parcelle → GeoJSON FeatureCollection |
| `GET /parcelles/{id}/mutations` | parcelles.py | silver.stg_dvf |

## Notes d'implémentation

- Géométries stockées en `String` dans ClickHouse → `json.loads(row["geometry"])` dans les routers
- `substring(parcelle_id, 1, 10)` pour retrouver la section d'une parcelle
- Les endpoints sections/parcelles retournent `prix_median_m2: null` si aucune transaction (LEFT JOIN)

## Sécurité — règles absolues

- **Requêtes paramétrées uniquement** — jamais de f-strings avec input utilisateur
- **CORS** : `allow_origins=["http://localhost:5173"]` uniquement
- **Credentials** depuis variables d'environnement
- Tous les paramètres typés avec `Annotated[type, Query(...)]` ou `Path(...)`

## Skills disponibles

- `/api-cmds` — commandes de test et démarrage (auto-chargé dans api/**)
- `/fastapi` — best practices FastAPI
- `/security-review` — audit injection SQL, CORS, credentials
