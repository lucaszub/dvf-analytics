from typing import Annotated
from fastapi import APIRouter, Query
from pydantic import BaseModel
from db import ClientDep

router = APIRouter(prefix="/mutations", tags=["mutations"])


class MutationResponse(BaseModel):
    id: str
    longitude: float
    latitude: float
    prix_m2: float
    surface: float
    valeur_fonciere: float
    type_local: str
    date_mutation: str  # ISO date string


@router.get("/")
def list_mutations(
    client: ClientDep,
    commune: Annotated[str, Query(min_length=5, max_length=5)],
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
) -> list[MutationResponse]:
    type_local = type_bien.capitalize() if type_bien else None

    conditions = [
        "code_commune = {commune:String}",
        "longitude != 0",
        "latitude != 0",
    ]
    params: dict = {"commune": commune}

    if type_local:
        conditions.append("type_local = {type_local:String}")
        params["type_local"] = type_local
    if annee:
        conditions.append("annee = {annee:UInt16}")
        params["annee"] = annee

    query = f"""
        SELECT
            id_mutation,
            longitude,
            latitude,
            prix_m2,
            surface_reelle_bati,
            valeur_fonciere,
            type_local,
            toString(date_mutation) AS date_mutation
        FROM silver.stg_dvf
        WHERE {' AND '.join(conditions)}
        ORDER BY date_mutation DESC
        LIMIT 5000
    """
    rows = client.query(query, parameters=params).named_results()
    return [
        MutationResponse(
            id=r["id_mutation"],
            longitude=float(r["longitude"]),
            latitude=float(r["latitude"]),
            prix_m2=float(r["prix_m2"]),
            surface=float(r["surface_reelle_bati"]),
            valeur_fonciere=float(r["valeur_fonciere"]),
            type_local=r["type_local"],
            date_mutation=str(r["date_mutation"]),
        )
        for r in rows
    ]
