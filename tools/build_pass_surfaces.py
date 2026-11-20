"""Bake the six scenic passes' geographic albedo, in the stage's local X/Z frame.

Input: ESA WorldCover 2021 Sentinel-2 RGBNIR median composite, bundled
WorldCover classes and OSM water. Credits in dist/streetscape/CREDITS.txt
and dist/vn-environment/CREDITS.txt. Uses the same build dependencies as
build_sight_landscapes.py. Optional arguments select individual stage IDs.
"""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import gzip
import json
import math
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from build_sight_landscapes import read_cells


DIST = Path(__file__).resolve().parents[1] / 'dist'
PASSES = ('deo-hai-van', 'deo-ma-pi-leng', 'deo-khau-pha', 'deo-o-quy-ho', 'deo-pha-din', 'deo-ngoan-muc')
SIZE, SPAN = 1024, 9600
# Each 1° satellite tile is 12000x12000. A cached subdivision is 375x375.
DIVISIONS, CELL = 32, 375


def footprint(stage):
    """Pixel centres in WGS84 with row zero on the stage's forward side."""
    lat = stage['start'][1]
    theta = math.radians(stage['bearing'])
    cs, sn = math.cos(theta), math.sin(theta)
    scale = 111320 * math.cos(math.radians(lat))
    axis = ((np.arange(SIZE) + .5) / SIZE - .5) * SPAN
    x, z = np.meshgrid(axis, axis)
    lon = stage['start'][0] + (cs*x-sn*z)/scale
    latitude = lat - (sn*x+cs*z)/110900

    def to_pixel(lng, north):
        east, south = (lng - stage['start'][0])*scale, (lat-north)*110900
        return ((east*cs+south*sn)/SPAN+.5)*SIZE, ((south*cs-east*sn)/SPAN+.5)*SIZE

    return lon, latitude, to_pixel


def tile_bounds(lon, lat, grid):
    return (math.floor(lon.min()*grid), math.floor(lat.min()*grid),
            math.floor(lon.max()*grid), math.floor(lat.max()*grid))


