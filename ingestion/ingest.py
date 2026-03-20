import csv
import gzip
import io
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

    # Bronze : toutes les colonnes, aucun filtre
    client.command("""
        CREATE TABLE IF NOT EXISTS bronze.raw_dvf (
            id_mutation                  String,
            date_mutation                Date,
            numero_disposition           String,
            nature_mutation              String,
            valeur_fonciere              Float64,
            adresse_numero               String,
            adresse_suffixe              String,
            adresse_nom_voie             String,
            adresse_code_voie            String,
            code_postal                  String,
            code_commune                 String,
            nom_commune                  String,
            code_departement             String,
            ancien_code_commune          String,
            ancien_nom_commune           String,
            id_parcelle                  String,
            ancien_id_parcelle           String,
            numero_volume                String,
            lot1_numero                  String,
            lot1_surface_carrez          Float32,
            lot2_numero                  String,
            lot2_surface_carrez          Float32,
            lot3_numero                  String,
            lot3_surface_carrez          Float32,
            lot4_numero                  String,
            lot4_surface_carrez          Float32,
            lot5_numero                  String,
            lot5_surface_carrez          Float32,
            nombre_lots                  UInt8,
            code_type_local              String,
            type_local                   String,
            surface_reelle_bati          Float32,
            nombre_pieces_principales    UInt8,
            code_nature_culture          String,
            nature_culture               String,
            code_nature_culture_speciale String,
            nature_culture_speciale      String,
            surface_terrain              Float32,
            longitude                    Float64,
            latitude                     Float64,
            _loaded_at                   DateTime DEFAULT now()
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
    try:
        return float(val.replace(",", "."))
    except ValueError:
        return 0.0


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
                    raw_date = row.get("date_mutation", "1970-01-01")
                    try:
                        parsed_date = date.fromisoformat(raw_date)
                    except ValueError:
                        parsed_date = date(1970, 1, 1)

                    rows.append({
                        "id_mutation":                  row.get("id_mutation", ""),
                        "date_mutation":                parsed_date,
                        "numero_disposition":           row.get("numero_disposition", ""),
                        "nature_mutation":              row.get("nature_mutation", ""),
                        "valeur_fonciere":              parse_float(row.get("valeur_fonciere", "")),
                        "adresse_numero":               row.get("adresse_numero", ""),
                        "adresse_suffixe":              row.get("adresse_suffixe", ""),
                        "adresse_nom_voie":             row.get("adresse_nom_voie", ""),
                        "adresse_code_voie":            row.get("adresse_code_voie", ""),
                        "code_postal":                  row.get("code_postal", ""),
                        "code_commune":                 row.get("code_commune", ""),
                        "nom_commune":                  row.get("nom_commune", ""),
                        "code_departement":             row.get("code_departement", dept),
                        "ancien_code_commune":          row.get("ancien_code_commune", ""),
                        "ancien_nom_commune":           row.get("ancien_nom_commune", ""),
                        "id_parcelle":                  row.get("id_parcelle", ""),
                        "ancien_id_parcelle":           row.get("ancien_id_parcelle", ""),
                        "numero_volume":                row.get("numero_volume", ""),
                        "lot1_numero":                  row.get("lot1_numero", ""),
                        "lot1_surface_carrez":          parse_float(row.get("lot1_surface_carrez", "")),
                        "lot2_numero":                  row.get("lot2_numero", ""),
                        "lot2_surface_carrez":          parse_float(row.get("lot2_surface_carrez", "")),
                        "lot3_numero":                  row.get("lot3_numero", ""),
                        "lot3_surface_carrez":          parse_float(row.get("lot3_surface_carrez", "")),
                        "lot4_numero":                  row.get("lot4_numero", ""),
                        "lot4_surface_carrez":          parse_float(row.get("lot4_surface_carrez", "")),
                        "lot5_numero":                  row.get("lot5_numero", ""),
                        "lot5_surface_carrez":          parse_float(row.get("lot5_surface_carrez", "")),
                        "nombre_lots":                  parse_int(row.get("nombre_lots", "0")),
                        "code_type_local":              row.get("code_type_local", ""),
                        "type_local":                   row.get("type_local", ""),
                        "surface_reelle_bati":          parse_float(row.get("surface_reelle_bati", "")),
                        "nombre_pieces_principales":    parse_int(row.get("nombre_pieces_principales", "0")),
                        "code_nature_culture":          row.get("code_nature_culture", ""),
                        "nature_culture":               row.get("nature_culture", ""),
                        "code_nature_culture_speciale": row.get("code_nature_culture_speciale", ""),
                        "nature_culture_speciale":      row.get("nature_culture_speciale", ""),
                        "surface_terrain":              parse_float(row.get("surface_terrain", "")),
                        "longitude":                    parse_float(row.get("longitude", "")),
                        "latitude":                     parse_float(row.get("latitude", "")),
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
    log.info(f"=== Terminé. bronze.raw_dvf: {total:,} lignes ===")


if __name__ == "__main__":
    main()
