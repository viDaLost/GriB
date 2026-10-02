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
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

from common import (
    CACHE,
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
    target = latin.lower()
    for r in res:
        if r.get("name", "").lower() == target and r.get("is_active", True):
            return r["id"]
    for r in res:
        if (r.get("matched_term") or "").lower() == target:
            return r["id"]
    for r in res:
        if r.get("iconic_taxon_name") == "Fungi":
            print(f"  ? {latin}: точного совпадения нет, беру {r['name']}", file=sys.stderr)
            return r["id"]
    return None


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
            path.parent.mkdir(parents=True, exist_ok=True)
            img.save(path, "JPEG", quality=92)
        except Exception as e:  # битые и недоступные фото просто пропускаем
            print(f"  ! {photo['url']}: {e}", file=sys.stderr)
            return None
    return Row(
        label=label,
        path=str(path.relative_to(ROOT)),
        observation_id=photo["observation_id"],
        photo_id=photo["photo_id"],
        license=photo["license"],
        attribution=photo["attribution"],
        url=photo["url"],
        split=split_for(photo["observation_id"]),
    )


def cached(name: str, fn):
    """Список фото для метки кешируется — повторный запуск только докачивает файлы."""
    path = CACHE / f"{name}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    value = fn()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--per-species", type=int, default=400, help="максимум фото на вид")
    ap.add_argument("--photos-per-obs", type=int, default=2, help="максимум фото с одного наблюдения")
    ap.add_argument("--service-images", type=int, default=3000, help="фото на каждый служебный класс")
    ap.add_argument("--licenses", default="cc0,cc-by,cc-by-nc", help="разрешённые лицензии фото")
    ap.add_argument("--workers", type=int, default=8, help="параллельных загрузок")
    ap.add_argument("--only", nargs="*", help="скачать только эти id видов")
    args = ap.parse_args()
    licenses = {x.strip().lower() for x in args.licenses.split(",")}

    species = load_species()
    if args.only:
        species = [s for s in species if s["id"] in set(args.only)]

    jobs: list[tuple[str, dict]] = []
    taxon_ids: dict[str, int] = cached("taxa", lambda: {})
    for s in tqdm(species, desc="Поиск фото по видам"):
        if s["id"] not in taxon_ids:
            tid = resolve_taxon(s["latin"])
            if tid is None:
                print(f"  ! {s['latin']} не найден в iNaturalist — пропускаю", file=sys.stderr)
                continue
            taxon_ids[s["id"]] = tid
            (CACHE / "taxa.json").write_text(json.dumps(taxon_ids), encoding="utf-8")
        photos = cached(
            s["id"],
            lambda: collect_photos({"taxon_id": taxon_ids[s["id"]]}, args.per_species, args.photos_per_obs, licenses),
        )
        jobs += [(s["id"], p) for p in photos]

    if not args.only:
        per_taxon = args.service_images // len(NOT_MUSHROOM_TAXA)
        for t in NOT_MUSHROOM_TAXA:
            photos = cached(f"{NOT_MUSHROOM}-{t}", lambda: collect_photos({"taxon_id": t}, per_taxon, 1, licenses))
            jobs += [(NOT_MUSHROOM, p) for p in photos]
        exclude = ",".join(str(v) for v in taxon_ids.values())
        photos = cached(
            OTHER_FUNGUS,
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

    rows.sort(key=lambda r: (r.label, r.photo_id))
    write_manifest(rows)
    counts: dict[str, int] = {}
    for r in rows:
        counts[r.label] = counts.get(r.label, 0) + 1
    print(f"\nГотово: {len(rows)} фото, {len(counts)} классов → {Path('data/manifest.csv')}")
    for label, n in sorted(counts.items(), key=lambda x: x[1]):
        if n < 50:
            print(f"  мало фото: {label} — {n}")


if __name__ == "__main__":
    main()
