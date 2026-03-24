from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from db import ClientDep

router = APIRouter(prefix="/code-postaux", tags=["code-postaux"])


class CodePostalResponse(BaseModel):
    code: str
    departmentCode: str
    pricePerSqm: float
    transactions: int
    evolution: float | None
    coordinates: tuple[float, float]


@router.get("/")
def list_code_postaux(
    client: ClientDep,
    dept: Annotated[str | None, Query(pattern="^(22|29|35|56)$")] = None,
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
) -> list[CodePostalResponse]:
    type_local = type_bien.capitalize() if type_bien else None
    return _from_gold(client, dept, type_local, annee)


def _from_gold(client, dept, type_local, annee) -> list[CodePostalResponse]:
    # Default to the latest available year to avoid one row per (code_postal × year × type)
    if not annee:
        row = next(
            client.query(
                "SELECT max(annee) AS y FROM gold.mart_prix_code_postal"
            ).named_results()
        )
        annee = int(row["y"])

    conditions = [
        "g.prix_median_m2 IS NOT NULL",
        "coords.longitude != 0",
        "coords.latitude != 0",
        "g.annee = {annee:UInt16}",
    ]
    params: dict = {"annee": annee}

    if dept:
        conditions.append("g.code_departement = {dept:String}")
        params["dept"] = dept
    if type_local:
        conditions.append("g.type_local = {type_local:String}")
        params["type_local"] = type_local

    query = f"""
        SELECT
            g.code_postal,
            g.code_departement,
            g.prix_median_m2,
            g.nb_transactions,
            g.evolution_pct_n1,
            coords.longitude,
            coords.latitude
        FROM gold.mart_prix_code_postal AS g
        INNER JOIN (
            SELECT
                d.code_postal,
                avg(c.longitude) AS longitude,
                avg(c.latitude)  AS latitude
            FROM silver.stg_dvf AS d
            INNER JOIN silver.stg_communes AS c ON d.code_commune = c.code_commune
            WHERE d.code_postal != '' AND c.longitude != 0 AND c.latitude != 0
            GROUP BY d.code_postal
        ) AS coords ON g.code_postal = coords.code_postal
        WHERE {' AND '.join(conditions)}
        ORDER BY g.code_postal
    """
    rows = client.query(query, parameters=params).named_results()
    return [_to_code_postal(r) for r in rows]


def _to_code_postal(r: dict) -> CodePostalResponse:
    return CodePostalResponse(
        code=r["code_postal"],
        departmentCode=r["code_departement"],
        pricePerSqm=float(r["prix_median_m2"]),
        transactions=int(r["nb_transactions"]),
        evolution=float(r["evolution_pct_n1"]) if r["evolution_pct_n1"] is not None else None,
        coordinates=(float(r["longitude"]), float(r["latitude"])),
    )
