from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import BaseModel

from db import ClientDep

DEPT_NOMS = {
    "22": "Côtes-d'Armor",
    "29": "Finistère",
    "35": "Ille-et-Vilaine",
    "56": "Morbihan",
}

router = APIRouter(prefix="/communes", tags=["communes"])


class CommuneResponse(BaseModel):
    id: str
    name: str
    department: str
    departmentCode: str
    pricePerSqm: float
    transactions: int
    evolution: float | None
    coordinates: tuple[float, float]


@router.get("/")
def list_communes(
    client: ClientDep,
    dept: Annotated[str | None, Query(pattern="^(22|29|35|56)$")] = None,
    type_bien: Annotated[str | None, Query(alias="type")] = None,
    annee: Annotated[int | None, Query(ge=2018, le=2024)] = None,
    mois: Annotated[int | None, Query(ge=1, le=12)] = None,
) -> list[CommuneResponse]:
    type_local = type_bien.capitalize() if type_bien else None
    if mois is not None:
        return _from_silver(client, dept, type_local, annee, mois)
    return _from_gold(client, dept, type_local, annee)


def _from_gold(client, dept, type_local, annee) -> list[CommuneResponse]:
    # Without a year filter the gold table returns one row per (commune × year × type),
    # producing duplicates on the map. Default to the latest available year.
    if not annee:
        row = next(
            client.query("SELECT max(annee) AS y FROM gold.mart_prix_commune").named_results()
        )
        annee = int(row["y"])

    conditions = [
        "prix_median_m2 IS NOT NULL",
        "longitude IS NOT NULL",
        "latitude IS NOT NULL",
        "longitude != 0",
        "latitude != 0",
        "annee = {annee:UInt16}",
    ]
    params: dict = {"annee": annee}
    if dept:
        conditions.append("code_departement = {dept:String}")
        params["dept"] = dept
    if type_local:
        conditions.append("type_local = {type_local:String}")
        params["type_local"] = type_local

    query = f"""
        SELECT
            code_commune, nom_commune, code_departement,
            longitude, latitude, prix_median_m2, nb_transactions, evolution_pct_n1
        FROM gold.mart_prix_commune
        WHERE {' AND '.join(conditions)}
        ORDER BY code_commune
    """
    rows = client.query(query, parameters=params).named_results()
    return [_to_commune(r) for r in rows]


def _from_silver(client, dept, type_local, annee, mois) -> list[CommuneResponse]:
    conditions = ["toMonth(d.date_mutation) = {mois:UInt8}"]
    params: dict = {"mois": mois}
    if dept:
        conditions.append("d.code_departement = {dept:String}")
        params["dept"] = dept
    if type_local:
        conditions.append("d.type_local = {type_local:String}")
        params["type_local"] = type_local
    if annee:
        conditions.append("d.annee = {annee:UInt16}")
        params["annee"] = annee

    query = f"""
        SELECT
            d.code_commune AS code_commune,
            d.nom_commune AS nom_commune,
            d.code_departement AS code_departement,
            c.longitude AS longitude,
            c.latitude AS latitude,
            round(quantile(0.5)(d.prix_m2), 0) AS prix_median_m2,
            count() AS nb_transactions
        FROM silver.stg_dvf AS d
        INNER JOIN silver.stg_communes AS c ON d.code_commune = c.code_commune
        WHERE {' AND '.join(conditions)}
        GROUP BY d.code_commune, d.nom_commune, d.code_departement, c.longitude, c.latitude
        HAVING nb_transactions >= 5 AND prix_median_m2 > 0
        ORDER BY d.code_commune
    """
    rows = client.query(query, parameters=params).named_results()
    return [
        CommuneResponse(
            id=r["code_commune"],
            name=r["nom_commune"],
            department=DEPT_NOMS.get(r["code_departement"], r["code_departement"]),
            departmentCode=r["code_departement"],
            pricePerSqm=float(r["prix_median_m2"]),
            transactions=int(r["nb_transactions"]),
            evolution=None,
            coordinates=(float(r["longitude"]), float(r["latitude"])),
        )
        for r in rows
    ]


def _to_commune(r: dict) -> CommuneResponse:
    return CommuneResponse(
        id=r["code_commune"],
        name=r["nom_commune"],
        department=DEPT_NOMS.get(r["code_departement"], r["code_departement"]),
        departmentCode=r["code_departement"],
        pricePerSqm=float(r["prix_median_m2"]),
        transactions=int(r["nb_transactions"]),
        evolution=float(r["evolution_pct_n1"]) if r["evolution_pct_n1"] is not None else None,
        coordinates=(float(r["longitude"]), float(r["latitude"])),
    )


class CommuneMapping(BaseModel):
    code_commune: str
    code_postal: str
    nom_commune: str


@router.get("/mapping")
def get_commune_mapping(
    client: ClientDep,
    dept: Annotated[str, Query(pattern="^(22|29|35|56)$")],
) -> list[CommuneMapping]:
    """Returns majority code_postal per commune for the given department."""
    query = """
        SELECT
            code_commune,
            anyHeavy(code_postal) AS cp_principal,
            any(nom_commune) AS nom_commune
        FROM silver.stg_dvf
        WHERE code_departement = {dept:String}
          AND code_postal != ''
        GROUP BY code_commune
        ORDER BY code_commune
    """
    rows = client.query(query, parameters={"dept": dept}).named_results()
    return [
        CommuneMapping(
            code_commune=r["code_commune"],
            code_postal=r["cp_principal"],
            nom_commune=r["nom_commune"],
        )
        for r in rows
    ]
