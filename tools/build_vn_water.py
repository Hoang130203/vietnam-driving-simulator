"""Build ODbL water scenery: pip install osmium shapely; python tools/build_vn_water.py vietnam.osm.pbf dist/vn-water."""
import argparse
from collections import Counter, defaultdict
import gzip
import json
import math
from pathlib import Path

import osmium
from shapely import box, from_wkb, make_valid


def components(geometry, kind):
    if geometry.is_empty:
        return
    if geometry.geom_type == kind:
        yield geometry
    elif hasattr(geometry, 'geoms'):
        for part in geometry.geoms:
            yield from components(part, kind)


def simple_faces(polygon):
    """Make solid rings for the renderer while leaving actual OSM islands dry."""
    pending = [polygon]
    while pending:
        part = pending.pop()
        if not part.interiors and len(part.exterior.coords) <= 400:
            yield part
            continue
        xmin, ymin, xmax, ymax = part.bounds
        ring = part.interiors[0] if part.interiors else part.exterior
        left, bottom, right, top = ring.bounds
        if xmax - xmin > ymax - ymin:
            cut = (left + right) / 2
            sides = [box(xmin, ymin, cut, ymax), box(cut, ymin, xmax, ymax)]
        else:
            cut = (bottom + top) / 2
            sides = [box(xmin, ymin, xmax, cut), box(xmin, cut, xmax, ymax)]
        for side in sides:
            pending.extend(components(part.intersection(side), 'Polygon'))


def encode_line(coords):
    result = []
    for x, y in coords:
        point = [round(x * 100_000), round(y * 100_000)]
        if result[-2:] != point:
            result.extend(point)
    return result


def build(source, output):
    tags = [('natural', 'water'), ('waterway', 'riverbank'), ('landuse', 'reservoir'), ('waterway', 'river')]
    processor = osmium.FileProcessor(str(source)).with_areas(osmium.filter.TagFilter(*tags))
    processor.with_filter(osmium.filter.TagFilter(*tags))
    factory = osmium.geom.WKBFactory()
    tiles, counts = defaultdict(list), Counter()
    for obj in processor:
        name = obj.tags.get('name:vi') or obj.tags.get('name', '')
        if obj.is_area():
            kind, geom_type = 'lake', 'Polygon'
            try:
                raw = from_wkb(factory.create_multipolygon(obj))
            except RuntimeError:
                continue
            if not name and raw.area < .000008:
                continue
        elif obj.is_way() and obj.tags.get('waterway') == 'river' and name:
            kind, geom_type = 'river', 'LineString'
            try:
                raw = from_wkb(factory.create_linestring(obj))
            except RuntimeError:
                continue
        else:
            continue
        geom = raw.simplify(.00009, preserve_topology=True)
        if not geom.is_valid:
            geom = make_valid(geom)
        if geom.is_empty:
            continue
        xmin, ymin, xmax, ymax = (math.floor(v * 4) for v in geom.bounds)
        for x in range(xmin, xmax + 1):
            for y in range(ymin, ymax + 1):
                clipped = geom.intersection(box(x / 4, y / 4, (x + 1) / 4, (y + 1) / 4))
                for part in components(clipped, geom_type):
                    lines = (p.exterior.coords for p in simple_faces(part)) if kind == 'lake' else [part.coords]
                    for coords in lines:
                        points = encode_line(coords)
                        if len(points) < (8 if kind == 'lake' else 4):
                            continue
                        tiles[f'{x}_{y}'].append([kind, name, points])
                        counts[kind] += 1

    output.mkdir(parents=True, exist_ok=True)
    def compact(obj):
        return json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    total = 0
    for tile, features in tiles.items():
        data = gzip.compress(compact(features), compresslevel=8, mtime=0)
        (output / (tile + '.gz')).write_bytes(data)
        total += len(data)
    with osmium.io.Reader(str(source)) as reader:
        timestamp = reader.header().get('osmosis_replication_timestamp')
    index = dict(tiles=sorted(tiles), parts=counts, bytes=total, osmTimestamp=timestamp,
                 attribution='© OpenStreetMap contributors', license='https://opendatacommons.org/licenses/odbl/1-0/',
                 source='https://download.geofabrik.de/asia/vietnam.html')
    (output / 'index.json').write_bytes(compact(index))
    print(f'{len(tiles)} tiles, {counts}, {total:,} bytes')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    build(args.source, args.output)
