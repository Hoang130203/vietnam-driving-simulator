"""Draw the featured passes from the shipped OSM courses and Terrarium grids.

Run with Python and Pillow. Optionally pass one or more stage IDs to rebuild.
The plates face geographic north. A ring marks the start and a diamond the finish.
"""
import argparse
import base64
import gzip
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


DIST = Path(__file__).resolve().parents[1] / "dist"
SIZE = (1080, 660)
# Low valleys, middle slopes, and high ridges in each print.
PALETTES = {
    "deo-hai-van": ("244c4b", "68846e", "d5c896"),
    "deo-ma-pi-leng": ("294746", "738377", "ddd5b6"),
    "deo-khau-pha": ("314c44", "8b995c", "e1c181"),
    "deo-o-quy-ho": ("253d4a", "6e8f94", "d0d9c5"),
    "deo-pha-din": ("39493f", "89936e", "d9b991"),
    "deo-ngoan-muc": ("37443c", "92916b", "dfb486"),
}


def stage_grid(slug):
    source = (DIST / "stage-terrain" / f"{slug}.js").read_text("ascii")
    payload = base64.b64decode(source.split('"')[1])
    values, last, shift, delta = [], 0, 0, 0
    for byte in payload:
        delta |= (byte & 127) << shift
        if byte >= 128:
            shift += 7
            continue
        if len(values) % 211 == 0:
            last = 0
        last += -(delta // 2 + 1) if delta & 1 else delta // 2
        values.append(last)
        shift, delta = 0, 0
    if len(values) != 211**2:
        raise ValueError(f"Invalid elevation grid for {slug}")
    grid = Image.new("F", (211, 211))
    grid.putdata(values)
    return grid


def grid_index(metres):
    radius = abs(metres)
    if radius <= 3600:
        cell = radius / 50
    elif radius <= 6200:
        cell = 72 + (radius - 3600) / 200
    else:
        cell = 85 + (min(radius, 15200) - 6200) / 450
    return 105.5 + math.copysign(cell, metres)


class Plate:
    """North-up sheet coordinates in metres east and south of the start."""

    def __init__(self, stage):
        self.stage = stage
        self.points = [(0, 0)]
        for angle in stage["angles"]:
            heading = math.radians(stage["bearing"] + angle)
            x, y = self.points[-1]
            self.points.append((x + math.sin(heading) * stage["step"],
                                y - math.cos(heading) * stage["step"]))
        xs, ys = zip(*self.points)
        mid_x, mid_y = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        self.metres = max(4.0, (max(xs)-min(xs)) / (SIZE[0]*.66),
                         (max(ys)-min(ys)) / (SIZE[1]*.66))
        if stage["id"] == "deo-hai-van":
            # Keep the headland and the sea in the same frame as the hairpins.
            self.metres = 5.4
            mid_x += 560
            mid_y -= 220
        self.west = mid_x - self.metres * SIZE[0] / 2
        self.north = mid_y - self.metres * SIZE[1] / 2
        self.mx = 111320 * math.cos(math.radians(stage["start"][1]))

    def pixel(self, east, south):
        return ((east-self.west) / self.metres, (south-self.north) / self.metres)

    def geographic_pixel(self, lon, lat):
        start_lon, start_lat = self.stage["start"]
        return self.pixel((lon-start_lon)*self.mx, (start_lat-lat)*110900)

    def height_image(self):
        bearing = math.radians(self.stage["bearing"])
        cs, sn = math.cos(bearing), math.sin(bearing)

        def sample(px, py):
            east = self.west + px * self.metres
            south = self.north + py * self.metres
            return (4*grid_index(cs*east + sn*south), 4*grid_index(-sn*east + cs*south))

        patches = []
        for top in range(0, SIZE[1], 20):
            for left in range(0, SIZE[0], 20):
                right, bottom = min(SIZE[0], left+20), min(SIZE[1], top+20)
                corners = (sample(left, top), sample(left, bottom),
                           sample(right, bottom), sample(right, top))
                patches.append(((left, top, right, bottom), sum(corners, ())))
        grid = stage_grid(self.stage["id"])
        grid = grid.resize((grid.width*4,grid.height*4), Image.Resampling.BICUBIC)
        return grid.transform(SIZE, Image.Transform.MESH, patches, Image.Resampling.BILINEAR)

    def cover_masks(self):
        """Ink for forest, fields and water from the local ESA WorldCover mosaic."""
        start_lon, start_lat = self.stage["start"]
        west = (start_lon+self.west/self.mx)*2
        north = (start_lat-self.north/110900)*2
        east = west+2*SIZE[0]*self.metres/self.mx
        south = north-2*SIZE[1]*self.metres/110900
        left, top = math.floor(west), math.floor(north)
        nx, ny = math.floor(east)-left+1, top-math.floor(south)+1
        classes = Image.new("L",(1200*nx,1200*ny))
        for column in range(nx):
            for row in range(ny):
                path = DIST/"vn-environment"/f"{left+column}_{top-row}.gz"
                if path.exists():
                    raw = gzip.decompress(path.read_bytes())[300**2:]
                    classes.paste(Image.frombytes("L",(1200,1200),raw), (1200*column,1200*row))
        bounds = ((west-left)*1200,(top+1-north)*1200,
                  (east-left)*1200,(top+1-south)*1200)
        for code in (10,40,80):
            yield classes.point(lambda c: 255 if c == code else 0).transform(
                SIZE, Image.Transform.EXTENT, bounds, Image.Resampling.BILINEAR)

    def map_features(self, directory):
        start_lon, start_lat = self.stage["start"]
        west = start_lon + self.west/self.mx
        east = west + SIZE[0]*self.metres/self.mx
        north = start_lat - self.north/110900
        south = north - SIZE[1]*self.metres/110900
        for x in range(math.floor(west*4), math.floor(east*4)+1):
            for y in range(math.floor(south*4), math.floor(north*4)+1):
                for path in sorted((DIST/directory).glob(f"{x}_{y}*.gz")):
                    with gzip.open(path) as handle:
                        for row in json.load(handle):
                            coords = row[-1]
                            xx, yy = coords[::2], coords[1::2]
                            if (max(xx) < west*1e5 or min(xx) > east*1e5 or
                                    max(yy) < south*1e5 or min(yy) > north*1e5):
                                continue
                            yield row, [self.geographic_pixel(a/1e5, b/1e5)
                                        for a,b in zip(xx,yy)]


def gradient(names):
    palette = [bytes.fromhex(name) for name in names]
    result = []
    for i in range(256):
        segment = 0 if i < 128 else 1
        f = i/127 if segment == 0 else (i-128)/127
        result.extend(round(a+(b-a)*f) for a,b in zip(palette[segment],palette[segment+1]))
    return result


def draw_relief(plate):
    heights = plate.height_image()
    width, height = SIZE
    lo, hi = heights.getextrema()
    levels = heights.point(lambda h: (h-lo)*255/(hi-lo)).convert("L")
    # Clip the tails of the histogram so small summit and water pixels do not
    # flatten the rest of the hillshade.
    cumulative = 0
    histogram = levels.histogram()
    floor = 0
    for i, count in enumerate(histogram):
        cumulative += count
        if cumulative < width*height*.018:
            floor = i
        if cumulative >= width*height*.985:
            ceiling = i
            break
    ink = levels.point(lambda k: (k-floor)*255/max(1,ceiling-floor))
    ink.putpalette(gradient(PALETTES[plate.stage["id"]]))
    land = ink.convert("RGB")

    # Direct light comes across the terrain from the north-west. The broad
    # local relief term keeps deep valleys visible at thumbnail sizes.
    broad = levels.filter(ImageFilter.GaussianBlur(29))
    soft = ImageChops.subtract(levels, broad, scale=1, offset=128).load()
    dem = heights.load()
    relief, contour = (bytearray(width*height) for _ in range(2))
    spacing = 30 if hi-lo < 850 else 50
    for y in range(height):
        top, bottom = max(0,y-2), min(height-1,y+2)
        for x in range(width):
            k = y*width+x
            h = dem[x,y]
            dx = (dem[min(width-1,x+2),y] - dem[max(0,x-2),y])/(4*plate.metres)
            dy = (dem[x,bottom] - dem[x,top])/(4*plate.metres)
            slope = math.hypot(dx,dy)
            light = (.58*dx + .53*dy + .62) / math.sqrt(1+slope*slope)
            shade = 127 + 111*(light-.59) + (soft[x,y]-128)*.75
            relief[k] = min(255,max(0,round(shade)))
            contour_dist = abs(h - round(h/spacing)*spacing)
            major = round(h/spacing) % 5 == 0
            px_dist = contour_dist/max(.02,slope*plate.metres)
            contour[k] = int((82 if major else 51)*max(0,1-px_dist/(1.4 if major else 1.0)))
    shade = Image.frombytes("L",SIZE,bytes(relief)).convert("RGB")
    land = ImageChops.soft_light(land,shade)
    land.paste((26,42,40), mask=Image.frombytes("L",SIZE,bytes(contour)))

    forest, crops, water = plate.cover_masks()
    land.paste(ImageChops.multiply(land, Image.new("RGB",SIZE,(195,235,225))),
               mask=forest.point(lambda v:v*.48))
    land.paste(ImageChops.screen(land, Image.new("RGB",SIZE,(161,127,60))),
               mask=crops.point(lambda v:v*.38))
    water = water.filter(ImageFilter.GaussianBlur(2)).point(lambda v: max(0,min(255,(v-96)*4)))
    draw_water = ImageDraw.Draw(water)
    for row, points in plate.map_features("vn-water"):
        if row[0] == "lake":
            draw_water.polygon(points, fill=255)
        else:
            draw_water.line(points, fill=255, width=2)
    lake = Image.new("RGB", SIZE, (43,100,107))
    shore = ImageChops.subtract(water, water.filter(ImageFilter.GaussianBlur(11)))
    lake.paste((117,176,164),mask=shore)
    # Pale, concentric waterlining echoes the coast on traditional relief maps.
    for radius in (9,23,43):
        edge = water.filter(ImageFilter.GaussianBlur(radius))
        line = edge.point(lambda value: max(0,24-abs(value-196)*2))
        lake.paste((185,217,196),mask=line)
    land.paste(lake,mask=water)
    return land


def draw_route(image, plate):
    # Supersample the strokes and pins only, keeping the DEM bake lightweight.
    mask = Image.new("RGBA", (SIZE[0]*2,SIZE[1]*2))
    d = ImageDraw.Draw(mask)
    seen = set()
    for row, coords in plate.map_features("vn-roads"):
        if row[0] in seen:
            continue
        seen.add(row[0])
        d.line([(2*x,2*y) for x,y in coords], fill=(237,225,188,125),
               width=3 if row[4] in ("trunk","primary","secondary") else 2, joint="curve")
    coords = [tuple(2*v for v in plate.pixel(x,y)) for x,y in plate.points]
    d.line(coords,fill=(28,47,41,250),width=15,joint="curve")
    d.line(coords,fill=(255,226,148,255),width=8,joint="curve")
    x,y=coords[0]
    for r,colour in ((17,"#283f39"),(12,"#fff0ba"),(7,"#38574e")):
        d.ellipse((x-r,y-r,x+r,y+r),fill=colour)
    x,y=coords[-1]
    for r,colour in ((20,"#283f39"),(15,"#fff0ba"),(7,"#b36342")):
        d.polygon(((x,y-r),(x+r,y),(x,y+r),(x-r,y)),fill=colour)
    marks = mask.resize(SIZE, Image.Resampling.LANCZOS)
    image.paste(marks,mask=marks.getchannel("A"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stages",nargs="*",metavar="STAGE")
    args = parser.parse_args()
    source = (DIST/"mountain-stages.js").read_text("utf8")
    manifest = {stage["id"]: stage for stage in json.loads(source.split("window.mountainStages=")[1].strip().rstrip(";"))}
    output = DIST/"pass-plates"
    output.mkdir(exist_ok=True)
    for slug in args.stages or PALETTES:
        plate = Plate(manifest[slug])
        image = draw_relief(plate)
        draw_route(image,plate)
        image.save(output/f"{slug}.webp",quality=90,method=6)
        print(slug,flush=True)


if __name__ == "__main__":
    main()
