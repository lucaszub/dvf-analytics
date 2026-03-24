from typing import Annotated

from fastapi import APIRouter, Query

from db import ClientDep

router = APIRouter(prefix="/h3", tags=["h3"])


def _get_max_annee(client, dept: str) -> int:
    row = next(
        client.query(
            "SELECT max(toYear(date_mutation)) AS y FROM bronze.raw_dvf"
            " WHERE code_departement = {dept:String}",
            parameters={"dept": dept},
        ).named_results()
    )
    return int(row["y"])


def _boundary_to_geojson_polygon(boundary) -> dict:
    """Convert h3ToGeoBoundary result (list of (lat, lon) tuples) to GeoJSON Polygon."""
    coords = [[lon, lat] for lat, lon in boundary]
    coords.append(coords[0])  # close ring
    return {"type": "Polygon", "coordinates": [coords]}


@router.get("/")
def get_h3_cells(
    client: ClientDep,
    dept: Annotated[str, Query(pattern="^(22|29|35|56)$")],
    min_lat: Annotated[float, Query()],
    max_lat: Annotated[float, Query()],
    min_lon: Annotated[float, Query()],
    max_lon: Annotated[float, Query()],
    resolution: Annotated[int, Query(ge=8, le=9)] = 9,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
    type_bien: Annotated[str | None, Query(alias="type")] = None,
) -> dict:
    if annee is None:
        annee = _get_max_annee(client, dept)

    type_local = type_bien.capitalize() if type_bien else None

    conditions = [
        "code_departement = {dept:String}",
        "latitude > {min_lat:Float64}",
        "latitude < {max_lat:Float64}",
        "longitude > {min_lon:Float64}",
        "longitude < {max_lon:Float64}",
        "nature_mutation = 'Vente'",
        "type_local IN ('Appartement', 'Maison')",
        "surface_reelle_bati > 0",
        "valeur_fonciere > 0",
        "valeur_fonciere / surface_reelle_bati BETWEEN 100 AND 50000",
        "latitude > 0",
        "longitude != 0",
        "toYear(date_mutation) = {annee:UInt16}",
    ]

    params: dict = {
        "dept": dept,
        "min_lat": min_lat,
        "max_lat": max_lat,
        "min_lon": min_lon,
        "max_lon": max_lon,
        "resolution": resolution,
        "annee": annee,
    }

    if type_local:
        conditions.append("type_local = {type_local:String}")
        params["type_local"] = type_local

    where_clause = " AND ".join(conditions)

    query = f"""
        SELECT
            geoToH3(longitude, latitude, {{resolution:UInt8}}) AS h3_cell,
            round(quantile(0.5)(valeur_fonciere / surface_reelle_bati), 0) AS prix_median_m2,
            count() AS nb_transactions,
            h3ToGeoBoundary(geoToH3(longitude, latitude, {{resolution:UInt8}})) AS boundary
        FROM bronze.raw_dvf
        WHERE {where_clause}
        GROUP BY h3_cell
        HAVING nb_transactions >= 3
    """

    rows = list(client.query(query, parameters=params).named_results())

    features = []
    for row in rows:
        features.append({
            "type": "Feature",
            "geometry": _boundary_to_geojson_polygon(row["boundary"]),
            "properties": {
                "h3": str(row["h3_cell"]),
                "pricePerSqm": float(row["prix_median_m2"]),
                "transactions": int(row["nb_transactions"]),
            },
        })

    return {"type": "FeatureCollection", "features": features}
