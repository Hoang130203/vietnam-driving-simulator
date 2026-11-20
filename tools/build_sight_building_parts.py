"""Export mapped 3D building parts and the remaining shell of their parent.

Requires Python, osmium and shapely 2. Build against the same extract as
dist/vn-osm-buildings, e.g. python tools/build_sight_building_parts.py vietnam.osm.pbf.
Coordinates and tags © OpenStreetMap contributors, ODbL 1.0.
"""
import argparse
from collections import Counter, defaultdict
from dataclasses import dataclass
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

import osmium
from shapely import STRtree, difference, intersection, set_precision, union_all
from shapely.geometry import Polygon, box

from build_tour_buildings import SCALE, metres
from build_vn_osm_buildings import compact


ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Footprint:
    id: str
    polygon: Polygon
    kind: str
    height: float
    levels: float
    roof: str
    tags: dict


def count(raw):
    value = (raw or "").strip().replace(",", ".")
    return float(value) if re.fullmatch(r"\d{1,3}(?:\.\d+)?", value) else 0


def metadata(tags):
    result = {}
    for key in ("building:colour", "building:material", "roof:colour", "roof:material",
                "roof:direction", "roof:orientation", "religion"):
        if tags.get(key):
            result[key] = tags[key]
    for key in ("height", "min_height", "roof:height"):
        value = metres(tags.get(key))
        if value:
            result[key] = value
    for key in ("building:min_level", "roof:levels"):
        value = count(tags.get(key) or (tags.get("min_level") if key == "building:min_level" else None))
        if value:
            result[key] = value
    return result


def members(polygon):
    if polygon.is_empty:
        return
    if polygon.geom_type == "Polygon":
        if polygon.is_valid and polygon.area > 0:
            yield polygon
    elif polygon.geom_type in {"MultiPolygon", "GeometryCollection"}:
        for piece in polygon.geoms:
            yield from members(piece)


def part_outlines(source):
    tag = osmium.filter.KeyFilter("building:part")
    stream = (osmium.FileProcessor(source).with_locations().with_areas(tag)
              .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)).with_filter(tag))
    parts = []
    for area in stream:
        tags = area.tags
        part = tags.get("building:part", "yes")
        if part in {"no", "ruins", "construction", "demolished", "proposed", "underground"}:
            continue
        meta = metadata(tags)
        height = meta.get("height", 0)
        levels = count(tags.get("building:levels"))
        roof = tags.get("roof:shape", "")
        low = meta.get("min_height", 0)
        if low and height and height <= low:
            if height == low and meta.get("roof:height"):
                # A roof shell with an explicitly tagged rise above its spring line.
                height = low + meta["roof:height"]
            else:
                continue
        if not height and levels and levels <= meta.get("building:min_level", 0):
            continue
        if not (height or levels or roof or meta.get("roof:height") or meta.get("roof:levels")):
            continue
        meta["building:part"] = part
        kind = tags.get("building") or part
        ref = ("w" if area.from_way() else "r") + str(area.orig_id())
        for i, outer in enumerate(area.outer_rings()):
            def points(ring):
                # pyosmium stores 1e-7 degrees; work in the game's 1e-5 grid.
                return [(n.x/100, n.y/100) for n in ring]
            polygon = Polygon(points(outer), [points(loop) for loop in area.inner_rings(outer)])
            if not polygon.is_valid:
                continue
            source_id = ref + (f":{i}" if i else "")
            for j, piece in enumerate(members(set_precision(polygon, 1))):
                parts.append(Footprint(source_id + ":part" + (f":{j}" if j else ""),
                                       piece, kind, height, levels, roof, {**meta, "sourceId": source_id}))
    return parts


def decode(encoded):
    points = []
    x = y = 0
    for dx, dy in zip(encoded[::2], encoded[1::2]):
        x += dx
        y += dy
        points.append((x, y))
    return points


def parent_candidates(directory, index, parts):
    tree = STRtree([part.polygon for part in parts])
    candidates = defaultdict(list)
    parents = {}
    # A feature tagged building AND building:part is a mapped volume itself,
    # not an independent enclosing building for its neighbouring volumes.
    part_ids = {part.tags["sourceId"] for part in parts}
    for key, *tile_bounds in index["tiles"]:
        if not len(tree.query(box(*tile_bounds))):
            continue
        with gzip.open(directory / (key + ".gz")) as file:
            rows = json.load(file)
        for ident, kind, height, levels, rings, roof in rows:
            if ident in part_ids:
                continue
            shell = decode(rings[0])
            xs, ys = zip(*shell)
            nearby = tree.query(box(min(xs), min(ys), max(xs), max(ys)))
            if not len(nearby):
                continue
            polygon = Polygon(shell, [decode(ring) for ring in rings[1:]])
            if not polygon.is_valid:
                continue
            for i in nearby:
                part = parts[i].polygon
                if not polygon.covers(part.representative_point()):
                    continue
                coverage = 1 if polygon.covers(part) else intersection(polygon, part).area / part.area
                # Simplification of the nationwide outlines can drift by <1 m.
                # Require nearly all of the actual part, excluding parent holes.
                if coverage < .985:
                    continue
                candidates[i].append(ident)
                if ident not in parents:
                    parents[ident] = Footprint(ident, polygon, kind, height, levels, roof, {})
    return candidates, parents


