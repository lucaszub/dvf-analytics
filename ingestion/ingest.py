import csv
import gzip
import io
import json
import logging
import sys
import time
from datetime import date
from decimal import Decimal

import ijson
import requests
import clickhouse_connect


class _DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _dumps(obj) -> str:
    return json.dumps(obj, cls=_DecimalEncoder)

from config import (
    ANNEES,
    CLICKHOUSE_HOST,
    CLICKHOUSE_PASSWORD,
    CLICKHOUSE_PORT,
    CLICKHOUSE_USER,
    DEPARTEMENTS,
    DVF_URL,
    GEOJSON_URL,
    PARCELLES_URL,
    SECTIONS_URL,
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
        CREATE TABLE IF NOT EXISTS bronze.raw_dvf_geo (
            id_mutation               String,
            date_mutation             Date,
            code_departement          String,
            code_commune              String,
            nom_commune               String,
            code_postal               String,
            adresse_nom_voie          String,
            type_local                String,
            surface_reelle_bati       Float32,
            nombre_pieces_principales UInt8,
            valeur_fonciere           Float64,
            nombre_lots               UInt8,
            id_parcelle               String,
            longitude                 Float64,
            latitude                  Float64,
            _loaded_at                DateTime DEFAULT now()
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

    client.command("""
        CREATE TABLE IF NOT EXISTS bronze.raw_sections (
            id         String,
            commune    String,
            prefixe    String,
            section    String,
            contenance UInt32,
            geometry   String,
            _loaded_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (commune, id)
    """)

    client.command("""
        CREATE TABLE IF NOT EXISTS bronze.raw_parcelles (
            id         String,
            commune    String,
            prefixe    String,
            section    String,
            numero     String,
            contenance UInt32,
            geometry   String,
            _loaded_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (commune, id)
    """)

    log.info("Tables bronze créées (ou déjà existantes).")


def parse_float(val: str) -> float:
    if not val:
        return 0.0
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return 0.0


def parse_int(val: str) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def dvf_already_loaded(client, dept: str, annee: int) -> bool:
    result = client.query(
        "SELECT count() FROM bronze.raw_dvf_geo"
        " WHERE code_departement = {dept:String}"
        " AND toYear(date_mutation) = {annee:UInt16}",
        parameters={"dept": dept, "annee": annee},
    )
    return result.result_rows[0][0] > 0


def ingest_dvf(client) -> None:
    for annee in ANNEES:
        for dept in DEPARTEMENTS:
            if dvf_already_loaded(client, dept, annee):
                log.info(f"Déjà chargé : DVF {dept}/{annee} — skip.")
                continue

            url = DVF_URL.format(annee=annee, dept=dept)
            log.info(f"Téléchargement DVF {dept}/{annee} → {url}")

            try:
                response = requests.get(url, timeout=120)
                response.raise_for_status()
            except requests.HTTPError as e:
                log.warning(f"Fichier introuvable DVF {dept}/{annee} : {e} — skip.")
                continue

            with gzip.open(io.BytesIO(response.content), "rt", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                rows = []
                for row in reader:
                    raw_date = row.get("date_mutation", "1970-01-01")
                    try:
                        parsed_date = date.fromisoformat(raw_date)
                    except ValueError:
                        parsed_date = date(1970, 1, 1)

                    rows.append([
                        row.get("id_mutation", ""),
                        parsed_date,
                        row.get("code_departement", dept),
                        row.get("code_commune", ""),
                        row.get("nom_commune", ""),
                        row.get("code_postal", ""),
                        row.get("adresse_nom_voie", ""),
                        row.get("type_local", ""),
                        parse_float(row.get("surface_reelle_bati", "")),
                        parse_int(row.get("nombre_pieces_principales", "0")),
                        parse_float(row.get("valeur_fonciere", "")),
                        parse_int(row.get("nombre_lots", "0")),
                        row.get("id_parcelle", ""),
                        parse_float(row.get("longitude", "")),
                        parse_float(row.get("latitude", "")),
                    ])

            if not rows:
                log.warning(f"Aucune ligne valide pour DVF {dept}/{annee}.")
                continue

            columns = [
                "id_mutation", "date_mutation", "code_departement", "code_commune",
                "nom_commune", "code_postal", "adresse_nom_voie", "type_local",
                "surface_reelle_bati", "nombre_pieces_principales", "valeur_fonciere",
                "nombre_lots", "id_parcelle", "longitude", "latitude",
            ]
            client.insert("bronze.raw_dvf_geo", rows, column_names=columns)
            log.info(f"Chargement DVF {dept}/{annee} — {len(rows):,} lignes")


def ingest_communes(client) -> None:
    count = client.query("SELECT count() FROM bronze.raw_communes").result_rows[0][0]
    if count > 0:
        log.info(f"Communes déjà chargées ({count:,} lignes) — skip.")
        return

    rows = []
    for dept in DEPARTEMENTS:
        url = GEOJSON_URL.format(dept=dept)
        log.info(f"GeoJSON communes dept {dept} → {url}")
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
        except requests.HTTPError as e:
            log.warning(f"GeoJSON dept {dept} indisponible : {e} — skip.")
            continue
        features = response.json().get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [0.0, 0.0]) if geom else [0.0, 0.0]
            rows.append([
                props.get("code", ""),
                props.get("nom", ""),
                dept,
                float(coords[0]),
                float(coords[1]),
            ])

    client.insert(
        "bronze.raw_communes",
        rows,
        column_names=["code_commune", "nom_commune", "code_dept", "longitude", "latitude"],
    )
    log.info(f"Chargement communes — {len(rows):,} communes")


BATCH_SIZE = 10_000
COLUMNS_SECTIONS = ["id", "commune", "prefixe", "section", "contenance", "geometry"]
COLUMNS_PARCELLES = ["id", "commune", "prefixe", "section", "numero", "contenance", "geometry"]


def _stream_geojson_features(gz_bytes: bytes):
    """Yield parsed feature dicts from a gzipped GeoJSON stream using ijson."""
    with gzip.open(io.BytesIO(gz_bytes), "rb") as f:
        for feat in ijson.items(f, "features.item"):
            yield feat


def ingest_sections(client) -> None:
    client.command("TRUNCATE TABLE IF EXISTS bronze.raw_sections")

    total = 0
    for dept in DEPARTEMENTS:
        url = SECTIONS_URL.format(dept=dept)
        log.info(f"Sections cadastrales dept {dept} → {url}")
        try:
            response = requests.get(url, timeout=300)
            response.raise_for_status()
        except requests.HTTPError as e:
            log.warning(f"Sections dept {dept} indisponibles : {e} — skip.")
            continue

        rows = []
        for feat in _stream_geojson_features(response.content):
            props = feat.get("properties", {})
            rows.append([
                props.get("id", ""),
                props.get("commune", ""),
                props.get("prefixe", ""),
                props.get("section", ""),
                int(props.get("contenance", 0) or 0),
                _dumps(feat.get("geometry", {})),
            ])
            if len(rows) >= BATCH_SIZE:
                client.insert("bronze.raw_sections", rows, column_names=COLUMNS_SECTIONS)
                total += len(rows)
                rows = []

        if rows:
            client.insert("bronze.raw_sections", rows, column_names=COLUMNS_SECTIONS)
            total += len(rows)

        log.info(f"Chargement sections {dept} — {total:,} sections (total courant)")

    log.info(f"Chargement sections terminé — {total:,} sections")


def ingest_parcelles(client) -> None:
    client.command("TRUNCATE TABLE IF EXISTS bronze.raw_parcelles")

    for dept in DEPARTEMENTS:
        url = PARCELLES_URL.format(dept=dept)
        log.info(f"Parcelles cadastrales dept {dept} → {url}")
        try:
            response = requests.get(url, timeout=600)
            response.raise_for_status()
        except requests.HTTPError as e:
            log.warning(f"Parcelles dept {dept} indisponibles : {e} — skip.")
            continue

        rows = []
        dept_total = 0
        for feat in _stream_geojson_features(response.content):
            props = feat.get("properties", {})
            rows.append([
                props.get("id", ""),
                props.get("commune", ""),
                props.get("prefixe", ""),
                props.get("section", ""),
                props.get("numero", ""),
                int(props.get("contenance", 0) or 0),
                _dumps(feat.get("geometry", {})),
            ])
            if len(rows) >= BATCH_SIZE:
                client.insert("bronze.raw_parcelles", rows, column_names=COLUMNS_PARCELLES)
                dept_total += len(rows)
                rows = []

        if rows:
            client.insert("bronze.raw_parcelles", rows, column_names=COLUMNS_PARCELLES)
            dept_total += len(rows)

        log.info(f"Chargement parcelles {dept} — {dept_total:,} parcelles")


def main() -> None:
    log.info("=== Démarrage ingestion DVF Bretagne ===")
    client = wait_for_clickhouse()
    create_tables(client)
    ingest_communes(client)
    ingest_dvf(client)
    ingest_sections(client)
    ingest_parcelles(client)

    dvf_total = client.query("SELECT count() FROM bronze.raw_dvf_geo").result_rows[0][0]
    sections_total = client.query("SELECT count() FROM bronze.raw_sections").result_rows[0][0]
    parcelles_total = client.query("SELECT count() FROM bronze.raw_parcelles").result_rows[0][0]
    log.info(
        f"=== Terminé. raw_dvf_geo: {dvf_total:,} | "
        f"raw_sections: {sections_total:,} | raw_parcelles: {parcelles_total:,} ==="
    )


if __name__ == "__main__":
    main()
