"""Extract OSM buildings around the visitor atlas, including courtyards and observed height tags.

Run after build_vn_tourism.py, with the same Vietnam .osm.pbf snapshot.
Requires osmium and shapely. The input and derived databases are licensed ODbL 1.0.
"""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
import math
from pathlib import Path
import re

import osmium
from shapely.geometry import Polygon


SCALE = 100000
GRID = 20
RADIUS = 240


def metres(value):
    """Preserve usable observed dimensions and omit ambiguous ranges."""
    match = re.fullmatch(r"(\d+(?:[.,]\d+)?)\s*(m|meters?|metres?|ft|feet|')?", (value or "").strip().lower())
    if not match:
        return 0
    n = float(match[1].replace(",", "."))
    if match[2] in {"ft", "feet", "'"}:
        n *= .3048
    return round(n, 1) if .4 <= n <= 850 else 0


def pack_ring(coords):
    out = []
    last = None
    for lon,lat in coords[:-1]:
        p = (round(lon*SCALE),round(lat*SCALE))
        if p == last:
            continue
        out.extend(p if last is None else (p[0]-last[0],p[1]-last[1]))
        last = p
    return out


def tile_for(rings):
    # Metre quantisation occasionally folds a narrow courtyard or collapses an
    # edge. Check the exact polygon the client will receive before emitting it.
    coords = []
    for ring in rings:
        x = y = 0
        path = []
        for dx,dy in zip(ring[::2],ring[1::2]):
            x += dx
            y += dy
            path.append((x,y))
        coords.append(path)
    polygon = Polygon(coords[0],coords[1:])
    if not polygon.is_valid or polygon.area == 0:
        return None
    west,south,east,north = polygon.bounds
    return f"{math.floor((west+east)*GRID/(2*SCALE))}_{math.floor((south+north)*GRID/(2*SCALE))}"


def build(source, catalog, directory):
    text = catalog.read_text(encoding="utf8")
    rows = json.loads("["+text.split("entries: [",1)[1].split("].map(",1)[0]+"]")
    # Geographic index of POI pins and their driveable street approaches, including border cells.
    cells = defaultdict(list)
    for row in rows:
        for x,y in (row[5:7],row[7:9]):
            for a in range(math.floor((x-.004)*200),math.floor((x+.004)*200)+1):
                for b in range(math.floor((y-.004)*200),math.floor((y+.004)*200)+1):
                    cells[a,b].append((x,y,math.cos(math.radians(y))))
    tiles = defaultdict(list)
    member_shapes = set()
    stream = (osmium.FileProcessor(source).with_locations().with_areas(osmium.filter.KeyFilter("building"))
              .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)).with_filter(osmium.filter.KeyFilter("building")))
    for area in stream:
        kind = area.tags.get("building","yes")
        if kind in {"no","ruins","construction","demolished","roof"}:
            continue
        ref = ("w" if area.from_way() else "r")+str(area.orig_id())
        for part,outer in enumerate(area.outer_rings()):
            first = outer[0]
            if not cells.get((math.floor(first.lon*200),math.floor(first.lat*200))):
                continue
            shell = [(n.lon,n.lat) for n in outer]
            if len(shell)<4:
                continue
            west,south = map(min,zip(*shell))
            east,north = map(max,zip(*shell))
            x,y = (east+west)/2,(north+south)/2
            candidates = cells.get((math.floor(x*200),math.floor(y*200)),[])
            if not any((((x-sx)*c*111320)**2+((y-sy)*110900)**2)<=RADIUS**2 for sx,sy,c in candidates):
                continue
            holes = [[(n.lon,n.lat) for n in inner] for inner in area.inner_rings(outer)]
            poly = Polygon(shell,[h for h in holes if len(h)>=4])
            if not poly.is_valid or poly.area*1.14e10<7:
                continue
            poly = poly.simplify(.000005,preserve_topology=True)
            packed = [pack_ring(poly.exterior.coords[:])]
            if len(packed[0])<6:
                continue
            signature = (round(x*SCALE),round(y*SCALE),round(poly.area*1e10))
            if signature in member_shapes:
                continue
            member_shapes.add(signature)
            packed.extend(r for inner in poly.interiors if len(r:=pack_ring(inner.coords[:]))>=6)
            key = tile_for(packed)
            if key is None:
                continue
            height = metres(area.tags.get("height"))
            levels = metres(area.tags.get("building:levels"))
            roof = area.tags.get("roof:shape","")
            tiles[key].append([ref+(":"+str(part) if part else ""),kind,height,levels,packed,roof])
    directory.mkdir(exist_ok=True)
    total = tagged = 0
    for key, features in tiles.items():
        data = json.dumps(features,ensure_ascii=False,separators=(",",":")).encode()
        (directory/(key+".gz")).write_bytes(gzip.compress(data,mtime=0))
        total += len(features)
        tagged += sum(bool(row[2] or row[3]) for row in features)
    with source.open("rb") as f:
        digest = hashlib.file_digest(f,"sha256").hexdigest()
    info = {"scale":SCALE,"grid":GRID,"radiusMeters":RADIUS,"tiles":sorted(tiles),
            "buildings":total,"heightOrLevelsTagged":tagged,"source":"https://download.geofabrik.de/asia/vietnam.html",
            "attribution":"© OpenStreetMap contributors","license":"ODbL 1.0","sourceSha256":digest}
    (directory/"index.json").write_text(json.dumps(info,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    print(f"{total} building footprints across {len(tiles)} tiles, {tagged} with observed heights or levels.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf",type=Path)
    parser.add_argument("--catalog",type=Path,default=Path("dist/tourism-catalog.js"))
    parser.add_argument("--output",type=Path,default=Path("dist/tour-buildings"))
    args = parser.parse_args()
    build(args.pbf,args.catalog,args.output)
