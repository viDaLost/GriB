"""Validate a manual training request or the deliberately narrow push trigger."""
import argparse
import json
import os
from pathlib import Path

DEFAULTS = {'per_species': '1200', 'photos_per_obs': '2', 'service_images': '6000',
            'danger_weight': '2.0', 'epochs_head': '4', 'epochs_finetune': '20',
            'finetune_layers': '0', 'baseline_run': '37027955551'}
LIMITS = {'per_species': (100, 2000), 'photos_per_obs': (1, 3), 'service_images': (1000, 10000),
          'danger_weight': (1, 4), 'epochs_head': (1, 10), 'epochs_finetune': (1, 40),
          'finetune_layers': (0, 1000), 'baseline_run': (1, 10**14)}

def normalize(values):
    config = {**DEFAULTS, **{k: str(v) for k, v in values.items() if k in DEFAULTS and v != ''}}
    for k, (lo, hi) in LIMITS.items():
        number = float(config[k]) if k == 'danger_weight' else int(config[k])
        if not lo <= number <= hi:
            raise ValueError(f'{k}: allowed range is {lo}..{hi}')
        # Only normalized numbers reach shell commands; raw input is never interpolated.
        config[k] = str(number)
    return config

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--github-output', type=Path, required=True)
    args = ap.parse_args()
    if os.environ['GITHUB_EVENT_NAME'] == 'push':
        values = json.loads(Path(__file__).with_name('request.json').read_text())
    else:
        values = json.loads(os.environ.get('TRAIN_INPUTS', '{}'))
    config = normalize(values)
    with args.github_output.open('a') as f:
        for k, v in config.items(): f.write(f'{k}={v}\n')
    print(json.dumps(config, indent=2))

if __name__ == '__main__': main()
