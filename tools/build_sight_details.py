"""Refresh verified references and architectural tags for the existing OSM atlas."""
from collections import defaultdict
import json
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


def main():
    extract = "global.window=global;require('./dist/tourism-catalog.js');console.log(JSON.stringify(VietnamTourism.entries.map(s=>s.id)))"
    ids = json.loads(subprocess.check_output(['node','-e',extract],cwd=ROOT))
    grouped = defaultdict(list)
    for ref in ids:
        _,kind,num = ref.split('-')
        grouped[kind].append(num)
    details, entities = {}, defaultdict(list)
    for kind, numbers in grouped.items():
        for part in batches(numbers, 140):
            url = f'https://api.openstreetmap.org/api/0.6/{kind}s.json?{kind}s='+','.join(part)
            for element in get(url)['elements']:
                tags = element.get('tags',{})
                ref = f"osm-{kind}-{element['id']}"
                record = {}
                for key in ('building','roof:shape','roof:colour','building:colour','building:material','religion','height'):
                    if tags.get(key):record[key] = tags[key]
                commons = tags.get('wikimedia_commons','')
                if commons.startswith(('Category:', 'File:')):
                    record['photo'] = 'https://commons.wikimedia.org/wiki/'+quote(commons.replace(' ','_'),safe=':_')
                wd = tags.get('wikidata','')
                if re.fullmatch(r'Q\d+',wd):entities[wd].append(ref)
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
