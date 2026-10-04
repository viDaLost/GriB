import { readFileSync, writeFileSync } from 'node:fs';
import { evaluateDecisions, type Predictions } from './decision_metrics.ts';
import type { DecisionPolicy } from '../app/src/ml/decision.ts';

const data = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Predictions;
if (data.split !== 'val') throw new Error('Confidence rules may only be fitted on validation photos');

// Predeclared validation targets leave room for variation on the held-out test.
// Coverage and selective accuracy prevent passing by suppressing every answer.
const targets = { dangerousRate: .005, unknownRate: .08, knownCoverage: .2, knownAccuracy: .9 };
const trials = [];
let selected: { policy: DecisionPolicy; metrics: ReturnType<typeof evaluateDecisions> } | null = null;
for (let step = 70; step <= 95; step++) {
  const policy = { confident: step / 100, allowConfident: true };
  const metrics = evaluateDecisions(data, policy);
  trials.push({ policy, metrics });
  if (metrics.dangerous >= 200 && metrics.unknown >= 200
    && metrics.unwarnedConfidentEdibleRate <= targets.dangerousRate
    && metrics.unknownAsConfidentRate <= targets.unknownRate
    && metrics.knownConfidentRate >= targets.knownCoverage
    && metrics.confidentKnownAccuracy >= targets.knownAccuracy) {
    selected = { policy, metrics };
    break;
  }
}
if (!selected) throw new Error('No confidence policy meets validation safety, coverage and accuracy targets');
writeFileSync(process.argv[3]!, JSON.stringify({ ...selected, split: 'val', targets, trials }, null, 2));
console.log(JSON.stringify(selected));
