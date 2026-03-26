# api/ — FastAPI

API REST qui expose les données Gold ClickHouse avec GeoJSON pour le rendu polygonal.
Contexte global : voir [CLAUDE.md racine](../CLAUDE.md) · Specs endpoints : [docs/SPEC.md](../docs/SPEC.md)

## Endpoints

### Existants
| Route | Source Gold | Description |
|-------|-------------|-------------|
| `GET /communes` | mart_prix_commune | Prix médian + volume par commune |
| `GET /departements` | mart_prix_departement | Stats par département |
| `GET /kpis` | mart_prix_bretagne | KPIs globaux Bretagne |
| `GET /code_postaux` | mart_prix_code_postal | Stats par code postal |
| `GET /mutations` | silver.stg_dvf | Transactions individuelles |

### Nouveaux (drill-down zoom)
| Route | Source Gold | Description |
|-------|-------------|-------------|
| `GET /communes/{code_commune}/sections` | mart_prix_section | GeoJSON sections d'une commune |
| `GET /sections/{section_id}/parcelles` | mart_prix_parcelle | GeoJSON parcelles d'une section |
| `GET /parcelles/{parcelle_id}/mutations` | stg_dvf | Mutations individuelles sur une parcelle |

## Réponse GeoJSON (sections et parcelles)

Les endpoints `/sections` et `/parcelles` retournent un GeoJSON FeatureCollection :
```python
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {...},           # MultiPolygon (sections) ou Polygon (parcelles)
      "properties": {
        "id": "35238000AB",        # section_id ou parcelle_id
        "code_commune": "35238",
        "prix_median_m2": 3450.0,  # null si aucune transaction
        "nb_transactions": 42,
        "annee": 2023,
        "type_local": "Appartement"
      }
    }
  ]
}
```

La géométrie est stockée en String dans ClickHouse → `json.loads(row["geometry"])` pour désérialiser.

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `main.py` | App FastAPI, CORS, inclusion routers |
| `db.py` | `get_client()` + `ClientDep` |
| `routers/communes.py` | /communes |
| `routers/departements.py` | /departements |
| `routers/kpis.py` | /kpis |
| `routers/sections.py` | /communes/{code}/sections (nouveau) |
| `routers/parcelles.py` | /sections/{id}/parcelles (nouveau) |
| `routers/mutations.py` | /parcelles/{id}/mutations (nouveau) |

## Pattern GeoJSON dans les routers

```python
from fastapi import APIRouter
from api.db import ClientDep
import json

router = APIRouter()

@router.get("/communes/{code_commune}/sections")
async def get_sections(
    code_commune: str,
    client: ClientDep,
    annee: int | None = None,
    type: str | None = None,
):
    params = {"commune": code_commune}
    # ... build query with parameters dict
    result = client.query("SELECT ...", parameters=params)
    features = [
        {
            "type": "Feature",
            "geometry": json.loads(row["geometry"]),
            "properties": {
                "id": row["section_id"],
                "code_commune": row["code_commune"],
                "prix_median_m2": row["prix_median_m2"],
                "nb_transactions": row["nb_transactions"],
            }
        }
        for row in result.named_results()
    ]
    return {"type": "FeatureCollection", "features": features}
```

## Sécurité — règles absolues

- **Requêtes paramétrées uniquement** — jamais de f-strings avec input utilisateur
- **CORS** : `allow_origins=["http://localhost:5173"]` uniquement
- **Credentials** depuis variables d'environnement
- Tous les paramètres typés avec `Annotated[type, Query(...)]` ou `Path(...)`

## Commandes

```bash
docker compose up api
docker compose run --rm api pytest
curl "http://localhost:8000/communes/35238/sections?annee=2023"
curl "http://localhost:8000/sections/35238000AB/parcelles"
curl "http://localhost:8000/parcelles/35238000AB0068/mutations"
```

## Skills disponibles

- `/fastapi` — best practices FastAPI (Annotated, Depends, paramètres typés)
- `/fastapi-templates` — structure routers/services/repos, patterns pytest
- `/security-review` — vérifier injection SQL, CORS, credentials
- Subagent `security-reviewer` — audit automatique FastAPI + SQL
