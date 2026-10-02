"""Rebuild the offline map snapshot from an explicitly reviewed GBIF source allowlist.
Only catalogued preserved specimens, identified by a named person, are accepted.
The source identification is retained; this is not a claim of independent re-identification.
Run from app/: python scripts/import-map-records.py
"""
import concurrent.futures
import datetime
import json
from pathlib import Path
import urllib.parse
import urllib.request

APP = Path(__file__).resolve().parents[1]
SOURCES = [
    {'id': 'd922b606-6c94-4d51-9277-36c9b03872a7', 'name': 'Фунгарий Югорского государственного университета', 'code': 'YSU-F', 'license': 'CC BY 4.0', 'doi': '10.15468/g4bk6h'},
    {'id': 'd415c253-4d61-4459-9d25-4015b9084fb0', 'name': 'Гербарий Нью-Йоркского ботанического сада', 'code': 'NY', 'license': 'CC0 1.0', 'doi': '10.15468/6e8nje'},
]
SOURCE_IDS = {s['id'] for s in SOURCES}
BAD_ISSUES = {'ZERO_COORDINATE', 'COORDINATE_OUT_OF_RANGE', 'COUNTRY_COORDINATE_MISMATCH', 'COORDINATE_INVALID', 'TAXON_MATCH_FUZZY', 'TAXON_MATCH_HIGHERRANK', 'RECORDED_DATE_INVALID', 'RECORDED_DATE_UNLIKELY', 'PRESUMED_NEGATED_LATITUDE', 'PRESUMED_NEGATED_LONGITUDE'}

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Gribnik-reference-map/1.0'})
    with urllib.request.urlopen(req, timeout=40) as response:
        return json.load(response)

def fetch_species(species):
    if species.get('protected'):
        return []  # Do not expose localities of species already marked as protected.
    params = urllib.parse.urlencode({'country': 'RU', 'scientificName': species['latin'], 'basisOfRecord': 'PRESERVED_SPECIMEN', 'hasCoordinate': 'true', 'hasGeospatialIssue': 'false', 'limit': 300})
    data = get('https://api.gbif.org/v1/occurrence/search?' + params)
    records = []
    for r in data['results']:
        if r.get('datasetKey') not in SOURCE_IDS or r.get('basisOfRecord') != 'PRESERVED_SPECIMEN' or r.get('countryCode') != 'RU':
            continue
        if r.get('species') != species['latin'] or r.get('taxonRank') != 'SPECIES' or not r.get('identifiedBy') or not r.get('catalogNumber'):
            continue
        if r.get('occurrenceStatus') != 'PRESENT' or BAD_ISSUES.intersection(r.get('issues', [])):
            continue
        lat, lon = r.get('decimalLatitude'), r.get('decimalLongitude')
        if lat is None or lon is None or not (41 <= lat <= 82 and (19 <= lon <= 180 or -180 <= lon <= -169)):
            continue
        uncertainty = r.get('coordinateUncertaintyInMeters')
        if uncertainty is not None and (uncertainty < 0 or uncertainty > 5000):
            continue
        date = r.get('eventDate', '')
        try:
            datetime.date.fromisoformat(date[:10])
        except ValueError:
            continue
        if len(date) < 10 or '/' in date or date[:10] > datetime.date.today().isoformat():
            continue
        if r.get('informationWithheld') or r.get('dataGeneralizations'):
            continue
        records.append({'id': str(r['key']), 'speciesId': species['id'], 'datasetId': r['datasetKey'], 'latitude': lat, 'longitude': lon,
                        'date': date[:10], 'locality': r.get('locality') or r.get('stateProvince') or 'Местность не указана',
                        'region': r.get('stateProvince') or r.get('gadm', {}).get('level1', {}).get('name') or 'Регион не указан',
                        'identifiedBy': r['identifiedBy'], 'catalogNumber': r['catalogNumber'], 'uncertaintyMeters': uncertainty,
                        'basisOfRecord': 'PRESERVED_SPECIMEN', 'countryCode': 'RU'})
    return records

if __name__ == '__main__':
    species = []
    for name in ['tubular', 'gilled', 'other', 'dangerous']:
        species.extend(json.loads((APP / 'src/data/species' / f'{name}.json').read_text()))
    # Fail before replacing the shipped snapshot if an upstream request fails.
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        records = [r for group in pool.map(fetch_species, species) for r in group]
    unique = {r['id']: r for r in records}
    records = sorted(unique.values(), key=lambda r: (r['speciesId'], r['date'], r['id']))
    snapshot = {'updatedAt': datetime.date.today().isoformat(), 'sources': SOURCES, 'records': records,
                'method': 'Каталогизированные образцы научных коллекций; вид, определитель, дата и координаты указаны в исходной записи GBIF. Выборка неполная.'}
    (APP / 'src/data/map-records.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(records)} records, {len(set(r["speciesId"] for r in records))} species, {len(set(r["region"] for r in records))} regions')
