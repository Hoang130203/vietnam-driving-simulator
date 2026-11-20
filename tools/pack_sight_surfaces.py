"""Pack the existing elevation and vegetation pages for ViVu3D.

Run from any directory with Python, numpy, Pillow (libwebp) and Node. Each
source PNG stays intact. R and G still encode integer metres plus 128, and B
is still a vegetation index, so older image readers can use the same pages.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
import math
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'dist' / 'sight-landscapes'
GRID, SIZE = 32, 96
# Water, then the 158, strictly-above-178 and 204 placement tests in world-scene.
CLASS = np.searchsorted([0, 1, 157, 178, 203], np.arange(256)).astype('uint8')
COVER = np.array([0, 1, 128, 160, 192, 224], dtype='uint8')[CLASS]


def stops():
    extract = r"""const fs=require('fs');global.window=global;
    const scripts=Array.from(fs.readFileSync('dist/index.html','utf8').matchAll(/src="([^"]+\.js)"/g),m=>m[1]);
    for(const file of scripts.slice(scripts.indexOf('tourism-catalog.js'),scripts.indexOf('vietnam-landmarks.js')+1))
      require('./dist/'+file);
    console.log(JSON.stringify([...VietnamTourism.entries,...VietnamLandmarks.entries]
      .flatMap(p=>[[p.lon,p.lat],p.start]).filter(p=>p?.every(Number.isFinite))));"""
    return json.loads(subprocess.check_output(['node', '-e', extract], cwd=ROOT))


def sample_positions(index, coordinates):
    """Locate the four original sample centres for each bilinear interpolation."""
    slots = {}
    for tag, cells in index.items():
        ox, oy = int(tag[4:]) * GRID, int(tag[1:3]) * GRID
        for n, (i, j) in enumerate(cells):
            slots[ox+i, oy+j] = (f'{tag}-{n//32}', n % 32)
    protected = defaultdict(set)
    covered = 0
    for lon, lat in coordinates:
        # Page rows point south; longitude and latitude cross page edges independently.
        left = math.floor(lon * GRID * SIZE - .5)
        top = math.floor(-lat * GRID * SIZE - .5)
        found = 0
        for y in (top, top+1):
            for x in (left, left+1):
                entry = slots.get((x//SIZE, -(y//SIZE)-1))
                if entry is None:
                    continue
                page, slot = entry
                protected[page].add((slot//8*SIZE + y % SIZE, slot%8*SIZE + x % SIZE))
                found += 1
        covered += found == 4
    return protected, covered


def pack_page(source, protected):
    target = source.with_suffix('.surface.webp')
    with Image.open(source) as image:
        if image.mode != 'RGB':
            raise ValueError(f'Unexpected surface mode in {source}: {image.mode}')
        original = np.array(image)
    before = original[:, :, 2]
    height = original[:, :, 0].astype('int32') * 256 + original[:, :, 1] - 128
    rounded = np.clip((height + 1) // 3 * 3, -128, 65407)
    rounded[before <= 1] = height[before <= 1]
    if protected:
        yy, xx = np.asarray(list(protected)).T
        rounded[yy, xx] = height[yy, xx]
    biased = rounded + 128
    packed = np.stack([biased >> 8, biased & 255, COVER[before]], axis=-1).astype('uint8')
    encoded = BytesIO()
    Image.fromarray(packed).save(encoded, 'WEBP', lossless=True, method=5)
    encoded.seek(0)
    with Image.open(encoded) as image:
        decoded = np.array(image)
    if not np.array_equal(decoded, packed):
        raise ValueError(f'Lossless page did not round-trip: {target}')
    measured = decoded[:, :, 0].astype('int32') * 256 + decoded[:, :, 1] - 128
    error = np.abs(measured - height)
    if error.max() > 1 or np.any(error[before <= 1]) or (protected and np.any(error[yy, xx])):
        raise ValueError(f'Elevation bound exceeded in {source}')
    if not np.array_equal(CLASS[before], CLASS[decoded[:, :, 2]]):
        raise ValueError(f'A coverage threshold changed in {source}')
    tmp = target.with_suffix('.webp.tmp')
    try:
        tmp.write_bytes(encoded.getvalue())
        tmp.replace(target)
    finally:
        tmp.unlink(missing_ok=True)
    return (source.stat().st_size, target.stat().st_size, height.size,
            int(error.sum()), int(error.max()), len(protected))


def pack_pages(directory, index, coordinates, jobs=6):
    protected, covered = sample_positions(index, coordinates)
    pages = [directory / f'{tag}-{n}.png' for tag, cells in sorted(index.items())
             for n in range((len(cells) + 31) // 32)]
    with ThreadPoolExecutor(max_workers=jobs) as workers:
        results = list(workers.map(pack_page, pages, (protected[p.stem] for p in pages)))
    source, packed, samples, total_error, _, fixed = np.sum(results, axis=0)
    print(f'{len(pages)} pages, {source:,} to {packed:,} bytes')
    print(f'{samples:,} classifications exact, mean absolute height error '
          f'{total_error / samples:.5f} m, max {max(row[4] for row in results)} m')
    print(f'{covered:,}/{len(coordinates):,} anchors covered by source, '
          f'{fixed:,} exact bilinear samples')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--jobs', type=int, default=6)
    args = parser.parse_args()
    index = json.loads((args.directory / 'index.json').read_text(encoding='utf8'))
    pack_pages(args.directory, index, stops(), args.jobs)


if __name__ == '__main__':
    main()
