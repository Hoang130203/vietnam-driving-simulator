"""Build the offline visitor atlas from the Geofabrik Vietnam PBF and bundled road tiles.

Install osmium and shapely, then run: python tools/build_vn_tourism.py vietnam.osm.pbf
Coordinates, names and references © OpenStreetMap contributors, ODbL 1.0.
"""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata

import osmium
from shapely import STRtree, from_wkb
from shapely.geometry import LineString, Point
from shapely.ops import polygonize


TAGS = {
    "tourism": {"museum": "Bảo tàng", "attraction": "Tham quan", "viewpoint": "Điểm ngắm cảnh",
                "gallery": "Phòng trưng bày", "theme_park": "Công viên", "zoo": "Vườn thú",
                "aquarium": "Thủy cung"},
    "historic": {"monument": "Di tích", "memorial": "Di tích", "castle": "Thành cổ",
                 "archaeological_site": "Khảo cổ", "fort": "Thành cổ", "temple": "Đền chùa",
                 "ruins": "Di tích", "building": "Kiến trúc", "tomb": "Lăng mộ", "tower": "Di tích"},
    "natural": {"beach": "Bãi biển", "cave_entrance": "Hang động", "peak": "Đỉnh núi", "bay": "Vịnh"},
    "water": {"lake": "Hồ"},
    "leisure": {"nature_reserve": "Khu bảo tồn"},
    "waterway": {"waterfall": "Thác nước"},
    "boundary": {"national_park": "Vườn quốc gia"},
    "amenity": {"place_of_worship": "Công trình tín ngưỡng"},
    "man_made": {"lighthouse": "Hải đăng"}
}
GROUPS = {
    "Bắc Bộ": "Cao Bằng|Điện Biên|Hà Nội|Hải Phòng|Lai Châu|Lạng Sơn|Lào Cai|Sơn La|Tuyên Quang|Thái Nguyên|Bắc Ninh|Phú Thọ|Hưng Yên|Quảng Ninh|Ninh Bình",
    "Trung Bộ": "Thanh Hóa|Nghệ An|Hà Tĩnh|Quảng Trị|Huế|Đà Nẵng|Quảng Ngãi|Gia Lai|Đắk Lắk|Khánh Hòa|Lâm Đồng",
    "Nam Bộ": "Đồng Nai|Tây Ninh|Hồ Chí Minh|Đồng Tháp|Vĩnh Long|Cần Thơ|An Giang|Cà Mau"
}
REGIONS = {p: r for r, names in GROUPS.items() for p in names.split("|")}
HIGHLIGHTS = set("vinh ha long|ho ba be|ho tuyen lam|ho xuan huong|ho nui coc|ho thac ba|ho lak|ho tay|ho hoan kiem|vinh lan ha|vinh vinh hy|vinh nha trang|phong nha|trang an|bich dong|tam coc|thac ban gioc|thac dray nur|thac pongour|mui ca mau|nha tu con dao|lang co duong lam|den hung|cau rong|chua cau|dinh doc lap|pho co dong van|thanh nha ho|kinh thanh hue|ngo mon|thanh dia my son|thap ba ponagar|chua thien mu".split("|"))
# Broad, user-defined OSM attraction/viewpoint tags also contain shops and directions.
# Require a recognizable feature name or independent heritage/Wikidata reference.
FEATURE = re.compile(r"\b(chua|dinh|thanh|doi|tham|dam|dao|dia dao|ho|cho|cot|dai|hoang cung|dien|lang|phu|tuong|nh[aà]|ph[oó]|vien|ke|khe|gieng|khu du lich|khu di tich|goc ngam|ghenh|nui|cong|hang|dong|mieu|bai|hon|thap|thac|vien|suoi|deo|cau|rung|bao tang|di tich|buon|ban|hai dang|vung|thung lung|vung tau|mui|vach da|quang truong|da chong|thanh dia|den|chung vien|vuon)\b")
SPAM = re.compile(r"(http|www\.|\.com\b|karaoke|casino|rent land|vip game|small hole|fork road|no fee|motorbike rental|close[d]?\?|sales office|noi that|cong ty|tnhh|shop\b|homestay|bag rack repair|aucune attraction|take right|business|phong kham|massage| nha dat |bat dong san|duong vao|loi vao|back entrance)")
# Historic labels still found on some partially updated OSM boundary relations.
MERGED = {"Quảng Bình": "Quảng Trị", "Yên Bái": "Lào Cai", "Hòa Bình": "Phú Thọ"}


def normalize(name):
    return "".join(c for c in unicodedata.normalize("NFKD", name.lower().replace("đ", "d"))
                   if not unicodedata.combining(c)).strip()


