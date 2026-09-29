#!/usr/bin/env python3
"""Build the CVAT vehicle-size preset catalogue from the Vietnam vehicle CSV dataset."""

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path


CATEGORY_NAMES = {
    "01_xe_may_hai_banh": "Motorcycle",
    "02_oto_con_du_lich": "Passenger car",
    "03_xe_khach_va_bus": "Bus / coach",
    "04_xe_tai_thuong_mai": "Commercial truck",
    "05_xe_dau_keo_container": "Tractor / trailer",
}


def number(row, *keys):
    for key in keys:
        value = (row.get(key) or "").strip().replace(",", ".")
        if value:
            try:
                return round(float(value))
            except ValueError:
                pass
    return None


def text(row, *keys):
    for key in keys:
        value = (row.get(key) or "").strip()
        if value:
            return value
    return ""


def normalize(value):
    value = unicodedata.normalize("NFD", value or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", value)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    presets = []
    seen = set()
    for csv_path in sorted(args.source.rglob("*.csv")):
        relative = csv_path.relative_to(args.source)
        category_key = relative.parts[0]
        with csv_path.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                length = number(row, "Dai_mm", "Dai_Tong_The_mm")
                width = number(row, "Rong_mm", "Rong_Tong_The_mm")
                height = number(row, "Cao_mm", "Cao_Tong_The_mm")
                if not all(value and value > 0 for value in (length, width, height)):
                    continue

                manufacturer = text(row, "Hang_Xe", "Hang_San_Xuat") or relative.parts[-2].replace("_", " ")
                model = text(row, "Dong_Xe", "Loai_Mooc") or csv_path.stem.replace("_", " ")
                variant = text(row, "Phien_Ban", "Quy_Cach")
                year = text(row, "Doi_Xe")
                has_mirrors = "Loai_Mooc" not in row
                identity = (category_key, normalize(manufacturer), normalize(model), length, width, height)
                if identity in seen:
                    continue
                seen.add(identity)
                presets.append({
                    "id": f"vehicle-{len(presets) + 1}",
                    "category": CATEGORY_NAMES.get(category_key, category_key),
                    "manufacturer": manufacturer,
                    "model": model,
                    "displayName": model,
                    "variant": variant,
                    "year": year,
                    "lengthMm": length,
                    "widthMm": width,
                    "heightMm": height,
                    "hasRearViewMirrors": has_mirrors,
                })

    # Keep one entry for identical model/dimension combinations. For model
    # names that legitimately have multiple dimensions, make the variant part
    # of the display name so the UI cannot silently pick the wrong preset.
    groups = {}
    for preset in presets:
        key = (normalize(preset["category"]), normalize(preset["manufacturer"]), normalize(preset["model"]))
        groups.setdefault(key, []).append(preset)
    for group in groups.values():
        has_multiple_dimensions = len({
            (item["lengthMm"], item["widthMm"], item["heightMm"]) for item in group
        }) > 1
        for item in group:
            year_suffix = f" ({item['year']})" if item["year"] else ""
            if has_multiple_dimensions and item["variant"]:
                item["displayName"] = f"{item['model']} - {item['variant']}{year_suffix}"
            else:
                item["displayName"] = f"{item['model']}{year_suffix}"

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(presets, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(presets)} vehicle presets to {args.output}")


if __name__ == "__main__":
    main()
