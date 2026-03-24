from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from db import ClientDep

router = APIRouter(prefix="/bretagne", tags=["bretagne"])


class KpisResponse(BaseModel):
    prix_median_bretagne: float
    prix_median_selection: float
    nb_transactions_total: int
    commune_plus_chere: str | None
    commune_moins_chere: str | None


class HistoriquePoint(BaseModel):
    annee: int
    prix_median_m2: float


@router.get("/kpis")
def get_kpis(
    client: ClientDep,
    dept: Annotated[str | None, Query(pattern="^(22|29|35|56)$")] = None,
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
    mois: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> KpisResponse:
    type_local = type_bien.capitalize() if type_bien else None
    if mois is not None:
        return _kpis_from_silver(client, dept, type_local, annee, mois)
    return _kpis_from_gold(client, dept, type_local, annee)


def _kpis_from_gold(client, dept, type_local, annee) -> KpisResponse:
    conditions: list[str] = []
    params: dict = {}
    if annee:
        conditions.append("annee = {annee:UInt16}")
        params["annee"] = annee
    if type_local:
        conditions.append("type_local = {type_local:String}")
        params["type_local"] = type_local

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    q_bretagne = f"""
        SELECT
            round(avg(prix_median_m2), 0) AS prix_median_bretagne,
            sum(nb_transactions) AS nb_transactions_total
        FROM gold.mart_prix_bretagne
        {where}
    """
    r_bretagne = next(client.query(q_bretagne, parameters=params).named_results())

    q_extremes = f"""
        SELECT
            argMax(commune_plus_chere, prix_median_m2) AS commune_plus_chere,
            argMin(commune_moins_chere, prix_median_m2) AS commune_moins_chere
        FROM gold.mart_prix_departement
        {where}
    """
    r_extremes = next(client.query(q_extremes, parameters=params).named_results())

    prix_median_selection = float(r_bretagne["prix_median_bretagne"])

    if dept:
        dept_conditions = conditions + ["code_departement = {dept:String}"]
        dept_params = dict(params)
        dept_params["dept"] = dept
        q_dept = f"""
            SELECT round(avg(prix_median_m2), 0) AS prix_median_selection
            FROM gold.mart_prix_departement
            WHERE {' AND '.join(dept_conditions)}
        """
        r_dept = next(client.query(q_dept, parameters=dept_params).named_results(), None)
        if r_dept and r_dept["prix_median_selection"]:
            prix_median_selection = float(r_dept["prix_median_selection"])

    return KpisResponse(
        prix_median_bretagne=float(r_bretagne["prix_median_bretagne"]),
        prix_median_selection=prix_median_selection,
        nb_transactions_total=int(r_bretagne["nb_transactions_total"]),
        commune_plus_chere=r_extremes["commune_plus_chere"] or None,
        commune_moins_chere=r_extremes["commune_moins_chere"] or None,
    )


def _kpis_from_silver(client, dept, type_local, annee, mois) -> KpisResponse:
    conditions = ["toMonth(date_mutation) = {mois:UInt8}"]
    params: dict = {"mois": mois}
    if annee:
        conditions.append("annee = {annee:UInt16}")
        params["annee"] = annee
    if type_local:
        conditions.append("type_local = {type_local:String}")
        params["type_local"] = type_local

    q_bretagne = f"""
        SELECT
            round(quantile(0.5)(prix_m2), 0) AS prix_median,
            count() AS nb_transactions
        FROM silver.stg_dvf
        WHERE {' AND '.join(conditions)}
    """
    r_bretagne = next(client.query(q_bretagne, parameters=params).named_results())
    prix_median_bretagne = float(r_bretagne["prix_median"])
    prix_median_selection = prix_median_bretagne

    if dept:
        dept_conditions = conditions + ["code_departement = {dept:String}"]
        dept_params = dict(params)
        dept_params["dept"] = dept
        q_dept = f"""
            SELECT round(quantile(0.5)(prix_m2), 0) AS prix_median
            FROM silver.stg_dvf
            WHERE {' AND '.join(dept_conditions)}
        """
        r_dept = next(client.query(q_dept, parameters=dept_params).named_results(), None)
        if r_dept and r_dept["prix_median"]:
            prix_median_selection = float(r_dept["prix_median"])

    return KpisResponse(
        prix_median_bretagne=prix_median_bretagne,
        prix_median_selection=prix_median_selection,
        nb_transactions_total=int(r_bretagne["nb_transactions"]),
        commune_plus_chere=None,
        commune_moins_chere=None,
    )


@router.get("/historique")
def get_historique(
    client: ClientDep,
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    dept: Annotated[str | None, Query(pattern="^(22|29|35|56)$")] = None,
) -> list[HistoriquePoint]:
    type_local = type_bien.capitalize() if type_bien else None

    if dept:
        conditions = ["code_departement = {dept:String}"]
        params: dict = {"dept": dept}
        if type_local:
            conditions.append("type_local = {type_local:String}")
            params["type_local"] = type_local
        query = f"""
            SELECT annee, round(quantile(0.5)(prix_m2), 0) AS prix_median_m2
            FROM silver.stg_dvf
            WHERE {' AND '.join(conditions)}
            GROUP BY annee
            ORDER BY annee
        """
    else:
        conditions = []
        params = {}
        if type_local:
            conditions.append("type_local = {type_local:String}")
            params["type_local"] = type_local
        where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        query = f"""
            SELECT annee, round(avg(prix_median_m2), 0) AS prix_median_m2
            FROM gold.mart_prix_bretagne
            {where}
            GROUP BY annee
            ORDER BY annee
        """

    rows = client.query(query, parameters=params).named_results()
    return [
        HistoriquePoint(annee=r["annee"], prix_median_m2=float(r["prix_median_m2"]))
        for r in rows
    ]
