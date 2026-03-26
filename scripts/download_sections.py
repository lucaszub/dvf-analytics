"""
Download cadastral sections GeoJSON for the 4 Bretagne departments from etalab cadastre.
Output: frontend/public/geo/sections-{dept}.geojson  (one file per dept)

Source: https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements/
"""

import gzip
import json
import urllib.request
from pathlib import Path

DEPTS = ["22", "29", "35", "56"]
BASE_URL = "https://cadastre.data.gouv.fr/data/etalab-cadastre/latest/geojson/departements"
OUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "geo"

# Properties to keep — drop geometry-heavy fields we don't need
KEEP_PROPS = {"id", "commune", "prefixe", "section", "contenance", "arpente"}


def download_sections(dept: str) -> None:
    url = f"{BASE_URL}/{dept}/cadastre-{dept}-sections.json.gz"
    out_path = OUT_DIR / f"sections-{dept}.geojson"

    print(f"[{dept}] Downloading {url} ...")
    with urllib.request.urlopen(url) as resp:
        compressed = resp.read()

    print(f"[{dept}] Decompressing ({len(compressed) // 1024} KB compressed) ...")
    raw = gzip.decompress(compressed)
    data = json.loads(raw)

    # Slim down properties
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        feat["properties"] = {k: v for k, v in props.items() if k in KEEP_PROPS}

    out_path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    size_mb = out_path.stat().st_size / 1024 / 1024
    n = len(data.get("features", []))
    print(f"[{dept}] Saved {n} sections → {out_path.name} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for dept in DEPTS:
        try:
            download_sections(dept)
        except Exception as e:
            print(f"[{dept}] ERROR: {e}")
    print("Done.")
