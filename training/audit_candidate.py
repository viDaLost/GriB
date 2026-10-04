"""Recompute saved holdout metrics and run the actual application warning logic.

This audit does not select a temperature or train on holdout predictions.
Keras/TFLite agreement here uses saved outputs; a fresh binary inference is
performed by export_tflite.py in the subsequent verification workflow.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import tempfile
from collections import Counter
from pathlib import Path

import numpy as np

from common import ROOT, Row, SERVICE_LABELS, split_for
from data_quality import audit_rows, dataset_fingerprint
from promotion import publication_reasons, summarize


def audit(directory: Path, source_run: int, expected_digest: str) -> dict:
    report = json.loads((directory / 'models/report.json').read_text())
    meta = json.loads((directory / 'models/candidate/model-meta.json').read_text())
    labels = json.loads((directory / 'models/labels.json').read_text())
    with (directory / 'data/manifest.csv').open(newline='') as source:
        rows = [Row(**r) for r in csv.DictReader(source)]
    audit_rows(rows)
    if any(r.split != split_for(r.observation_id) for r in rows):
        raise ValueError('Manifest does not match the observation split rule')
    selected = [r for r in rows if r.label in labels]
    if dataset_fingerprint(selected) != report['datasetFingerprint']:
        raise ValueError('Dataset fingerprint differs from the training report')
    test = [r for r in selected if r.split == 'test']
    with np.load(directory / 'models/holdout-predictions.npz', allow_pickle=False) as saved:
        probabilities, reference = saved['probabilities'], saved['reference']
        if labels != saved['labels'].tolist() or [r.label for r in test] != saved['truth'].tolist():
            raise ValueError('Saved predictions do not match manifest order or labels')
    if meta['labels'] != labels or report['labels'] != labels:
        raise ValueError('Metadata labels differ from predictions')
    for predictions in [probabilities, reference]:
        if (predictions.shape != (len(test), len(labels))
                or not np.isfinite(predictions).all()
                or (predictions < 0).any() or (predictions > 1).any()
                or not np.allclose(predictions.sum(axis=1), 1, atol=1e-4)):
            raise ValueError('Invalid probability tensor')
    computed, calibrated = summarize(probabilities, test, labels, meta['temperature'])
    for key in ['top1', 'top3', 'macroRecall', 'testImages', 'eceAfter', 'perClass']:
        if computed[key] != report[key]:
            raise ValueError(f'Independent metric differs from report: {key}')
    with tempfile.TemporaryDirectory() as temp:
        source, result = Path(temp) / 'input.json', Path(temp) / 'result.json'
        source.write_text(json.dumps({'labels': labels, 'samples': [
            {'truth': r.label, 'probabilities': p.tolist()} for r, p in zip(test, calibrated)]}))
        subprocess.run(['node', str(ROOT / 'evaluate_decisions.ts'), str(source), str(result)], check=True)
        decisions = json.loads(result.read_text())
    if decisions != report['decisions']:
        raise ValueError('Actual application warnings differ from the saved report')
    confidence, correct = calibrated.max(axis=1), calibrated.argmax(axis=1) == np.array([labels.index(r.label) for r in test])
    confidence_bins = []
    for lo in np.linspace(0, 1, 10, endpoint=False):
        mask = (confidence > lo) & (confidence <= lo + .1)
        if mask.any():
            confidence_bins.append({'lower': float(lo), 'upper': float(lo + .1), 'images': int(mask.sum()),
                                    'meanConfidence': round(float(confidence[mask].mean()), 4),
                                    'accuracy': round(float(correct[mask].mean()), 4)})
    promotion = report['promotion']
    reasons = publication_reasons(computed | {'decisions': decisions}, promotion['baseline'],
                                  promotion['candidateShared'], labels,
                                  json.loads((ROOT.parent / 'app/assets/model/model-meta.json').read_text())['labels'])
    pair_counts = Counter((m['true'], m['predicted']) for m in computed['dangerousConfidentMisses'])
    archive = directory / 'model.zip'
    with archive.open('rb') as source:
        checksum = hashlib.file_digest(source, 'sha256').hexdigest()
    if checksum != expected_digest:
        raise ValueError('Artifact archive checksum differs from GitHub digest')
    return {'sourceRun': source_run, 'artifactSha256': checksum,
            'artifactDigestMatchesGitHub': True,
            'dataset': {'images': len(rows), 'observations': len({r.observation_id for r in rows}),
                        'duplicatesOrCrossSplitObservations': 0, 'selectedSplits': dict(Counter(r.split for r in selected)),
                        'fingerprintMatches': True},
            'model': {'species': len(set(labels) - set(SERVICE_LABELS)), 'outputs': len(labels),
                      'top1': computed['top1'], 'top3': computed['top3'], 'macroRecall': computed['macroRecall'],
                      'testImages': len(test), 'ece': computed['eceAfter'],
                      'savedKerasTFLiteTop1Agreement': float((probabilities.argmax(axis=1) == reference.argmax(axis=1)).mean()),
                      'savedKerasTFLiteMaximumDifference': float(abs(probabilities - reference).max()),
                      'meanConfidence': round(float(confidence.mean()), 4)},
            'warningsCheckedForAllMonths': decisions,
            'dangerousConfidentMisses': {'total': len(computed['dangerousConfidentMisses']),
                                        'pairs': [{'truth': t, 'prediction': p, 'images': n} for (t, p), n in pair_counts.most_common()]},
            'confidenceBins': confidence_bins, 'perClass': computed['perClass'],
            'sharedComparisonFromOriginalWorkflow': {key: {k: v for k, v in promotion[key].items()
                if k not in {'perClass', 'dangerousConfidentMisses'}} for key in ['baseline', 'candidateShared']},
            'publication': {'passed': not reasons, 'reasons': reasons},
            'unsupportedSpecies': report['unsupportedSpecies'], 'limitedValidation': report['limitedValidation'],
            'limits': ['Saved prediction audit, not fresh image inference; fresh inference runs in CI.',
                       'No independent expert test set separated by photographer, region or year.',
                       'Only the central crop was measured; the application also averages zoomed/mirrored views.',
                       'Exact duplicate hashes are checked; near-duplicate photos may remain.',
                       'Observation-level holdout; results are not a safety guarantee.']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source-run', type=int, required=True)
    parser.add_argument('--expected-digest', required=True)
    args = parser.parse_args()
    result = audit(args.directory, args.source_run, args.expected_digest)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['dataset', 'model', 'warningsCheckedForAllMonths', 'publication']}, indent=2))
