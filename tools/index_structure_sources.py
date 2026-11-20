"""Index Google Open Buildings v3 confidence thresholds and 2023 height COGs.

Run from the project root with Python 3, pyproj and s2sphere. Then run
node tools/build_structure_tiles.mjs to bundle offline starter areas.
"""
import csv
import io
import json
import math
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

from pyproj import Transformer
from s2sphere import CellId, LatLng

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'dist/vn-structures/source-index.json'
GCS = 'https://storage.googleapis.com/'


def get(url):
    with urlopen(url, timeout=60) as response:
        return response.read()


def height_sources(args):
    token, zone, keyset = args
    path = f'open-buildings-temporal-data/v1/manifests/{token}_EPSG_{32600+zone}_2023_06_30.json'
    from urllib.error import HTTPError
    try:
        manifest = json.loads(get(GCS+path))
    except HTTPError as e:
        if e.code == 404:
            return []
        raise
    inverse = Transformer.from_crs(32600+zone, 4326, always_xy=True)
    files = []
    for item in manifest['tilesets'][0]['sources']:
        transform, size = item['affineTransform'], item['dimensions']
        x, y = transform['translateX'], transform['translateY']
        w, h = size['width']*transform['scaleX'], -size['height']*transform['scaleY']
        corners = [inverse.transform(a,b) for a in (x,x+w) for b in (y,y-h)]
        west,south = map(min,zip(*corners))
        east,north = map(max,zip(*corners))
        if any((a,b) in keyset for a in range(math.floor(west*4), math.floor(east*4)+1)
               for b in range(math.floor(south*4), math.floor(north*4)+1)):
            uri = (manifest['uriPrefix']+item['uris'][0]).split('/geotiffs/')[1]
            bounds = [math.floor(west*10000),math.floor(south*10000),
                      math.ceil(east*10000),math.ceil(north*10000)]
            files.append([uri,zone,int(x),int(y),int(w),int(h),*bounds])
    return files


def build():
    roads = json.loads((ROOT/'dist/vn-roads/index.json').read_bytes())
    cells = {tuple(map(int,k.split('_'))) for k in roads['tiles']}
    threshold_csv = get(GCS+'open-buildings-data/v3/score_thresholds_s2_level_4.csv')
    thresholds = []
    for row in csv.DictReader(io.StringIO(threshold_csv.decode())):
        coords = list(map(float,re.findall(r'-?\d+(?:\.\d+)?',row['geometry'])))
        xs,ys = coords[::2],coords[1::2]
        if min(xs)>114 or max(xs)<100 or min(ys)>25 or max(ys)<7:
            continue
        thresholds.append([float(row['confidence_threshold_90%_precision']),
                           [round(v,6) for v in coords]])
    tokens = {CellId.from_lat_lng(LatLng.from_degrees(b/4,a/4)).parent(2).to_token()
              for x,y in cells for a in [x,x+1] for b in [y,y+1]}
    with ThreadPoolExecutor(max_workers=6) as pool:
        groups = pool.map(height_sources, [(t,z,cells) for t in sorted(tokens) for z in range(47,51)])
        sources = sorted({row[0]:row for group in groups for row in group}.values())
    data = {'thresholds':thresholds,'heightSources':sources}
    OUT.write_text(json.dumps(data,separators=(',',':')),encoding='utf8')
    print(f'{len(sources)} height raster sources and {len(thresholds)} confidence cells')


if __name__ == '__main__':
    build()
