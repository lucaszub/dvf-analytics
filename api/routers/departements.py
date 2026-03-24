from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from db import ClientDep

router = APIRouter(prefix="/departements", tags=["departements"])


class DepartementResponse(BaseModel):
    code: str
    annee: int
    type_local: str
    prix_median_m2: float
    nb_transactions: int
    commune_plus_chere: str | None
    commune_moins_chere: str | None
    evolution_pct_n1: float | None


@router.get("/")
def list_departements(
    client: ClientDep,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
    mois: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[DepartementResponse]:
    if mois is not None:
        return _from_silver(client, annee, mois)
    return _from_gold(client, annee)


def _from_gold(client, annee) -> list[DepartementResponse]:
    conditions = []
    params: dict = {}
    if annee:
        conditions.append("annee = {annee:UInt16}")
        params["annee"] = annee

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"""
        SELECT
            code_departement, annee, type_local, prix_median_m2, nb_transactions,
            commune_plus_chere, commune_moins_chere, evolution_pct_n1
        FROM gold.mart_prix_departement
        {where}
        ORDER BY code_departement, annee, type_local
    """
    rows = client.query(query, parameters=params).named_results()
    return [
        DepartementResponse(
            code=r["code_departement"],
            annee=r["annee"],
            type_local=r["type_local"],
            prix_median_m2=float(r["prix_median_m2"]),
            nb_transactions=int(r["nb_transactions"]),
            commune_plus_chere=r["commune_plus_chere"] or None,
            commune_moins_chere=r["commune_moins_chere"] or None,
            evolution_pct_n1=float(r["evolution_pct_n1"]) if r["evolution_pct_n1"] is not None else None,
        )
        for r in rows
    ]


def _from_silver(client, annee, mois) -> list[DepartementResponse]:
    conditions = ["toMonth(date_mutation) = {mois:UInt8}"]
    params: dict = {"mois": mois}
    if annee:
        conditions.append("annee = {annee:UInt16}")
        params["annee"] = annee

    query = f"""
        SELECT
            code_departement,
            annee,
            type_local,
            round(quantile(0.5)(prix_m2), 0) AS prix_median_m2,
            count() AS nb_transactions
        FROM silver.stg_dvf
        WHERE {' AND '.join(conditions)}
        GROUP BY code_departement, annee, type_local
        ORDER BY code_departement, annee, type_local
    """
    rows = client.query(query, parameters=params).named_results()
    return [
        DepartementResponse(
            code=r["code_departement"],
            annee=r["annee"],
            type_local=r["type_local"],
            prix_median_m2=float(r["prix_median_m2"]),
            nb_transactions=int(r["nb_transactions"]),
            commune_plus_chere=None,
            commune_moins_chere=None,
            evolution_pct_n1=None,
        )
        for r in rows
    ]
