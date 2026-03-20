import os

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "default")
CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "")

DEPARTEMENTS = ["22", "29", "35", "56"]
ANNEES = list(range(2020, 2025))  # 2020 → 2024 (données dispo sur geo-dvf)

DVF_URL = "https://files.data.gouv.fr/geo-dvf/latest/csv/{annee}/departements/{dept}.csv.gz"
GEOJSON_URL = "https://geo.api.gouv.fr/departements/{dept}/communes?fields=nom,code,codesPostaux,centre&format=geojson"
