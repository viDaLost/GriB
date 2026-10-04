import { identify, type DecisionPolicy } from '../app/src/ml/decision.ts';
import { isDangerous } from '../app/src/data/types.ts';
import { db } from '../app/test/loadDb.ts';

export interface Predictions {
  labels: string[];
  policy?: DecisionPolicy;
  split?: string;
  samples: { truth: string; probabilities: number[] }[];
}

export function evaluateDecisions(data: Predictions, policy = data.policy) {
  let dangerous = 0, unwarnedConfidentEdible = 0, unknown = 0, unknownAsConfident = 0;
  let known = 0, confidentKnown = 0, correctConfidentKnown = 0;
  for (const sample of data.samples) {
    const results = [undefined, ...Array.from({ length: 12 }, (_, i) => i + 1)]
      .map(month => identify(sample.probabilities, data.labels, db, {
        month, policy, safetyOutput: sample.probabilities,
      }));
    const confident = results.filter(r => r.verdict === 'confident');
    const species = db.get(sample.truth);
    if (species) {
      known++;
      if (confident.length) {
        confidentKnown++;
        if (confident.every(r => r.candidates[0]?.species.id === sample.truth)) correctConfidentKnown++;
      }
    }
    if (species && isDangerous(species.edibility)) {
      dangerous++;
      if (confident.some(result => {
        const top = result.candidates[0]?.species;
        const warned = result.dangerousCandidates.some(c => c.species.id === sample.truth)
          || result.dangerousLookalikes.some(s => s.id === sample.truth);
        return top && ['edible', 'conditionally_edible'].includes(top.edibility) && !warned;
      })) unwarnedConfidentEdible++;
    }
    if (sample.truth === '__other_fungus__' || sample.truth === '__not_mushroom__') {
      unknown++;
      if (confident.length) unknownAsConfident++;
    }
  }
  return { dangerous, unwarnedConfidentEdible,
    unwarnedConfidentEdibleRate: dangerous ? unwarnedConfidentEdible / dangerous : 0,
    unknown, unknownAsConfident, unknownAsConfidentRate: unknown ? unknownAsConfident / unknown : 0,
    known, confidentKnown, correctConfidentKnown,
    knownConfidentRate: known ? confidentKnown / known : 0,
    confidentKnownAccuracy: confidentKnown ? correctConfidentKnown / confidentKnown : 0 };
}