def province_name(tags):
    name = tags.get("name:vi") or tags.get("name") or ""
    if not tags.get("ISO3166-2", "").startswith("VN-") or name.endswith(" cũ"):
        return None
    province = re.sub(r"^(Tỉnh|Thành phố) ", "", name)
    return MERGED.get(province, province)


def complete_clipped_provinces(source, provinces):
    """The country extract can clip outlying islands of a multipolygon while retaining its mainland ring."""
    missing = REGIONS.keys() - {name for name, _ in provinces}
    if not missing:
        return
    ways = defaultdict(set)
    for rel in osmium.FileProcessor(source, osmium.osm.RELATION).with_filter(osmium.filter.TagFilter(("admin_level","4"))):
        name = province_name(rel.tags)
        if name in missing:
            for member in rel.members:
                if member.type == 'w' and member.role == 'outer':
                    ways[member.ref].add(name)
    lines = defaultdict(list)
    for way in osmium.FileProcessor(source).with_locations().with_filter(
            osmium.filter.EntityFilter(osmium.osm.WAY)).with_filter(osmium.filter.IdFilter(ways.keys())):
        vertices = [(n.lon,n.lat) for n in way.nodes if n.location.valid()]
        if len(vertices)>=2:
            for name in ways[way.id]:
                lines[name].append(LineString(vertices))
    for name, segments in lines.items():
        provinces.extend((name,p.simplify(.00005)) for p in polygonize(segments))


def extract(source):
    pairs = [(key, value) for key, values in TAGS.items() for value in values]
    filters = osmium.filter.TagFilter(*pairs, ("admin_level", "4"))
    processor = osmium.FileProcessor(source).with_locations().with_areas(filters).with_filter(filters)
    factory = osmium.geom.WKBFactory()
    provinces, points = [], []
    for obj in processor:
        tags = obj.tags
        name = (tags.get("name:vi") or tags.get("name") or "").strip()
        if not name or len(name) > 110:
            continue
        if obj.is_area() and not obj.from_way() and tags.get("admin_level") == "4":
            province = province_name(tags)
            if province in REGIONS:
                polygon = from_wkb(factory.create_multipolygon(obj))
                provinces.append((province, polygon.simplify(.00005)))
            continue
        if obj.is_relation() or (obj.is_area() and obj.from_way()):
            continue
        kind = next((values[tags[k]] for k, values in TAGS.items()
                     if tags.get(k) in values), None)
        if not kind:
            continue
        linked = bool(tags.get("wikidata") or tags.get("wikipedia") or tags.get("heritage"))
        folded = normalize(name)
        highlight = folded in HIGHLIGHTS
        if SPAM.search(folded) or len(folded)<3:
            continue
        if kind in {"Hồ","Vịnh","Đỉnh núi","Khu bảo tồn"} and not (linked or highlight):
            continue
        if kind in {"Tham quan","Điểm ngắm cảnh"} and not (linked or highlight or FEATURE.search(folded)):
            continue
        if kind == "Công trình tín ngưỡng" and not (linked or folded.startswith(("chua ", "den ", "thap ", "nha tho ", "thanh that ", "dinh "))):
            continue
        if re.fullmatch(r"(view\s?point|museum|pagoda|beach|attraction|memorial|tuong dai|di tich|nghia trang liet si|chua|den|nha tho|bai bien|war memorial|tourist attraction|waterfall|hang dong)( \d+)?", folded):
            continue
        if tags.get("access") in {"no", "private", "military"}:
            continue
        if obj.is_node():
            x, y = obj.location.lon, obj.location.lat
            ref = f"node/{obj.id}"
        elif obj.is_way():
            vertices = [(n.lon, n.lat) for n in obj.nodes if n.location.valid()]
            if len(vertices) < 2:
                continue
            x = (min(a for a,b in vertices)+max(a for a,b in vertices))/2
            y = (min(b for a,b in vertices)+max(b for a,b in vertices))/2
            ref = f"way/{obj.id}"
        else:
            point = from_wkb(factory.create_multipolygon(obj)).representative_point()
            x, y, ref = point.x, point.y, f"relation/{obj.orig_id()}"
        rating = 8*highlight + 4*linked + (2 if kind in {"Bảo tàng","Thành cổ","Thác nước","Vườn quốc gia","Khảo cổ","Hang động","Hải đăng"} else 0)
        rating -= int(kind in {"Công trình tín ngưỡng","Điểm ngắm cảnh"})
        if tags.get("tourism") and tags.get("historic"):
            rating += 2
        points.append([rating, ref, name, kind, round(x,6), round(y,6), tags.get("wikidata","")])
    complete_clipped_provinces(source, provinces)
    return provinces, points


