"""
Split the per-department sections GeoJSON into one small file per commune.
Output: frontend/public/geo/sections/{insee_code}.geojson

Each file only contains the sections for one commune — loaded on demand
when the user selects that commune on the map.
"""

import json
from collections import defaultdict
from pathlib import Path

GEO_DIR = Path(__file__).parent.parent / "frontend" / "public" / "geo"
OUT_DIR = GEO_DIR / "sections"
DEPTS = ["22", "29", "35", "56"]


def split(dept: str) -> None:
    src = GEO_DIR / f"sections-{dept}.geojson"
    if not src.exists():
        print(f"[{dept}] SKIP — {src} not found")
        return

    print(f"[{dept}] Loading {src.name} ...")
    data = json.loads(src.read_text(encoding="utf-8"))
    features = data.get("features", [])

    by_commune: dict[str, list] = defaultdict(list)
    for feat in features:
        commune_code = feat.get("properties", {}).get("commune", "")
        if commune_code:
            by_commune[commune_code].append(feat)

    for code, feats in by_commune.items():
        out = OUT_DIR / f"{code}.geojson"
        fc = {"type": "FeatureCollection", "features": feats}
        out.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")

    total_kb = sum((OUT_DIR / f"{c}.geojson").stat().st_size for c in by_commune) / 1024
    print(f"[{dept}] Split into {len(by_commune)} commune files ({total_kb / 1024:.1f} MB total)")


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for dept in DEPTS:
        split(dept)
    # Remove the large per-dept files now that they're split
    for dept in DEPTS:
        f = GEO_DIR / f"sections-{dept}.geojson"
        if f.exists():
            f.unlink()
            print(f"Removed {f.name}")
    print("Done.")
