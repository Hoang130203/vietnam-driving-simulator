"""Bake the native-resolution Sentinel-2 ground colour at each landmark and road approach.

Uses the same public WorldCover composite, exposure and credits as build_sight_landscapes.
The wider landscape colour remains visible beyond these local patches.
"""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image

from build_sight_landscapes import ROOT, read_cells, stops


GRID, SIZE = 128, 96
OUTPUT = ROOT/'dist/sight-imagery'


def build(degree,cells,workers):
    lon,lat=degree
    tag=f'N{lat:02}E{lon:03}'
    url=(f'https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/N{lat:02}/'
         f'ESA_WorldCover_10m_2021_v200_{tag}_S2RGBNIR.tif')
    with TemporaryDirectory() as folder:
        data=read_cells(url,Path(folder)/'reflectance.tif',cells,0,workers,True,GRID,SIZE)
    cells=sorted(k for k in data if data[k].any())
    for start in range(0,len(cells),32):
        page=cells[start:start+32]
        image=Image.new('RGBA',(min(8,len(page))*SIZE,math.ceil(len(page)/8)*SIZE))
        for i,key in enumerate(page):
            values=data[key]
            linear=np.moveaxis(values[:3],0,-1).astype('float32')/3700
            rgb=np.uint8(np.clip(1.055*np.maximum(0,linear)**(1/2.4)-.055,0,1)*255)
            alpha=values.any(axis=0).astype('uint8')*255
            image.paste(Image.fromarray(np.dstack((rgb,alpha))),((i%8)*SIZE,(i//8)*SIZE))
        image.save(OUTPUT/f'{tag}-{start//32}.webp',quality=89,method=5)
    print(tag,len(cells),flush=True)
    return tag,[[x%GRID,y%GRID] for x,y in cells]


def main():
    degrees=defaultdict(set)
    for lon,lat in stops():
        for x in range(math.floor((lon-.0015)*GRID),math.floor((lon+.0015)*GRID)+1):
            for y in range(math.floor((lat-.0015)*GRID),math.floor((lat+.0015)*GRID)+1):
                degrees[x//GRID,y//GRID].add((x,y))
    OUTPUT.mkdir(exist_ok=True)
    with ThreadPoolExecutor(18) as workers, ThreadPoolExecutor(6) as batches:
        jobs=[batches.submit(build,degree,cells,workers) for degree,cells in sorted(degrees.items())]
        index=dict(job.result() for job in jobs)
    (OUTPUT/'index.json').write_text(json.dumps(index,separators=(',',':')),encoding='utf8')


if __name__=='__main__':
    main()