def road_tile(x, y, splits):
    bx, by = math.floor(x*4), math.floor(y*4)
    key = f"{bx}_{by}"
    n = splits.get(key)
    if n:
        key += f"_{math.floor((x*4-bx)*n)}_{math.floor((y*4-by)*n)}"
    return key


def build(source, roads):
    provinces, points = extract(source)
    print("Mapped province polygons:", sorted({name for name, _ in provinces}), flush=True)
    index = json.loads((roads/"index.json").read_text(encoding="utf8"))
    towns = json.loads((roads/"overview.json").read_text(encoding="utf8"))["places"]
    boundaries = STRtree([polygon for _, polygon in provinces])
    groups = defaultdict(list)
    for rating, ref, name, kind, x, y, wd in points:
        candidates = boundaries.query(Point(x,y), predicate="intersects")
        if len(candidates):
            province = provinces[min(candidates, key=lambda i: provinces[i][1].area)][0]
            groups[road_tile(x,y,index["splits"])].append((province,rating,ref,name,kind,x,y,wd))
    accessible = defaultdict(list)
    for tile, pois in groups.items():
        path = roads/(tile+".gz")
        if not path.is_file():
            continue
        scale = math.cos(math.radians(pois[0][6]))
        with gzip.open(path, "rt", encoding="utf8") as f:
            rows = json.load(f)
        # Never choose a motorway or limited-access ramp as a visitor arrival point.
        lines = [LineString([(x*scale/1e5,y/1e5) for x,y in zip(row[6][::2],row[6][1::2])])
                 for row in rows if row[4] not in {"motorway","trunk"} and not row[4].endswith("_link")]
        if not lines:
            continue
        street_index = STRtree(lines)
        for province,rating,ref,name,kind,x,y,wd in pois:
            local = Point(x*scale,y)
            street = lines[street_index.nearest(local)]
            position = street.interpolate(street.project(local))
            metres = local.distance(position)*111100
            if metres > 1100:
                continue
            accessible[province].append((rating,ref,name,kind,x,y,wd,
                                         round(position.x/scale,6),round(position.y,6),round(metres)))
    rows = []
    for province, pois in sorted(accessible.items()):
        names, seen_wd, grid, kinds = set(), set(), defaultdict(int), defaultdict(int)
        count = 0
        for rating,ref,name,kind,x,y,wd,sx,sy,dist in sorted(pois,key=lambda p:(-p[0],p[9],p[1])):
            cell = (math.floor(x*80),math.floor(y*80))
            norm = normalize(name)
            if count>=48 or norm in names or (wd and wd in seen_wd) or grid[cell]>=4 or kinds[kind]>=13:
                continue
            if any(normalize(r[1])==norm and abs(r[5]-x)<.01 and abs(r[6]-y)<.01 for r in rows):
                continue
            town = min(towns,key=lambda t:((t[1]-x)*math.cos(math.radians(y)))**2+(t[2]-y)**2)[0]
            rows.append([ref,name,province,town,kind,x,y,sx,sy,dist,REGIONS[province]])
            count += 1
            names.add(norm)
            if wd:
                seen_wd.add(wd)
            grid[cell]+=1
            kinds[kind]+=1
    return rows,index


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf", type=Path)
    parser.add_argument("--roads",type=Path,default=Path("dist/vn-roads"))
    parser.add_argument("--output",type=Path,default=Path("dist/tourism-catalog.js"))
    args = parser.parse_args()
    rows,index = build(args.pbf,args.roads)
    print(f"Selected {len(rows)} destinations in {len(set(r[2] for r in rows))} provinces",flush=True)
    compact = lambda v: json.dumps(v,ensure_ascii=False,separators=(",",":"))
    with args.pbf.open("rb") as f:
        digest = hashlib.file_digest(f, "sha256").hexdigest()
    content = """'use strict';
// Coordinates and names © OpenStreetMap contributors. Derived database under ODbL 1.0.
// Source https://download.geofabrik.de/asia/vietnam.html
// License https://opendatacommons.org/licenses/odbl/1-0/
window.VietnamTourism = {
"""
    metadata = {"attribution":"© OpenStreetMap contributors","license":"ODbL 1.0",
                "source":"https://download.geofabrik.de/asia/vietnam.html",
                "sourceSha256":digest,"roadSnapshot":index.get("osmTimestamp")}
    content += "  metadata: "+compact(metadata)+",\n  entries: [\n"
    content += ",\n".join("    "+compact(row) for row in rows)
    content += """
  ].map(([ref,name,province,locality,kind,lon,lat,startLon,startLat,approachMeters,region])=>({
    id:'osm-'+ref.replace('/','-'),name,province,city:province,locality,region,kind,lon,lat,
    start:[startLon,startLat],approachMeters,map:'https://www.openstreetmap.org/'+ref
  }))
};
"""
    args.output.write_text(content,encoding="utf8")
