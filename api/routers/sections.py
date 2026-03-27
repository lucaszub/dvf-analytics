import json
from typing import Annotated

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel

from db import ClientDep

router = APIRouter(tags=["cadastre"])


class Feature(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: dict


class GeoFeatureResponse(BaseModel):
    type: str = "FeatureCollection"
    features: list[Feature]


@router.get("/communes/{code_commune}/sections", response_model=GeoFeatureResponse)
def get_commune_sections(
    client: ClientDep,
    code_commune: Annotated[str, Path(min_length=5, max_length=5)],
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
) -> GeoFeatureResponse:
    type_local = type_bien.capitalize() if type_bien else None

    conditions = ["s.code_commune = {code_commune:String}"]
    params: dict = {"code_commune": code_commune}
    if annee:
        conditions.append("s.annee = {annee:UInt16}")
        params["annee"] = annee
    if type_local:
        conditions.append("s.type_local = {type_local:String}")
        params["type_local"] = type_local

    query = f"""
        SELECT
            s.section_id,
            s.code_commune,
            s.geometry,
            s.prix_median_m2,
            s.nb_transactions,
            s.annee,
            s.type_local
        FROM gold.mart_prix_section AS s
        WHERE {' AND '.join(conditions)}
        ORDER BY s.section_id
    """
    rows = client.query(query, parameters=params).named_results()
    features = [
        Feature(
            geometry=json.loads(r["geometry"]),
            properties={
                "id": r["section_id"],
                "code_commune": r["code_commune"],
                "prix_median_m2": float(r["prix_median_m2"]) if r["prix_median_m2"] else None,
                "nb_transactions": int(r["nb_transactions"]),
                "annee": r["annee"],
                "type_local": r["type_local"],
            },
        )
        for r in rows
    ]
    return GeoFeatureResponse(features=features)


@router.get("/sections/{section_id}/parcelles", response_model=GeoFeatureResponse)
def get_section_parcelles(
    client: ClientDep,
    section_id: Annotated[str, Path(min_length=10, max_length=10)],
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
) -> GeoFeatureResponse:
    type_local = type_bien.capitalize() if type_bien else None

    conditions = ["substring(p.parcelle_id, 1, 10) = {section_id:String}"]
    params: dict = {"section_id": section_id}
    if annee:
        conditions.append("p.annee = {annee:UInt16}")
        params["annee"] = annee
    if type_local:
        conditions.append("p.type_local = {type_local:String}")
        params["type_local"] = type_local

    query = f"""
        SELECT
            p.parcelle_id,
            p.code_commune,
            p.geometry,
            p.prix_median_m2,
            p.nb_transactions,
            p.annee,
            p.type_local
        FROM gold.mart_prix_parcelle AS p
        WHERE {' AND '.join(conditions)}
        ORDER BY p.parcelle_id
    """
    rows = client.query(query, parameters=params).named_results()
    features = [
        Feature(
            geometry=json.loads(r["geometry"]),
            properties={
                "id": r["parcelle_id"],
                "code_commune": r["code_commune"],
                "prix_median_m2": float(r["prix_median_m2"]) if r["prix_median_m2"] else None,
                "nb_transactions": int(r["nb_transactions"]),
                "annee": r["annee"],
                "type_local": r["type_local"],
            },
        )
        for r in rows
    ]
    return GeoFeatureResponse(features=features)
