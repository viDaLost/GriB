"""Скачивание фото для обучения с iNaturalist.

Берутся только наблюдения исследовательского уровня (вид подтверждён сообществом)
и только фото со свободными лицензиями. Авторство каждого фото сохраняется в
data/manifest.csv.

Пример:
    python download_inat.py --per-species 400
    python download_inat.py --only boletus-edulis amanita-phalloides
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

from data_quality import CACHE_VERSION, cache_identity, curate_rows, dataset_summary, exact_taxon

from common import (
    CACHE,
    DATA,
    NOT_MUSHROOM,
    OTHER_FUNGUS,
    RAW,
    ROOT,
    Row,
    load_species,
    split_for,
    write_manifest,
)

API = "https://api.inaturalist.org/v1"
USER_AGENT = "gribnik-training/0.1 (offline mushroom guide; research use)"
# iNaturalist просит не чаще ~1 запроса в секунду к API.
API_DELAY = 1.1

# Иконические таксоны iNaturalist для класса «не гриб»: растения, насекомые, моллюски.
NOT_MUSHROOM_TAXA = [47126, 47158, 47115]
FUNGI_TAXON = 47170

session = requests.Session()
session.headers["User-Agent"] = USER_AGENT
_last_call = 0.0


def api_get(path: str, params: dict) -> dict:
    global _last_call
    wait = API_DELAY - (time.monotonic() - _last_call)
    if wait > 0:
        time.sleep(wait)
    for attempt in range(5):
        _last_call = time.monotonic()
        try:
            r = session.get(f"{API}{path}", params=params, timeout=60)
            if r.status_code == 429 or r.status_code >= 500:
                raise requests.HTTPError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            delay = 5 * 2**attempt
            print(f"  ! {path}: {e}, повтор через {delay} с", file=sys.stderr)
            time.sleep(delay)
    raise RuntimeError(f"Не удалось получить {path} {params}")


def resolve_taxon(latin: str) -> int | None:
    """id вида в iNaturalist; синонимы iNaturalist сам сводит к принятому названию."""
    res = api_get("/taxa", {"q": latin, "rank": "species", "per_page": 30})["results"]
    tid = exact_taxon(res, latin)
    if tid is not None:
        return tid
    # Accept only an exact scientific synonym explicitly listed on an active
    # species record. Never infer a match from a shared genus or name prefix.
    detailed = []
    for candidate in res:
        if (candidate.get('rank') == 'species' and candidate.get('is_active')
            and candidate.get('iconic_taxon_name') == 'Fungi'):
            detailed.extend(api_get(f"/taxa/{candidate['id']}", {'all_names': 'true'})['results'])
    return exact_taxon(detailed, latin)


def collect_photos(
    params: dict, limit: int, photos_per_obs: int, licenses: set[str]
) -> list[dict]:
    """Фото из наблюдений, по убыванию id, с ограничением фото на одно наблюдение."""
    photos: list[dict] = []
    id_below = None
    while len(photos) < limit:
        q = {
            **params,
            "quality_grade": "research",
            "photos": "true",
            "photo_license": ",".join(sorted(licenses)),
            "per_page": 200,
            "order_by": "id",
            "order": "desc",
        }
        if id_below:
            q["id_below"] = id_below
        results = api_get("/observations", q)["results"]
        if not results:
            break
        for obs in results:
            taxon = obs.get('taxon') or {}
            wanted = params.get('taxon_id')
            if obs.get('quality_grade') != 'research':
                continue
            if wanted != FUNGI_TAXON and wanted not in NOT_MUSHROOM_TAXA:
                if taxon.get('rank') not in {'species', 'subspecies', 'variety', 'form'}:
                    continue
                if taxon.get('id') != wanted and wanted not in taxon.get('ancestor_ids', []):
                    continue
            taken = 0
            for p in obs.get("photos", []):
                lic = (p.get("license_code") or "").lower()
                url = p.get("url") or ""
                if lic not in licenses or not url:
                    continue
                photos.append(
                    {
                        "observation_id": str(obs["id"]),
                        "photo_id": str(p["id"]),
                        "license": lic,
                        "attribution": p.get("attribution", ""),
                        "url": url.replace("/square.", "/medium."),
                        "taxon_id": str(taxon.get('id', '')),
                        "observed_on": obs.get('observed_on') or '',
                        "observer_id": str((obs.get('user') or {}).get('id', '')),
                        "place": obs.get('place_guess') or '',
                        "source_quality": obs.get('quality_grade') or '',
                    }
                )
                taken += 1
                if taken >= photos_per_obs or len(photos) >= limit:
                    break
            if len(photos) >= limit:
                break
        id_below = results[-1]["id"]
    return photos


def download(label: str, photo: dict) -> Row | None:
    path = RAW / label / f"{photo['photo_id']}.jpg"
    if not path.exists():
        try:
            r = session.get(photo["url"], timeout=60)
            r.raise_for_status()
            img = Image.open(BytesIO(r.content)).convert("RGB")
            if min(img.size) < 96:
                return None
            path.parent.mkdir(parents=True, exist_ok=True)
            img.thumbnail((384, 384), Image.Resampling.LANCZOS)
            img.save(path, "JPEG", quality=90)
        except Exception as e:  # битые и недоступные фото просто пропускаем
            print(f"  ! {photo['url']}: {e}", file=sys.stderr)
            return None
    return Row(
        label=label,
        path=os.path.relpath(path, ROOT),
        observation_id=photo["observation_id"],
        photo_id=photo["photo_id"],
        license=photo["license"],
        attribution=photo["attribution"],
        url=photo["url"],
        split=split_for(photo["observation_id"]),
        taxon_id=photo.get('taxon_id', ''), observed_on=photo.get('observed_on', ''),
        observer_id=photo.get('observer_id', ''), place=photo.get('place', ''),
        source_quality=photo.get('source_quality', ''),
        image_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
    )


def cached(name: str, fn):
    """Список фото для метки кешируется — повторный запуск только докачивает файлы."""
    path = CACHE / f"{name}.json"
    if path.exists():
        saved = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(saved, dict) and saved.get('version') == CACHE_VERSION:
            return saved['value']
    value = fn()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({'version': CACHE_VERSION, 'value': value}, ensure_ascii=False), encoding="utf-8")
    return value


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--per-species", type=int, default=400, help="максимум фото на вид")
    ap.add_argument("--priority-multiplier", type=float, default=1.5, help="больше фото ядовитых видов и двух рыжиков")
    ap.add_argument("--photos-per-obs", type=int, default=2, help="максимум фото с одного наблюдения")
    ap.add_argument("--service-images", type=int, default=3000, help="фото на каждый служебный класс")
    ap.add_argument("--licenses", default="cc0,cc-by,cc-by-nc", help="разрешённые лицензии фото")
    ap.add_argument("--workers", type=int, default=8, help="параллельных загрузок")
    ap.add_argument("--only", nargs="*", help="скачать только эти id видов")
    args = ap.parse_args()
    licenses = {x.strip().lower() for x in args.licenses.split(",")}
    if args.per_species < 1 or args.photos_per_obs < 1 or args.priority_multiplier < 1:
        ap.error('Количество фото должно быть положительным, множитель — не меньше 1.')

    species = load_species()
    if args.only:
        species = [s for s in species if s["id"] in set(args.only)]

    jobs: list[tuple[str, dict]] = []
    taxonomy_key = 'taxa-' + hashlib.sha256(json.dumps([(s['id'], s['latin']) for s in species]).encode()).hexdigest()[:20]
    taxon_ids: dict[str, int] = cached(taxonomy_key, lambda: {})
    aliases = {}
    used_taxa = {}
    for s in tqdm(species, desc="Поиск фото по видам"):
        if s["id"] not in taxon_ids:
            tid = resolve_taxon(s["latin"])
            if tid is None:
                print(f"  ! {s['latin']} не найден в iNaturalist — пропускаю", file=sys.stderr)
                continue
            taxon_ids[s["id"]] = tid
            (CACHE / f'{taxonomy_key}.json').write_text(json.dumps({'version': CACHE_VERSION, 'value': taxon_ids}), encoding='utf-8')
        tid = taxon_ids[s['id']]
        if tid in used_taxa:
            aliases[s['id']] = used_taxa[tid]
            print(f"  ! {s['latin']}: тот же таксон, что {used_taxa[tid]}; отдельный класс не обучаем")
            continue
        used_taxa[tid] = s['id']
        priority = s['edibility'] in {'poisonous', 'deadly'} or s['id'] in {'lactarius-deliciosus', 'lactarius-deterrimus'}
        limit = int(args.per_species * (args.priority_multiplier if priority else 1))
        photos = cached(
            s['id'] + '-' + cache_identity({'taxon_id': tid}, limit, args.photos_per_obs, licenses),
            lambda: collect_photos({"taxon_id": tid}, limit, args.photos_per_obs, licenses),
        )
        jobs += [(s["id"], p) for p in photos]

    if not args.only:
        per_taxon = args.service_images // len(NOT_MUSHROOM_TAXA)
        for t in NOT_MUSHROOM_TAXA:
            photos = cached(NOT_MUSHROOM + '-' + cache_identity({'taxon_id': t}, per_taxon, 1, licenses), lambda: collect_photos({"taxon_id": t}, per_taxon, 1, licenses))
            jobs += [(NOT_MUSHROOM, p) for p in photos]
        exclude = ",".join(str(v) for v in sorted(taxon_ids.values()))
        # Список зависит от набора видов: добавленный вид не должен попасть в «прочие грибы».
        photos = cached(
            OTHER_FUNGUS + '-' + cache_identity({'taxon_id': FUNGI_TAXON, 'without_taxon_id': exclude}, args.service_images, 1, licenses),
            lambda: collect_photos(
                {"taxon_id": FUNGI_TAXON, "without_taxon_id": exclude}, args.service_images, 1, licenses
            ),
        )
        jobs += [(OTHER_FUNGUS, p) for p in photos]

    rows: list[Row] = []
    with ThreadPoolExecutor(args.workers) as pool:
        for row in tqdm(pool.map(lambda j: download(*j), jobs), total=len(jobs), desc="Загрузка фото"):
            if row:
                rows.append(row)

    rows, curation = curate_rows(rows)
    write_manifest(rows)
    summary = {**dataset_summary(rows, species), **curation, 'taxonAliases': aliases,
               'requestedPerSpecies': args.per_species, 'priorityMultiplier': args.priority_multiplier,
               'licenses': sorted(licenses)}
    (DATA / 'dataset-report.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    counts: dict[str, int] = {}
    for r in rows:
        counts[r.label] = counts.get(r.label, 0) + 1
    print(f"\nГотово: {len(rows)} фото, {len(counts)} классов → {Path('data/manifest.csv')}")
    for label, n in sorted(counts.items(), key=lambda x: x[1]):
        if n < 50:
            print(f"  мало фото: {label} — {n}")


if __name__ == "__main__":
    main()
