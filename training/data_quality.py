"""Taxon matching and leakage checks, independent of TensorFlow."""
from __future__ import annotations
import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import asdict

CACHE_VERSION = 3

def exact_taxon(results: list[dict], latin: str) -> int | None:
    target = latin.strip().casefold()
    valid = [r for r in results if r.get('rank') == 'species' and r.get('is_active', True)
             and r.get('iconic_taxon_name') == 'Fungi']
    for field in ('name', 'matched_term'):
        matches = [r for r in valid if str(r.get(field, '')).strip().casefold() == target]
        ids = {r['id'] for r in matches}
        if len(ids) == 1:
            return next(iter(ids))
    return None

def cache_identity(params: dict, limit: int, photos_per_obs: int, licenses: set[str]) -> str:
    return hashlib.sha256(json.dumps({'version': CACHE_VERSION, 'query': params, 'limit': limit,
        'photosPerObservation': photos_per_obs, 'licenses': sorted(licenses)}, sort_keys=True).encode()).hexdigest()[:20]

def curate_rows(rows):
    """Remove conflicting labels and duplicated photos/content across splits before training."""
    by_content = defaultdict(list)
    for r in rows:
        key = r.image_sha256 or 'photo:' + r.photo_id
        by_content[key].append(r)
    kept, conflicts, duplicates = [], [], 0
    seen_photos = {}
    for group in by_content.values():
        if len({r.label for r in group}) > 1:
            conflicts.append({'labels': sorted({r.label for r in group}), 'photos': [r.photo_id for r in group]})
            continue
        # Deterministic choice: all reruns preserve the same split and provenance.
        group.sort(key=lambda r: (r.observation_id, r.photo_id))
        r = group[0]
        if r.photo_id in seen_photos:
            duplicates += len(group)
            continue
        seen_photos[r.photo_id] = r.label
        kept.append(r)
        duplicates += len(group) - 1
    # A repeated photo identifier with different content/labels must also be removed entirely.
    labels_by_photo = defaultdict(set)
    for r in rows: labels_by_photo[r.photo_id].add(r.label)
    ambiguous = {p for p, labels in labels_by_photo.items() if len(labels) > 1}
    kept = sorted((r for r in kept if r.photo_id not in ambiguous), key=lambda r: (r.label, r.photo_id))
    return kept, {'duplicatesRemoved': duplicates, 'conflictingContent': conflicts, 'conflictingPhotoIds': sorted(ambiguous)}

def dataset_fingerprint(rows) -> str:
    payload = [asdict(r) for r in sorted(rows, key=lambda r: (r.label, r.photo_id))]
    return hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def audit_rows(rows):
    observations = defaultdict(set)
    photos, content = set(), set()
    for r in rows:
        observations[r.observation_id].add(r.split)
        if r.photo_id in photos or (r.image_sha256 and r.image_sha256 in content):
            raise ValueError('Duplicated photo in manifest; curate the dataset before training')
        photos.add(r.photo_id)
        if r.image_sha256: content.add(r.image_sha256)
    if any(len(splits) > 1 for splits in observations.values()):
        raise ValueError('Photographs from one observation cross dataset splits')

def dataset_summary(rows, species):
    counts = defaultdict(Counter)
    for r in rows: counts[r.label][r.split] += 1
    return {'fingerprint': dataset_fingerprint(rows), 'images': len(rows),
        'observations': len({r.observation_id for r in rows}),
        'perClass': {label: dict(c) for label, c in sorted(counts.items())},
        'withoutPhotos': [s['id'] for s in species if not counts[s['id']]]}
