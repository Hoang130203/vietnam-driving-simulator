"""Build the offline geographic context. Requires numpy, rasterio, requests and tifffile.

Run from any directory. --population accepts the original Vietnam WorldPop GeoTIFF
to avoid downloading it again. The WorldCover COGs support unsigned byte ranges.
"""
from argparse import ArgumentParser
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import gzip
import json

import numpy as np
import rasterio
from rasterio.windows import Window, from_bounds
import requests
from requests.adapters import HTTPAdapter
import tifffile
from urllib3.util.retry import Retry


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'dist/vn-environment'
POP_URL = ('https://data.worldpop.org/GIS/Population/Global_2015_2030/R2025A/2025/VNM/'
           'v1/100m/constrained/vnm_pop_2025_CN_100m_R2025A_v1.tif')
COVER_URL = ('https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/'
             'ESA_WorldCover_10m_2021_v200_N{:02}E{:03}_Map.tif')
POP_SIZE = 300    # Each sample averages sixteen source cells at three arc seconds.
COVER_SIZE = 1200  # 1.5 arc seconds per sample, half-degree tiles.


def client():
    session = requests.Session()
    retry = Retry(total=4, backoff_factor=.75, status_forcelist=(429, 500, 502, 503, 504))
    session.mount('https://', HTTPAdapter(max_retries=retry))
    return session


def byte_range(session, url, start, end):
    with session.get(url, headers={'Range': f'bytes={start}-{end}'}, timeout=(20, 100)) as res:
        if res.status_code == 404:
            return None
        res.raise_for_status()
        if res.status_code != 206 or len(res.content) != end - start + 1:
            raise ValueError(f'Invalid range response for {url}: {start}-{end}')
        return res.content


def cover_overview(session, work, lon, lat):
    """Retrieve the ~40 m overview of a 3° tile, without the full 10 m source."""
    url = COVER_URL.format(lat, lon)
    header = byte_range(session, url, 0, 262143)
    if header is None:
        return None
    with tifffile.TiffFile(BytesIO(header)) as tif:
        page = tif.pages[2]
        if page.shape != (9000, 9000):
            raise ValueError(f'Unexpected WorldCover grid in {url}')
        first = min(page.dataoffsets)
        last = max(p + n for p, n in zip(page.dataoffsets, page.databytecounts))
    data = byte_range(session, url, first, last - 1)
    path = work / f'cover-{lon}-{lat}.tif'
    with path.open('wb') as out:
        out.write(header)
        out.seek(first)
        out.write(data)
    return path


def population_grid(src, x, y):
    # Sample a 2x2 stride on the source raster, averaging a 4x4 neighbourhood
    # around each result. The one-cell halo makes smoothing continuous at tile edges.
    r, c = src.index(x / 2 + 0.5 / 1200, (y + 1) / 2 - 0.5 / 1200)
    values = src.read(1, window=Window(c - 1, r - 1, POP_SIZE * 2 + 2, POP_SIZE * 2 + 2),
                      boundless=True, fill_value=src.nodata)
    valid = np.isfinite(values) & (values >= 0)
    values[~valid] = 0
    average = np.zeros((POP_SIZE, POP_SIZE), dtype='float32')
    available = np.zeros((POP_SIZE, POP_SIZE), dtype=bool)
    for dy in range(4):
        for dx in range(4):
            cells = np.s_[dy:dy+2*POP_SIZE:2, dx:dx+2*POP_SIZE:2]
            average += values[cells] / 16
            available |= valid[cells]
    encoded = np.minimum(254, np.rint(20 * np.log2(1 + average))).astype('uint8') + 1
    encoded[~available] = 0
    return encoded


def pack_group(args):
    (lon, lat), tiles, work, population, destination = args
    with client() as session:
        cog = cover_overview(session, work, lon, lat)
    cover = rasterio.open(cog, overview_level=1) if cog else None
    try:
        with rasterio.open(population) as people:
            for x, y in sorted(tiles):
                density = population_grid(people, x, y)
                if cover:
                    window = from_bounds(x / 2, y / 2, (x + 1) / 2, (y + 1) / 2, cover.transform)
                    classes = cover.read(1, window=window, out_shape=(COVER_SIZE, COVER_SIZE))
                else:
                    classes = np.zeros((COVER_SIZE, COVER_SIZE), dtype='uint8')
                packed = gzip.compress(density.tobytes() + classes.tobytes(), compresslevel=6, mtime=0)
                (destination / f'{x}_{y}.gz').write_bytes(packed)
    finally:
        if cover:
            cover.close()
    print(f'{lon}E {lat}N: {len(tiles)} tiles', flush=True)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--population', type=Path)
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    roads = json.loads((ROOT / 'dist/vn-roads/index.json').read_text(encoding='utf8'))
    tiles = set()
    for key in roads['tiles']:
        x, y = map(int, key.split('_'))
        tiles.add((x // 2, y // 2))
    groups = defaultdict(list)
    for x, y in tiles:
        groups[x // 6 * 3, y // 6 * 3].append((x, y))
    args.output.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='vn-environment-build-') as tmp:
        work = Path(tmp)
        population = args.population
        if population is None:
            population = work / 'population.tif'
            with client() as session, session.get(POP_URL, stream=True, timeout=(20, 120)) as response:
                response.raise_for_status()
                with population.open('wb') as dest:
                    for chunk in response.iter_content(chunk_size=1024*1024):
                        dest.write(chunk)
        # Publish the manifest after every referenced tile has been generated.
        staging = work / 'tiles'
        staging.mkdir()
        with ThreadPoolExecutor(5) as pool:
            list(pool.map(pack_group, [(key, group, work, population, staging) for key, group in sorted(groups.items())]))
        keys = [f'{x}_{y}' for x, y in sorted(tiles)]
        index = {'grid': 2, 'populationSize': POP_SIZE, 'coverSize': COVER_SIZE, 'tiles': keys,
                 'worldPopYear': 2025, 'worldCoverYear': 2021}
        # Replace via a sibling temp file, including when staging is on another drive.
        for key in keys:
            path = args.output / f'{key}.gz'
            pending = path.with_suffix('.part')
            pending.write_bytes((staging / path.name).read_bytes())
            pending.replace(path)
        manifest = args.output / 'index.json'
        pending = manifest.with_suffix('.part')
        pending.write_text(json.dumps(index, separators=(',', ':')) + '\n', encoding='utf8')
        pending.replace(manifest)


if __name__ == '__main__':
    main()
