"""Refresh verified references and architectural tags for the existing OSM atlas."""
import argparse
from collections import defaultdict
import json
import math
from pathlib import Path
import re
import subprocess
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]


def get(url):
    request = Request(url, headers={'User-Agent':'VietnamDrivingSimulator/1.0 (offline visitor atlas)'})
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def batches(items, size):
    for start in range(0,len(items),size):
        yield items[start:start+size]


def read_tags(ids, pbf):
    if pbf:
        import osmium
        wanted=set(ids)
        from shapely import from_wkb
        named=osmium.filter.KeyFilter("name","name:vi")
        factory=osmium.geom.WKBFactory()
        for obj in osmium.FileProcessor(pbf).with_locations().with_areas(named).with_filter(named):
            if obj.is_area() and obj.from_way():
                continue
            kind="way" if obj.is_way() else "node" if obj.is_node() else "relation"
            number=obj.orig_id() if obj.is_area() else obj.id
            ref=f"osm-{kind}-{number}"
            if ref in wanted:
                bounds=None
                if obj.is_area():
                    bounds=from_wkb(factory.create_multipolygon(obj)).bounds
                elif obj.is_way():
                    coords=[(n.lon,n.lat) for n in obj.nodes if n.location.valid()]
                    if len(coords)>1:
                        xs,ys=zip(*coords)
                        bounds=min(xs),min(ys),max(xs),max(ys)
                yield ref,dict(obj.tags),bounds
        return
    grouped = defaultdict(list)
    for ref in ids:
        _,kind,num = ref.split('-')
        grouped[kind].append(num)
    for kind, numbers in grouped.items():
        for part in batches(numbers, 140):
            url = f'https://api.openstreetmap.org/api/0.6/{kind}s.json?{kind}s='+','.join(part)
            for element in get(url)['elements']:
                yield f"osm-{kind}-{element['id']}", element.get('tags',{}),None


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pbf",nargs="?",type=Path)
    args=parser.parse_args()
    extract = "global.window=global;require('./dist/tourism-catalog.js');console.log(JSON.stringify(VietnamTourism.entries.map(s=>s.id)))"
    ids = json.loads(subprocess.check_output(['node','-e',extract],cwd=ROOT))
    details, entities = {}, defaultdict(list)
    for ref,tags,bounds in read_tags(ids,args.pbf):
        record = details.get(ref,{})
        if bounds:
            west,south,east,north=bounds
            ew=round((east-west)*111320*math.cos(math.radians((south+north)/2)))
            ns=round((north-south)*110900)
            if max(ew,ns)>2:
                record['extent']=[max(1,ew),max(1,ns)]
        year=tags.get('start_date','')
        if re.fullmatch(r'[1-2]\d{3}',year):
            record['start_date']=year
        architect=tags.get('architect')
        if architect and len(architect)<=130:
            record['architect']=architect
        for key in ('building','roof:shape','roof:colour','roof:material','roof:height','building:colour','building:material','religion','height','denomination'):
            if tags.get(key):record[key] = tags[key]
        commons = tags.get('wikimedia_commons','')
        if commons.startswith(('Category:', 'File:')):
            record['photo'] = 'https://commons.wikimedia.org/wiki/'+quote(commons.replace(' ','_'),safe=':_')
        wd = tags.get('wikidata','')
        if re.fullmatch(r'Q\d+',wd) and ref not in entities[wd]:entities[wd].append(ref)
        if record:details[ref] = record
    for part in batches(sorted(entities), 40):
        query = urlencode({'action':'wbgetentities','ids':'|'.join(part),'props':'claims','format':'json'})
        for ident, entity in get('https://www.wikidata.org/w/api.php?'+query)['entities'].items():
            statements = [s for s in entity.get('claims',{}).get('P18',[]) if s.get('rank')!='deprecated']
            statements.sort(key=lambda s:s.get('rank')!='preferred')
            for statement in statements:
                name = statement['mainsnak'].get('datavalue',{}).get('value')
                if not isinstance(name,str):continue
                href='https://commons.wikimedia.org/wiki/File:'+quote(name.replace(' ','_'),safe='_')
                for ref in entities[ident]:details.setdefault(ref,{})['photo']=href
                break
    output="'use strict';\nwindow.VietnamSightDetails="+json.dumps(details,ensure_ascii=False,separators=(',',':'),sort_keys=True)+";\n"
    (ROOT/'dist'/'sight-details.js').write_text(output,encoding='utf8')
    print(len(details),'tagged sites,',sum('photo' in v for v in details.values()),'photo references')


if __name__ == '__main__':
    main()
