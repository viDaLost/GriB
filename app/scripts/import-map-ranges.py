#!/usr/bin/env python3
"""Extract regional reports (not point locations) from Bolshakov et al. 2021.
Usage: python scripts/import-map-ranges.py SUPPLEMENT.pdf ADMIN1.geojson
Requires pdftotext. Natural Earth admin-1 geometry is public domain.
Only exact accepted species headings from Appendix A are used; no synonyms inferred.
"""
import json, math, re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
NAMES = '''AL=Altai Republic;PSK=Pskov Oblast;KDA=Krasnodar Krai;KC=Karachay-Cherkess Republic;KB=Kabardino-Balkarian Republic;SE=North Ossetia;IN=Ingushetia;CE=Chechen Republic;DA=Dagestan;MUR=Murmansk Oblast;KR=Karelia;LEN=Leningrad Oblast;KGD=Kaliningrad Oblast;SMO=Smolensk Oblast;BRY=Bryansk Oblast;KRS=Kursk Oblast;BEL=Belgorod Oblast;VOR=Voronezh Oblast;ROS=Rostov Oblast;BU=Buryatia;TY=Tuva;ZAB=Zabaykalsky Krai;AMU=Amur Oblast;YEV=Jewish Autonomous Oblast;KHA=Khabarovsk Krai;PRI=Primorsky Krai;TYU=Tyumen Oblast;KGN=Kurgan Oblast;OMS=Omsk Oblast;NVS=Novosibirsk Oblast;CHE=Chelyabinsk Oblast;ALT=Altai Krai;ORE=Orenburg Oblast;SAR=Saratov Oblast;AST=Astrakhan Oblast;VGG=Volgograd Oblast;MAG=Magadan Oblast;SAK=Sakhalin Oblast;CHU=Chukotka Autonomous Okrug;YAN=Yamalo-Nenets Autonomous Okrug;NEN=Nenets Autonomous Okrug;SA=Sakha Republic;SPE=Saint Petersburg;ARK=Arkhangelsk Oblast;KYA=Krasnoyarsk Krai;KL=Kalmykia;KAM=Kamchatka Krai;BA=Bashkortostan;SVE=Sverdlovsk Oblast;KHM=Khanty-Mansi Autonomous Okrug;LIP=Lipetsk Oblast;TAM=Tambov Oblast;TOM=Tomsk Oblast;TA=Tatarstan;ULY=Ulyanovsk Oblast;PNZ=Penza Oblast;KEM=Kemerovo Oblast;ORL=Oryol Oblast;IRK=Irkutsk Oblast;KK=Khakassia;MO=Mordovia;KLU=Kaluga Oblast;KOS=Kostroma Oblast;YAR=Yaroslavl Oblast;VLA=Vladimir Oblast;RYA=Ryazan Oblast;IVA=Ivanovo Oblast;NIZ=Nizhny Novgorod Oblast;TUL=Tula Oblast;CU=Chuvash Republic;VLG=Vologda Oblast;NGR=Novgorod Oblast;TVE=Tver Oblast;MOW=Moscow Oblast;MOS=Moscow;ME=Mari El;KIR=Kirov Oblast;UD=Udmurt Republic;KO=Komi Republic;PER=Perm Krai;SAM=Samara Oblast;STA=Stavropol Krai;AD=Adygea'''
region_names = dict(x.split('=',1) for x in NAMES.split(';'))
if len(sys.argv) != 3:
    raise SystemExit(__doc__)
raw = subprocess.check_output(['pdftotext','-layout',sys.argv[1],'-']).decode()
if '10.21638/spbu03.2021.404' not in raw or 'Accepted current names' not in raw:
    raise SystemExit('Wrong supplement: expected Bolshakov et al. 2021, Appendix A')
# Keep the original PDF page indices for independently reviewing each species entry.
lines=[]; page_for=[]
for page, text in enumerate(raw.split('\f'), 1):
    if page >= 663: break
    for line in text.splitlines():
        if 'BIOLOGICAL COMMUNICATIONS' in line or 'https://doi.org/' in line: continue
        lines.append(line); page_for.append(page)