def explicit_membership(source, parents):
    declared = defaultdict(set)
    stream = osmium.FileProcessor(source, osmium.osm.RELATION).with_filter(osmium.filter.TagFilter(("type", "building")))
    for rel in stream:
        outlines = {m.type + str(m.ref) for m in rel.members if m.role == "outline"}
        for member in rel.members:
            if member.role == "part":
                declared[member.type + str(member.ref)].update(outlines)
    # The nationwide base tiles preserve only height, levels, shape and kind.
    # Recover the wall / roof finishes for any split remnants from the same PBF.
    by_ref = defaultdict(list)
    for parent in parents.values():
        by_ref[parent.id.split(":")[0]].append(parent)
    ids = {int(ref[1:]) for ref in by_ref}
    if ids:
        stream = osmium.FileProcessor(source, osmium.osm.WAY | osmium.osm.RELATION).with_filter(osmium.filter.IdFilter(ids))
        for obj in stream:
            for parent in by_ref.get(obj.type_str() + str(obj.id), []):
                parent.tags.update(metadata(obj.tags))
    return declared


def packed(polygon):
    # Cut edges meet long surveyed walls between grid vertices. Preserve those
    # intersections to 0.01 source units (~1 cm) without changing the tile scale.
    rings = []
    for ring in [polygon.exterior, *polygon.interiors]:
        values = []
        previous = (0, 0)
        for point in ring.coords[:-1]:
            for value, last in zip(point, previous):
                shift = round(value-last, 2)
                values.append(int(shift) if shift.is_integer() else shift)
            previous = point
        rings.append(values)
    return rings


def texture_tags(tags):
    return {key: value for key, value in tags.items() if key in
            {"building:colour", "building:material", "roof:colour", "roof:material", "religion"}}


def emit_parts(source, directory, index):
    parts = part_outlines(source)
    candidates, parents = parent_candidates(directory, index, parts)
    declared = explicit_membership(source, parents)
    grouped = defaultdict(list)
    for i, part in enumerate(parts):
        ids = candidates.get(i, [])
        expected = declared.get(part.tags["sourceId"].split(":")[0])
        if expected:
            ids = [key for key in ids if key.split(":")[0] in expected]
        owner = min(ids, key=lambda key: (parents[key].polygon.area, key)) if ids else None
        grouped[owner].append(part)

    rows = []
    for parent_id, components in grouped.items():
        parent = parents.get(parent_id)
        cut = []
        for part in components:
            meta = {**texture_tags(parent.tags), **part.tags, "parent": parent.id} if parent else part.tags
            kind = parent.kind if parent and part.kind == "yes" else part.kind
            rows.append((part.polygon, [part.id, kind, part.height, part.levels,
                                        packed(part.polygon), part.roof, meta]))
            if parent:
                # An elevated part usually represents a passage or an overhang.
                # Keep a lower shell under it only if that storey is itself
                # documented by an explicit parent height below the raised floor.
                floor = meta.get("min_height", 0) or meta.get("building:min_level", 0)*3.3
                lower_top = parent.height or parent.levels*3.3
                if not (lower_top and floor >= lower_top-.06):
                    cut.append(part.polygon)
        if parent:
            remaining = difference(parent.polygon, union_all(cut, grid_size=.01), grid_size=.01) if cut else parent.polygon
            for i, shell in enumerate(members(remaining)):
                meta = {**parent.tags, "parent": parent.id, "residual": True}
                rows.append((shell, [parent.id + f":shell:{i}", parent.kind, parent.height,
                                     parent.levels, packed(shell), parent.roof, meta]))
    return rows


def build(source, directory, out):
    index = json.loads((directory / "index.json").read_text("utf8"))
    with source.open("rb") as file:
        checksum = hashlib.file_digest(file, "sha256").hexdigest()
    if checksum != index["sourceSha256"] or index["scale"] != SCALE:
        raise ValueError("The PBF and vn-osm-buildings base must use the same snapshot and grid.")
    out.mkdir(exist_ok=True, parents=True)
    tiles = defaultdict(list)
    stats = Counter()
    parents = set()
    for polygon, row in emit_parts(source, directory, index):
        x0, y0, x1, y1 = polygon.bounds
        west, south, east, north = math.floor(x0), math.floor(y0), math.ceil(x1), math.ceil(y1)
        key = f"{(west+east)//(2*SCALE)}_{(south+north)//(2*SCALE)}"
        tiles[key].append(((west,south,east,north), row))
        meta = row[6]
        stats["residuals" if meta.get("residual") else "parts"] += 1
        if meta.get("parent"):
            parents.add(meta["parent"])
        elif not meta.get("residual"):
            stats["standalone"] += 1
    manifest = {"scale": SCALE, "tiles": [], **stats, "parents": len(parents),
                **{k: index[k] for k in ("source", "sourceSha256", "snapshot", "license", "attribution")}}
    for key, entries in sorted(tiles.items()):
        entries.sort(key=lambda e: e[1][0])
        west,south,east,north = zip(*(bbox for bbox, _ in entries))
        manifest["tiles"].append([key,min(west),min(south),max(east),max(north)])
        data = gzip.compress(compact([row for _, row in entries]), compresslevel=8, mtime=0)
        (out / (key + ".gz")).write_bytes(data)
    (out / "index.json").write_bytes(compact(manifest))
    print(dict(stats), len(parents), "parent footprints,", len(tiles), "tiles")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("source", type=Path)
    cli.add_argument("--base", type=Path, default=ROOT / "dist/vn-osm-buildings")
    cli.add_argument("--output", type=Path, default=ROOT / "dist/sight-building-parts")
    args = cli.parse_args()
    build(args.source, args.base, args.output)
