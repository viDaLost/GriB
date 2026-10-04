"""Select abstention rules using the saved validation set, never holdout errors."""
import json
import subprocess

import numpy as np

from calibration import apply_temperature
from common import MODELS, ROOT, read_manifest
from data_quality import audit_rows, dataset_fingerprint


def main():
    report = json.loads((MODELS / 'report.json').read_text())
    labels = json.loads((MODELS / 'labels.json').read_text())
    rows = [r for r in read_manifest() if r.label in labels]
    audit_rows(rows)
    if dataset_fingerprint(rows) != report['datasetFingerprint']:
        raise ValueError('Validation dataset differs from the trained model')
    validation = [r for r in rows if r.split == 'val']
    calibration = report.get('validationCalibration', {})
    if (calibration.get('preprocessing') != 'application-central-crop-bilinear'
            or calibration.get('images') != len(validation)
            or calibration.get('temperature') != report.get('temperature')):
        raise ValueError('Saved validation calibration is missing or incompatible')
    with np.load(MODELS / 'validation-predictions.npz', allow_pickle=False) as saved:
        if (saved['labels'].tolist() != labels
                or saved['truth'].tolist() != [r.label for r in validation]
                or saved['observation_ids'].tolist() != [r.observation_id for r in validation]):
            raise ValueError('Saved calibration predictions do not match validation observations')
        raw = saved['probabilities']
    if (raw.shape != (len(validation), len(labels)) or not np.isfinite(raw).all()
            or (raw < 0).any() or not np.allclose(raw.sum(axis=1), 1, atol=1e-4)):
        raise ValueError('Invalid validation predictions')
    probabilities = apply_temperature(raw, report['temperature'])
    source, result = MODELS / 'validation-policy-input.json', MODELS / 'decision-policy.json'
    source.write_text(json.dumps({'split': 'val', 'labels': labels, 'samples': [
        {'truth': r.label, 'probabilities': p.tolist()} for r, p in zip(validation, probabilities)]}))
    subprocess.run(['node', str(ROOT / 'fit_decision_policy.ts'), str(source), str(result)], check=True)
    source.unlink()
    selected = json.loads(result.read_text())
    report['decisionPolicy'] = selected['policy']
    report['validationDecisionPolicy'] = selected
    (MODELS / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
