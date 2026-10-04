"""Read a bounded existing-run request and verify provenance before rechecking."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from workflow_config import normalize


def source_run(request):
    value = request.get('source_run')
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 10**14:
        raise ValueError('source_run must be a positive integer GitHub run ID')
    return value


def check_source_run(run):
    if (run.get('repository', {}).get('full_name', '').casefold() != 'vidalost/grib'
            or run.get('path', '').split('@')[0] != '.github/workflows/train.yml'
            or run.get('head_branch') != 'main' or run.get('event') != 'push'
            or run.get('status') != 'completed'
            or not re.fullmatch('[0-9a-f]{40}', run.get('head_sha', ''))):
        raise ValueError('Recheck requires a completed main/push Train model run in this repository')
    return run['head_sha']


def check_source_files(original: Path, current: Path):
    paths = [Path('app/assets/model/model-meta.json'), Path('app/assets/model/gribnik.tflite')]
    original_species = sorted((original / 'app/src/data/species').glob('*.json'))
    current_species = sorted((current / 'app/src/data/species').glob('*.json'))
    if [p.name for p in original_species] != [p.name for p in current_species]:
        raise ValueError('Species files changed since the source training run')
    paths += [p.relative_to(original) for p in original_species]
    for path in paths:
        if hashlib.sha256((original / path).read_bytes()).digest() != hashlib.sha256((current / path).read_bytes()).digest():
            raise ValueError(f'Baseline model or catalog changed since training: {path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--github-output', type=Path, required=True)
    parser.add_argument('--run-info', type=Path)
    parser.add_argument('--original', type=Path)
    args = parser.parse_args()
    if args.run_info:
        values = {'source_sha': check_source_run(json.loads(args.run_info.read_text()))}
    elif args.original:
        check_source_files(args.original, Path.cwd())
        values = normalize(json.loads((args.original / 'training/request.json').read_text()))
    else:
        values = {'source_run': source_run(json.loads(Path(__file__).with_name('recheck-request.json').read_text()))}
    with args.github_output.open('a') as output:
        for key, value in values.items():
            output.write(f'{key}={value}\n')
