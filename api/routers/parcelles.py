from typing import Annotated

from fastapi import APIRouter, Path
from pydantic import BaseModel

from db import ClientDep

router = APIRouter(tags=["cadastre"])


class MutationData(BaseModel):
    id_mutation: str
    date_mutation: str
    type_local: str
    valeur_fonciere: float
    surface_reelle_bati: float
    prix_m2: float
    adresse_nom_voie: str


@router.get("/parcelles/{parcelle_id}/mutations")
def get_parcelle_mutations(
    client: ClientDep,
    parcelle_id: Annotated[str, Path(min_length=14, max_length=14)],
) -> list[MutationData]:
    query = """
        SELECT
            id_mutation,
            toString(date_mutation) AS date_mutation,
            type_local,
            valeur_fonciere,
            surface_reelle_bati,
            prix_m2,
            adresse_nom_voie
        FROM silver.stg_dvf
        WHERE id_parcelle = {parcelle_id:String}
        ORDER BY date_mutation DESC
    """
    rows = client.query(query, parameters={"parcelle_id": parcelle_id}).named_results()
    return [
        MutationData(
            id_mutation=r["id_mutation"],
            date_mutation=str(r["date_mutation"]),
            type_local=r["type_local"],
            valeur_fonciere=float(r["valeur_fonciere"]),
            surface_reelle_bati=float(r["surface_reelle_bati"]),
            prix_m2=float(r["prix_m2"]),
            adresse_nom_voie=r["adresse_nom_voie"],
        )
        for r in rows
    ]
