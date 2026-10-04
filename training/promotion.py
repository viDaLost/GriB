"""Metrics and publication rules evaluated once on an observation-level holdout."""
import numpy as np
from common import SERVICE_LABELS, load_species

def summarize(probabilities, rows, labels, temperature=1.0):
    from calibration import apply_temperature, expected_calibration_error
    p = apply_temperature(probabilities, temperature)
    index = {label: i for i, label in enumerate(labels)}
    y = np.array([index[r.label] for r in rows])
    ranked = np.argsort(-p, axis=1)
    correct = ranked[:, 0] == y
    per_class = {}
    kinds = {s['id']: s['edibility'] for s in load_species()}
    misses = []
    for i, r in enumerate(rows):
        stat = per_class.setdefault(r.label, {'n': 0, 'correct': 0})
        stat['n'] += 1; stat['correct'] += int(correct[i])
        prediction = labels[ranked[i, 0]]
        if (kinds.get(r.label) in {'poisonous', 'deadly'}
            and kinds.get(prediction) in {'edible', 'conditionally_edible'} and p[i].max() >= .7):
            misses.append({'true': r.label, 'predicted': prediction, 'confidence': round(float(p[i].max()), 3), 'photo': r.path})
    for stat in per_class.values(): stat['recall'] = round(stat['correct'] / stat['n'], 4)
    return {'top1': round(float(correct.mean()), 4),
            'top3': round(float(np.mean([y[i] in ranked[i, :3] for i in range(len(y))])), 4),
            'macroRecall': round(float(np.mean([s['recall'] for s in per_class.values()])), 4),
            'testImages': len(rows), 'perClass': per_class, 'eceAfter': expected_calibration_error(p, y),
            'dangerousConfidentMisses': misses}, p

def publication_reasons(candidate, baseline, overlap, labels, baseline_labels):
    reasons = []
    if candidate['testImages'] < 1000: reasons.append('Fewer than 1000 held-out photographs')
    for metric, minimum in [('top1', .75), ('top3', .90), ('macroRecall', .65)]:
        if candidate[metric] < minimum: reasons.append(f'{metric} below {minimum}')
    new_species = set(labels) - set(SERVICE_LABELS)
    previous_species = set(baseline_labels) - set(SERVICE_LABELS)
    if not set(SERVICE_LABELS) <= set(labels): reasons.append('Missing refusal classes')
    if not previous_species <= new_species: reasons.append('Previously supported species are missing')
    if len(new_species) < len(previous_species) + 10: reasons.append('Fewer than 10 additional trained species')
    if overlap['testImages'] < 1000: reasons.append('Too few shared holdout photographs for comparison')
    for metric, tolerance in [('top1', .01), ('top3', .01), ('macroRecall', .02)]:
        if overlap[metric] + tolerance < baseline[metric]: reasons.append(f'Shared-species {metric} regressed')
    if overlap['eceAfter'] > baseline['eceAfter'] + .01: reasons.append('Calibration regressed')
    for key in ['unwarnedConfidentEdibleRate', 'unknownAsConfidentRate']:
        if overlap['decisions'][key] > baseline['decisions'][key]: reasons.append(f'Application {key} regressed')
    if candidate['decisions']['dangerous'] < 200: reasons.append('Too few dangerous holdout photographs')
    if candidate['decisions'].get('unknown', 0) < 200: reasons.append('Too few unknown/non-mushroom holdout photographs')
    if candidate['decisions']['unknownAsConfidentRate'] > .1: reasons.append('Too many confident answers on unknown/non-mushroom images')
    if candidate['decisions']['unwarnedConfidentEdibleRate'] > .01:
        reasons.append('More than 1% of dangerous holdout images confidently misidentified without the correct warning')
    for s in load_species():
        stat = candidate['perClass'].get(s['id'], {})
        if s['edibility'] == 'deadly' and stat.get('n', 0) >= 20 and stat.get('recall', 0) < .5:
            reasons.append(f"Low recall for deadly species {s['id']}")
    return reasons
