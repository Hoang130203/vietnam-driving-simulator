"""Build nationwide offline OSM building tiles with osmium and shapely.

python tools/build_vn_osm_buildings.py vietnam-261118.osm.pbf
"""
import argparse
from collections import defaultdict
from contextlib import ExitStack
import gzip
import hashlib
import json
from pathlib import Path
import re
from tempfile import TemporaryDirectory

import osmium
from shapely.geometry import Polygon

from build_tour_buildings import metres, SCALE


MAX_ROWS = 3200
ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {"no", "roof", "construction", "ruins", "demolished", "proposed"}


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def integer_ring(nodes):
    # pyosmium exposes lon/lat as integers in 1e-7 degrees. Quantize once.
    points = []
    for node in nodes:
        point = ((node.x+50)//100, (node.y+50)//100)
        if not points or points[-1] != point:
            points.append(point)
    if points and points[-1] == points[0]:
        points.pop()
    return points


def delta(points):
    out = []
    last_x = last_y = 0
    for x,y in points:
        out.extend([x-last_x, y-last_y])
        last_x, last_y = x,y
    return out


def geometry(area, outer):
    ring = integer_ring(outer)
    if len(ring) < 3:
        return None
    holes = [points for inner in area.inner_rings(outer) if len(points := integer_ring(inner)) >= 3]
    # Most footprints are convex quadrilaterals. A consistent winding proves
    # such a simple ring is valid without allocating a GEOS object for it.
    turns = []
    if not holes and len(ring) == 4:
        for i,(ax,ay) in enumerate(ring):
            bx,by = ring[(i+1)%4]
            cx,cy = ring[(i+2)%4]
            turns.append((bx-ax)*(cy-by) - (by-ay)*(cx-bx))
    if turns and (min(turns)>0 or max(turns)<0):
        if abs(turns[0]+turns[2]) < 12:
            return None
    else:
        polygon = Polygon(ring, holes)
        if not polygon.is_valid or polygon.area < 6:
            return None
        if len(ring) > 12:
            polygon = polygon.simplify(.6, preserve_topology=True)
            ring = [(int(x),int(y)) for x,y in polygon.exterior.coords[:-1]]
            holes = [[(int(x),int(y)) for x,y in loop.coords[:-1]] for loop in polygon.interiors]
    xs,ys = zip(*ring)
    return [min(xs),min(ys),max(xs),max(ys)], [delta(ring), *map(delta, holes)]


def spool(source, work):
    files = {}
    tag = osmium.filter.KeyFilter("building")
    stream = (osmium.FileProcessor(source).with_locations().with_areas(tag)
              .with_filter(osmium.filter.EntityFilter(osmium.osm.AREA)).with_filter(tag))
    with ExitStack() as stack:
        for area in stream:
            kind = area.tags.get("building")
            if kind in EXCLUDED:
                continue
            ref = ("w" if area.from_way() else "r") + str(area.orig_id())
            h = metres(area.tags.get("height"))
            floors = area.tags.get("building:levels","")
            levels = float(floors) if re.fullmatch(r"[0-9]{1,3}(?:\.[0-9])?", floors) else 0
            roof = area.tags.get("roof:shape","")
            for part, outer in enumerate(area.outer_rings()):
                shape = geometry(area, outer)
                if not shape:
                    continue
                bbox, rings = shape
                west,south,east,north = bbox
                key = f"{(west+east)//(2*SCALE)}_{(south+north)//(2*SCALE)}"
                if key not in files:
                    files[key] = stack.enter_context((work/key).open("wb"))
                row = [ref+(f":{part}" if part else ""), kind, h, levels, rings, roof]
                files[key].write(compact([bbox, row])+b"\n")
    return sorted(files)


def partition(rows, key, left, bottom, width, directory, tiles, stats):
    if len(rows)>MAX_ROWS and width>32:
        middle_x, middle_y = left+width/2, bottom+width/2
        children = defaultdict(list)
        for entry in rows:
            (w,s,e,n),_ = entry
            child = int((w+e)/2 >= middle_x) + 2*int((s+n)/2 >= middle_y)
            children[child].append(entry)
        for child, group in sorted(children.items()):
            partition(group, key+"_"+str(child), left+(child%2)*width/2,
                      bottom+(child//2)*width/2, width/2, directory, tiles, stats)
        return
    west,south = map(min,zip(*(entry[0][:2] for entry in rows)))
    east,north = map(max,zip(*(entry[0][2:] for entry in rows)))
    rows.sort(key=lambda entry: (entry[0][1],entry[0][0],entry[1][0]))
    features = [row for _,row in rows]
    data = gzip.compress(compact(features), compresslevel=7, mtime=0)
    (directory/(key+".gz")).write_bytes(data)
    # Extents include the full geometry to find buildings spanning a tile edge.
    tiles.append([key,west,south,east,north])
    stats["buildings"] += len(features)
    stats["heightOrLevelsTagged"] += sum(bool(row[2] or row[3]) for row in features)
    stats["typed"] += sum(row[1] != "yes" for row in features)
    stats["roofShapeTagged"] += sum(bool(row[5]) for row in features)
    stats["bytes"] += len(data)


def build(source, output, source_url):
    output.mkdir(exist_ok=True, parents=True)
    tiles, stats = [], defaultdict(int)
    with TemporaryDirectory(prefix="vn-osm-geometry-") as folder:
        work = Path(folder)
        for key in spool(source, work):
            lon,lat = map(int,key.split("_"))
            with (work/key).open("rb") as file:
                rows = [json.loads(line) for line in file]
            partition(rows,key,lon*SCALE,lat*SCALE,SCALE,output,tiles,stats)
            del rows
    with osmium.io.Reader(str(source)) as reader:
        stamp = reader.header().get("osmosis_replication_timestamp")
    if not source_url:
        date = stamp[2:10].replace("-","") if stamp else ""
        source_url = (f"https://download.geofabrik.de/asia/vietnam/vietnam-{date}.osm.pbf"
                      if date else "https://download.geofabrik.de/asia/vietnam.html")
    with source.open("rb") as file:
        sha = hashlib.file_digest(file,"sha256").hexdigest()
    index = {"scale": SCALE, "tiles": tiles, **stats, "source": source_url, "snapshot": stamp,
             "sourceSha256": sha, "license": "ODbL 1.0", "attribution": "© OpenStreetMap contributors"}
    (output/"index.json").write_bytes(compact(index))
    print(f"{dict(stats)}, {len(tiles)} tiles")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT/"dist"/"vn-osm-buildings")
    parser.add_argument("--source-url", help="Override the Geofabrik URL inferred from the snapshot date")
    args = parser.parse_args()
    build(args.source, args.output, args.source_url)
