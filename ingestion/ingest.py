import csv
import gzip
import io
import json
import logging
import sys
import time
from datetime import date

import requests
import clickhouse_connect

from config import (
    ANNEES,
    CLICKHOUSE_HOST,
    CLICKHOUSE_PASSWORD,
    CLICKHOUSE_PORT,
    CLICKHOUSE_USER,
    DEPARTEMENTS,
    DVF_URL,
    GEOJSON_URL,
)

logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)


def get_client():
    return clickhouse_connect.get_client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        username=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
    )


def wait_for_clickhouse(retries: int = 20, delay: int = 5):
    for i in range(retries):
        try:
            client = get_client()
            client.query("SELECT 1")
            log.info("ClickHouse prêt.")
            return client
        except Exception as e:
            log.info(f"Attente ClickHouse ({i+1}/{retries})... {e}")
            time.sleep(delay)
    raise RuntimeError("ClickHouse inaccessible après plusieurs tentatives.")


def create_tables(client) -> None:
    client.command("CREATE DATABASE IF NOT EXISTS bronze")

    client.command("""
        CREATE TABLE IF NOT EXISTS bronze.raw_dvf (
            id_mutation          String,
            date_mutation        Date,
            code_departement     String,
            code_commune         String,
            nom_commune          String,
            code_postal          String,
            type_local           String,
            surface_reelle_bati  Float32,
            valeur_fonciere      Float64,
            nombre_lots          UInt8,
            _loaded_at           DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (code_departement, date_mutation)
        PARTITION BY (code_departement, toYear(date_mutation))
    """)

    client.command("""
        CREATE TABLE IF NOT EXISTS bronze.raw_communes (
            code_commune  String,
            nom_commune   String,
            code_dept     String,
            longitude     Float64,
            latitude      Float64
        ) ENGINE = MergeTree()
        ORDER BY code_commune
    """)
    log.info("Tables bronze créées (ou déjà existantes).")


def already_loaded(client, dept: str, annee: int) -> bool:
    result = client.query(
        f"SELECT count() FROM bronze.raw_dvf WHERE code_departement = '{dept}' AND toYear(date_mutation) = {annee}"
    )
    return result.result_rows[0][0] > 0


def parse_float(val: str) -> float:
    if not val:
        return 0.0
    return float(val.replace(",", "."))


def parse_int(val: str) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def ingest_dvf(client) -> None:
    for annee in ANNEES:
        for dept in DEPARTEMENTS:
            if already_loaded(client, dept, annee):
                log.info(f"Déjà chargé : {dept}/{annee} — skip.")
                continue

            url = DVF_URL.format(annee=annee, dept=dept)
            log.info(f"Téléchargement {dept}/{annee} → {url}")

            try:
                response = requests.get(url, timeout=120)
                response.raise_for_status()
            except requests.HTTPError as e:
                log.warning(f"Fichier introuvable {dept}/{annee} : {e} — skip.")
                continue

            with gzip.open(io.BytesIO(response.content), "rt", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = []
                for row in reader:
                    type_local = row.get("type_local", "").strip()
                    if type_local not in ("Appartement", "Maison"):
                        continue
                    surface = parse_float(row.get("surface_reelle_bati", ""))
                    valeur = parse_float(row.get("valeur_fonciere", ""))
                    if surface <= 0 or valeur <= 0:
                        continue
                    raw_date = row.get("date_mutation", "1970-01-01")
                    try:
                        parsed_date = date.fromisoformat(raw_date)
                    except ValueError:
                        parsed_date = date(1970, 1, 1)
                    rows.append({
                        "id_mutation":         row.get("id_mutation", ""),
                        "date_mutation":       parsed_date,
                        "code_departement":    row.get("code_departement", dept),
                        "code_commune":        row.get("code_commune", ""),
                        "nom_commune":         row.get("nom_commune", ""),
                        "code_postal":         row.get("code_postal", ""),
                        "type_local":          type_local,
                        "surface_reelle_bati": surface,
                        "valeur_fonciere":     valeur,
                        "nombre_lots":         parse_int(row.get("nombre_lots", "0")),
                    })

            if not rows:
                log.warning(f"Aucune ligne valide pour {dept}/{annee}.")
                continue

            client.insert(
                "bronze.raw_dvf",
                [list(r.values()) for r in rows],
                column_names=list(rows[0].keys()),
            )
            log.info(f"Chargé {dept}/{annee} — {len(rows):,} lignes.")


def ingest_communes(client) -> None:
    count = client.query("SELECT count() FROM bronze.raw_communes").result_rows[0][0]
    if count > 0:
        log.info(f"Communes déjà chargées ({count:,} lignes) — skip.")
        return

    rows = []
    for dept in DEPARTEMENTS:
        url = GEOJSON_URL.format(dept=dept)
        log.info(f"GeoJSON communes dept {dept} → {url}")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        features = response.json().get("features", [])
        for f in features:
            props = f.get("properties", {})
            geom = f.get("geometry", {})
            coords = geom.get("coordinates", [0.0, 0.0]) if geom else [0.0, 0.0]
            rows.append({
                "code_commune": props.get("code", ""),
                "nom_commune":  props.get("nom", ""),
                "code_dept":    dept,
                "longitude":    float(coords[0]),
                "latitude":     float(coords[1]),
            })

    client.insert(
        "bronze.raw_communes",
        [list(r.values()) for r in rows],
        column_names=list(rows[0].keys()),
    )
    log.info(f"Communes chargées — {len(rows):,} communes.")


def main() -> None:
    log.info("=== Démarrage ingestion DVF Bretagne ===")
    client = wait_for_clickhouse()
    create_tables(client)
    ingest_communes(client)
    ingest_dvf(client)

    total = client.query("SELECT count() FROM bronze.raw_dvf").result_rows[0][0]
    communes = client.query("SELECT count() FROM bronze.raw_communes").result_rows[0][0]
    log.info(f"=== Ingestion terminée. raw_dvf: {total:,} lignes | raw_communes: {communes:,} communes ===")


if __name__ == "__main__":
    main()