text='\n'.join(lines)
offsets=[]; offset=0
for i,line in enumerate(lines):
    m=re.match(r'^\s{3,}([A-Z][a-z]+ [a-z][a-z-]+) (?=[A-Z(])',line)
    if m: offsets.append((offset,m[1],page_for[i]))
    offset+=len(line)+1
species=[]
for f in ['dangerous','tubular','gilled','other']:
    species.extend(json.loads((ROOT/f'src/data/species/{f}.json').read_text()))
entries=[]
for s in species:
    if s.get('protected'): continue
    hits=[(i,x) for i,x in enumerate(offsets) if x[1]==s['latin']]
    if not hits: continue
    i, (_,name,page) = hits[0]
    block=text[offsets[i][0]:offsets[i+1][0] if i+1<len(offsets) else len(text)]
    normalized=re.sub(r'\s+',' ',block).replace('Karachay- Cherkess','Karachay-Cherkess').replace('Khanty- Mansi','Khanty-Mansi').replace('Yamalo-Nenets','Yamalo-Nenets')
    reports=[]
    for code, region in region_names.items():
        m=re.search(r'(?<![\w-])'+re.escape(region)+r' \(([^()]*)\)',normalized)
        if m:
            citations=re.sub(r'(?:(?<=; )|^)\d[\d,]*','',m[1])
            reports.append({'regionId':'RU-'+code,'references':citations})
    if reports: entries.append({'speciesId':s['id'],'page':page,'reports':reports})
# Ramer–Douglas–Peucker simplification in geographical degrees, preserves closed rings.
def simplify(points,eps):
    if len(points)<3: return points
    ax,ay=points[0]; bx,by=points[-1]; dx=bx-ax; dy=by-ay
    den=dx*dx+dy*dy
    distances=[]
    for x,y in points[1:-1]:
        t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/den)) if den else 0
        distances.append(math.hypot(x-ax-t*dx,y-ay-t*dy))
    best=max(distances,default=0)
    if best<=eps: return [points[0],points[-1]]
    idx=distances.index(best)+1
    return simplify(points[:idx+1],eps)[:-1]+simplify(points[idx:],eps)
def project(lon,lat):
    if lon<0:lon+=360
    return [(lon-19)/172*1000,(82-lat)/41*480]
regions=[]
for feature in json.loads(Path(sys.argv[2]).read_text())['features']:
    p=feature['properties']; code=p['iso_3166_2']
    if code not in {'RU-'+x for x in region_names}: continue
    polys=feature['geometry']['coordinates']
    if feature['geometry']['type']=='Polygon': polys=[polys]
    paths=[]; coords=[]
    for poly in polys:
        for ring in poly:
            points=[project(*xy[:2]) for xy in simplify(ring, .025)]
            if len(points)<4: continue
            coords+=points
            paths.append('M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in points)+' Z')
    if not coords: continue
    xs,ys=zip(*coords)
    name=p['name_ru'] or p['name']
    name={'RU-ALT':'Алтайский край','RU-MAG':'Магаданская область','RU-MOW':'Московская область','RU-MOS':'Москва'}.get(code,name)
    regions.append({'id':code,'name':name,'paths':paths,'bounds':[min(xs),min(ys),max(xs),max(ys)]})
if not entries or len(regions) < 80 or any(r['regionId'] not in {g['id'] for g in regions} for e in entries for r in e['reports']):
    raise SystemExit('Incomplete extraction; shipped snapshot was not replaced')
result={'source':{'title':'Bolshakov et al., 2021 · Checklist of agaricoid and boletoid fungi of Russia','url':'https://doi.org/10.21638/spbu03.2021.404','supplement':'https://biocomm.spbu.ru/article/download/7362/8648','year':2021,'method':'Exact accepted names in Appendix A; regional literature reports, not precise coordinates. Original bibliography and PDF page retained.'},'regions':regions,'entries':entries}
(ROOT/'src/data/map-ranges.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
print('Species:',len(entries),'regional reports:',sum(len(e['reports']) for e in entries),'regions:',len(regions))
for code in ['RU-STA','RU-KC']:
    print(code,[(next(s['nameRu'] for s in species if s['id']==e['speciesId']),e['page']) for e in entries if any(r['regionId']==code for r in e['reports'])])
