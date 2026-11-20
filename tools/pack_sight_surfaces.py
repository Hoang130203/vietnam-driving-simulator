"""Pack the existing elevation and vegetation pages for ViVu3D.

Run from any directory with Python, Pillow (libwebp) and numpy. The originals
and all water and satellite-colour images are retained. Each output is decoded
and checked against its source before the previous output is replaced.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import json
from pathlib import Path

import numpy as np
from PIL import Image


DIRECTORY = Path(__file__).resolve().parents[1] / 'dist' / 'sight-landscapes'
# The renderer tests water, then vegetation at 158, strictly above 178, and
# at 204. Keep these decisions exact when reducing the vegetation palette.
BANDS = ((2, 157), (158, 178), (179, 203), (204, 255))
CLASS = np.searchsorted([0, 1, 157, 178, 203], np.arange(256)).astype('uint8')


def vegetation_palette():
    # Every input vegetation index has a representative within eight units.
    # Multiples of eight also compress efficiently beside the byte-exact DEM.
    levels = np.array([8, 24, 40, 56, 72, 88, 104, 120, 136, 152,
                       160, 176, 184, 200, 208, 224, 240, 248])
    table = np.arange(256, dtype='uint8')
    for first, last in BANDS:
        values = np.arange(first, last + 1)
        available = levels[(levels >= first) & (levels <= last)]
        table[values] = available[np.abs(values[:, None] - available).argmin(axis=1)]
    return table


COVER = vegetation_palette()


def pack_page(source):
    target = source.with_suffix('.surface.webp')
    with Image.open(source) as image:
        if image.mode != 'RGB':
            raise ValueError(f'Unexpected surface mode in {source}: {image.mode}')
        original = np.array(image)
    packed = original.copy()
    packed[:, :, 2] = COVER[original[:, :, 2]]
    encoded = BytesIO()
    Image.fromarray(packed).save(encoded, 'WEBP', lossless=True, method=5)
    encoded.seek(0)
    with Image.open(encoded) as image:
        decoded = np.array(image)
    if not np.array_equal(decoded, packed):
        raise ValueError(f'Lossless page did not round-trip: {target}')
    before, after = original[:, :, 2], decoded[:, :, 2]
    if not np.array_equal(original[:, :, :2], decoded[:, :, :2]) or not np.array_equal(CLASS[before], CLASS[after]):
        raise ValueError(f'Elevation, no-data or a cover threshold changed in {source}')
    error = np.abs(before.astype('int16') - after)
    valid = before > 1
    tmp = target.with_suffix('.webp.tmp')
    try:
        tmp.write_bytes(encoded.getvalue())
        tmp.replace(target)
    finally:
        tmp.unlink(missing_ok=True)
    return (source.stat().st_size, target.stat().st_size, before.size,
            int(valid.sum()), int(error[valid].sum()), int(error.max()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--jobs', type=int, default=6)
    args = parser.parse_args()
    index = json.loads((args.directory / 'index.json').read_text(encoding='utf8'))
    pages = [args.directory / f'{tag}-{page}.png' for tag, slots in sorted(index.items())
             for page in range((len(slots) + 31) // 32)]
    with ThreadPoolExecutor(max_workers=args.jobs) as workers:
        results = list(workers.map(pack_page, pages))
    source, packed, samples, vegetated, total_error, _ = np.sum(results, axis=0)
    print(f'{len(pages)} pages, {source:,} to {packed:,} bytes')
    print(f'{samples:,} sample heights and classifications verified exactly')
    print(f'Vegetation index absolute error: mean {total_error / max(vegetated, 1):.3f}, '
          f'max {max(row[-1] for row in results)} cover units')


if __name__ == '__main__':
    main()
