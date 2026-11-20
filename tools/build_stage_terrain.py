"""Bake local terrain for the mountain circuits from Mapzen/AWS Terrarium tiles.

Python dependencies: Pillow. Run from the repository root. Tiles are cached only
for the duration of the build, and the resulting local files work offline.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
import io
from functools import lru_cache
import json
import math
from pathlib import Path
import tempfile
import time
import urllib.request

from PIL import Image

DIST = Path(__file__).resolve().parents[1] / "dist"
# Central 50 m grid covering the full track, with coarser bands in the distance.
HALF_AXIS = [0, *range(50, 3601, 50), *range(3800, 6201, 200), *range(6650, 15201, 450)]
AXIS = [-d for d in reversed(HALF_AXIS[1:])] + HALF_AXIS


def mercator(lon, lat, zoom):
    size = 256 * (2 ** zoom)
    return ((lon + 180) / 360 * size - .5,
            (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * size - .5)


def mapping(stage):
    lon, lat = stage['start']
    bearing = math.radians(stage['bearing'])
    cs, sn = math.cos(bearing), math.sin(bearing)
    mx = 111320 * math.cos(math.radians(lat))

    def sample(x, z, zoom):
        return mercator(lon + (cs*x-sn*z)/mx, lat + (-sn*x-cs*z)/110900, zoom)
    return sample


def tiles_for(stages):
    keys = set()
    for stage in stages:
        point = mapping(stage)
        for zoom, reach in [(10, AXIS[-1]), (12, 3600)]:
            corners = [point(x, z, zoom) for x in (-reach, reach) for z in (-reach, reach)]
            x, y = zip(*corners)
            for i in range(math.floor((min(x)-2)/256), math.floor((max(x)+2)/256)+1):
                for j in range(math.floor((min(y)-2)/256), math.floor((max(y)+2)/256)+1):
                    keys.add((zoom,i,j))
    return keys


def download(key, folder):
    zoom,x,y = key
    path = folder / f'{zoom}-{x}-{y}.png'
    for attempt in range(4):
        try:
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png'
            with urllib.request.urlopen(url, timeout=30) as response:
                contents = response.read()
            with Image.open(io.BytesIO(contents)) as image:
                image.verify()
            path.write_bytes(contents)
            return
        except OSError:
            if attempt == 3:
                raise
            time.sleep(1+attempt)


def validate_heights(values, stage, coarse):
    # The lower zoom Terrarium mosaics occasionally contain a cluster of
    # outliers inland. Use the independent coarser atlas to distinguish real
    # offshore bathymetry from negative inland heights, and replace gross spikes.
    source = mapping(stage)
    nw = len(AXIS)
    repaired = list(values)
    levels = [3500*(i/255)**1.6 for i in range(256)]
    for idx, value in enumerate(values):
        u,v = source(AXIS[idx % nw], AXIS[idx // nw], 8)
        u -= 200*256
        v -= 110*256
        i,j = math.floor(u),math.floor(v)
        f,t = u-i,v-j
        a = levels[coarse.getpixel((i,j))]*(1-f)+levels[coarse.getpixel((i+1,j))]*f
        b = levels[coarse.getpixel((i,j+1))]*(1-f)+levels[coarse.getpixel((i+1,j+1))]*f
        baseline = a*(1-t)+b*t
        if (baseline>5 and value<0) or abs(value-baseline)>max(650, baseline*.50):
            repaired[idx] = round(baseline)
    return repaired


def write_grid(heights, output):
    data = bytearray()
    for i,height in enumerate(heights):
        delta = height-(heights[i-1] if i%len(AXIS) else 0)
        value = 2*delta if delta>=0 else -2*delta-1
        while value>=128:
            data.append((value&127)|128)
            value >>= 7
        data.append(value)
    payload = base64.b64encode(data).decode('ascii')
    output.write_text('window.loadStageRelief("'+payload+'");\n', encoding='ascii')


def bake(stage, folder, output, coarse):
    cache = {}
    def pixel(zoom,x,y):
        key = (zoom,x//256,y//256)
        if key not in cache:
            path = folder / ('%d-%d-%d.png' % key)
            cache[key] = Image.open(path).convert('RGB').load()
        r,g,b = cache[key][x%256,y%256]
        return r*256+g+b/256-32768

    @lru_cache(maxsize=65536)
    def filtered(zoom,x,y):
        center = pixel(zoom,x,y)
        near = sorted(pixel(zoom,x+i,y+j) for j in (-1,0,1) for i in (-1,0,1))
        median = near[4]
        # Some individual source pixels decode to impossible kilometre-high
        # spikes. Preserve genuine cliffs and bathymetry supported by neighbours.
        spread = sorted(abs(v-median) for v in near)[4]
        return median if abs(center-median) > max(80, 6*(spread+3)) else center

    point = mapping(stage)
    heights = []
    for z in AXIS:
        for x in AXIS:
            zoom = 12 if max(abs(x),abs(z))<=3600 else 10
            u,v = point(x,z,zoom)
            i,j = math.floor(u),math.floor(v)
            f,t = u-i,v-j
            a = filtered(zoom,i,j)*(1-f)+filtered(zoom,i+1,j)*f
            b = filtered(zoom,i,j+1)*(1-f)+filtered(zoom,i+1,j+1)*f
            heights.append(round(a*(1-t)+b*t))
    write_grid(validate_heights(heights,stage,coarse), output/(stage['id']+'.js'))


def main():
    text = (DIST/'mountain-stages.js').read_text(encoding='utf8')
    stages = json.loads(text.split('window.mountainStages=',1)[1].strip().rstrip(';'))
    output = DIST/'stage-terrain'
    output.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='taylai-dem-') as tmp:
        folder = Path(tmp)
        keys = sorted(tiles_for(stages))
        print(f'{len(keys)} elevation tiles for {len(stages)} courses', flush=True)
        with ThreadPoolExecutor(max_workers=12) as pool:
            list(pool.map(lambda key:download(key,folder),keys))
        coarse = Image.open(DIST/'streetscape/surfaces/vietnam-elevation.png').convert('L')
        for stage in stages:
            bake(stage,folder,output,coarse)
        print('Baked', len(stages),'terrain grids', flush=True)


if __name__ == '__main__':
    main()
