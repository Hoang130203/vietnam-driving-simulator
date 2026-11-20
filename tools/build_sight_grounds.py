"""Extract mapped visitor grounds around Vietnam atlas destinations from the road snapshot.

python tools/build_sight_grounds.py vietnam-261118.osm.pbf
Requires osmium and shapely. Coordinates are WGS84 in millionths of a degree.
"""
import argparse
from collections import Counter, defaultdict
import gzip
import json
import math
from pathlib import Path
import subprocess

import osmium
from shapely import STRtree, from_wkb
from shapely.geometry import Point, LineString, box

from build_tour_buildings import metres


ROOT = Path(__file__).resolve().parents[1]
GRID, SCALE = 32, 1000000
KEYS = ("highway","barrier","amenity","leisure","man_made","natural","tourism","historic","landuse","place")


def feature(tags, area=False, point=False):
    if tags.get("access") in {"private","no","military"} or tags.get("indoor")=="yes" or tags.get("tunnel")=="yes":
        return
    if point:
        if tags.get("natural")=="tree":
            species=" ".join(tags.get(k,"").lower() for k in ("genus","species","taxon"))
            if any(name in species for name in ("cocos","areca","roystonea","phoenix","coconut")):
                return "palm"
            return "pine" if tags.get("leaf_type")=="needleleaved" or "pinus" in species else "tree"
        if tags.get("amenity") in {"bench","picnic_table"}:
            return tags["amenity"]
        if tags.get("information") in {"board","map"}:
            return "board"
        if tags.get("memorial") in {"stele","obelisk","stone"}:
            return tags["memorial"]
        if tags.get("man_made") == "flagpole":
            return "flagpole"
        return
    road = tags.get("highway")
    if area:
        if tags.get("building") or tags.get("boundary"):
            return
        if tags.get("area")=="yes" and road in {"pedestrian","footway"} or tags.get("place")=="square":
            return "court"
        if tags.get("natural") in {"beach","sand","bare_rock"}:
            return "rock" if tags["natural"]=="bare_rock" else "sand"
        if tags.get("landuse") in {"orchard","vineyard","farmland","plantation"}:
            if tags.get("crop")=="tea" or tags.get("trees")=="tea_plants":
                return "tea"
            if tags.get("landuse")=="orchard":
                return "orchard"
        if tags.get("landuse") in {"grass","flowerbed"} or tags.get("leisure")=="garden":
            return "lawn"
        return
    if tags.get("area")=="yes":
        return
    if tags.get("natural")=="tree_row":
        return "avenue"
    if tags.get("barrier") in {"wall","hedge","city_wall"}:
        return tags["barrier"]
    if tags.get("man_made")=="pier":
        return "pier"
    if road in {"steps","path","footway","pedestrian"}:
        if tags.get("footway") in {"sidewalk","crossing"} or tags.get("bridge") not in {None,"no"}:
            return
        if road=="steps":
            return "steps"
        return "trail" if tags.get("surface") in {"dirt","earth","ground","unpaved","gravel"} or road=="path" and not tags.get("surface") else "walk"


def pack(coords):
    result = []
    for lon,lat in coords:
        p = round(lon*SCALE),round(lat*SCALE)
        if not result or p!=result[-1]:
            result.append(p)
    dx = dy = 0
    out = []
    for x,y in result:
        out.extend((x-dx,y-dy))
        dx,dy = x,y
    return out


def build(source, output):
    script = "global.window=global;require('./dist/tourism-catalog');console.log(JSON.stringify(VietnamTourism.entries.flatMap(s=>[[s.lon,s.lat],s.start])))"
    sites = json.loads(subprocess.check_output(["node","-e",script],cwd=ROOT))
    boxes = [box(x-.0048,y-.00455,x+.0048,y+.00455) for x,y in sites]
    nearby = STRtree(boxes)
    tiles = defaultdict(list)
    counts = Counter()
    filters = osmium.filter.KeyFilter(*KEYS)
    stream = osmium.FileProcessor(source).with_locations().with_areas(filters).with_filter(filters)
    factory = osmium.geom.WKBFactory()
    for obj in stream:
        node,area = obj.is_node(),obj.is_area()
        kind = feature(obj.tags,area,node)
        if not kind or obj.is_relation():
            continue
        if node:
            shape = Point(obj.location.lon,obj.location.lat)
        elif area:
            try:
                shape = from_wkb(factory.create_multipolygon(obj))
            except (ValueError,RuntimeError):
                continue
        else:
            if obj.is_closed() and (kind=="pier" or obj.tags.get("area")=="yes"):
                continue
            coords = [(n.lon,n.lat) for n in obj.nodes if n.location.valid()]
            if len(coords)<2:
                continue
            shape = LineString(coords)
        if shape.is_empty or not shape.is_valid:
            continue
        # Only read cells touched by the mapped feature and close to a visitor stop.
        w,s,e,n = shape.bounds
        if not len(nearby.query(shape,predicate="intersects")):
            continue
        size = metres(obj.tags.get("height" if kind in {"wall","city_wall","hedge","flagpole","stele","stone","obelisk","tree","pine","palm","avenue"} else "width"))
        for i in range(math.floor(w*GRID),math.floor(e*GRID)+1):
            for j in range(math.floor(s*GRID),math.floor(n*GRID)+1):
                tile = box(i/GRID,j/GRID,(i+1)/GRID,(j+1)/GRID)
                if not len(nearby.query(tile)):
                    continue
                part = shape if tile.covers(shape) else shape.intersection(tile)
                for g in getattr(part,"geoms",[part]):
                    if g.is_empty or g.geom_type!=("Point" if node else "Polygon" if area else "LineString"):
                        continue
                    if not node and not len(nearby.query(g,predicate="intersects")):
                        continue
                    if area:
                        g = g.simplify(.000003)
                        rings = [pack(g.exterior.coords[:-1])]+[pack(r.coords[:-1]) for r in g.interiors]
                        if len(rings[0])<6:
                            continue
                        rings = [r for r in rings if len(r)>=6]
                    else:
                        rings = [pack(g.coords)]
                        if not node and len(rings[0])<4:
                            continue
                    tiles[i,j].append([kind,size,rings])
                    counts[kind]+=1
    # One request can serve several adjacent sight cells.
    bundles = defaultdict(dict)
    for (i,j),rows in sorted(tiles.items()):
        bundles[f"{i//8}_{j//8}"][f"{i}_{j}"] = rows
    output.mkdir(exist_ok=True)
    for key,rows in bundles.items():
        data = json.dumps(rows,separators=(",",":")).encode()
        (output/(key+".gz")).write_bytes(gzip.compress(data,compresslevel=8,mtime=0))
    manifest = {"bundles":sorted(bundles),"grid":GRID,"scale":SCALE,"counts":dict(sorted(counts.items())),
                "attribution":"© OpenStreetMap contributors","license":"ODbL 1.0",
                "source":"https://download.geofabrik.de/asia/vietnam.html"}
    (output/"index.json").write_text(json.dumps(manifest,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    print(counts, flush=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf",type=Path)
    parser.add_argument("--output",type=Path,default=ROOT/"dist/sight-grounds")
    args=parser.parse_args()
    build(args.pbf,args.output)