def satellite(lon, lat):
    x0, y0, x1, y1 = tile_bounds(lon, lat, DIVISIONS)
    groups = defaultdict(list)
    for x in range(x0, x1+1):
        for y in range(y0, y1+1):
            groups[x//DIVISIONS, y//DIVISIONS].append((x, y))
    mosaic = np.zeros(((y1-y0+1)*CELL, (x1-x0+1)*CELL, 4), dtype='uint16')
    with TemporaryDirectory(prefix='vivu-pass-s2-') as tmp, ThreadPoolExecutor(max_workers=10) as workers:
        for (lng, north), keys in groups.items():
            tag = f'N{north:02}E{lng:03}'
            url = (f'https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/N{north:02}/'
                   f'ESA_WorldCover_10m_2021_v200_{tag}_S2RGBNIR.tif')
            values = read_cells(url, Path(tmp)/f'{tag}.tif', keys, 0, workers, True, DIVISIONS, CELL)
            for (x,y), bands in values.items():
                i, j = (x-x0)*CELL, (y1-y)*CELL
                mosaic[j:j+CELL,i:i+CELL] = bands.transpose(1,2,0)
    u = np.clip((lon*DIVISIONS-x0)*CELL-.5, 0, mosaic.shape[1]-1.001)
    v = np.clip((y1+1-lat*DIVISIONS)*CELL-.5, 0, mosaic.shape[0]-1.001)
    i, j = u.astype(int), v.astype(int)
    fx, fy = (u-i)[...,None].astype('float32'), (v-j)[...,None].astype('float32')
    return ((mosaic[j,i]*(1-fx)+mosaic[j,i+1]*fx)*(1-fy) +
            (mosaic[j+1,i]*(1-fx)+mosaic[j+1,i+1]*fx)*fy)


def land_types(lon, lat):
    folder = DIST/'vn-environment'
    manifest = json.loads((folder/'index.json').read_text())
    grid, size = manifest['grid'], manifest['coverSize']
    x0, y0, x1, y1 = tile_bounds(lon, lat, grid)
    cover = np.zeros((SIZE,SIZE), dtype='uint8')
    for x in range(x0,x1+1):
        for y in range(y0,y1+1):
            path = folder/f'{x}_{y}.gz'
            if path.exists():
                raw = gzip.decompress(path.read_bytes())
                tile = np.frombuffer(raw,dtype='uint8',offset=manifest['populationSize']**2).reshape(size,size)
                u, v = lon*grid-x, lat*grid-y
                mask = (u>=0)&(u<1)&(v>=0)&(v<1)
                cover[mask] = tile[size-1-(v[mask]*size).astype(int), (u[mask]*size).astype(int)]
    return cover


def mapped_water(lon, lat, to_pixel):
    x0, y0, x1, y1 = tile_bounds(lon, lat, 4)
    mask = Image.new('L',(SIZE,SIZE))
    draw = ImageDraw.Draw(mask)
    for x in range(x0,x1+1):
        for y in range(y0,y1+1):
            path = DIST/'vn-water'/f'{x}_{y}.gz'
            if not path.exists():
                continue
            for kind, name, coords in json.loads(gzip.decompress(path.read_bytes())):
                points = [to_pixel(a/1e5,b/1e5) for a,b in zip(coords[::2],coords[1::2])]
                if kind == 'lake':
                    draw.polygon(points,fill=255)
                else:
                    # Narrow centre lines fill gaps between mapped bank polygons.
                    draw.line(points,fill=190,width=2)
    return np.asarray(mask.filter(ImageFilter.GaussianBlur(.65)),dtype='float32')/255


def bake(stage):
    lon, lat, to_pixel = footprint(stage)
    bands = satellite(lon,lat)
    red, green, blue, ir = bands.transpose(2,0,1)
    # Remove a little aerosol haze. Lift broad shadows to let the game's
    # light model describe the slopes while retaining fine canopy variation.
    linear = np.maximum(0,bands[:,:,:3]-[28,40,75])/4450
    rgb = np.clip(1.055*linear**(1/2.4)-.055,0,1)*255
    light = rgb @ [.25,.64,.11]
    smooth = np.asarray(Image.fromarray(light.astype('uint8')).filter(ImageFilter.GaussianBlur(28)))
    rgb *= np.clip((92/(smooth+1))**.38,.81,1.25)[...,None]
    cover = land_types(lon,lat)
    palette = {0:(69,96,78),10:(55,83,58),20:(91,105,63),30:(119,129,75),
               40:(143,140,81),50:(142,134,118),60:(150,139,121),70:(218,224,220),
               80:(46,100,105),90:(90,119,86),95:(61,105,74),100:(112,126,92)}
    colors = np.zeros((256,3),dtype='uint8')
    for code, tint in palette.items():
        colors[code] = tint
    tint = np.asarray(Image.fromarray(colors[cover]).filter(ImageFilter.GaussianBlur(2.2)))
    rgb = np.where((bands.max(axis=2)>0)[...,None],.80*rgb+.20*tint,tint)
    # Use the imagery to locate narrow coves and banks between 45 m classes.
    spectral = np.clip((green-ir*.98)/np.maximum(70,green)*3,0,1)
    lakes = mapped_water(lon,lat,to_pixel)
    water = np.maximum(lakes,np.where(cover==80,np.maximum(.38,spectral),spectral*.86))
    aqua = np.stack((36+.13*rgb[:,:,0],75+.28*rgb[:,:,1],80+.28*rgb[:,:,2]),axis=-1)
    rgb += (aqua-rgb)*water[...,None]*.88
    output = DIST/'pass-surfaces'
    output.mkdir(exist_ok=True)
    final = output/(stage['id']+'.webp')
    Image.fromarray(np.uint8(np.clip(rgb,0,255))).save(final,quality=88,method=6)
    print(stage['id'], final.stat().st_size, flush=True)


if __name__ == '__main__':
    text = (DIST/'mountain-stages.js').read_text(encoding='utf8')
    stages = {s['id']:s for s in json.loads(text.split('window.mountainStages=',1)[1].strip().rstrip(';'))}
    for key in sys.argv[1:] or PASSES:
        bake(stages[key])
