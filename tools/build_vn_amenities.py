"""Extract everyday amenities from a Vietnam OSM PBF into offline game tiles.

Install osmium and shapely, then run
  python tools/build_vn_amenities.py vietnam-261118.osm.pbf
The source download and ODbL attribution are recorded in the output.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import hashlib
import json
from pathlib import Path

import osmium
from shapely import STRtree, from_wkb
from shapely.geometry import Point


KINDS = {"marketplace": "market", "school": "school", "fuel": "fuel",
         "cafe": "cafe", "hospital": "hospital"}
SCALE = 100000
ROOT = Path(__file__).resolve().parents[1]


def extract(source):
    tags = osmium.filter.TagFilter(*[("amenity", value) for value in KINDS])
    stream = osmium.FileProcessor(source).with_locations().with_areas(tags).with_filter(tags)
    factory = osmium.geom.WKBFactory()
    nodes, areas = [], []
    for obj in stream:
        kind = KINDS.get(obj.tags.get("amenity"))
        if not kind:
            continue
        name = " ".join((obj.tags.get("name:vi") or obj.tags.get("name", "")).split())
        if obj.is_node() and obj.location.valid():
            nodes.append((f"n{obj.id}", kind, name, Point(obj.location.lon, obj.location.lat)))
        elif obj.is_area():
            try:
                shape = from_wkb(factory.create_multipolygon(obj))
            except (RuntimeError, ValueError):
                continue
            if not shape.is_empty and shape.area > 0:
                prefix = "w" if obj.from_way() else "r"
                areas.append((prefix + str(obj.orig_id()), kind, name, shape))

    # A named shop node often sits within a second area for the same facility.
    # Keep the area anchor and inherit the label from the node if necessary.
    tree = STRtree([record[3] for record in areas])
    for ref, kind, name, point in nodes:
        matches = [i for i in tree.query(point, predicate="intersects")
                   if areas[i][1] == kind and
                   (not name or not areas[i][2] or areas[i][2].casefold() == name.casefold())]
        if matches:
            i = min(matches, key=lambda index: areas[index][3].area)
            if name and not areas[i][2]:
                areas[i] = (areas[i][0], kind, name, areas[i][3])
        else:
            yield ref, kind, name, point
    for ref, kind, name, shape in areas:
        yield ref, kind, name, shape.representative_point()


def build(source, output, source_url):
    output.mkdir(exist_ok=True, parents=True)
    tiles, counts = defaultdict(list), Counter()
    for ref, kind, name, point in extract(source):
        lon, lat = round(point.x*SCALE), round(point.y*SCALE)
        key = f"{lon // SCALE}_{lat // SCALE}"
        tiles[key].append([ref, kind, name, lon, lat])
        counts[kind] += 1
    for key, rows in sorted(tiles.items()):
        rows.sort(key=lambda row: (row[4], row[3], row[0]))
        raw = json.dumps(rows, separators=(",", ":"), ensure_ascii=False).encode()
        (output / (key+".gz")).write_bytes(gzip.compress(raw, mtime=0))
    with source.open("rb") as file:
        checksum = hashlib.file_digest(file, "sha256").hexdigest()
    with osmium.io.Reader(str(source)) as reader:
        timestamp = reader.header().get("osmosis_replication_timestamp")
    if not source_url:
        source_url = "https://download.geofabrik.de/asia/vietnam.html"
        if timestamp:
            date = timestamp[2:10].replace("-", "")
            source_url = f"https://download.geofabrik.de/asia/vietnam/vietnam-{date}.osm.pbf"
    manifest = {"tiles": sorted(tiles), "scale": SCALE, "counts": dict(sorted(counts.items())),
                "source": source_url, "sourceSha256": checksum, "snapshot": timestamp,
                "attribution": "© OpenStreetMap contributors", "license": "ODbL 1.0"}
    (output / "index.json").write_text(json.dumps(manifest, ensure_ascii=False,
                                                   separators=(",", ":")), encoding="utf-8")
    print(f"{sum(counts.values()):,} amenities, {len(tiles)} tiles, {dict(counts)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "dist" / "vn-amenities")
    parser.add_argument("--source-url", help="Override the Geofabrik URL inferred from the snapshot date")
    args = parser.parse_args()
    build(args.source, args.output, args.source_url)
